import { describe, expect, it } from "vitest";
import type { Ambiente, Item, Medicao } from "@/lib/calc";
import { interpretar } from "@/lib/interpretar";

const wc: Ambiente = {
  id: "bf",
  evf_id: "e",
  nome: "Banheiro Feminino",
  ordem: 0,
  comprimento: 2.3,
  largura: 2.68,
  pe_direito: 2.27,
  area_vaos: 0,
  descricao_servico: null,
};
const med = (extra: Partial<Medicao>): Medicao => ({
  id: "m",
  ambiente_id: "bf",
  descricao: "",
  largura: 0,
  altura: 0,
  profundidade: 0,
  quantidade: 1,
  sinal: -1,
  tipo: "vao",
  ordem: 0,
  created_at: "",
  ...extra,
});
const porta = med({ descricao: "porta", largura: 0.9, altura: 2.1 });
let k = 0;
const item = (descricao: string, chave: string | null, extra: Partial<Item> = {}): Item => ({
  id: `i${++k}`,
  evf_id: "e",
  ambiente_id: "bf",
  capitulo_codigo: 1,
  codigo: `${k}`,
  descricao,
  unidade: "m²",
  quantidade: 1,
  perda_pct: 0,
  material_unit: 0,
  mo_unit: 0,
  tipo_preco: "composicao",
  etapa: "Agora",
  ordem: k,
  criterio_cotacao: "media",
  justificativa: null,
  chave,
  base_qtd: null,
  base_item_id: null,
  fator: 1,
  link: null,
  origem_preco: null,
  equipe: null,
  ...extra,
});

const TEXTO = `Vamos ter que tirar todo piso que está nele, deixar plano, arrumar o ralo, para depois colocar um novo piso com as novas louças.
O mesmo da parede: lixar, passar, e tudo que tem que fazer para impermeabilizar para colocar o mesmo revestimento do piso na parede até 1,75 m.
Manter o forro, só pintar.`;

describe("interpretar o que será feito", () => {
  it("banheiro do condomínio: piso, ralo, louças, parede até 1,75 m e forro mantido", () => {
    const r = interpretar(TEXTO, wc, [porta], []);
    const ch = r.propostas.filter((p) => p.acao === "adicionar").map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining([
        "rem_piso",
        "regularizacao_contrapiso",
        "adequacao_ralo",
        "ralo",
        "piso",
        "vaso",
        "cuba",
        "rem_loucas",
        "lixamento_parede",
        "imperm_parede",
        "regularizacao_reboco",
        "parede_rev",
        "perfil_revestimento",
        "pint_parede",
        "pint_teto",
      ]),
    );
    expect(ch).not.toContain("imperm_piso");
    expect(ch).not.toContain("forro_drywall");
    const parede = r.propostas.find((p) => p.chave === "parede_rev");
    // (9,96 × 1,75) − porta 0,90 × 1,75
    expect(parede?.quantidade).toBeCloseTo(9.06 * 1.75, 2);
    expect(parede?.descricao).toMatch(/até 1,75 m, mesmo revestimento do piso/);
    expect(r.propostas.find((p) => p.chave === "perfil_revestimento")?.quantidade).toBeCloseTo(
      9.06,
      2,
    );
    expect(r.propostas.find((p) => p.chave === "regularizacao_contrapiso")?.descricao).toMatch(
      /caimento para o ralo/,
    );
    expect(r.naoEntendi).toEqual([]);
  });

  it("manter o forro tira do escopo a remoção e o forro novo; altura nova atualiza a impermeabilização", () => {
    const its = [
      item("Remoção de forro – Banheiro Feminino", "rem_forro"),
      item("Forro em drywall, placa RU", "forro_drywall"),
      item("Impermeabilização de parede até 1,80 m – Banheiro Feminino", "imperm_parede", {
        quantidade: 17.93,
      }),
      item("Revestimento de piso antiderrapante", "piso", { quantidade: 6.164, base_qtd: "piso" }),
    ];
    const r = interpretar(TEXTO, wc, [porta], its);
    const remover = r.propostas.filter((p) => p.acao === "remover").map((p) => p.chave);
    expect(remover).toEqual(expect.arrayContaining(["rem_forro", "forro_drywall"]));
    const atual = r.propostas.find((p) => p.acao === "atualizar" && p.chave === "imperm_parede");
    expect(atual?.descricao).toMatch(/até 1,75 m/);
    expect(r.jaNoEscopo.join()).toMatch(/Revestimento de piso/);
  });

  it("tolera erros de digitação (texto real do Banheiro Masculino)", () => {
    const real =
      "vamos que ter tirar todo piso q esta nele, deixar plano, arrumar o ralo, para depois colocar u novo piso com as novas louças. \n\no mesmo da parede, lixar, passar, e tudo q tem q fazer para impermebilizar para colocar o mesmo revestimento do psio na aprede ate uma certa altura  até 1,75 m";
    const r = interpretar(real, wc, [porta], []);
    const ch = r.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining(["imperm_parede", "parede_rev", "lixamento_parede", "piso"]),
    );
    expect(r.propostas.find((p) => p.chave === "imperm_parede")?.descricao).toMatch(/até 1,75 m/);
    expect(r.avisos.join()).not.toMatch(/Faltou a altura/);
    // "o mesmo da parede" repete na parede o que foi pedido para o piso
    expect(ch).toContain("rem_parede");
    expect(ch).toContain("regularizacao_reboco");
  });

  it("escopo detalhado: mictório, rejunte epóxi, ajuste de porta e caçamba na obra toda", () => {
    const t =
      "Ensacamento e transporte do entulho até a caçamba. Troca da base dos registros. Fechamento de rasgos das instalações. Teste de estanqueidade com lâmina d'água. Parede com o mesmo porcelanato até 1,75 m. Rejunte epóxi. Mictório com válvula. Torneira de fechamento automático. Ajuste da porta ao piso novo e revisão da fechadura.";
    const r = interpretar(t, wc, [porta], []);
    const ch = r.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining([
        "transporte_entulho",
        "cacamba",
        "troca_registro",
        "fechamento_rasgos",
        "teste_estanqueidade",
        "rejunte_epoxi",
        "mictorio",
        "torneira_temporizada",
        "ajuste_porta",
      ]),
    );
    expect(ch).not.toContain("porta_interna");
    expect(r.propostas.find((p) => p.chave === "cacamba")?.obraToda).toBe(true);
    expect(r.propostas.find((p) => p.chave === "rejunte_epoxi")?.quantidade).toBeCloseTo(
      6.164 + 9.06 * 1.75,
      2,
    );
    expect(r.naoEntendi).toEqual([]);
  });

  it("obra toda: documentação, canteiro e logística", () => {
    const t =
      "Plano de reforma aprovado pelo síndico e RRT de execução. Gestão da obra por 2 meses. Seguro de obra e impressão de projetos. Isolamento da área e sinalização. Proteção do trajeto até a caçamba. Fretes de material. Limpeza pós-obra.";
    const r = interpretar(t, null, [], []);
    expect(r.propostas.map((p) => p.chave)).toEqual(
      expect.arrayContaining([
        "aprovacao_condominio",
        "rrt",
        "gestao_mensal",
        "seguro_obra",
        "impressao_projetos",
        "isolamento_area",
        "protecao_piso",
        "cacamba",
        "frete",
        "limpeza_final",
      ]),
    );
    expect(r.propostas.find((p) => p.chave === "gestao_mensal")?.quantidade).toBe(2);
    expect(r.naoEntendi).toEqual([]);
  });

  it("'tirar' vale só até o próximo verbo", () => {
    const r = interpretar("Tirar o piso, deixar plano, piso novo e pintar o teto.", wc, [], []);
    const ch = r.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining(["rem_piso", "regularizacao_contrapiso", "piso", "pint_teto"]),
    );
    expect(ch).not.toContain("rem_forro");
  });

  it("frases sem serviço reconhecido voltam como 'não entendi'", () => {
    const r = interpretar("A síndica pediu capricho. Trocar 2 tomadas.", wc, [], []);
    expect(r.naoEntendi).toEqual(["A síndica pediu capricho"]);
    expect(r.propostas.find((p) => p.chave === "ponto_tomada")?.quantidade).toBe(2);
  });

  it("'certa altura' sem número gera aviso", () => {
    const r = interpretar("revestimento na parede até uma certa altura", wc, [], []);
    expect(r.avisos.join()).toMatch(/Faltou a altura/);
  });
});
