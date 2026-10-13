import { describe, expect, it } from "vitest";
import type { Ambiente, Evf, Item } from "@/lib/calc";
import { geometria, linhasDoModelo, quantidadeVinculada, sugerir } from "@/lib/sugestoes";

const evf = (tipo: string): Evf => ({
  id: "e",
  cliente: "",
  obra: "",
  tipo_obra: tipo,
  cidade_uf: "",
  area_m2: 0,
  padrao: "Médio",
  target: 0,
  origem_recurso: "Próprio",
  revisao: "R00",
  data_base: "2026-10-01",
  status: "Rascunho",
  observacoes: "",
  created_at: "",
  sugestoes_ignoradas: [],
});

const amb = (id: string, nome: string, c = 0, l = 0, pd = 2.6, vaos = 0): Ambiente => ({
  id,
  evf_id: "e",
  nome,
  ordem: 0,
  comprimento: c,
  largura: l,
  pe_direito: pd,
  area_vaos: vaos,
});

let seq = 0;
const item = (descricao: string, extra: Partial<Item> = {}): Item => ({
  id: `i${++seq}`,
  evf_id: "e",
  ambiente_id: null,
  capitulo_codigo: 1,
  codigo: "",
  descricao,
  unidade: "un",
  quantidade: 1,
  perda_pct: 0,
  material_unit: 0,
  mo_unit: 0,
  tipo_preco: "composicao",
  etapa: "Agora",
  ordem: 0,
  criterio_cotacao: "media",
  justificativa: null,
  chave: null,
  base_qtd: null,
  base_item_id: null,
  fator: 1,
  link: null,
  ...extra,
});

describe("geometria do ambiente", () => {
  it("calcula piso, perímetro e paredes descontando vãos", () => {
    const g = geometria(amb("a", "Quarto", 4, 3, 2.6, 3), []);
    expect(g.piso).toBeCloseTo(12);
    expect(g.perimetro).toBeCloseTo(14);
    expect(g.paredes).toBeCloseTo(14 * 2.6 - 3);
  });
});

describe("regras de obra", () => {
  it("banheiro do curso: lembra chumbadores, estanqueidade, RRT e condomínio", () => {
    const b = amb("b", "Banheiro social");
    const its = [
      "Remoção de revestimento cerâmico de piso",
      "Remoção de revestimento cerâmico de parede",
      "Regularização de reboco nas paredes",
      "Regularização de contrapiso",
      "Impermeabilização de piso, argamassa semiflexível",
      "Impermeabilização de parede até 1,80 m",
      "Novo ponto de água fria para ducha higiênica",
      "Novo ponto de tomada",
      "Revestimento de piso 90x90 branco acetinado",
      "Revestimento de parede 5x20 branco mate",
      "Bancada com cuba esculpida em granito cinza andorinha levigado",
      "Box em vidro, 1 folha de abrir, estrutura preto fosco",
      "Ralo linear do box",
      "Chuveiro elétrico",
      "Acabamento de registro de gaveta 3/4",
      "Troca da base de registro de gaveta 3/4",
      "Locação de caçamba de entulho",
      "Gestão da obra – custo mensal",
      "Seguro de obra",
      "Salva piso",
      "Vassoura",
      "Limpeza pós-obra",
    ].map((d) => item(d, { ambiente_id: b.id }));
    const chaves = sugerir(evf("Reforma de interiores"), its, [b]).map((s) => s.chave);
    expect(chaves).toEqual(
      expect.arrayContaining(["chumbadores", "teste_estanqueidade", "rrt", "aprovacao_condominio"]),
    );
    expect(chaves).not.toContain("cacamba");
    expect(chaves).not.toContain("box");
    expect(chaves).not.toContain("regularizacao_contrapiso");
  });

  it("parede nova puxa chapisco e reboco nas duas faces (quantidade derivada)", () => {
    const alv = item("Alvenaria de vedação em bloco", { quantidade: 40, chave: "alvenaria" });
    const sug = sugerir(evf("Construção do zero"), [alv], []);
    const chapisco = sug.find((s) => s.chave === "chapisco");
    expect(chapisco?.base).toBe("item");
    expect(chapisco?.qtd).toBe(80);
    expect(sug.map((s) => s.chave)).toEqual(
      expect.arrayContaining(["emboco", "pint_parede", "verga", "fundacao", "telhamento"]),
    );
  });

  it("quantidade vinculada a outro item acompanha a mudança", () => {
    const alv = item("Alvenaria de vedação em bloco", { quantidade: 50 });
    const ch = item("Chapisco", { base_qtd: "item", base_item_id: alv.id, fator: 2 });
    expect(quantidadeVinculada(ch, [alv, ch], [], [])).toBe(100);
  });

  it("sugestão ignorada não volta", () => {
    const e = {
      ...evf("Reforma de interiores"),
      sugestoes_ignoradas: ["check:aprovacao_condominio"],
    };
    expect(sugerir(e, [item("Seguro de obra")], []).map((s) => s.chave)).not.toContain(
      "aprovacao_condominio",
    );
  });
});

describe("modelos", () => {
  it("banheiro 2,0 × 1,5 m: piso e paredes saem das medidas", () => {
    const b = amb("b", "Banheiro", 2, 1.5, 2.5, 1.5);
    const linhas = linhasDoModelo("banheiro", b, [], () => null);
    const piso = linhas.find((l) => l.chave === "piso");
    const parede = linhas.find((l) => l.chave === "parede_rev");
    const imperm = linhas.find((l) => l.chave === "imperm_parede");
    expect(piso?.quantidade).toBeCloseTo(3);
    expect(piso?.perda_pct).toBe(10);
    expect(parede?.quantidade).toBeCloseTo(7 * 2.5 - 1.5);
    expect(imperm?.quantidade).toBeCloseTo(7 * 1.8);
    expect(linhas.find((l) => l.chave === "vaso")?.base_qtd).toBeNull();
    expect(linhas.length).toBeGreaterThan(30);
  });
});

describe("regras por tipo de ambiente", () => {
  it("impermeabilização de parede só é sugerida em banheiro", () => {
    const area = amb("a", "Área de serviço");
    const ban = amb("b", "Banheiro");
    const its = [
      item("Impermeabilização de piso, argamassa semiflexível", { ambiente_id: area.id }),
      item("Impermeabilização de piso, argamassa semiflexível", { ambiente_id: ban.id }),
    ];
    const s = sugerir(evf("Reforma de interiores"), its, [area, ban]).filter(
      (x) => x.chave === "imperm_parede",
    );
    expect(s.map((x) => x.ambienteId)).toEqual(["b"]);
  });
});

describe("modelo banheiro coletivo", () => {
  it("2,30 × 2,68 m, pé-direito 2,27 m, 2,92 m² de vãos (Brisa do Parque)", () => {
    const b = amb("bf", "Banheiro Feminino", 2.3, 2.68, 2.27, 2.92);
    const linhas = linhasDoModelo("banheiro_coletivo", b, [], () => null);
    expect(linhas.find((l) => l.chave === "piso")?.quantidade).toBeCloseTo(6.164, 2);
    expect(linhas.find((l) => l.chave === "parede_rev")?.quantidade).toBeCloseTo(
      9.96 * 2.27 - 2.92,
      2,
    );
    expect(linhas.some((l) => l.chave === "chuveiro" || l.chave === "box")).toBe(false);
    expect(linhas.some((l) => l.chave === "barras_apoio")).toBe(true);
  });
});
