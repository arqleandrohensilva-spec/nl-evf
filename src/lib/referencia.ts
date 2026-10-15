/**
 * Base de preços de referência (SINAPI ou outra tabela importada).
 * - Lê a planilha como vier: acha a linha de cabeçalho e as colunas de código, descrição, unidade,
 *   preço (coluna da UF ou "custo total") e, se houver, % de mão de obra.
 * - Sugere o vínculo serviço da biblioteca → composição pela descrição e unidade (o usuário confirma).
 * - Converte o preço de referência em material + M.O. do item.
 */
import { SERVICOS, type Servico } from "@/lib/biblioteca";
import { normaliza } from "@/lib/sugestoes";

export interface Mapa {
  linhaCabecalho: number;
  codigo: number;
  descricao: number;
  unidade: number;
  preco: number;
  pctMo: number | null;
}

export interface Registro {
  codigo: string;
  descricao: string;
  unidade: string;
  preco: number;
  pct_mo: number | null;
}

const UFS =
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

const txt = (v: unknown) => normaliza(String(v ?? "").trim());

/** Número em formato brasileiro ou já numérico ("1.234,56" → 1234.56). */
export function numero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "")
    .replace(/[R$\s]/g, "")
    .trim();
  if (!s) return 0;
  const br = /,\d{1,4}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(br);
  return Number.isFinite(n) ? n : 0;
}

/** Unidade padronizada (M2 → m², UN → un…). */
export function unidade(u: unknown): string {
  const s = String(u ?? "")
    .trim()
    .toLowerCase()
    .replace("²", "2")
    .replace("³", "3");
  if (/^m2$|^m\^2$/.test(s)) return "m²";
  if (/^m3$|^m\^3$/.test(s)) return "m³";
  if (/^(m|ml)$/.test(s)) return "m";
  if (/^(un|und|unid|unidade|pc|peca)$/.test(s)) return "un";
  if (/^kg$/.test(s)) return "kg";
  if (/^(vb|verba|cj|conj)$/.test(s)) return "vb";
  if (/^(mes|mês)$/.test(s)) return "mês";
  return s;
}

/** Acha cabeçalho e colunas. `uf` escolhe a coluna de preço quando a planilha tem uma por estado. */
export function detectarColunas(linhas: unknown[][], uf = "SP"): Mapa | null {
  const lim = Math.min(linhas.length, 40);
  for (let r = 0; r < lim; r++) {
    const row = (linhas[r] ?? []).map(txt);
    const codigo = row.findIndex((c) => /codigo|^cod/.test(c));
    const descricao = row.findIndex((c) => /descri/.test(c));
    if (codigo < 0 || descricao < 0) continue;
    const unidadeCol = row.findIndex((c) => /^unid|^und|^un$/.test(c));
    // Preço: coluna da UF (na própria linha ou até 2 linhas acima/abaixo) ou "custo total"/"preço".
    let preco = -1;
    for (let d = -2; d <= 2 && preco < 0; d++) {
      const rr = linhas[r + d] ?? [];
      const k = rr.findIndex(
        (c) =>
          String(c ?? "")
            .trim()
            .toUpperCase() === uf.toUpperCase(),
      );
      if (k >= 0) preco = /%/.test(txt((linhas[r] ?? [])[k])) ? k + 1 : k;
    }
    if (preco < 0)
      preco = row.findIndex((c) => /custo total|preco|valor|custo/.test(c) && !/%/.test(c));
    if (preco < 0) continue;
    const pctMo = row.findIndex((c) => /(%|perc).*(mao de obra|m\.?o\.?)|mao de obra.*%/.test(c));
    return {
      linhaCabecalho: r,
      codigo,
      descricao,
      unidade: unidadeCol,
      preco,
      pctMo: pctMo >= 0 ? pctMo : null,
    };
  }
  return null;
}

/** Linhas de dados com código, descrição e preço válidos. */
export function extrair(linhas: unknown[][], m: Mapa): Registro[] {
  const out: Registro[] = [];
  const vistos = new Set<string>();
  for (let r = m.linhaCabecalho + 1; r < linhas.length; r++) {
    const row = linhas[r] ?? [];
    const codigo = String(row[m.codigo] ?? "").trim();
    const descricao = String(row[m.descricao] ?? "").trim();
    const preco = numero(row[m.preco]);
    if (!codigo || !/\d/.test(codigo) || !descricao || preco <= 0 || vistos.has(codigo)) continue;
    vistos.add(codigo);
    let pct = m.pctMo != null ? numero(row[m.pctMo]) : null;
    if (pct != null && pct > 1) pct = pct / 100;
    out.push({
      codigo,
      descricao,
      unidade: m.unidade >= 0 ? unidade(row[m.unidade]) : "",
      preco,
      pct_mo: pct != null && pct > 0 && pct < 1 ? pct : null,
    });
  }
  return out;
}

/** Palavras que ajudam a achar a composição de cada serviço (busca, não código). */
const DICAS: Record<string, string[]> = {
  alvenaria: ["alvenaria", "vedacao", "bloco"],
  chapisco: ["chapisco"],
  emboco: ["emboco", "massa unica", "interna"],
  emboco_externo: ["emboco", "massa unica", "fachada", "externa"],
  contrapiso: ["contrapiso"],
  regularizacao_contrapiso: ["contrapiso", "regularizacao"],
  piso: ["revestimento ceramico", "piso"],
  piso_externo: ["piso", "ceramico", "externa"],
  parede_rev: ["revestimento ceramico", "parede"],
  pint_parede: ["pintura", "latex", "acrilica", "parede"],
  pint_teto: ["pintura", "latex", "teto"],
  pint_externa: ["pintura", "acrilica", "fachada"],
  forro_gesso: ["forro", "gesso"],
  forro_drywall: ["forro", "drywall"],
  imperm_piso: ["impermeabilizacao", "argamassa polimerica"],
  imperm_parede: ["impermeabilizacao", "argamassa polimerica"],
  imperm_laje: ["impermeabilizacao", "manta asfaltica"],
  imperm_baldrame: ["impermeabilizacao", "viga baldrame"],
  laje: ["laje", "pre-moldada"],
  pilares_vigas: ["concreto", "armado", "estrutura"],
  estrutura_telhado: ["estrutura", "madeira", "telhado"],
  telhamento: ["telhamento", "telha"],
  rufos_calhas: ["calha"],
  manta_termica: ["manta", "subcobertura"],
  radier: ["radier"],
  sapata_corrida: ["sapata"],
  baldrame: ["viga baldrame"],
  estacas: ["estaca"],
  verga: ["verga"],
  rodape: ["rodape"],
  soleira: ["soleira"],
  peitoril: ["peitoril"],
  ponto_tomada: ["ponto", "tomada"],
  ponto_interruptor: ["ponto", "interruptor"],
  ponto_iluminacao: ["ponto", "iluminacao"],
  ponto_agua_fria: ["ponto", "agua fria"],
  ponto_agua_quente: ["ponto", "agua quente"],
  ponto_esgoto: ["ponto", "esgoto"],
  muro: ["muro"],
  calcada: ["calcada"],
  limpeza_terreno: ["limpeza", "terreno"],
  locacao_obra: ["locacao", "obra"],
  janela: ["janela", "aluminio"],
  porta_interna: ["porta", "madeira"],
  vaso: ["bacia sanitaria"],
  cuba: ["lavatorio"],
  torneira: ["torneira"],
  tanque: ["tanque"],
  chuveiro: ["chuveiro"],
  ralo: ["ralo"],
  caixa_dagua: ["caixa d'agua"],
  rem_piso: ["demolicao|remocao|retirada", "piso"],
  rem_parede: ["demolicao|remocao|retirada", "revestimento|azulejo"],
  rem_forro: ["demolicao|remocao|retirada", "forro"],
  demol_alvenaria: ["demolicao", "alvenaria"],
  regularizacao_reboco: ["emboco", "massa unica"],
  lixamento_parede: ["chapisco"],
  bancada_cozinha: ["bancada", "granito"],
  bancada_banheiro: ["bancada", "granito"],
};

const PARADAS = new Set(
  "de da do das dos e em com para a o as os por no na nos nas ou ate tipo inclusive incl conforme".split(
    " ",
  ),
);

const tokens = (s: string) =>
  normaliza(s)
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !PARADAS.has(t));

export interface Candidato extends Registro {
  pontos: number;
}

/** Melhores composições para um serviço: mesma unidade, mais palavras em comum. */
export function sugerir(servico: Servico, refs: Registro[], n = 5): Candidato[] {
  const un = unidade(servico.un);
  const dicas = (DICAS[servico.chave] ?? []).map((h) => normaliza(h).split("|"));
  const base = tokens(servico.desc);
  const ehRemocao = /^(remocao|demolicao|retirada)/.test(normaliza(servico.desc));
  const tem = (d: string, alts: string[]) => alts.some((a) => d.includes(a));
  const out: Candidato[] = [];
  for (const r of refs) {
    if (un && un !== "vb" && r.unidade && r.unidade !== un) continue;
    const d = normaliza(r.descricao);
    // Tirar e colocar são serviços diferentes: nunca cruzar remoção com execução.
    const refRemove = /\b(demolicao|remocao|retirada)\b/.test(d);
    if (ehRemocao !== refRemove) continue;
    // A primeira dica é a palavra que define o serviço: sem ela, não serve.
    if (dicas[0] && !tem(d, dicas[0])) continue;
    let pontos = 0;
    for (const alts of dicas) if (tem(d, alts)) pontos += alts.some((a) => a.includes(" ")) ? 4 : 3;
    for (const t of base) if (d.includes(t)) pontos += 1;
    if (pontos <= 2) continue;
    out.push({ ...r, pontos: pontos - Math.min(2, d.length / 200) });
  }
  return out.sort((a, b) => b.pontos - a.pontos).slice(0, n);
}

/** Serviços que fazem sentido vincular (os de verba ficam de fora). */
export const SERVICOS_VINCULAVEIS = SERVICOS.filter((s) => s.un !== "vb" && s.un !== "mês");

/** Preço de referência → material e mão de obra do item. Sem % de M.O., tudo fica no material. */
export function dividir(preco: number, pctMo: number | null) {
  if (pctMo == null) return { material_unit: preco, mo_unit: 0 };
  return { material_unit: preco * (1 - pctMo), mo_unit: preco * pctMo };
}
