import {
  AMBIENTE_MOLHADO,
  CHECKLIST,
  MODELO,
  REGRAS,
  SERVICO,
  type Base,
  type ItemModelo,
} from "@/lib/biblioteca";
import { efeitoMedicao, type Ambiente, type Evf, type Item, type Medicao } from "@/lib/calc";

const n = (v: unknown) => Number(v) || 0;

/** Texto sem acento e minúsculo, para comparar descrições. */
export function normaliza(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface Geometria {
  piso: number;
  teto: number;
  perimetro: number;
  paredes: number;
  medicoes: number;
}

export function geometria(a: Ambiente, medicoes: Medicao[]): Geometria {
  const c = n(a.comprimento);
  const l = n(a.largura);
  const pd = n(a.pe_direito);
  const perimetro = c && l ? 2 * (c + l) : 0;
  const ef = medicoes
    .filter((m) => m.ambiente_id === a.id)
    .map(efeitoMedicao)
    .reduce(
      (s, e) => ({
        medicoes: s.medicoes + e.medicoes,
        piso: s.piso + e.piso,
        paredes: s.paredes + e.paredes,
      }),
      {
        medicoes: 0,
        piso: 0,
        paredes: 0,
      },
    );
  const piso = c && l ? Math.max(0, c * l + ef.piso) : 0;
  return {
    piso,
    teto: piso,
    perimetro,
    paredes: perimetro ? Math.max(0, perimetro * pd - n(a.area_vaos) + ef.paredes) : 0,
    medicoes: ef.medicoes,
  };
}

/** Quantidade calculada de um item vinculado (null = item manual). */
export function quantidadeVinculada(
  item: Item,
  itens: Item[],
  ambientes: Ambiente[],
  medicoes: Medicao[],
): number | null {
  const base = item.base_qtd as Base | null;
  if (!base || base === "manual") return null;
  const fator = n(item.fator) || 1;
  if (base === "item") {
    const ref = itens.find((i) => i.id === item.base_item_id);
    return ref ? n(ref.quantidade) * fator : null;
  }
  const amb = ambientes.find((a) => a.id === item.ambiente_id);
  if (!amb) return null;
  const g = geometria(amb, medicoes);
  return g[base] * fator;
}

/** O item é (ou equivale a) o serviço da biblioteca? */
const EH_REMOCAO = /^(rem_|demol_)/;
const TEXTO_REMOCAO = /\b(remocao|retirada|demolicao|arrancar|retirar|remover)\b/;

export function itemEh(item: Item, chave: string) {
  if (item.chave === chave) return true;
  // Item com chave conhecida é aquele serviço e nenhum outro.
  if (item.chave && SERVICO[item.chave]) return false;
  const s = SERVICO[chave];
  if (!s) return false;
  const desc = normaliza(item.descricao);
  // "Remoção de revestimento de parede" não é o revestimento de parede (e vice-versa).
  if (TEXTO_REMOCAO.test(desc) !== EH_REMOCAO.test(chave)) return false;
  return s.match.test(desc);
}

export interface Sugestao {
  id: string;
  chave: string;
  titulo: string;
  motivo: string;
  ambienteId: string | null;
  ambienteNome: string | null;
  base: Base;
  fator: number;
  baseItemId: string | null;
  qtd: number;
}

/** Lista o que provavelmente está faltando no EVF. */
export function sugerir(evf: Evf, itens: Item[], ambientes: Ambiente[]): Sugestao[] {
  const out = new Map<string, Sugestao>();
  const ignoradas = new Set(
    Array.isArray(evf.sugestoes_ignoradas) ? (evf.sugestoes_ignoradas as string[]) : [],
  );
  const add = (s: Sugestao) => {
    if (!ignoradas.has(s.id) && !out.has(s.id)) out.set(s.id, s);
  };
  const temNaObra = (chaves: string[]) => itens.some((i) => chaves.some((c) => itemEh(i, c)));
  const temNoAmbiente = (chaves: string[], ambId: string | null) =>
    itens.some((i) => (ambId ? i.ambiente_id === ambId : true) && chaves.some((c) => itemEh(i, c)));

  for (const r of REGRAS) {
    const svc = SERVICO[r.sugere];
    if (!svc) continue;
    const gatilhos = itens.filter((i) => r.se.some((c) => itemEh(i, c)));
    for (const g of gatilhos) {
      const amb =
        r.escopo === "ambiente" ? (ambientes.find((a) => a.id === g.ambiente_id) ?? null) : null;
      if (r.soEm) {
        const nomeAmb = ambientes.find((a) => a.id === g.ambiente_id)?.nome ?? "";
        if (!r.soEm.test(normaliza(nomeAmb))) continue;
      }
      const ok =
        r.escopo === "ambiente" ? temNoAmbiente(r.precisa, g.ambiente_id) : temNaObra(r.precisa);
      if (ok) continue;
      const usaItem = r.derivar != null;
      add({
        id: `${r.id}:${r.escopo === "ambiente" ? (g.ambiente_id ?? "geral") : "obra"}`,
        chave: svc.chave,
        titulo: svc.desc,
        motivo: r.motivo,
        ambienteId: usaItem ? g.ambiente_id : (amb?.id ?? g.ambiente_id ?? null),
        ambienteNome: amb?.nome ?? ambientes.find((a) => a.id === g.ambiente_id)?.nome ?? null,
        base: usaItem ? "item" : (svc.base ?? "manual"),
        fator: usaItem ? (r.derivar ?? 1) : (svc.fator ?? 1),
        baseItemId: usaItem ? g.id : null,
        qtd: usaItem ? n(g.quantidade) * (r.derivar ?? 1) : (svc.qtd ?? 1),
      });
    }
  }

  for (const c of CHECKLIST) {
    if (!(c.tipos.includes("*") || c.tipos.includes(evf.tipo_obra))) continue;
    if (evf.sem_gestao && c.sugere === "gestao_mensal") continue;
    if (temNaObra(c.precisa)) continue;
    const svc = SERVICO[c.sugere];
    if (!svc) continue;
    add({
      id: `check:${c.sugere}`,
      chave: svc.chave,
      titulo: svc.desc,
      motivo: c.motivo,
      ambienteId: null,
      ambienteNome: null,
      base: "manual",
      fator: 1,
      baseItemId: null,
      qtd: svc.qtd ?? 1,
    });
  }

  for (const a of ambientes) {
    const nome = normaliza(a.nome);
    if (!AMBIENTE_MOLHADO.test(nome)) continue;
    const doAmb = itens.filter((i) => i.ambiente_id === a.id);
    if (!doAmb.length) continue;
    const temObraMolhada = doAmb.some((i) =>
      ["rem_piso", "piso", "piso_externo", "ponto_agua_fria", "ponto_esgoto", "chuveiro"].some(
        (c) => itemEh(i, c),
      ),
    );
    if (temObraMolhada && !doAmb.some((i) => itemEh(i, "imperm_piso") || itemEh(i, "imperm_laje")))
      add({
        id: `molhado_imperm:${a.id}`,
        chave: "imperm_piso",
        titulo: SERVICO["imperm_piso"]?.desc ?? "Impermeabilização de piso",
        motivo: `${a.nome} é área molhada: mexendo no piso ou nas instalações, impermeabilize antes do revestimento.`,
        ambienteId: a.id,
        ambienteNome: a.nome,
        base: "piso",
        fator: 1,
        baseItemId: null,
        qtd: 0,
      });
    if (!doAmb.some((i) => itemEh(i, "ralo")) && temObraMolhada && !/lavabo/.test(nome))
      add({
        id: `molhado_ralo:${a.id}`,
        chave: "ralo",
        titulo: "Ralo",
        motivo: `${a.nome} é área molhada: confira ralo e caimento do contrapiso.`,
        ambienteId: a.id,
        ambienteNome: a.nome,
        base: "manual",
        fator: 1,
        baseItemId: null,
        qtd: 1,
      });
  }
  return [...out.values()];
}

/** Preço por descrição (e chave do serviço, para a referência vinculada). */
export type PrecoFn = (
  desc: string,
  chave?: string | null,
) => { material_unit: number; mo_unit: number; origem?: string } | null;

/** Monta as linhas de itens de um modelo da biblioteca (sem evf_id, que o chamador completa). */
export function linhasDoModelo(
  modeloId: string,
  ambiente: Ambiente | null,
  medicoes: Medicao[],
  precoCatalogo: PrecoFn,
) {
  const m = MODELO[modeloId];
  if (!m) return [];
  const g = ambiente ? geometria(ambiente, medicoes) : null;
  return m.itens
    .map((im) => linhaDoServico(im, ambiente, g, precoCatalogo))
    .filter((x): x is NonNullable<typeof x> => x != null);
}

export function linhaDoServico(
  im: ItemModelo,
  ambiente: Ambiente | null,
  g: Geometria | null,
  precoCatalogo: PrecoFn,
) {
  const s = SERVICO[im.chave];
  if (!s) return null;
  const desc =
    im.desc ??
    (ambiente && s.base && s.base !== "manual" ? `${s.desc} – ${ambiente.nome}` : s.desc);
  const base: Base = im.qtd != null ? "manual" : (im.base ?? s.base ?? "manual");
  const fator = im.fator ?? s.fator ?? 1;
  const vinculada = base !== "manual" && base !== "item" && ambiente != null;
  const qtd =
    vinculada && g ? g[base as Exclude<Base, "manual" | "item">] * fator : (im.qtd ?? s.qtd ?? 1);
  const preco = precoCatalogo(im.desc ?? s.desc, s.chave) ?? precoCatalogo(s.desc, s.chave);
  return {
    ambiente_id: ambiente?.id ?? null,
    capitulo_codigo: s.cap,
    descricao: desc,
    unidade: s.un,
    quantidade: qtd,
    perda_pct: s.perda ?? 0,
    material_unit: preco?.material_unit ?? 0,
    mo_unit: preco ? preco.mo_unit : (s.mo ?? 0),
    origem_preco: preco?.origem ?? null,
    tipo_preco: s.tipo,
    chave: s.chave,
    base_qtd: vinculada ? base : null,
    fator: vinculada ? fator : 1,
  };
}
