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
  return [...itens].sort((a, b) => a.capitulo_codigo - b.capitulo_codigo || a.ordem - b.ordem || compareCodigo(a.codigo, b.codigo));
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
  const capitulos = [...map.values()].sort((a, b) => a.codigo - b.codigo);
  for (const c of capitulos) c.taxa = c.total * ((c.taxaPct ?? 0) / 100);
  const direto = capitulos.reduce((s, c) => s + c.total, 0);
  const taxas = capitulos.reduce((s, c) => s + c.taxa, 0);
  const mat = capitulos.reduce((s, c) => s + c.mat, 0);
  const mo = capitulos.reduce((s, c) => s + c.mo, 0);
  return { capitulos, direto, taxas, mat, mo, geral: direto + taxas, taxaEfetiva: direto ? (taxas / direto) * 100 : 0 };
}

/** Total geral de um item incluindo a taxa do seu capítulo. */
export function porEtapa(itens: Item[], caps: Capitulo[]) {
  const out: Record<string, { direto: number; geral: number }> = { Agora: { direto: 0, geral: 0 }, "Etapa futura": { direto: 0, geral: 0 } };
  for (const i of itens) {
    const cap = caps.find((c) => c.codigo === i.capitulo_codigo);
    const t = itemTotais(i).total;
    const k = i.etapa === "Etapa futura" ? "Etapa futura" : "Agora";
    out[k].direto += t;
    out[k].geral += t * (1 + n(cap?.taxa_adm_pct) / 100);
  }
  return out;
}

export function curvaABC(itens: Item[]) {
  const rows = itens.map((i) => ({ item: i, total: itemTotais(i).total })).sort((a, b) => b.total - a.total);
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

export function totalMedicao(m: Medicao) {
  return n(m.largura) * n(m.altura) * n(m.quantidade) * (m.sinal < 0 ? -1 : 1);
}

export function proximaRevisao(rev: string) {
  const m = rev.match(/^(.*?)(\d+)$/);
  if (!m) return rev + "1";
  const num = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return m[1] + num;
}

export function mesesDesde(d: string) {
  const a = new Date(d + "T00:00:00");
  const b = new Date();
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
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
  for (const i of sortItens(itens)) {
    if (i.tipo_preco === "cotacao") {
      const nc = cotacoes.filter((c) => c.item_id === i.id && Number(c.valor) > 0).length;
      if (nc < 3)
        out.push({ nivel: "medio", titulo: `${i.codigo} ${i.descricao}: só ${nc} cotação(ões)`, detalhe: "Itens por cotação devem ter 3 propostas para comparação." });
    }
    if (itemTotais(i).total === 0)
      out.push({ nivel: "medio", titulo: `${i.codigo} ${i.descricao}: total zero`, detalhe: "Verifique quantidade e preços unitários." });
  }
  const demo = caps.find((c) => /demoli/i.test(c.nome));
  if (demo) {
    const di = itens.filter((i) => i.capitulo_codigo === demo.codigo);
    const verbas = di.filter((i) => i.tipo_preco === "verba");
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
      out.push({ nivel: "medio", titulo: `Capítulo ${c} sem taxa de administração`, detalhe: "Defina a taxa em Taxas de administração." });
  }
  return out;
}
