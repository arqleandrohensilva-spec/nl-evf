import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/calc";
import { itemTotais } from "@/lib/calc";
import {
  equipeDoItem,
  porEquipe,
  ratearProposta,
  semPrecoItem,
  textoParaEquipe,
} from "@/lib/equipes";

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
    expect(equipeDoItem({ ...base, chave: "ponto_tomada" })).toBe("pedreiro");
    expect(equipeDoItem({ ...base, chave: "vaso", capitulo_codigo: 10 })).toBe("pedreiro");
    expect(equipeDoItem({ ...base, chave: "ponto_tomada", equipe: "eletricista" })).toBe(
      "eletricista",
    );
    expect(equipeDoItem({ ...base, chave: null, capitulo_codigo: 11 })).toBe("pedreiro");
    expect(equipeDoItem({ ...base, chave: null, capitulo_codigo: 16 })).toBe("limpeza");
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
  it("rateia o valor global da proposta pela M.O. estimada e volta à estimativa", () => {
    const itens: Item[] = [
      base,
      { ...base, id: "2", codigo: "9.2", quantidade: 5, mo_unit: 100, perda_pct: 10 },
      { ...base, id: "3", codigo: "9.3", quantidade: 2, mo_unit: 0 },
    ];
    const l = porEquipe(itens)[0]!;
    expect(l.previsto).toBeCloseTo(500 + 550, 2);
    const novos = ratearProposta(l, 2100);
    const aplicados = itens.map((i) => ({ ...i, ...novos.find((n) => n.id === i.id) }));
    const soma = aplicados.reduce((s, i) => s + itemTotais(i).mo, 0);
    expect(soma).toBeCloseTo(2100, 1);
    expect(aplicados[2]!.mo_unit).toBe(0);
    const volta = ratearProposta(porEquipe(aplicados)[0]!, 1050);
    expect(volta.find((n) => n.id === "1")!.mo_unit).toBeCloseTo(50, 3);
  });
  it("pede valor global para equipe de mão de obra", () => {
    const t = textoParaEquipe(porEquipe([base])[0]!, [], { nome: "Obra" });
    expect(t).toContain("valor global");
  });
  it("serviço da empreiteira não fica 'sem preço' (a M.O. vem do valor global)", () => {
    const zero = { ...base, material_unit: 0, mo_unit: 0 };
    expect(semPrecoItem(zero)).toBe(false);
    expect(semPrecoItem({ ...zero, tipo_preco: "cotacao" })).toBe(true);
    expect(semPrecoItem({ ...zero, equipe: "marmorista" })).toBe(true);
  });
});
