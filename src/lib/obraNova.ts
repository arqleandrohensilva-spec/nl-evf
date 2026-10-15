/**
 * Construção do zero: a partir dos dados da casa (terreno, ambientes, pavimentos, padrão e sistemas),
 * monta a obra inteira — ambientes com portas e janelas e todos os serviços por etapa — com
 * quantidades paramétricas. É estimativa de EVF: cada número sai de uma premissa escrita, e os itens
 * ligados às medidas se ajustam sozinhos quando a planta real entra em "Ambientes e medidas".
 */
import { SERVICO, type Base } from "@/lib/biblioteca";
import type { Ambiente, Medicao } from "@/lib/calc";
import { geometria, normaliza } from "@/lib/sugestoes";
import type { LinhaNova } from "@/lib/actions";

export type TipoAmb =
  | "sala"
  | "quarto"
  | "suite"
  | "banheiro"
  | "lavabo"
  | "cozinha"
  | "servico"
  | "garagem"
  | "varanda"
  | "gourmet"
  | "escritorio"
  | "circulacao";

export type Padrao = "Baixo" | "Médio" | "Alto";

export interface AmbientePrograma {
  nome: string;
  tipo: TipoAmb;
  area: number;
  pavimento: 1 | 2;
}

export interface Programa {
  terreno: { frente: number; fundo: number; topografia: "plano" | "aclive" | "declive" };
  pavimentos: 1 | 2;
  peDireito: number;
  padrao: Padrao;
  fundacao: "radier" | "sapata" | "estacas";
  cobertura: "ceramica" | "fibrocimento" | "termoacustica" | "laje";
  forro: "gesso" | "laje" | "pvc";
  muro: boolean;
  ambientes: AmbientePrograma[];
}

const IDX = { Baixo: 0, Médio: 1, Alto: 2 } as const;

export const TIPOS_AMB: Record<
  TipoAmb,
  { rotulo: string; area: [number, number, number]; janela: number; porta: boolean }
> = {
  sala: { rotulo: "Sala", area: [14, 20, 30], janela: 1 / 6, porta: false },
  quarto: { rotulo: "Quarto", area: [8, 10, 12], janela: 1 / 6, porta: true },
  suite: { rotulo: "Suíte", area: [10, 13, 16], janela: 1 / 6, porta: true },
  banheiro: { rotulo: "Banheiro", area: [3, 3.5, 4.5], janela: 0, porta: true },
  lavabo: { rotulo: "Lavabo", area: [2, 2.5, 3], janela: 0, porta: true },
  cozinha: { rotulo: "Cozinha", area: [7, 10, 14], janela: 1 / 8, porta: false },
  servico: { rotulo: "Área de serviço", area: [3, 4, 6], janela: 1 / 8, porta: false },
  garagem: { rotulo: "Garagem", area: [12.5, 25, 30], janela: 0, porta: false },
  varanda: { rotulo: "Varanda", area: [5, 8, 12], janela: 0, porta: false },
  gourmet: { rotulo: "Área gourmet", area: [10, 14, 20], janela: 0, porta: false },
  escritorio: { rotulo: "Escritório", area: [6, 8, 10], janela: 1 / 6, porta: true },
  circulacao: { rotulo: "Circulação", area: [4, 6, 8], janela: 0, porta: false },
};

/** Tipo pelo nome do ambiente ("Banheiro suíte" → banheiro). */
export function classificar(nome: string): TipoAmb {
  const n = normaliza(nome);
  if (/lavabo/.test(n)) return "lavabo";
  if (/banh|wc|sanitario/.test(n)) return "banheiro";
  if (/suite/.test(n)) return "suite";
  if (/quarto|dormit/.test(n)) return "quarto";
  if (/gourmet|churrasq/.test(n)) return "gourmet";
  if (/cozinha|copa/.test(n)) return "cozinha";
  if (/servico|lavanderia/.test(n)) return "servico";
  if (/garagem|abrigo/.test(n)) return "garagem";
  if (/varanda|terraco|sacada|alpendre/.test(n)) return "varanda";
  if (/escritorio|home office|estudo/.test(n)) return "escritorio";
  if (/circula|corredor|hall|escada/.test(n)) return "circulacao";
  return "sala";
}

/** Casa térrea típica para começar: 3 quartos (1 suíte), 2 banheiros, garagem e varanda. */
export function programaPadrao(padrao: Padrao = "Médio"): Programa {
  const a = (tipo: TipoAmb, nome?: string): AmbientePrograma => ({
    nome: nome ?? TIPOS_AMB[tipo].rotulo,
    tipo,
    area: TIPOS_AMB[tipo].area[IDX[padrao]],
    pavimento: 1,
  });
  return {
    terreno: { frente: 10, fundo: 25, topografia: "plano" },
    pavimentos: 1,
    peDireito: 2.7,
    padrao,
    fundacao: "sapata",
    cobertura: "ceramica",
    forro: "gesso",
    muro: true,
    ambientes: [
      a("sala", "Sala de estar e jantar"),
      a("cozinha"),
      a("servico"),
      a("suite", "Suíte"),
      a("banheiro", "Banheiro da suíte"),
      a("quarto", "Quarto 1"),
      a("quarto", "Quarto 2"),
      a("banheiro", "Banheiro social"),
      a("garagem"),
      a("varanda"),
    ],
  };
}

export interface AmbienteGerado {
  nome: string;
  tipo: TipoAmb;
  pavimento: 1 | 2;
  comprimento: number;
  largura: number;
  pe_direito: number;
  vaos: { descricao: string; largura: number; altura: number }[];
  linhas: Omit<LinhaNova, "ambiente_id">[];
}

export interface ObraEstimada {
  ambientes: AmbienteGerado[];
  gerais: LinhaNova[];
  numeros: {
    areaUtil: number;
    areaConstruida: number;
    areaPorPavimento: number[];
    perimetroExterno: number[];
    paredes: number;
    alvenaria: number;
    fachada: number;
    cobertura: number;
    concreto: number;
    duracaoMeses: number;
  };
  premissas: string[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r05 = (v: number) => Math.round(v * 20) / 20;
const fmt = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

function linha(
  chave: string,
  quantidade: number,
  o: { desc?: string; base?: Base | null; fator?: number } = {},
): Omit<LinhaNova, "ambiente_id"> {
  const s = SERVICO[chave];
  if (!s) throw new Error(`Serviço desconhecido: ${chave}`);
  return {
    capitulo_codigo: s.cap,
    descricao: o.desc ?? s.desc,
    unidade: s.un,
    quantidade: r2(quantidade),
    perda_pct: s.perda ?? 0,
    material_unit: 0,
    mo_unit: s.mo ?? 0,
    tipo_preco: s.tipo,
    chave,
    base_qtd: o.base ?? null,
    fator: o.fator ?? 1,
  };
}

export function estimarObra(p: Programa): ObraEstimada {
  const pd = p.peDireito || 2.7;
  const ip = IDX[p.padrao];
  const premissas: string[] = [];
  const pavs = p.pavimentos === 2 ? [1, 2] : [1];

  // Ambientes (com circulação de 8% por pavimento) e medidas estimadas (proporção 1 : 1,25).
  const lista: AmbientePrograma[] = [...p.ambientes.filter((a) => a.area > 0)];
  for (const pv of pavs) {
    const doPav = lista.filter((a) => (a.pavimento ?? 1) === pv);
    const temCirc = doPav.some((a) => a.tipo === "circulacao");
    const soma = doPav.reduce((s, a) => s + a.area, 0);
    if (!temCirc && soma > 0)
      lista.push({
        nome: p.pavimentos === 2 ? `Circulação e escada (${pv}º pav.)` : "Circulação",
        tipo: "circulacao",
        area: r2(Math.max(3, soma * 0.08)),
        pavimento: pv as 1 | 2,
      });
  }
  premissas.push(
    "Medidas dos ambientes estimadas pela área (proporção 1 : 1,25). Ajuste com a planta em “Ambientes e medidas”: os serviços ligados se recalculam.",
  );

  const ambientes: AmbienteGerado[] = lista.map((a) => {
    const largura = r05(Math.sqrt(a.area / 1.25));
    const comprimento = r05(a.area / largura);
    const cfg = TIPOS_AMB[a.tipo];
    const vaos: AmbienteGerado["vaos"] = [];
    if (cfg.porta) vaos.push({ descricao: "porta", largura: 0.8, altura: 2.1 });
    if (a.tipo === "banheiro" || a.tipo === "lavabo")
      vaos.push({ descricao: "janela", largura: 0.6, altura: 0.6 });
    else if (cfg.janela > 0) {
      const area = a.area * cfg.janela;
      const alt = a.tipo === "cozinha" || a.tipo === "servico" ? 1.0 : 1.2;
      vaos.push({ descricao: "janela", largura: r05(area / alt), altura: alt });
    }
    return {
      nome: a.nome,
      tipo: a.tipo,
      pavimento: a.pavimento ?? 1,
      comprimento,
      largura,
      pe_direito: pd,
      vaos,
      linhas: [],
    };
  });
  premissas.push(
    "Janelas pela regra de iluminação (1/6 do piso em quartos e salas, 1/8 em cozinha e serviço); portas internas de 0,80 × 2,10 m.",
  );

  // Geometria de cada ambiente (com os vãos descontados).
  const geo = ambientes.map((a, i) => {
    const amb: Ambiente = {
      id: `g${i}`,
      evf_id: "",
      nome: a.nome,
      ordem: i,
      comprimento: a.comprimento,
      largura: a.largura,
      pe_direito: a.pe_direito,
      area_vaos: 0,
      descricao_servico: null,
    };
    const meds: Medicao[] = a.vaos.map((v, k) => ({
      id: `m${i}-${k}`,
      ambiente_id: amb.id,
      descricao: v.descricao,
      largura: v.largura,
      altura: v.altura,
      profundidade: 0,
      quantidade: 1,
      sinal: -1,
      tipo: "vao",
      ordem: k,
      created_at: "",
    }));
    return geometria(amb, meds);
  });

  // Números da casa por pavimento.
  const fechado = (t: TipoAmb) => t !== "varanda" && t !== "garagem" && t !== "gourmet";
  const areaUtilPav = pavs.map((pv) =>
    ambientes.reduce((s, a, i) => s + (a.pavimento === pv ? geo[i]!.piso : 0), 0),
  );
  const areaConstPav = areaUtilPav.map((a) => a * 1.12);
  const pext = areaConstPav.map((a) => 4.5 * Math.sqrt(a));
  const paredesPav = pavs.map((pv, k) => {
    const somaPerim = ambientes.reduce(
      (s, a, i) => s + (a.pavimento === pv && fechado(a.tipo) ? geo[i]!.perimetro : 0),
      0,
    );
    return (somaPerim + pext[k]!) / 2;
  });
  const vaosPav = pavs.map((pv) =>
    ambientes.reduce(
      (s, a) => s + (a.pavimento === pv ? a.vaos.reduce((x, v) => x + v.largura * v.altura, 0) : 0),
      0,
    ),
  );
  const portaExt = 2 * 0.9 * 2.1;
  const temTelhado = p.cobertura !== "laje";
  const oitao = temTelhado ? pext[pext.length - 1]! * 0.6 : pext[pext.length - 1]! * 0.8;
  const alvenaria =
    paredesPav.reduce((s, l) => s + l * pd, 0) -
    vaosPav.reduce((s, v) => s + v, 0) -
    portaExt +
    oitao;
  const janelasExt = ambientes.reduce(
    (s, a) =>
      s +
      a.vaos.filter((v) => v.descricao === "janela").reduce((x, v) => x + v.largura * v.altura, 0),
    0,
  );
  const fachada = pext.reduce((s, pe) => s + pe * (pd + 0.3), 0) + oitao - janelasExt - portaExt;
  const areaUtil = areaUtilPav.reduce((s, a) => s + a, 0);
  const areaConstruida = areaConstPav.reduce((s, a) => s + a, 0);
  const ultimo = areaConstPav[areaConstPav.length - 1]!;
  const pextUlt = pext[pext.length - 1]!;
  const projCobertura = ultimo + pextUlt * 0.6;
  const coberturaInclinada = projCobertura * 1.15;
  const concreto = 0.035 * areaConstruida + (p.pavimentos === 2 ? 0.01 * areaConstPav[0]! : 0);
  const duracaoMeses = Math.min(
    24,
    Math.max(6, Math.round(5 + areaConstruida / 22) + (p.padrao === "Alto" ? 2 : 0)),
  );
  premissas.push(
    `Área construída = área útil × 1,12 (paredes). Perímetro externo ≈ 4,5 × √área do pavimento. Comprimento de paredes = (soma dos perímetros dos ambientes + perímetro externo) ÷ 2.`,
    `Estrutura em concreto armado com alvenaria de vedação: ${fmt(0.035, 3)} m³ de concreto por m² construído (pilares e vigas). Definir no projeto estrutural.`,
    `Prazo estimado de ${duracaoMeses} meses (gestão, consumo de água e energia e locações acompanham esse prazo).`,
  );

  // ------------------------------------------------------------------ Itens gerais da obra
  const G: LinhaNova[] = [];
  const g = (chave: string, q: number, o?: Parameters<typeof linha>[2]) =>
    G.push({ ...linha(chave, q, o), ambiente_id: null });
  const terreno = p.terreno.frente * p.terreno.fundo;

  g("gestao_mensal", duracaoMeses);
  g("projetos_complementares", 1);
  g("sondagem", 1);
  g("topografia", 1);
  g("aprovacao_prefeitura", 1);
  g("inss_obra", 1);
  g("habite_se", 1);
  g("rrt", 1);
  g("seguro_obra", 1);
  g("impressao_projetos", 1);
  g("placa_obra", 1);

  g("limpeza_terreno", terreno, { desc: "Limpeza do terreno (roçada e remoção de vegetação)" });
  if (p.terreno.topografia !== "plano") {
    const m3 = terreno * (p.terreno.topografia === "declive" ? 0.6 : 0.3);
    g("terraplanagem", m3);
    premissas.push(
      `Terraplanagem estimada em ${fmt(m3, 0)} m³ (${p.terreno.topografia === "declive" ? "0,6" : "0,3"} m³ por m² de terreno). Confirmar com o levantamento topográfico.`,
    );
  }
  g("locacao_obra", pext[0]! + 4);
  g("tapume_barracao", 1);
  g("ligacao_provisoria", 1);
  g("consumo_obra", duracaoMeses);
  g("cacamba", Math.max(2, Math.ceil(areaConstruida / 20)));
  g("betoneira", Math.max(1, Math.ceil(duracaoMeses * 0.6)));
  g("andaime", Math.max(1, Math.ceil(duracaoMeses * (p.pavimentos === 2 ? 0.5 : 0.3))));
  g("ligacoes_definitivas", 1);

  // Fundação
  const paredesTerreo = paredesPav[0]!;
  if (p.fundacao === "radier") {
    g("radier", areaConstPav[0]! * 1.05);
  } else if (p.fundacao === "sapata") {
    g("sapata_corrida", paredesTerreo);
    g("baldrame", paredesTerreo, { desc: "Vigas baldrame" });
    g("imperm_baldrame", paredesTerreo);
  } else {
    g("estacas", Math.ceil(areaConstPav[0]! / 9));
    g("baldrame", paredesTerreo, { desc: "Vigas baldrame" });
    g("imperm_baldrame", paredesTerreo);
  }
  premissas.push(
    "Fundação estimada sem sondagem: o tipo e as quantidades saem do projeto estrutural com a sondagem SPT.",
  );

  // Estrutura e vedações
  g("pilares_vigas", concreto);
  const lajes: string[] = [];
  let laje = 0;
  if (p.pavimentos === 2) {
    laje += areaConstPav[1]!;
    lajes.push("entrepiso");
  }
  if (p.forro === "laje" || p.cobertura === "laje") {
    laje += ultimo;
    lajes.push("cobertura/forro");
  }
  if (laje > 0) {
    g("laje", laje, { desc: `Laje treliçada (${lajes.join(" + ")})` });
    g("escoramento", lajes.length);
  }
  g("alvenaria", alvenaria, {
    desc: `Alvenaria de vedação em bloco${temTelhado ? " (inclui oitões)" : " (inclui platibanda)"}`,
  });
  const vergas = ambientes.reduce(
    (s, a) =>
      s + a.vaos.reduce((x, v) => x + (v.largura + 0.6) * (v.descricao === "janela" ? 2 : 1), 0),
    0,
  );
  g("verga", vergas + 2 * 1.5);
  g("emboco_externo", fachada);

  // Cobertura
  if (temTelhado) {
    const telha =
      p.cobertura === "ceramica"
        ? "telha cerâmica"
        : p.cobertura === "fibrocimento"
          ? "telha de fibrocimento"
          : "telha termoacústica";
    g("estrutura_telhado", coberturaInclinada, {
      desc: `Estrutura do telhado (madeira ou metálica) – ${telha}`,
    });
    g("telhamento", coberturaInclinada, { desc: `Telhamento em ${telha}` });
    if (p.cobertura !== "termoacustica" && ip >= 1) g("manta_termica", coberturaInclinada);
    g("rufos_calhas", pextUlt);
    premissas.push(
      `Cobertura: projeção do último pavimento + beiral de 0,60 m, × 1,15 pela inclinação = ${fmt(coberturaInclinada, 1)} m².`,
    );
  } else {
    g("imperm_laje", ultimo, { desc: "Impermeabilização da laje de cobertura com manta" });
    g("rufos_calhas", pextUlt);
  }

  // Instalações gerais
  g("caixa_dagua", 1);
  g("esgoto_externo", p.terreno.fundo * 0.6 + 6);
  g("pluviais", pextUlt);
  g("entrada_energia", 1);
  g("quadro", p.pavimentos === 2 ? 2 : 1);
  g("aterramento", 1);
  if (ip === 2) g("aquecedor", 1, { desc: "Aquecimento central (gás ou solar)" });

  // Fachada, esquadrias externas e portas
  g("pint_externa", fachada);
  g("porta_externa", 2);
  const nPortas = ambientes.filter((a) => TIPOS_AMB[a.tipo].porta).length;
  g("pint_portas", nPortas + 2);
  g("soleira", 2, { desc: "Soleira em pedra (portas externas)" });

  // Área externa
  if (p.muro) {
    const muro = 2 * p.terreno.fundo + p.terreno.frente;
    g("muro", muro, { desc: "Muro de divisa (laterais, fundo e frente)" });
    premissas.push(
      `Muro em todo o perímetro do terreno: ${fmt(muro, 1)} m (portão descontado no orçamento final).`,
    );
  }
  const calcada = p.terreno.frente * 2 + 12;
  g("calcada", calcada, { desc: "Calçada (passeio público e acessos)" });
  const jardim = Math.max(0, (terreno - areaConstPav[0]! - calcada) * 0.5);
  if (jardim > 0) g("paisagismo", jardim);
  if (!ambientes.some((a) => a.tipo === "garagem")) g("portao", 1);
  g("limpeza_final", 1, { desc: "Limpeza pós-obra (bruta + fina) da casa toda" });

  // ------------------------------------------------------------------ Por ambiente
  for (const [i, a] of ambientes.entries()) {
    const G0 = geo[i]!;
    const L = a.linhas;
    const add = (chave: string, q: number, o?: Parameters<typeof linha>[2]) =>
      L.push(linha(chave, q, o));
    const lig = (chave: string, base: Exclude<Base, "manual" | "item">, fator = 1, desc?: string) =>
      L.push(
        linha(chave, G0[base] * fator, {
          base,
          fator,
          desc: desc ?? `${SERVICO[chave]!.desc} – ${a.nome}`,
        }),
      );
    const molhado = ["banheiro", "lavabo", "cozinha", "servico", "gourmet", "varanda"].includes(
      a.tipo,
    );
    const externo = a.tipo === "varanda" || a.tipo === "garagem" || a.tipo === "gourmet";
    const janela = a.vaos.find((v) => v.descricao === "janela");

    // Base
    lig("contrapiso", "piso");
    if (
      a.tipo === "banheiro" ||
      a.tipo === "servico" ||
      a.tipo === "varanda" ||
      a.tipo === "gourmet"
    )
      lig("imperm_piso", "piso");
    if (a.tipo === "banheiro") {
      lig("imperm_parede", "perimetro", 1.8);
      add("teste_estanqueidade", 1);
    }
    if (!externo) {
      lig("chapisco", "paredes");
      lig("emboco", "paredes");
    }

    // Instalações
    const tomadas =
      a.tipo === "cozinha"
        ? Math.ceil(G0.perimetro / 3.5) + 2
        : a.tipo === "servico"
          ? 3
          : a.tipo === "banheiro" || a.tipo === "lavabo"
            ? 1
            : a.tipo === "gourmet"
              ? 5
              : a.tipo === "garagem" || a.tipo === "varanda"
                ? 2
                : a.tipo === "circulacao"
                  ? 1
                  : Math.max(2, Math.ceil(G0.perimetro / 5));
    add("ponto_tomada", tomadas, { desc: `Pontos de tomada – ${a.nome}` });
    add("ponto_interruptor", a.tipo === "circulacao" && p.pavimentos === 2 ? 2 : 1, {
      desc: `Pontos de interruptor – ${a.nome}`,
    });
    add("ponto_iluminacao", 1 + Math.floor(G0.piso / 12), {
      desc: `Pontos de iluminação – ${a.nome}`,
    });
    const agua: Partial<Record<TipoAmb, number>> = {
      banheiro: ip >= 1 ? 4 : 3,
      lavabo: 2,
      cozinha: 2,
      servico: 3,
      gourmet: 1,
      garagem: 1,
    };
    const esgoto: Partial<Record<TipoAmb, number>> = {
      banheiro: 3,
      lavabo: 2,
      cozinha: 1,
      servico: 3,
      gourmet: 1,
    };
    if (agua[a.tipo])
      add("ponto_agua_fria", agua[a.tipo]!, { desc: `Pontos de água fria – ${a.nome}` });
    if (ip >= 1 && (a.tipo === "banheiro" || (ip === 2 && a.tipo === "cozinha")))
      add("ponto_agua_quente", a.tipo === "banheiro" ? 2 : 1, {
        desc: `Pontos de água quente – ${a.nome}`,
      });
    if (esgoto[a.tipo])
      add("ponto_esgoto", esgoto[a.tipo]!, { desc: `Pontos de esgoto – ${a.nome}` });
    if (a.tipo === "banheiro" && ip < 2) add("circuito_chuveiro", 1);
    if (
      (ip === 2 && ["quarto", "suite", "sala", "escritorio"].includes(a.tipo)) ||
      (ip === 1 && a.tipo === "suite")
    )
      add("infra_ar", 1);
    if (ip >= 1 && ["sala", "quarto", "suite", "escritorio"].includes(a.tipo)) add("logica_tv", 1);

    // Forro e revestimentos
    if (!externo || a.tipo === "gourmet") {
      if (p.forro === "gesso")
        lig(
          "forro_gesso",
          "teto",
          1,
          `Forro de gesso${molhado ? " (placa resistente à umidade)" : ""} – ${a.nome}`,
        );
      else if (p.forro === "pvc") lig("forro_gesso", "teto", 1, `Forro de PVC – ${a.nome}`);
    }
    if (externo) lig("piso_externo", "piso");
    else lig("piso", "piso");

    if (a.tipo === "banheiro") {
      if (ip === 0) {
        lig("parede_rev", "perimetro", 1.5, `Revestimento de parede até 1,50 m – ${a.nome}`);
        lig("pint_parede", "paredes", 0.35, `Pintura da parede acima do revestimento – ${a.nome}`);
      } else lig("parede_rev", "paredes");
    } else if (
      a.tipo === "lavabo" ||
      a.tipo === "cozinha" ||
      a.tipo === "servico" ||
      a.tipo === "gourmet"
    ) {
      const f = ip === 2 && a.tipo !== "servico" ? 1 : 0.5;
      lig(
        "parede_rev",
        "paredes",
        f,
        `Revestimento de parede${f < 1 ? " (faixa das bancadas)" : ""} – ${a.nome}`,
      );
      if (f < 1) lig("pint_parede", "paredes", 1 - f);
    } else if (!externo) {
      lig("pint_parede", "paredes");
      lig("rodape", "perimetro");
    } else if (a.tipo === "varanda") lig("rodape", "perimetro");
    if (a.tipo !== "garagem" || ip >= 1) lig("pint_teto", "teto");

    // Louças, metais, bancadas e equipamentos
    if (a.tipo === "banheiro") {
      add("vaso", 1);
      add("cuba", 1);
      add("torneira", 1);
      add("sifao", 1);
      add("chuveiro", 1);
      if (ip >= 1) add("ducha", 1);
      add("acab_registro", ip >= 1 ? 3 : 2);
      add("ralo", 2);
      add("acessorios_banho", 1);
      add("bancada_banheiro", 1);
      add("box", 1);
      add("espelho", 1);
      add("soleira", 1);
    }
    if (a.tipo === "lavabo") {
      add("vaso", 1);
      add("cuba", 1);
      add("torneira", 1);
      add("sifao", 1);
      add("acessorios_banho", 1);
      add("bancada_banheiro", 1);
      add("espelho", 0.8);
    }
    if (a.tipo === "cozinha" || a.tipo === "gourmet") {
      const bancada = r2(Math.max(1.2, G0.perimetro * 0.35) * 0.6);
      add("bancada_cozinha", bancada);
      add("cuba_cozinha", 1);
      add("torneira_cozinha", 1);
      add("sifao", 1);
      if (a.tipo === "gourmet") add("churrasqueira", 1);
      if (ip >= 1 && a.tipo === "cozinha") add("armario_cozinha", r2(G0.perimetro * 0.35));
      if (ip === 2 && a.tipo === "cozinha") {
        add("coifa", 1);
        add("cooktop", 1);
      }
    }
    if (a.tipo === "servico") {
      add("tanque", 1);
      add("torneira_tanque", 2);
      add("ralo", 1);
    }
    if (a.tipo === "varanda" || a.tipo === "gourmet") add("ralo", 1);
    if (a.tipo === "garagem") add("portao", 1);
    if (ip >= 1 && (a.tipo === "suite" || (ip === 2 && a.tipo === "quarto")))
      add("armario_quarto", r2(a.largura * 2.6));

    // Esquadrias
    if (TIPOS_AMB[a.tipo].porta) add("porta_interna", 1);
    if (janela) {
      add("janela", janela.largura * janela.altura, {
        desc: `Janela ${fmt(janela.largura)} × ${fmt(janela.altura)} m – ${a.nome}`,
      });
      add("peitoril", janela.largura);
    }
  }
  premissas.push(
    "Pontos elétricos pela NBR 5410 (tomadas a cada 5 m de perímetro em salas e quartos, 3,5 m na cozinha) e hidráulicos por peça de louça.",
    `Padrão ${p.padrao}: ${ip === 0 ? "revestimento de banheiro até 1,50 m, chuveiro elétrico, sem armários" : ip === 1 ? "banheiro revestido até o teto, água quente nos banheiros, armário de cozinha e da suíte" : "revestimento pleno, aquecimento central, ar-condicionado nos quartos e sala, marcenaria completa"}.`,
  );

  return {
    ambientes,
    gerais: G,
    numeros: {
      areaUtil: r2(areaUtil),
      areaConstruida: r2(areaConstruida),
      areaPorPavimento: areaConstPav.map(r2),
      perimetroExterno: pext.map(r2),
      paredes: r2(paredesPav.reduce((s, l) => s + l, 0)),
      alvenaria: r2(alvenaria),
      fachada: r2(fachada),
      cobertura: r2(temTelhado ? coberturaInclinada : ultimo),
      concreto: r2(concreto),
      duracaoMeses,
    },
    premissas,
  };
}
