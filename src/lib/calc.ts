import type { Tables } from "@/integrations/supabase/types";

export type Evf = Tables<"evfs">;
export type Item = Tables<"itens_evf">;
export type Capitulo = Tables<"capitulos">;
export type Cotacao = Tables<"cotacoes">;
export type Ambiente = Tables<"ambientes">;
export type Medicao = Tables<"medicoes">;
export type Config = Tables<"configuracoes">;

export const TIPO_LABEL: Record<string, string> = {
  composicao: "Composição",
  cotacao: "Cotação",
  verba: "Verba",
};

const n = (v: unknown) => Number(v) || 0;

export function qtdEfetiva(i: Item) {
  return n(i.quantidade) * (1 + n(i.perda_pct) / 100);
}
export function itemTotais(i: Item) {
  const q = qtdEfetiva(i);
  const mat = q * n(i.material_unit);
  const mo = q * n(i.mo_unit);
  return { mat, mo, total: mat + mo };
}

export function compareCodigo(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
    const d = (pa[k] ?? -1) - (pb[k] ?? -1);
    if (d) return d;
  }
  return 0;
}

export function sortItens(itens: Item[]) {
  return [...itens].sort(
    (a, b) =>
      a.capitulo_codigo - b.capitulo_codigo ||
      a.ordem - b.ordem ||
      compareCodigo(a.codigo, b.codigo),
  );
}

export interface CapResumo {
  cap: Capitulo | undefined;
  codigo: number;
  nome: string;
  itens: Item[];
  mat: number;
  mo: number;
  total: number;
  taxaPct: number | null;
  taxa: number;
}

export function resumo(itens: Item[], caps: Capitulo[]) {
  const map = new Map<number, CapResumo>();
  for (const i of sortItens(itens)) {
    let r = map.get(i.capitulo_codigo);
    if (!r) {
      const cap = caps.find((c) => c.codigo === i.capitulo_codigo);
      r = {
        cap,
        codigo: i.capitulo_codigo,
        nome: cap?.nome ?? `Capítulo ${i.capitulo_codigo}`,
        itens: [],
        mat: 0,
        mo: 0,
        total: 0,
        taxaPct: cap?.taxa_adm_pct == null ? null : n(cap.taxa_adm_pct),
        taxa: 0,
      };
      map.set(i.capitulo_codigo, r);
    }
    const t = itemTotais(i);
    r.itens.push(i);
    r.mat += t.mat;
    r.mo += t.mo;
    r.total += t.total;
  }
  const capitulos = [...map.values()].sort(
    (a, b) => (a.cap?.ordem ?? 999) - (b.cap?.ordem ?? 999) || a.codigo - b.codigo,
  );
  for (const c of capitulos) c.taxa = c.total * ((c.taxaPct ?? 0) / 100);
  const direto = capitulos.reduce((s, c) => s + c.total, 0);
  const taxas = capitulos.reduce((s, c) => s + c.taxa, 0);
  const mat = capitulos.reduce((s, c) => s + c.mat, 0);
  const mo = capitulos.reduce((s, c) => s + c.mo, 0);
  return {
    capitulos,
    direto,
    taxas,
    mat,
    mo,
    geral: direto + taxas,
    taxaEfetiva: direto ? (taxas / direto) * 100 : 0,
  };
}

/** Filtro de ambiente: "" = todos, "geral" = itens sem ambiente (obra toda), ou o id do ambiente. */
export function filtrarPorAmbiente(itens: Item[], filtro: string) {
  if (!filtro) return itens;
  if (filtro === "geral") return itens.filter((i) => !i.ambiente_id);
  return itens.filter((i) => i.ambiente_id === filtro);
}

export interface LinhaAmbiente {
  id: string;
  nome: string;
  itens: number;
  mat: number;
  mo: number;
  direto: number;
  taxas: number;
  geral: number;
  /** Parte dos itens gerais distribuída para este ambiente (só com ratear). */
  rateio: number;
  /** Total com o rateio dos gerais. */
  final: number;
}

/**
 * Soma por ambiente. Itens sem ambiente (gestão, seguro, caçamba…) formam a linha "Itens gerais".
 * Com ratear, os gerais são distribuídos entre os ambientes na proporção do custo direto de cada um,
 * e a soma dos "final" continua igual ao total do EVF.
 */
export function porAmbiente(
  itens: Item[],
  caps: Capitulo[],
  ambientes: { id: string; nome: string }[],
  ratear = false,
): { linhas: LinhaAmbiente[]; geral: LinhaAmbiente | null; total: number } {
  const linha = (id: string, nome: string, its: Item[]): LinhaAmbiente => {
    const r = resumo(its, caps);
    return {
      id,
      nome,
      itens: its.length,
      mat: r.mat,
      mo: r.mo,
      direto: r.direto,
      taxas: r.taxas,
      geral: r.geral,
      rateio: 0,
      final: r.geral,
    };
  };
  const ids = new Set(ambientes.map((a) => a.id));
  const linhas = ambientes.map((a) =>
    linha(
      a.id,
      a.nome,
      itens.filter((i) => i.ambiente_id === a.id),
    ),
  );
  const soltos = itens.filter((i) => !i.ambiente_id || !ids.has(i.ambiente_id));
  const geral = soltos.length ? linha("geral", "Itens gerais (obra toda)", soltos) : null;
  const baseRateio = linhas.reduce((s, l) => s + l.direto, 0);
  if (ratear && geral && baseRateio > 0) {
    for (const l of linhas) {
      l.rateio = geral.geral * (l.direto / baseRateio);
      l.final = l.geral + l.rateio;
    }
  }
  const total =
    linhas.reduce((s, l) => s + l.final, 0) + (ratear && baseRateio > 0 ? 0 : (geral?.geral ?? 0));
  return { linhas, geral, total };
}

/** Soma por etapa (Agora × Etapa futura), com e sem a taxa do capítulo. */
export function porEtapa(itens: Item[], caps: Capitulo[]) {
  const agora = { direto: 0, geral: 0 };
  const futura = { direto: 0, geral: 0 };
  for (const i of itens) {
    const cap = caps.find((c) => c.codigo === i.capitulo_codigo);
    const t = itemTotais(i).total;
    const alvo = i.etapa === "Etapa futura" ? futura : agora;
    alvo.direto += t;
    alvo.geral += t * (1 + n(cap?.taxa_adm_pct) / 100);
  }
  return { agora, futura };
}

export function curvaABC(itens: Item[]) {
  const rows = itens
    .map((i) => ({ item: i, total: itemTotais(i).total }))
    .sort((a, b) => b.total - a.total);
  const soma = rows.reduce((s, r) => s + r.total, 0);
  let acc = 0;
  const out = rows.map((r) => {
    const pct = soma ? (r.total / soma) * 100 : 0;
    const primeiro = acc === 0;
    acc += pct;
    const a = Math.round(acc * 1e6) / 1e6;
    const classe = a <= 80 || primeiro ? "A" : a <= 95 ? "B" : "C";
    return { ...r, pct, acum: acc, classe };
  });
  const nA = out.filter((r) => r.classe === "A").length;
  return { rows: out, soma, nA };
}

export function valorCotacao(valores: number[], criterio: string) {
  const v = valores.filter((x) => x > 0);
  if (!v.length) return null;
  if (criterio === "menor") return Math.min(...v);
  if (criterio === "maior") return Math.max(...v);
  return v.reduce((s, x) => s + x, 0) / v.length;
}

export type TipoMedicao =
  "soma" | "vao" | "vao_area" | "soma_area" | "shaft_canto" | "shaft_parede";

/** Tipos lançados direto pela área (vão curvo, arco, forma irregular): a área fica em "largura". */
export const TIPOS_POR_AREA: TipoMedicao[] = ["vao_area", "soma_area"];

export function tipoMedicao(m: Pick<Medicao, "sinal"> & { tipo?: string | null }): TipoMedicao {
  const t = m.tipo;
  if (
    t === "soma" ||
    t === "vao" ||
    t === "vao_area" ||
    t === "soma_area" ||
    t === "shaft_canto" ||
    t === "shaft_parede"
  )
    return t;
  return m.sinal < 0 ? "vao" : "soma";
}

/**
 * Quanto cada linha de medição mexe no ambiente (m²):
 * - soma: entra no total de medições (trechos de parede, áreas irregulares)
 * - vão: sai das medições e das paredes (porta, janela)
 * - vão por área / trecho por área: a área em m² digitada direto (vão curvo, arco, forma irregular)
 * - shaft/pilar no canto: sai do piso e do teto; as faces do shaft substituem a parede escondida
 * - shaft/pilar no meio da parede: sai do piso e do teto e soma as duas laterais nas paredes
 */
export function efeitoMedicao(m: Medicao) {
  const l = n(m.largura),
    h = n(m.altura),
    p = n(m.profundidade),
    q = n(m.quantidade);
  switch (tipoMedicao(m)) {
    case "soma":
      return { medicoes: l * h * q, piso: 0, paredes: 0 };
    case "vao":
      return { medicoes: -l * h * q, piso: 0, paredes: -l * h * q };
    case "vao_area":
      return { medicoes: -l * q, piso: 0, paredes: -l * q };
    case "soma_area":
      return { medicoes: l * q, piso: 0, paredes: 0 };
    case "shaft_canto":
      return { medicoes: 0, piso: -l * p * q, paredes: 0 };
    case "shaft_parede":
      return { medicoes: 0, piso: -l * p * q, paredes: 2 * p * h * q };
  }
}

/** Contribuição da linha no total de "Medições" do ambiente. */
export function totalMedicao(m: Medicao) {
  return efeitoMedicao(m).medicoes;
}

export function proximaRevisao(rev: string) {
  const m = rev.match(/^(.*?)(\d+)$/);
  if (!m) return rev + "1";
  const digitos = m[2] ?? "0";
  const num = String(Number(digitos) + 1).padStart(digitos.length, "0");
  return (m[1] ?? "") + num;
}

export function mesesDesde(d: string) {
  const a = new Date(d + "T00:00:00");
  const b = new Date();
  return (
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth()) -
    (b.getDate() < a.getDate() ? 1 : 0)
  );
}

export interface Alerta {
  nivel: "alto" | "medio";
  titulo: string;
  detalhe: string;
}

export function auditar(evf: Evf, itens: Item[], caps: Capitulo[], cotacoes: Cotacao[]): Alerta[] {
  const out: Alerta[] = [];
  const meses = mesesDesde(evf.data_base);
  if (meses > 6)
    out.push({
      nivel: "alto",
      titulo: `Data-base com ${meses} meses`,
      detalhe: `Os preços são de ${evf.data_base.split("-").reverse().join("/")}. Sugestão: reajustar pelo INCC acumulado no período ou recotar os itens principais.`,
    });
  const poucasCot: Item[] = [];
  const semQtd: Item[] = [];
  const semPreco: Item[] = [];
  for (const i of sortItens(itens)) {
    if (i.tipo_preco === "cotacao") {
      const nc = cotacoes.filter((c) => c.item_id === i.id && Number(c.valor) > 0).length;
      if (nc === 0 && n(i.material_unit) + n(i.mo_unit) > 0) poucasCot.push(i);
    }
    if (n(i.quantidade) === 0) semQtd.push(i);
    else if (n(i.material_unit) + n(i.mo_unit) === 0) semPreco.push(i);
  }
  const lista = (xs: Item[]) =>
    xs
      .slice(0, 12)
      .map((i) => `${i.codigo} ${i.descricao}`)
      .join("; ") + (xs.length > 12 ? `; e mais ${xs.length - 12}` : "");
  if (semQtd.length)
    out.push({
      nivel: "alto",
      titulo: `${semQtd.length} ${semQtd.length === 1 ? "item sem quantidade" : "itens sem quantidade"}`,
      detalhe: `Informe as medidas do ambiente (aba Ambientes e medidas) ou digite a quantidade: ${lista(semQtd)}.`,
    });
  if (semPreco.length)
    out.push({
      nivel: "medio",
      titulo: `${semPreco.length} ${semPreco.length === 1 ? "item a cotar" : "itens a cotar"} (sem preço)`,
      detalhe: `Cadastre o preço no catálogo ou lance cotações: ${lista(semPreco)}.`,
    });
  if (poucasCot.length)
    out.push({
      nivel: "medio",
      titulo: `${poucasCot.length} ${poucasCot.length === 1 ? "item comprado" : "itens comprados"} sem nenhuma cotação`,
      detalhe: `O preço foi digitado sem fonte. Registre ao menos uma cotação (loja, valor, link): ${lista(poucasCot)}.`,
    });
  const demo = caps.find((c) => /demoli/i.test(c.nome));
  if (demo) {
    const di = itens.filter((i) => i.capitulo_codigo === demo.codigo);
    const verbas = di.filter(
      (i) =>
        i.tipo_preco === "verba" &&
        /m[aã]o de obra|demoli[cç][oõ]es e retiradas|geral|global/i.test(i.descricao),
    );
    const medidos = di.filter((i) => i.tipo_preco !== "verba" && /m²|m2|un|m³|m$/i.test(i.unidade));
    if (verbas.length && medidos.length)
      out.push({
        nivel: "alto",
        titulo: `Possível dupla contagem em ${demo.codigo} ${demo.nome}`,
        detalhe: `O capítulo tem ${verbas.length} item(ns) por verba (${verbas.map((v) => v.codigo).join(", ")}) e ${medidos.length} item(ns) medidos por m²/unidade. Confirme se a verba não inclui os serviços medidos.`,
      });
  }
  const usados = [...new Set(itens.map((i) => i.capitulo_codigo))];
  for (const c of usados) {
    const cap = caps.find((x) => x.codigo === c);
    if (!cap || cap.taxa_adm_pct == null)
      out.push({
        nivel: "medio",
        titulo: `Capítulo ${c} sem taxa de administração`,
        detalhe: "Defina a taxa em Taxas de administração.",
      });
  }
  return out;
}
