/**
 * Lista de materiais: consumo de insumos por serviço (coeficiente × quantidade do item) e compra em
 * embalagens. Coeficientes de referência de mercado para EVF — o quantitativo final sai do projeto
 * executivo e das fichas dos fabricantes.
 */
import type { Item } from "@/lib/calc";
import { itemEh, normaliza } from "@/lib/sugestoes";

export interface Insumo {
  nome: string;
  un: string;
  /** Embalagem de compra (ex.: saco de 50 kg). Sem embalagem, compra-se na própria unidade. */
  emb?: { qtd: number; nome: string };
}

export const INSUMOS: Record<string, Insumo> = {
  placa_piso: { nome: "Revestimento de piso (placas)", un: "m²" },
  placa_parede: { nome: "Revestimento de parede (placas)", un: "m²" },
  rodape_pecas: { nome: "Rodapé (peças)", un: "m" },
  argamassa_ac3: {
    nome: "Argamassa colante AC-III",
    un: "kg",
    emb: { qtd: 20, nome: "saco 20 kg" },
  },
  rejunte: { nome: "Rejunte", un: "kg", emb: { qtd: 5, nome: "embalagem 5 kg" } },
  cimento: { nome: "Cimento CP-II", un: "kg", emb: { qtd: 50, nome: "saco 50 kg" } },
  cal: { nome: "Cal hidratada CH-III", un: "kg", emb: { qtd: 20, nome: "saco 20 kg" } },
  areia: { nome: "Areia média", un: "m³" },
  brita: { nome: "Brita 1", un: "m³" },
  argamassa_pronta: {
    nome: "Argamassa pronta (reboco/regularização)",
    un: "kg",
    emb: { qtd: 20, nome: "saco 20 kg" },
  },
  bloco_ceramico: {
    nome: "Bloco cerâmico de vedação 9×19×19",
    un: "un",
    emb: { qtd: 1000, nome: "milheiro" },
  },
  concreto: { nome: "Concreto fck 25 MPa (usinado ou virado em obra)", un: "m³" },
  aco: { nome: "Aço CA-50/CA-60", un: "kg" },
  forma: { nome: "Fôrma de madeira (compensado)", un: "m²" },
  tela_soldada: { nome: "Tela soldada", un: "m²" },
  lona: { nome: "Lona plástica", un: "m²" },
  vigota: { nome: "Vigota treliçada", un: "m" },
  imperm: {
    nome: "Argamassa polimérica impermeabilizante",
    un: "kg",
    emb: { qtd: 18, nome: "caixa 18 kg" },
  },
  imperm_asfaltico: {
    nome: "Impermeabilizante asfáltico (baldrame)",
    un: "kg",
    emb: { qtd: 18, nome: "balde 18 kg" },
  },
  selador: { nome: "Selador acrílico", un: "L", emb: { qtd: 18, nome: "lata 18 L" } },
  massa_acrilica: { nome: "Massa acrílica", un: "kg", emb: { qtd: 25, nome: "balde 25 kg" } },
  massa_corrida: { nome: "Massa corrida PVA", un: "kg", emb: { qtd: 25, nome: "balde 25 kg" } },
  tinta_acrilica: { nome: "Tinta acrílica", un: "L", emb: { qtd: 18, nome: "lata 18 L" } },
  placa_gesso: { nome: "Placa de gesso 60×60 (forro)", un: "un" },
  chapa_drywall: { nome: "Chapa de drywall 1,20×1,80", un: "un" },
  perfil_drywall: {
    nome: "Perfil metálico para drywall",
    un: "m",
    emb: { qtd: 3, nome: "barra 3 m" },
  },
  telha_ceramica: { nome: "Telha cerâmica", un: "un" },
};

interface Consumo {
  insumo: string;
  /** Por unidade do serviço. */
  coef: number;
  /** Aplica a perda % do item (placas, peças). */
  perda?: boolean;
}

interface Composicao {
  nota: string;
  itens: Consumo[];
  /** Só vale se a descrição do item combinar (ex.: telha cerâmica). */
  so?: RegExp;
}

/** Composições de consumo por serviço da biblioteca. */
export const COMPOSICOES: Record<string, Composicao> = {
  piso: {
    nota: "Placas + perda do item; AC-III 7 kg/m² (dupla colagem em placas grandes); rejunte 0,5 kg/m².",
    itens: [
      { insumo: "placa_piso", coef: 1, perda: true },
      { insumo: "argamassa_ac3", coef: 7 },
      { insumo: "rejunte", coef: 0.5 },
    ],
  },
  piso_externo: {
    nota: "Placas + perda; AC-III 7 kg/m²; rejunte 0,5 kg/m².",
    itens: [
      { insumo: "placa_piso", coef: 1, perda: true },
      { insumo: "argamassa_ac3", coef: 7 },
      { insumo: "rejunte", coef: 0.5 },
    ],
  },
  parede_rev: {
    nota: "Placas + perda; AC-III 5 kg/m²; rejunte 0,8 kg/m² (juntas mais frequentes).",
    itens: [
      { insumo: "placa_parede", coef: 1, perda: true },
      { insumo: "argamassa_ac3", coef: 5 },
      { insumo: "rejunte", coef: 0.8 },
    ],
  },
  rodape: {
    nota: "Peças + perda; AC-III 0,7 kg/m; rejunte 0,1 kg/m.",
    itens: [
      { insumo: "rodape_pecas", coef: 1, perda: true },
      { insumo: "argamassa_ac3", coef: 0.7 },
      { insumo: "rejunte", coef: 0.1 },
    ],
  },
  contrapiso: {
    nota: "4 cm, traço 1:4: cimento 14 kg/m² e areia 0,046 m³/m².",
    itens: [
      { insumo: "cimento", coef: 14 },
      { insumo: "areia", coef: 0.046 },
    ],
  },
  regularizacao_contrapiso: {
    nota: "2 cm, traço 1:4: cimento 7 kg/m² e areia 0,023 m³/m².",
    itens: [
      { insumo: "cimento", coef: 7 },
      { insumo: "areia", coef: 0.023 },
    ],
  },
  chapisco: {
    nota: "Traço 1:3, 5 mm: cimento 2,4 kg/m² e areia 0,006 m³/m².",
    itens: [
      { insumo: "cimento", coef: 2.4 },
      { insumo: "areia", coef: 0.006 },
    ],
  },
  lixamento_parede: {
    nota: "Chapisco 1:3 após o lixamento: cimento 2,4 kg/m² e areia 0,006 m³/m².",
    itens: [
      { insumo: "cimento", coef: 2.4 },
      { insumo: "areia", coef: 0.006 },
    ],
  },
  emboco: {
    nota: "Massa única 2 cm, traço 1:2:8: cimento 3,1 kg, cal 3 kg e areia 0,024 m³ por m².",
    itens: [
      { insumo: "cimento", coef: 3.1 },
      { insumo: "cal", coef: 3 },
      { insumo: "areia", coef: 0.024 },
    ],
  },
  emboco_externo: {
    nota: "Massa única 2,5 cm, traço 1:2:8 (inclui chapisco): cimento 6,3 kg, cal 3,8 kg e areia 0,036 m³ por m².",
    itens: [
      { insumo: "cimento", coef: 6.3 },
      { insumo: "cal", coef: 3.8 },
      { insumo: "areia", coef: 0.036 },
    ],
  },
  regularizacao_reboco: {
    nota: "Argamassa pronta 34 kg/m² (cerca de 2 cm).",
    itens: [{ insumo: "argamassa_pronta", coef: 34 }],
  },
  alvenaria: {
    nota: "25 blocos/m² + 5% de perda; assentamento 1:2:8 (cimento 2,5 kg, cal 2,5 kg, areia 0,014 m³ por m²).",
    itens: [
      { insumo: "bloco_ceramico", coef: 26.25 },
      { insumo: "cimento", coef: 2.5 },
      { insumo: "cal", coef: 2.5 },
      { insumo: "areia", coef: 0.014 },
    ],
  },
  verga: {
    nota: "Seção 10 × 10 cm: concreto 0,01 m³/m e aço 1 kg/m.",
    itens: [
      { insumo: "concreto", coef: 0.01 },
      { insumo: "aco", coef: 1 },
    ],
  },
  pilares_vigas: {
    nota: "Por m³: aço 100 kg e fôrma 12 m². Virado em obra: 7 sacos de cimento, 0,72 m³ de areia e 0,86 m³ de brita por m³.",
    itens: [
      { insumo: "concreto", coef: 1 },
      { insumo: "aco", coef: 100 },
      { insumo: "forma", coef: 12 },
    ],
  },
  radier: {
    nota: "Espessura 12 cm com tela soldada, lastro de brita 5 cm e lona.",
    itens: [
      { insumo: "concreto", coef: 0.12 },
      { insumo: "tela_soldada", coef: 1.1 },
      { insumo: "brita", coef: 0.05 },
      { insumo: "lona", coef: 1.1 },
    ],
  },
  sapata_corrida: {
    nota: "Seção 40 × 20 cm: concreto 0,08 m³/m, aço 3 kg/m e lastro de brita.",
    itens: [
      { insumo: "concreto", coef: 0.08 },
      { insumo: "aco", coef: 3 },
      { insumo: "brita", coef: 0.02 },
    ],
  },
  baldrame: {
    nota: "Seção 15 × 30 cm: concreto 0,045 m³/m, aço 3 kg/m e fôrma 0,6 m²/m.",
    itens: [
      { insumo: "concreto", coef: 0.045 },
      { insumo: "aco", coef: 3 },
      { insumo: "forma", coef: 0.6 },
    ],
  },
  estacas: {
    nota: "Broca de 25 cm × 4 m: concreto 0,2 m³ e aço 8 kg por estaca.",
    itens: [
      { insumo: "concreto", coef: 0.2 },
      { insumo: "aco", coef: 8 },
    ],
  },
  laje: {
    nota: "Treliçada: vigotas 2,5 m/m², capa de 5 cm (0,05 m³/m²) e tela soldada.",
    itens: [
      { insumo: "vigota", coef: 2.5 },
      { insumo: "concreto", coef: 0.05 },
      { insumo: "tela_soldada", coef: 1.1 },
    ],
  },
  imperm_piso: {
    nota: "Argamassa polimérica 4 kg/m² (3 demãos cruzadas).",
    itens: [{ insumo: "imperm", coef: 4 }],
  },
  imperm_parede: { nota: "Argamassa polimérica 4 kg/m².", itens: [{ insumo: "imperm", coef: 4 }] },
  imperm_baldrame: {
    nota: "Impermeabilizante asfáltico 1,5 kg/m (topo e faces).",
    itens: [{ insumo: "imperm_asfaltico", coef: 1.5 }],
  },
  pint_parede: {
    nota: "Selador 0,12 L/m², massa acrílica 0,5 kg/m², tinta acrílica 2 demãos 0,15 L/m².",
    itens: [
      { insumo: "selador", coef: 0.12 },
      { insumo: "massa_acrilica", coef: 0.5 },
      { insumo: "tinta_acrilica", coef: 0.15 },
    ],
  },
  pint_teto: {
    nota: "Selador 0,12 L/m², massa corrida 0,5 kg/m², tinta 2 demãos 0,12 L/m².",
    itens: [
      { insumo: "selador", coef: 0.12 },
      { insumo: "massa_corrida", coef: 0.5 },
      { insumo: "tinta_acrilica", coef: 0.12 },
    ],
  },
  pint_externa: {
    nota: "Selador 0,12 L/m² e tinta acrílica para fachada 0,2 L/m².",
    itens: [
      { insumo: "selador", coef: 0.12 },
      { insumo: "tinta_acrilica", coef: 0.2 },
    ],
  },
  forro_gesso: {
    nota: "Placas 60 × 60: 2,78 por m² + 5% de perda.",
    so: /^(?!.*pvc).*/,
    itens: [{ insumo: "placa_gesso", coef: 2.92 }],
  },
  forro_drywall: {
    nota: "Chapa 1,06 m²/m² (1,20 × 1,80) e perfis 1,7 m/m².",
    itens: [
      { insumo: "chapa_drywall", coef: 0.49 },
      { insumo: "perfil_drywall", coef: 1.7 },
    ],
  },
  drywall_parede: {
    nota: "Duas faces: chapas 0,98 un/m² e perfis 2,2 m/m².",
    itens: [
      { insumo: "chapa_drywall", coef: 0.98 },
      { insumo: "perfil_drywall", coef: 2.2 },
    ],
  },
  telhamento: {
    nota: "Telha cerâmica: 16 un/m² (modelo romana/portuguesa).",
    so: /ceram/,
    itens: [{ insumo: "telha_ceramica", coef: 16 }],
  },
};

const n = (v: unknown) => Number(v) || 0;

/** Qual composição de consumo vale para o item (pela chave ou pela descrição). */
export function composicaoDoItem(i: Item): { chave: string; comp: Composicao } | null {
  const desc = normaliza(i.descricao);
  const chave =
    i.chave && COMPOSICOES[i.chave] ? i.chave : Object.keys(COMPOSICOES).find((k) => itemEh(i, k));
  if (!chave) return null;
  const comp = COMPOSICOES[chave]!;
  if (comp.so && !comp.so.test(desc)) return null;
  return { chave, comp };
}

export interface ConsumoItem {
  insumo: string;
  qtd: number;
}

export function consumoDoItem(i: Item): ConsumoItem[] {
  const c = composicaoDoItem(i);
  if (!c) return [];
  const q = n(i.quantidade);
  const perda = 1 + n(i.perda_pct) / 100;
  return c.comp.itens.map((x) => ({ insumo: x.insumo, qtd: q * x.coef * (x.perda ? perda : 1) }));
}

export interface LinhaMaterial {
  insumo: string;
  nome: string;
  un: string;
  total: number;
  compra: string;
  origens: { item: Item; qtd: number }[];
}

/** Lista consolidada: soma o consumo de todos os itens e converte em embalagens. */
export function listaDeMateriais(itens: Item[]): LinhaMaterial[] {
  const mapa = new Map<string, LinhaMaterial>();
  for (const i of itens) {
    if (i.etapa === "Etapa futura") continue;
    for (const c of consumoDoItem(i)) {
      if (c.qtd <= 0) continue;
      const ins = INSUMOS[c.insumo];
      if (!ins) continue;
      const l = mapa.get(c.insumo) ?? {
        insumo: c.insumo,
        nome: ins.nome,
        un: ins.un,
        total: 0,
        compra: "",
        origens: [],
      };
      l.total += c.qtd;
      l.origens.push({ item: i, qtd: c.qtd });
      mapa.set(c.insumo, l);
    }
  }
  const ordem = Object.keys(INSUMOS);
  return [...mapa.values()]
    .map((l) => ({ ...l, compra: compra(l.insumo, l.total) }))
    .sort((a, b) => ordem.indexOf(a.insumo) - ordem.indexOf(b.insumo));
}

export function compra(insumo: string, total: number): string {
  const ins = INSUMOS[insumo];
  if (!ins) return "";
  const fmt = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
  if (ins.emb && ins.un === "un")
    return `${Math.ceil(total)} un (${fmt(total / ins.emb.qtd, 1)} ${plural(ins.emb.nome)})`;
  if (ins.emb) {
    const k = Math.ceil(total / ins.emb.qtd - 1e-9);
    const nome = ins.emb.nome.split(" ")[0] ?? ins.emb.nome;
    return `${k} ${k === 1 ? nome : plural(nome)} (${ins.emb.nome})`;
  }
  if (ins.un === "un") return `${Math.ceil(total)} un`;
  if (/^placa_|rodape_pecas/.test(insumo))
    return `${fmt(total, 1)} ${ins.un} (em caixas do fabricante)`;
  return `${fmt(total, ins.un === "m³" ? 2 : 1)} ${ins.un}`;
}

function plural(s: string) {
  if (s === "milheiro") return "milheiros";
  if (/m$/.test(s)) return `${s.slice(0, -1)}ns`;
  if (/[aeiou]$/.test(s)) return `${s}s`;
  if (/r$/.test(s)) return `${s}es`;
  return `${s}s`;
}
