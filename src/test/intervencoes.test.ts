import { describe, expect, it } from "vitest";
import type { Ambiente, Medicao } from "@/lib/calc";
import { aplicarIntervencao, contexto, INTERVENCOES, respostasPadrao } from "@/lib/intervencoes";

const wc: Ambiente = {
  id: "bm",
  evf_id: "e",
  nome: "Banheiro Masculino",
  ordem: 0,
  comprimento: 2.3,
  largura: 2.68,
  pe_direito: 2.27,
  area_vaos: 0,
  descricao_servico: null,
};
const porta: Medicao = {
  id: "p",
  ambiente_id: "bm",
  descricao: "porta",
  largura: 0.9,
  altura: 2.1,
  profundidade: 0,
  quantidade: 1,
  sinal: -1,
  tipo: "vao",
  ordem: 0,
  created_at: "",
};
const I = (id: string) => INTERVENCOES.find((x) => x.id === id)!;

describe("intervenções guiadas", () => {
  it("piso de banheiro com as respostas padrão monta toda a sequência", () => {
    const iv = I("piso");
    const r = respostasPadrao(iv, contexto(wc, 9.96));
    expect(r["molhado"]).toBe("sim");
    const res = aplicarIntervencao(iv, r, wc, [porta], []);
    const ch = res.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining([
        "rem_piso",
        "regularizacao_contrapiso",
        "imperm_piso",
        "teste_estanqueidade",
        "adequacao_ralo",
        "ralo",
        "piso",
        "soleira",
      ]),
    );
    expect(ch).not.toContain("rodape");
    expect(res.propostas.find((p) => p.chave === "piso")?.quantidade).toBeCloseTo(6.164, 2);
  });

  it("piso vinílico por cima, área seca: sem impermeabilização, com ajuste de porta", () => {
    const sala = { ...wc, id: "s", nome: "Sala" };
    const res = aplicarIntervencao(
      I("piso"),
      { atual: "porcima", molhado: "nao", tipo: "vinilico", rodape: "novo" },
      sala,
      [],
      [],
    );
    const ch = res.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining(["regularizacao_contrapiso", "piso", "rodape", "ajuste_porta"]),
    );
    expect(ch).not.toContain("imperm_piso");
    expect(res.propostas.find((p) => p.chave === "piso")?.perda).toBe(5);
    expect(res.avisos.join()).toMatch(/Piso sobre piso/);
  });

  it("parede até 1,75 m sobre pintura: lixar, regularizar, impermeabilizar, revestir, perfil e pintar acima", () => {
    const res = aplicarIntervencao(
      I("paredes"),
      { hoje: "pintura", ate: "altura", altura: 1.75, molhado: "sim" },
      wc,
      [porta],
      [],
    );
    const por = (k: string) => res.propostas.find((p) => p.chave === k);
    expect(por("lixamento_parede")?.quantidade).toBeCloseTo(9.06 * 1.75, 2);
    expect(por("imperm_parede")?.descricao).toMatch(/até 1,75 m/);
    expect(por("parede_rev")?.quantidade).toBeCloseTo(9.06 * 1.75, 2);
    expect(por("perfil_revestimento")?.quantidade).toBeCloseTo(9.06, 2);
    expect(por("pint_parede")).toBeTruthy();
  });

  it("louças: bancada puxa chumbadores; chuveiro elétrico puxa circuito; já existentes não duplicam", () => {
    const res = aplicarIntervencao(
      I("loucas"),
      respostasPadrao(I("loucas"), contexto(wc, 9.96)),
      wc,
      [],
      [
        {
          id: "x",
          evf_id: "e",
          ambiente_id: "bm",
          capitulo_codigo: 10,
          codigo: "10.1",
          descricao: "Vaso sanitário",
          unidade: "un",
          quantidade: 1,
          perda_pct: 0,
          material_unit: 0,
          mo_unit: 0,
          tipo_preco: "cotacao",
          etapa: "Agora",
          ordem: 1,
          criterio_cotacao: "media",
          justificativa: null,
          chave: "vaso",
          base_qtd: null,
          base_item_id: null,
          fator: 1,
          link: null,
          origem_preco: null,
        },
      ],
    );
    const ch = res.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining([
        "bancada_banheiro",
        "chumbadores",
        "chuveiro",
        "circuito_chuveiro",
        "box",
      ]),
    );
    expect(ch).not.toContain("vaso");
    expect(res.jaNoEscopo.join()).toMatch(/Vaso/);
  });

  it("forro: sai e entra drywall RU no banheiro, com spots", () => {
    const res = aplicarIntervencao(
      I("forro"),
      { hoje: "sai", novo: "drywall", spots: 3 },
      wc,
      [],
      [],
    );
    const ch = res.propostas.map((p) => p.chave);
    expect(ch).toEqual(
      expect.arrayContaining([
        "rem_forro",
        "forro_drywall",
        "pint_teto",
        "ponto_iluminacao",
        "luminaria",
      ]),
    );
    expect(res.propostas.find((p) => p.chave === "forro_drywall")?.descricao).toMatch(/RU/);
  });
});
