import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/calc";
import { equipeDoItem, porEquipe, textoParaEquipe } from "@/lib/equipes";

const base: Item = {
  id: "1",
  evf_id: "e",
  ambiente_id: null,
  capitulo_codigo: 9,
  codigo: "9.1",
  descricao: "Revestimento de piso",
  unidade: "m²",
  quantidade: 10,
  perda_pct: 0,
  material_unit: 80,
  mo_unit: 50,
  tipo_preco: "composicao",
  criterio_cotacao: "media",
  justificativa: null,
  etapa: "Etapa única",
  ordem: 0,
  chave: "piso",
  base_qtd: null,
  base_item_id: null,
  fator: 1,
  link: null,
  origem_preco: null,
  equipe: null,
};

describe("equipes", () => {
  it("sugere pela chave, cai no capítulo e respeita a escolha manual", () => {
    expect(equipeDoItem(base)).toBe("pedreiro");
    expect(equipeDoItem({ ...base, chave: "ponto_tomada" })).toBe("eletricista");
    expect(equipeDoItem({ ...base, chave: null, capitulo_codigo: 11 })).toBe("pintor");
    expect(equipeDoItem({ ...base, equipe: "granilite" })).toBe("granilite");
  });

  it("mão de obra conta só M.O.; quem fornece e instala conta o total", () => {
    const linhas = porEquipe([
      base,
      {
        ...base,
        id: "2",
        chave: "bancada_banheiro",
        capitulo_codigo: 13,
        material_unit: 900,
        mo_unit: 0,
        quantidade: 1,
      },
      { ...base, id: "3", etapa: "Etapa futura" },
    ]);
    expect(linhas.map((l) => l.equipe.id)).toEqual(["pedreiro", "marmorista"]);
    expect(linhas[0]!.previsto).toBe(500);
    expect(linhas[1]!.previsto).toBe(900);
    const txt = textoParaEquipe(linhas[0]!, [], { nome: "Casa X" });
    expect(txt).toMatch(/mão de obra/);
    expect(txt).toMatch(/Revestimento de piso – 10 m²/);
  });
});
