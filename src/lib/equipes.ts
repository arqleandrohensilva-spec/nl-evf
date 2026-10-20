/**
 * Quem executa cada item. Serve para mandar a lista certa a cada profissional, comparar a proposta
 * dele com o previsto no EVF e ver quanto da mão de obra vai para cada equipe.
 */
import { itemTotais, sortItens, type Ambiente, type Item } from "@/lib/calc";

/**
 * mo: cobra só mão de obra (o material é comprado pela obra).
 * fornecedor: fornece e instala (proposta única).
 * compra: material, locação ou taxa, sem equipe de obra.
 */
export type TipoEquipe = "mo" | "fornecedor" | "compra";

export interface Equipe {
  id: string;
  nome: string;
  tipo: TipoEquipe;
}

export const EQUIPES: Equipe[] = [
  { id: "pedreiro", nome: "Pedreiro (obra, hidráulica e elétrica)", tipo: "mo" },
  { id: "encanador", nome: "Encanador", tipo: "mo" },
  { id: "eletricista", nome: "Eletricista", tipo: "mo" },
  { id: "gesseiro", nome: "Gesseiro / drywall", tipo: "mo" },
  { id: "pintor", nome: "Pintor", tipo: "mo" },
  { id: "carpinteiro", nome: "Carpinteiro (portas)", tipo: "mo" },
  { id: "telhadista", nome: "Telhadista", tipo: "mo" },
  { id: "limpeza", nome: "Limpeza pós-obra", tipo: "mo" },
  { id: "marmorista", nome: "Marmoraria", tipo: "fornecedor" },
  { id: "marceneiro", nome: "Marcenaria", tipo: "fornecedor" },
  { id: "vidraceiro", nome: "Vidraçaria (box e espelhos)", tipo: "fornecedor" },
  { id: "serralheiro", nome: "Esquadrias e serralheria", tipo: "fornecedor" },
  { id: "granilite", nome: "Aplicador de granilite", tipo: "fornecedor" },
  { id: "refrigeracao", nome: "Ar-condicionado", tipo: "fornecedor" },
  { id: "paisagista", nome: "Paisagismo", tipo: "fornecedor" },
  { id: "outros", nome: "Outros prestadores", tipo: "fornecedor" },
  { id: "tecnicos", nome: "Projetos, documentos e taxas", tipo: "compra" },
  { id: "compras", nome: "Compras e locações (sem equipe)", tipo: "compra" },
];

export const EQUIPE: Record<string, Equipe> = Object.fromEntries(EQUIPES.map((e) => [e.id, e]));

const POR_CHAVE: Record<string, string[]> = {
  pedreiro: [
    "rem_piso",
    "rem_parede",
    "rem_loucas",
    "rem_bancada",
    "rem_box",
    "rem_esquadria",
    "demol_alvenaria",
    "transporte_entulho",
    "locacao_obra",
    "tapume_barracao",
    "isolamento_area",
    "escoramento",
    "fundacao",
    "radier",
    "sapata_corrida",
    "baldrame",
    "pilares_vigas",
    "laje",
    "alvenaria",
    "verga",
    "chapisco",
    "lixamento_parede",
    "emboco",
    "emboco_externo",
    "regularizacao_reboco",
    "contrapiso",
    "regularizacao_contrapiso",
    "imperm_piso",
    "imperm_parede",
    "imperm_laje",
    "imperm_baldrame",
    "teste_estanqueidade",
    "fechamento_rasgos",
    "chumbadores",
    "piso",
    "parede_rev",
    "perfil_revestimento",
    "rejunte_epoxi",
    "rodape",
    "piso_externo",
    "acessorios_banho",
    "dispensers",
    "lixeira",
    "barras_apoio",
    "churrasqueira",
    "muro",
    "calcada",
  ],
  encanador: [
    "adequacao_ralo",
    "ponto_agua_fria",
    "ponto_agua_quente",
    "ponto_esgoto",
    "troca_registro",
    "caixa_dagua",
    "esgoto_externo",
    "pluviais",
    "vaso",
    "mictorio",
    "bacia_pcd",
    "cuba",
    "torneira",
    "torneira_temporizada",
    "chuveiro",
    "ducha",
    "acab_registro",
    "ralo",
    "sifao",
    "cuba_cozinha",
    "torneira_cozinha",
    "tanque",
    "torneira_tanque",
    "aquecedor",
  ],
  eletricista: [
    "ligacao_provisoria",
    "ligacoes_definitivas",
    "ponto_tomada",
    "ponto_interruptor",
    "ponto_iluminacao",
    "circuito_chuveiro",
    "quadro",
    "entrada_energia",
    "aterramento",
    "logica_tv",
    "luminaria",
    "fita_led",
    "sensor_presenca",
    "exaustor",
    "coifa",
    "cooktop",
  ],
  gesseiro: ["rem_forro", "forro_drywall", "forro_gesso", "tabica", "drywall_parede"],
  pintor: ["pint_parede", "pint_teto", "pint_portas", "pint_externa"],
  carpinteiro: ["porta_interna", "ajuste_porta", "porta_acessivel"],
  telhadista: ["estrutura_telhado", "telhamento", "rufos_calhas", "manta_termica"],
  limpeza: ["limpeza_final"],
  marmorista: ["bancada_banheiro", "bancada_cozinha", "nicho", "soleira", "peitoril"],
  marceneiro: [
    "rem_marcenaria",
    "armario_banheiro",
    "armario_cozinha",
    "armario_quarto",
    "painel_tv",
  ],
  vidraceiro: ["box", "espelho"],
  serralheiro: ["janela", "porta_externa", "portao"],
  granilite: ["granilite_liquido", "rodape_granilite"],
  refrigeracao: ["infra_ar", "ar_condicionado"],
  paisagista: ["paisagismo"],
  outros: [
    "sondagem",
    "topografia",
    "terraplanagem",
    "limpeza_terreno",
    "estacas",
    "divisoria_cabine",
    "sinalizacao",
  ],
  tecnicos: [
    "gestao_mensal",
    "projetos_complementares",
    "aprovacao_prefeitura",
    "aprovacao_condominio",
    "habite_se",
    "inss_obra",
    "rrt",
    "seguro_obra",
    "impressao_projetos",
  ],
  compras: [
    "frete",
    "placa_obra",
    "consumo_obra",
    "protecao_piso",
    "lona",
    "material_limpeza",
    "cacamba",
    "andaime",
    "betoneira",
  ],
};

const CHAVE_EQUIPE: Record<string, string> = Object.fromEntries(
  Object.entries(POR_CHAVE).flatMap(([eq, chaves]) => chaves.map((c) => [c, eq])),
);

/**
 * Na prática do escritório, o pedreiro faz também a hidráulica e a elétrica. Os serviços continuam
 * classificados por especialidade (acima); aqui eles são juntados no pedreiro. Para contratar um
 * eletricista ou encanador à parte, basta trocar "Quem faz" no item.
 */
const JUNTO_COM: Record<string, string> = { encanador: "pedreiro", eletricista: "pedreiro" };

/** Equipe padrão de cada capítulo, para itens sem chave (item livre, catálogo). */
const POR_CAPITULO: Record<number, string> = {
  1: "tecnicos",
  2: "compras",
  3: "compras",
  4: "pedreiro",
  5: "pedreiro",
  6: "encanador",
  7: "eletricista",
  8: "gesseiro",
  9: "pedreiro",
  10: "encanador",
  11: "pintor",
  12: "eletricista",
  13: "marmorista",
  14: "marceneiro",
  15: "vidraceiro",
  16: "limpeza",
  17: "tecnicos",
  18: "pedreiro",
  19: "pedreiro",
  20: "pedreiro",
  21: "telhadista",
  22: "serralheiro",
  23: "encanador",
  24: "pedreiro",
  25: "outros",
};

/** Equipe sugerida pelo sistema (sem considerar a escolha manual). */
export function equipeSugerida(i: Pick<Item, "chave" | "capitulo_codigo">): string {
  const eq = (i.chave && CHAVE_EQUIPE[i.chave]) || POR_CAPITULO[i.capitulo_codigo] || "outros";
  return JUNTO_COM[eq] ?? eq;
}

/** Equipe do item: a escolhida à mão ou a sugerida. */
export function equipeDoItem(i: Pick<Item, "chave" | "capitulo_codigo" | "equipe">): string {
  return i.equipe && EQUIPE[i.equipe] ? i.equipe : equipeSugerida(i);
}

export interface LinhaEquipe {
  equipe: Equipe;
  itens: Item[];
  mat: number;
  mo: number;
  total: number;
  /** O que a equipe cobra: M.O. para quem só executa; tudo para quem fornece e instala. */
  previsto: number;
}

/** Agrupa os itens por equipe, na ordem de EQUIPES. Itens de "Etapa futura" ficam de fora. */
export function porEquipe(itens: Item[]): LinhaEquipe[] {
  const map = new Map<string, LinhaEquipe>();
  for (const i of sortItens(itens)) {
    if (i.etapa === "Etapa futura") continue;
    const eq = EQUIPE[equipeDoItem(i)]!;
    let l = map.get(eq.id);
    if (!l) {
      l = { equipe: eq, itens: [], mat: 0, mo: 0, total: 0, previsto: 0 };
      map.set(eq.id, l);
    }
    const t = itemTotais(i);
    l.itens.push(i);
    l.mat += t.mat;
    l.mo += t.mo;
    l.total += t.total;
  }
  for (const l of map.values()) l.previsto = l.equipe.tipo === "mo" ? l.mo : l.total;
  return EQUIPES.flatMap((e) => (map.has(e.id) ? [map.get(e.id)!] : []));
}

/** Chave, em evfs.propostas_equipe, onde fica a estimativa original da equipe antes de aplicar a proposta. */
export const chaveEstimado = (id: string) => `${id}#estimado`;

/**
 * Distribui o valor global da proposta de uma equipe de mão de obra pelos itens dela, na proporção
 * da M.O. estimada de cada item (sem estimativa nenhuma, divide igualmente). Assim o EVF passa a
 * somar exatamente o valor da proposta, e cada serviço continua com um custo para a Curva ABC.
 * Como é uma escala proporcional, aplicar de novo o valor estimado volta aos números originais.
 */
export function ratearProposta(l: LinhaEquipe, valor: number): { id: string; mo_unit: number }[] {
  const itens = l.itens.filter((i) => itemTotais({ ...i, mo_unit: 1 }).mo > 0);
  if (!itens.length) return [];
  const pesos = itens.map((i) => itemTotais(i).mo);
  const soma = pesos.reduce((s, p) => s + p, 0);
  return itens.map((i, k) => {
    const parte = soma > 0 ? (valor * pesos[k]!) / soma : valor / itens.length;
    const base = itemTotais({ ...i, mo_unit: 1 }).mo;
    return { id: i.id, mo_unit: Math.round((parte / base) * 10000) / 10000 };
  });
}

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Texto pronto para mandar no WhatsApp ou e-mail pedindo a proposta da equipe. */
export function textoParaEquipe(
  l: LinhaEquipe,
  ambientes: Ambiente[],
  obra: { nome: string; local?: string | null | undefined },
): string {
  const grupos = new Map<string, Item[]>();
  for (const i of l.itens) {
    const nome = ambientes.find((a) => a.id === i.ambiente_id)?.nome ?? "Obra toda";
    grupos.set(nome, [...(grupos.get(nome) ?? []), i]);
  }
  const pedido =
    l.equipe.tipo === "mo"
      ? "Pedido de proposta de *mão de obra* para o conjunto dos serviços abaixo (o material é fornecido pela obra)."
      : l.equipe.tipo === "fornecedor"
        ? "Pedido de proposta de *fornecimento e instalação*."
        : "Lista de compras e contratações.";
  const linhas = [
    `*NL Arquitetos – ${obra.nome}*${obra.local ? ` (${obra.local})` : ""}`,
    `${l.equipe.nome}: ${pedido}`,
    "",
  ];
  for (const [amb, its] of grupos) {
    linhas.push(`*${amb}*`);
    for (const i of its)
      linhas.push(`• ${i.descricao} – ${num(Number(i.quantidade) || 0)} ${i.unidade}`);
    linhas.push("");
  }
  if (l.equipe.tipo === "mo")
    linhas.push(
      "Por favor, informe o *valor global* da mão de obra de todos os serviços, o prazo de execução e a forma de pagamento.",
      "Fase de estudo de viabilidade: a proposta ajuda a decidir o projeto.",
    );
  else if (l.equipe.tipo !== "compra")
    linhas.push(
      "Por favor, informe o valor por item (ou global), o prazo de execução e a forma de pagamento.",
      "Fase de estudo de viabilidade: a proposta ajuda a decidir o projeto.",
    );
  return linhas.join("\n").trim();
}
