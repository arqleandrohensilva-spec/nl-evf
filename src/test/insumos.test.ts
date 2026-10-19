import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/calc";
import { compra, consumoDoItem, listaDeMateriais } from "@/lib/insumos";

let k = 0;
const item = (
  descricao: string,
  chave: string | null,
  quantidade: number,
  extra: Partial<Item> = {},
): Item => ({
  id: `i${++k}`,
  evf_id: "e",
  ambiente_id: null,
  capitulo_codigo: 9,
  codigo: `${k}`,
  descricao,
  unidade: "m²",
  quantidade,
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

describe("lista de materiais", () => {
  it("piso de 6,16 m² com 10% de perda: placas, argamassa e rejunte", () => {
    const c = consumoDoItem(
      item("Revestimento de piso – Banheiro", "piso", 6.164, { perda_pct: 10 }),
    );
    expect(c.find((x) => x.insumo === "placa_piso")?.qtd).toBeCloseTo(6.78, 2);
    expect(c.find((x) => x.insumo === "argamassa_ac3")?.qtd).toBeCloseTo(43.15, 1);
  });

  it("soma os mesmos insumos de serviços diferentes e converte em embalagens", () => {
    const l = listaDeMateriais([
      item("Contrapiso", "contrapiso", 100),
      item("Emboço / reboco", "emboco", 200),
      item("Alvenaria de vedação em bloco", "alvenaria", 200),
    ]);
    const cimento = l.find((x) => x.insumo === "cimento")!;
    // 100×14 + 200×3,1 + 200×2,5 = 2.520 kg = 51 sacos de 50 kg
    expect(cimento.total).toBeCloseTo(2520);
    expect(cimento.compra).toBe("51 sacos (saco 50 kg)");
    expect(cimento.origens).toHaveLength(3);
    expect(l.find((x) => x.insumo === "bloco_ceramico")?.compra).toMatch(/^5250 un/);
  });

  it("reconhece pela descrição quando o item não tem chave e ignora etapa futura", () => {
    const l = listaDeMateriais([
      item("Pintura de teto da sala", null, 20),
      item("Telhamento em telha cerâmica", "telhamento", 100, { etapa: "Etapa futura" }),
    ]);
    expect(l.map((x) => x.insumo)).toContain("tinta_acrilica");
    expect(l.map((x) => x.insumo)).not.toContain("telha_ceramica");
  });

  it("telha só conta quando é cerâmica", () => {
    expect(consumoDoItem(item("Telhamento em telha de fibrocimento", "telhamento", 100))).toEqual(
      [],
    );
    expect(compra("tinta_acrilica", 37)).toBe("3 latas (lata 18 L)");
  });
});
