import { describe, expect, it } from "vitest";
import { classificar, estimarObra, programaPadrao } from "@/lib/obraNova";

describe("construção do zero", () => {
  it("casa térrea padrão médio: todas as etapas, quantidades plausíveis", () => {
    const o = estimarObra(programaPadrao("Médio"));
    const ch = new Set([...o.gerais, ...o.ambientes.flatMap((a) => a.linhas)].map((l) => l.chave));
    for (const k of [
      "sondagem",
      "aprovacao_prefeitura",
      "inss_obra",
      "habite_se",
      "limpeza_terreno",
      "locacao_obra",
      "sapata_corrida",
      "baldrame",
      "imperm_baldrame",
      "pilares_vigas",
      "alvenaria",
      "verga",
      "emboco_externo",
      "estrutura_telhado",
      "telhamento",
      "rufos_calhas",
      "caixa_dagua",
      "entrada_energia",
      "contrapiso",
      "chapisco",
      "emboco",
      "piso",
      "pint_parede",
      "ponto_tomada",
      "vaso",
      "porta_interna",
      "janela",
      "muro",
      "calcada",
      "limpeza_final",
      "gestao_mensal",
      "ligacoes_definitivas",
    ])
      expect(ch, k).toContain(k);
    expect(o.numeros.areaUtil).toBeGreaterThan(110);
    expect(o.numeros.areaUtil).toBeLessThan(120);
    expect(o.numeros.duracaoMeses).toBe(11);
    expect(o.numeros.concreto).toBeGreaterThan(4);
    expect(o.numeros.concreto).toBeLessThan(5);
    // alvenaria de uma casa de ~130 m²: 1,4 a 2,5 m² por m² construído
    expect(o.numeros.alvenaria / o.numeros.areaConstruida).toBeGreaterThan(1.4);
    expect(o.numeros.alvenaria / o.numeros.areaConstruida).toBeLessThan(2.5);
    expect(o.ambientes.find((a) => a.tipo === "circulacao")).toBeTruthy();
    expect(o.gerais.find((l) => l.chave === "gestao_mensal")?.quantidade).toBe(11);
  });

  it("sobrado com radier e laje impermeabilizada", () => {
    const p = programaPadrao("Alto");
    p.pavimentos = 2;
    p.fundacao = "radier";
    p.cobertura = "laje";
    p.ambientes = p.ambientes.map((a) =>
      /Quarto|Suíte|Banheiro/.test(a.nome) ? { ...a, pavimento: 2 } : a,
    );
    const o = estimarObra(p);
    const ch = o.gerais.map((l) => l.chave);
    expect(ch).toContain("radier");
    expect(ch).not.toContain("baldrame");
    expect(ch).toContain("laje");
    expect(ch).toContain("imperm_laje");
    expect(ch).not.toContain("telhamento");
    expect(o.ambientes.filter((a) => a.tipo === "circulacao")).toHaveLength(2);
    expect(o.ambientes.flatMap((a) => a.linhas).some((l) => l.chave === "infra_ar")).toBe(true);
  });

  it("classifica ambientes pelo nome", () => {
    expect(classificar("Banheiro da suíte")).toBe("banheiro");
    expect(classificar("Suíte master")).toBe("suite");
    expect(classificar("Área gourmet")).toBe("gourmet");
    expect(classificar("Lavanderia")).toBe("servico");
  });
});
