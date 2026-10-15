import { describe, expect, it } from "vitest";
import { SERVICO } from "@/lib/biblioteca";
import { detectarColunas, dividir, extrair, numero, sugerir, unidade } from "@/lib/referencia";

describe("importar tabela de referência", () => {
  it("formato por estado: cabeçalho com uma coluna por UF", () => {
    const linhas = [
      ["SINAPI - Composições"],
      [],
      ["", "", "", "", "Custo por UF"],
      ["Grupo", "Código da Composição", "Descrição", "Unidade", "AC", "SP", "RJ"],
      [
        "ALVE",
        "90001",
        "ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS 9X19X19",
        "M2",
        "80,10",
        "95,40",
        "90,00",
      ],
      ["REVE", "90002", "CHAPISCO APLICADO EM ALVENARIA, COM ROLO", "M2", "5,00", "6,12", "5,50"],
      ["", "", "Total do grupo", "", "", "", ""],
    ];
    const m = detectarColunas(linhas, "SP");
    expect(m).toMatchObject({ linhaCabecalho: 3, codigo: 1, descricao: 2, unidade: 3, preco: 5 });
    const r = extrair(linhas, m!);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ codigo: "90001", unidade: "m²", preco: 95.4 });
  });

  it("formato antigo: 'custo total' e % de mão de obra", () => {
    const linhas = [
      ["DATA DE PREÇO", "09/2026"],
      [
        "CODIGO DA COMPOSICAO",
        "DESCRICAO DA COMPOSICAO",
        "UNIDADE",
        "CUSTO TOTAL",
        "% MAO DE OBRA",
      ],
      ["90100", "CONTRAPISO EM ARGAMASSA TRAÇO 1:4, ESPESSURA 4 CM", "M2", "1.234,56", "40"],
    ];
    const m = detectarColunas(linhas)!;
    expect(m.preco).toBe(3);
    expect(m.pctMo).toBe(4);
    const [reg] = extrair(linhas, m);
    expect(reg).toMatchObject({ preco: 1234.56, pct_mo: 0.4 });
    expect(dividir(100, 0.4)).toEqual({ material_unit: 60, mo_unit: 40 });
  });

  it("números e unidades", () => {
    expect(numero("R$ 1.234,56")).toBe(1234.56);
    expect(numero(12.5)).toBe(12.5);
    expect(unidade("M2")).toBe("m²");
    expect(unidade("UN")).toBe("un");
  });

  it("sugere a composição pela descrição e unidade", () => {
    const refs = [
      {
        codigo: "1",
        descricao: "ALVENARIA DE VEDAÇÃO DE BLOCOS CERÂMICOS FURADOS",
        unidade: "m²",
        preco: 95,
        pct_mo: null,
      },
      {
        codigo: "2",
        descricao: "CHAPISCO APLICADO EM ALVENARIA",
        unidade: "m²",
        preco: 6,
        pct_mo: null,
      },
      {
        codigo: "3",
        descricao: "ALVENARIA DE VEDAÇÃO DE BLOCOS (POR METRO)",
        unidade: "m",
        preco: 20,
        pct_mo: null,
      },
    ];
    const c = sugerir(SERVICO["alvenaria"]!, refs);
    expect(c[0]?.codigo).toBe("1");
    expect(c.map((x) => x.codigo)).not.toContain("3");
    // remoção nunca vira execução (e vice-versa)
    const pisos = [
      {
        codigo: "10",
        descricao: "REVESTIMENTO CERÂMICO PARA PISO COM PLACAS 60X60",
        unidade: "m²",
        preco: 118,
        pct_mo: null,
      },
      {
        codigo: "11",
        descricao: "DEMOLIÇÃO DE REVESTIMENTO CERÂMICO DE PISO, DE FORMA MANUAL",
        unidade: "m²",
        preco: 18,
        pct_mo: null,
      },
    ];
    expect(sugerir(SERVICO["rem_piso"]!, pisos).map((x) => x.codigo)).toEqual(["11"]);
    expect(sugerir(SERVICO["piso"]!, pisos).map((x) => x.codigo)).toEqual(["10"]);
  });
});
