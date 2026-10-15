/**
 * Intervenções guiadas: o arquiteto diz o que muda no ambiente ("trocar o piso") e responde poucas
 * perguntas de obra; o sistema monta todos os serviços que isso exige, com quantidades.
 */
import { AMBIENTE_MOLHADO } from "@/lib/biblioteca";
import type { Ambiente, Item, Medicao } from "@/lib/calc";
import { criarMontador } from "@/lib/montador";
import type { Interpretacao } from "@/lib/interpretar";
import { normaliza } from "@/lib/sugestoes";

export type Resposta = string | number;
export type Respostas = Record<string, Resposta>;

export interface Ctx {
  amb: Ambiente;
  nome: string;
  molhado: boolean;
  banheiro: boolean;
  cozinha: boolean;
  pd: number;
  perimetro: number;
}

export interface Pergunta {
  id: string;
  texto: string;
  ajuda?: string;
  tipo: "escolha" | "numero";
  opcoes?: [string, string][];
  unidade?: string;
  padrao: (c: Ctx) => Resposta;
  quando?: (r: Respostas) => boolean;
}

type Montador = ReturnType<typeof criarMontador>;

export interface Intervencao {
  id: string;
  nome: string;
  descricao: string;
  perguntas: Pergunta[];
  gerar: (r: Respostas, m: Montador, c: Ctx, avisos: string[]) => void;
}

const SIM_NAO: [string, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
];
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export const INTERVENCOES: Intervencao[] = [
  {
    id: "piso",
    nome: "Piso",
    descricao: "Trocar ou colocar piso novo",
    perguntas: [
      {
        id: "atual",
        texto: "E o piso de hoje?",
        tipo: "escolha",
        opcoes: [
          ["retirar", "Sai (retirar)"],
          ["porcima", "O novo vai por cima"],
          ["naotem", "Não tem (contrapiso ou laje)"],
        ],
        padrao: () => "retirar",
      },
      {
        id: "molhado",
        texto: "É área molhada (chuveiro, ralo, lavagem)?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: (c) => (c.molhado ? "sim" : "nao"),
      },
      {
        id: "ralo",
        texto: "O ralo…",
        tipo: "escolha",
        opcoes: [
          ["mesmo", "Fica no mesmo lugar"],
          ["muda", "Muda de lugar"],
          ["novo", "Precisa de ralo novo"],
        ],
        padrao: () => "mesmo",
        quando: (r) => r["molhado"] === "sim",
      },
      {
        id: "tipo",
        texto: "Qual piso?",
        tipo: "escolha",
        opcoes: [
          ["porcelanato", "Porcelanato ou cerâmica"],
          ["grande", "Porcelanato grande (90 cm ou mais)"],
          ["vinilico", "Vinílico"],
          ["laminado", "Laminado"],
          ["externo", "Antiderrapante (área externa)"],
        ],
        padrao: () => "porcelanato",
      },
      {
        id: "rodape",
        texto: "Rodapé",
        tipo: "escolha",
        opcoes: [
          ["novo", "Rodapé novo"],
          ["mantem", "Mantém o atual"],
          ["naotem", "Não tem (parede revestida)"],
        ],
        padrao: (c) => (c.molhado ? "naotem" : "novo"),
      },
    ],
    gerar: (r, m, c, avisos) => {
      const t = "Piso";
      const molhado = r["molhado"] === "sim";
      const tipo = String(r["tipo"]);
      const seco = tipo === "vinilico" || tipo === "laminado";
      if (r["atual"] === "retirar") m.propor("rem_piso", t, "O piso atual sai.");
      if (r["atual"] !== "porcima" || seco)
        m.propor(
          "regularizacao_contrapiso",
          t,
          "Base plana (e com caimento, se molhada) para o piso novo.",
          {
            desc: `Regularização de contrapiso${molhado ? ", nivelado e com caimento para o ralo" : ", nivelado"} – ${c.nome}`,
          },
        );
      if (r["atual"] === "porcima")
        avisos.push(
          "Piso sobre piso: argamassa para sobreposição, conferir aderência do piso antigo e se a porta continua abrindo (o nível sobe).",
        );
      if (molhado && !seco) {
        if (r["atual"] === "porcima")
          avisos.push(
            "Sobre o piso existente não se refaz a impermeabilização: confira se a antiga está boa.",
          );
        else m.propor("imperm_piso", t, "Área molhada: impermeabilizar antes do revestimento.");
        m.propor("teste_estanqueidade", t, "Toda impermeabilização passa pelo teste de 72 h.");
      }
      if (molhado) {
        if (r["ralo"] === "muda" || r["ralo"] === "novo") {
          m.propor("ponto_esgoto", t, "Ralo em lugar novo pede ponto de esgoto.", { qtd: 1 });
          m.propor("fechamento_rasgos", t, "Fechar o rasgo da tubulação.");
        }
        if (r["ralo"] !== "novo" || r["atual"] !== "naotem")
          m.propor("adequacao_ralo", t, "Ajustar o ralo ao nível do piso novo.");
        m.propor("ralo", t, "Grelha nova.", { desc: "Ralo (grelha nova)" });
        if (seco)
          avisos.push(
            `${tipo === "laminado" ? "Laminado" : "Vinílico"} não é indicado para área molhada.`,
          );
      }
      const nomes: Record<string, string> = {
        porcelanato: "porcelanato/cerâmica",
        grande: "porcelanato grande formato",
        vinilico: "vinílico",
        laminado: "laminado",
        externo: "antiderrapante",
      };
      m.propor(tipo === "externo" ? "piso_externo" : "piso", t, "Piso novo.", {
        desc: `Revestimento de piso em ${nomes[tipo] ?? "porcelanato"} – ${c.nome}`,
        especifico: true,
      });
      const p = m.props.get(tipo === "externo" ? "piso_externo" : "piso");
      if (p) p.perda = tipo === "grande" ? 15 : seco ? 5 : 10;
      if (r["rodape"] === "novo") m.propor("rodape", t, "Rodapé novo.");
      if (r["atual"] !== "naotem") {
        m.propor("soleira", t, "O nível muda na porta: soleira de transição.", { qtd: 1 });
        if (r["atual"] === "porcima")
          m.propor("ajuste_porta", t, "Porta precisa ser ajustada ao piso mais alto.");
      }
    },
  },
  {
    id: "paredes",
    nome: "Paredes",
    descricao: "Revestir paredes (azulejo, porcelanato, pastilha)",
    perguntas: [
      {
        id: "hoje",
        texto: "O que tem na parede hoje?",
        tipo: "escolha",
        opcoes: [
          ["azulejo", "Azulejo ou cerâmica (sai)"],
          ["porcima", "Azulejo (novo vai por cima)"],
          ["pintura", "Reboco pintado"],
        ],
        padrao: (c) => (c.molhado ? "azulejo" : "pintura"),
      },
      {
        id: "ate",
        texto: "Até onde vai o revestimento?",
        tipo: "escolha",
        opcoes: [
          ["teto", "Até o teto"],
          ["altura", "Até uma altura"],
        ],
        padrao: (c) => (c.cozinha ? "altura" : "teto"),
      },
      {
        id: "altura",
        texto: "Altura do revestimento",
        tipo: "numero",
        unidade: "m",
        padrao: (c) => (c.cozinha ? 1.5 : 1.6),
        quando: (r) => r["ate"] === "altura",
      },
      {
        id: "molhado",
        texto: "É área molhada (precisa impermeabilizar a parede)?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: (c) => (c.banheiro ? "sim" : "nao"),
      },
    ],
    gerar: (r, m, c) => {
      const t = "Paredes";
      const H = r["ate"] === "altura" ? Number(r["altura"]) || null : null;
      const parcial = H != null && H < c.pd - 0.01;
      const p = m.paredeAte(H);
      const ate = parcial ? ` até ${fmt(H!)} m` : "";
      if (r["hoje"] === "azulejo")
        m.propor("rem_parede", t, "O revestimento atual sai.", {
          qtd: p.qtd,
          base: p.base,
          desc: `Remoção do revestimento de parede${ate} – ${c.nome}`,
          especifico: true,
        });
      if (r["hoje"] === "pintura")
        m.propor(
          "lixamento_parede",
          t,
          "Sobre pintura, o revestimento só adere com a base preparada.",
          {
            qtd: p.qtd,
            base: p.base,
            desc: `Lixamento/apicoamento e chapisco da parede${ate} – ${c.nome}`,
            especifico: true,
          },
        );
      if (r["hoje"] !== "porcima")
        m.propor("regularizacao_reboco", t, "Parede no prumo e plana para o revestimento.", {
          qtd: p.qtd,
          base: p.base,
          desc: `Regularização de reboco${ate} – ${c.nome}`,
          especifico: true,
        });
      if (r["molhado"] === "sim") {
        const Hi = H ? Math.min(H, 1.8) : 1.8;
        const pi = m.paredeAte(Hi);
        m.propor("imperm_parede", t, `Área molhada: impermeabilizar até ${fmt(Hi)} m.`, {
          qtd: pi.qtd,
          base: pi.base,
          desc: `Impermeabilização de parede até ${fmt(Hi)} m, argamassa semiflexível – ${c.nome}`,
          especifico: true,
        });
      }
      m.propor(
        "parede_rev",
        t,
        parcial ? `Revestimento até ${fmt(H!)} m.` : "Revestimento até o teto.",
        {
          qtd: p.qtd,
          base: p.base,
          desc: `Revestimento de parede${ate}${r["hoje"] === "porcima" ? " sobre o existente" : ""} – ${c.nome}`,
          especifico: true,
        },
      );
      if (parcial && m.geo) {
        m.propor(
          "perfil_revestimento",
          t,
          "O revestimento para no meio da parede: acabamento no topo.",
          {
            qtd: Math.max(0, m.geo.perimetro - p.portas),
            base: null,
            desc: `Acabamento do topo do revestimento a ${fmt(H!)} m (perfil/cantoneira)`,
            especifico: true,
          },
        );
        m.propor("pint_parede", t, `Acima de ${fmt(H!)} m a parede é pintada.`, {
          qtd: Math.max(0, m.geo.paredes - p.qtd),
          base: null,
          desc: `Pintura da parede acima do revestimento (${fmt(H!)} a ${fmt(c.pd)} m) – ${c.nome}`,
          especifico: true,
        });
      }
    },
  },
  {
    id: "pintura",
    nome: "Pintura",
    descricao: "Pintar paredes e/ou teto",
    perguntas: [
      {
        id: "onde",
        texto: "O que pintar?",
        tipo: "escolha",
        opcoes: [
          ["ambos", "Paredes e teto"],
          ["paredes", "Só paredes"],
          ["teto", "Só teto"],
        ],
        padrao: () => "ambos",
      },
      {
        id: "estado",
        texto: "Como está a superfície?",
        tipo: "escolha",
        opcoes: [
          ["bom", "Boa (só repintar)"],
          ["ruim", "Com fissuras, mofo ou descascando"],
        ],
        padrao: () => "bom",
      },
      {
        id: "umida",
        texto: "Ambiente úmido (banheiro, cozinha, serviço)?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: (c) => (c.molhado ? "sim" : "nao"),
      },
    ],
    gerar: (r, m, c) => {
      const t = "Pintura";
      const extra = [
        r["estado"] === "ruim" ? "tratamento de fissuras e mofo" : "",
        r["umida"] === "sim" ? "tinta antimofo" : "",
      ]
        .filter(Boolean)
        .join(", ");
      const sufixo = extra ? ` (${extra})` : "";
      if (r["onde"] !== "teto")
        m.propor("pint_parede", t, "Pintura das paredes.", {
          desc: `Emassamento e pintura de paredes${sufixo} – ${c.nome}`,
        });
      if (r["onde"] !== "paredes")
        m.propor("pint_teto", t, "Pintura do teto.", {
          desc: `Emassamento e pintura de teto${sufixo} – ${c.nome}`,
        });
    },
  },
  {
    id: "forro",
    nome: "Forro",
    descricao: "Forro novo, manter ou só pintar o teto",
    perguntas: [
      {
        id: "hoje",
        texto: "O forro de hoje…",
        tipo: "escolha",
        opcoes: [
          ["sai", "Sai"],
          ["fica", "Fica (só pintar)"],
          ["naotem", "Não tem (laje)"],
        ],
        padrao: () => "naotem",
      },
      {
        id: "novo",
        texto: "Forro novo",
        tipo: "escolha",
        opcoes: [
          ["gesso", "Gesso"],
          ["drywall", "Drywall"],
          ["pvc", "PVC"],
          ["nenhum", "Nenhum (laje pintada)"],
        ],
        padrao: (c) => (c.molhado ? "drywall" : "gesso"),
        quando: (r) => r["hoje"] !== "fica",
      },
      {
        id: "spots",
        texto: "Quantos spots ou luminárias embutidas?",
        tipo: "numero",
        unidade: "un",
        padrao: () => 0,
      },
    ],
    gerar: (r, m, c) => {
      const t = "Forro";
      const umido = c.molhado;
      if (r["hoje"] === "sai") m.propor("rem_forro", t, "O forro atual sai.");
      const novo = r["hoje"] === "fica" ? "nenhum" : String(r["novo"]);
      if (novo === "gesso")
        m.propor("forro_gesso", t, "Forro novo.", {
          desc: `Forro de gesso${umido ? " (placa resistente à umidade)" : ""} – ${c.nome}`,
        });
      if (novo === "drywall")
        m.propor("forro_drywall", t, "Forro novo.", {
          desc: `Forro em drywall${umido ? ", placa RU" : ""} – ${c.nome}`,
        });
      if (novo === "pvc")
        m.propor("forro_gesso", t, "Forro novo.", { desc: `Forro de PVC – ${c.nome}` });
      if (novo !== "pvc") m.propor("pint_teto", t, "Teto pintado.");
      const spots = Number(r["spots"]) || 0;
      if (spots > 0) {
        m.propor("ponto_iluminacao", t, "Pontos para as luminárias embutidas.", { qtd: spots });
        m.propor("luminaria", t, "Luminárias embutidas.", { qtd: spots });
      }
    },
  },
  {
    id: "loucas",
    nome: "Louças e metais",
    descricao: "Vaso, cuba, chuveiro, box e acessórios",
    perguntas: [
      {
        id: "vaso",
        texto: "Vaso sanitário",
        tipo: "escolha",
        opcoes: [
          ["trocar", "Trocar"],
          ["manter", "Manter"],
          ["naotem", "Não tem"],
        ],
        padrao: () => "trocar",
      },
      {
        id: "lavatorio",
        texto: "Lavatório",
        tipo: "escolha",
        opcoes: [
          ["bancada", "Cuba com bancada de pedra"],
          ["coluna", "Cuba de coluna ou suspensa"],
          ["manter", "Manter"],
        ],
        padrao: () => "bancada",
      },
      {
        id: "chuveiro",
        texto: "Chuveiro",
        tipo: "escolha",
        opcoes: [
          ["eletrico", "Elétrico"],
          ["gas", "Água quente (gás ou solar)"],
          ["manter", "Manter"],
          ["naotem", "Não tem"],
        ],
        padrao: (c) => (/lavabo/.test(normaliza(c.nome)) ? "naotem" : "eletrico"),
      },
      {
        id: "box",
        texto: "Box",
        tipo: "escolha",
        opcoes: [
          ["novo", "Box novo"],
          ["manter", "Manter"],
          ["naotem", "Não tem"],
        ],
        padrao: (c) => (/lavabo/.test(normaliza(c.nome)) ? "naotem" : "novo"),
      },
      {
        id: "pontos",
        texto: "Algum ponto de água ou esgoto muda de lugar?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: () => "nao",
      },
      {
        id: "acessorios",
        texto: "Acessórios e espelho novos?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: () => "sim",
      },
    ],
    gerar: (r, m) => {
      const t = "Louças e metais";
      if (
        r["vaso"] === "trocar" ||
        r["lavatorio"] !== "manter" ||
        ["eletrico", "gas"].includes(String(r["chuveiro"]))
      )
        m.propor("rem_loucas", t, "Retirar o que vai ser trocado.");
      if (r["vaso"] === "trocar") m.propor("vaso", t, "Vaso novo.");
      if (r["lavatorio"] !== "manter") {
        m.propor("cuba", t, "Cuba nova.", {
          desc: r["lavatorio"] === "coluna" ? "Cuba de coluna ou suspensa" : "Cuba de banheiro",
        });
        m.propor("sifao", t, "Cuba nova pede sifão.");
        m.propor("torneira", t, "Torneira nova.");
        if (r["lavatorio"] === "bancada") {
          m.propor("bancada_banheiro", t, "Bancada de pedra para a cuba.");
          m.propor("chumbadores", t, "Bancada precisa de chumbadores.", { qtd: 2 });
        }
      }
      if (r["chuveiro"] === "eletrico") {
        m.propor("chuveiro", t, "Chuveiro novo.");
        m.propor("circuito_chuveiro", t, "Chuveiro elétrico pede circuito próprio.");
        m.propor("acab_registro", t, "Acabamentos de registro.", { qtd: 2 });
      }
      if (r["chuveiro"] === "gas") {
        m.propor("chuveiro", t, "Chuveiro com misturador.", {
          desc: "Chuveiro com misturador (água quente)",
        });
        m.propor("ponto_agua_quente", t, "Água quente no chuveiro e na cuba.", { qtd: 2 });
        m.propor("acab_registro", t, "Acabamentos de registro (quente e fria).", { qtd: 3 });
      }
      if (r["box"] === "novo") m.propor("box", t, "Box novo (medir depois do revestimento).");
      if (r["pontos"] === "sim") {
        m.propor("ponto_agua_fria", t, "Pontos de água mudando de lugar.", { qtd: 2 });
        m.propor("ponto_esgoto", t, "Ponto de esgoto mudando de lugar.", { qtd: 1 });
        m.propor("fechamento_rasgos", t, "Fechar os rasgos das tubulações.");
      }
      if (r["acessorios"] === "sim") {
        m.propor("acessorios_banho", t, "Papeleira, toalheiro e cabide.");
        m.propor("espelho", t, "Espelho.");
      }
    },
  },
  {
    id: "cozinha",
    nome: "Cozinha",
    descricao: "Bancada, cuba, armários e faixa da parede",
    perguntas: [
      {
        id: "bancada",
        texto: "Bancada",
        tipo: "escolha",
        opcoes: [
          ["granito", "Nova em granito"],
          ["quartzo", "Nova em quartzo"],
          ["porcelanato", "Nova em porcelanato"],
          ["manter", "Manter"],
        ],
        padrao: () => "granito",
      },
      {
        id: "cuba",
        texto: "Cuba e torneira",
        tipo: "escolha",
        opcoes: [
          ["nova", "Novas"],
          ["manter", "Manter"],
        ],
        padrao: () => "nova",
      },
      {
        id: "armarios",
        texto: "Armários",
        tipo: "escolha",
        opcoes: [
          ["novos", "Novos (marcenaria)"],
          ["manter", "Manter"],
          ["naotem", "Não terá"],
        ],
        padrao: () => "novos",
      },
      {
        id: "metros",
        texto: "Metros lineares de armário",
        tipo: "numero",
        unidade: "m",
        padrao: (c) => Math.max(2, Math.round(c.perimetro * 0.35 * 10) / 10),
        quando: (r) => r["armarios"] === "novos",
      },
      {
        id: "faixa",
        texto: "Revestir a faixa da parede da bancada (cerca de 60 cm)?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: () => "sim",
      },
      {
        id: "tomadas",
        texto: "Tomadas novas",
        tipo: "numero",
        unidade: "un",
        padrao: () => 4,
      },
      {
        id: "coifa",
        texto: "Coifa ou depurador?",
        tipo: "escolha",
        opcoes: SIM_NAO,
        padrao: () => "nao",
      },
    ],
    gerar: (r, m, c) => {
      const t = "Cozinha";
      const linear = Math.max(1.5, c.perimetro * 0.35);
      if (r["bancada"] !== "manter") {
        m.propor("rem_bancada", t, "A bancada atual sai.");
        m.propor("bancada_cozinha", t, "Bancada nova.", {
          qtd: Math.round(linear * 0.6 * 100) / 100,
          desc: `Bancada de cozinha em ${r["bancada"]} (com frontão)`,
        });
      }
      if (r["cuba"] === "nova") {
        m.propor("cuba_cozinha", t, "Cuba nova.");
        m.propor("torneira_cozinha", t, "Torneira nova.");
        m.propor("sifao", t, "Cuba nova pede sifão.");
      }
      if (r["armarios"] === "novos")
        m.propor("armario_cozinha", t, "Armários sob medida.", {
          qtd: Number(r["metros"]) || linear,
        });
      if (r["faixa"] === "sim")
        m.propor("parede_rev", t, "Faixa revestida atrás da bancada.", {
          qtd: Math.round(linear * 0.6 * 100) / 100,
          base: null,
          desc: `Revestimento da faixa da bancada (cerca de 60 cm) – ${c.nome}`,
          especifico: true,
        });
      const tomadas = (Number(r["tomadas"]) || 0) + (r["coifa"] === "sim" ? 1 : 0);
      if (tomadas > 0) m.propor("ponto_tomada", t, "Tomadas novas.", { qtd: tomadas });
      if (r["coifa"] === "sim") m.propor("coifa", t, "Coifa ou depurador.");
    },
  },
];

export function contexto(amb: Ambiente, perimetro: number): Ctx {
  const nome = normaliza(amb.nome);
  return {
    amb,
    nome: amb.nome,
    molhado: AMBIENTE_MOLHADO.test(nome),
    banheiro: /banh|wc|lavabo|sanit/.test(nome),
    cozinha: /cozinha|copa|gourmet/.test(nome),
    pd: Number(amb.pe_direito) || 2.6,
    perimetro,
  };
}

export function respostasPadrao(i: Intervencao, c: Ctx): Respostas {
  return Object.fromEntries(i.perguntas.map((p) => [p.id, p.padrao(c)]));
}

/** Monta as propostas da intervenção, comparando com o que o ambiente já tem. */
export function aplicarIntervencao(
  i: Intervencao,
  r: Respostas,
  amb: Ambiente,
  medicoes: Medicao[],
  itens: Item[],
): Interpretacao {
  const m = criarMontador(amb, medicoes, itens);
  const c = contexto(amb, m.geo?.perimetro ?? 0);
  const avisos: string[] = [];
  i.gerar(r, m, c, avisos);
  if (m.geo && !m.geo.piso && [...m.props.values()].some((p) => p.base_qtd))
    avisos.push(
      `${amb.nome} ainda não tem medidas: os serviços ligados ao piso, às paredes e ao teto entram com 0 e se ajustam quando você informar as medidas.`,
    );
  return m.fechar(avisos, []);
}
