import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  curvaABC,
  proximaRevisao,
  resumo,
  valorCotacao,
  type Capitulo,
  type Item,
} from "@/lib/calc";

// Usa os mesmos dados que o banco recebe (seed), para o teste falhar se o cálculo ou o seed mudarem.
const sql = readFileSync(
  resolve(__dirname, "../../drizzle/migrations/0000_evf_schema_seed.sql"),
  "utf8",
);

function capitulos(): Capitulo[] {
  const linha = sql.split("\n").find((l) => l.startsWith("(1,'Serviços técnicos"));
  if (!linha) throw new Error("seed de capítulos não encontrado");
  return [...linha.matchAll(/\((\d+),'([^']+)',(\d+),([\d.]+)\)/g)].map((m) => ({
    id: m[1] ?? "",
    codigo: Number(m[1]),
    nome: m[2] ?? "",
    ordem: Number(m[3]),
    taxa_adm_pct: Number(m[4]),
  }));
}

function itens(): Item[] {
  const re =
    /^\((\d+),(\d+),'([^']+)','([^']+)','([^']+)',([\d.]+),([\d.]+),([\d.]+),'(\w+)','\{([^}]*)\}'\)/gm;
  return [...sql.matchAll(re)].map((m) => {
    const cot = (m[10] ?? "").split(",").filter(Boolean).map(Number);
    const mat = cot.length ? (valorCotacao(cot, "media") ?? 0) : Number(m[7]);
    return {
      id: m[1] ?? "",
      evf_id: "e",
      ambiente_id: null,
      capitulo_codigo: Number(m[2]),
      codigo: m[3] ?? "",
      descricao: m[4] ?? "",
      unidade: m[5] ?? "",
      quantidade: Number(m[6]),
      perda_pct: 0,
      material_unit: mat,
      mo_unit: Number(m[8]),
      tipo_preco: m[9] ?? "",
      etapa: "Agora",
      ordem: Number(m[1]),
      criterio_cotacao: "media",
      justificativa: null,
      chave: null,
      base_qtd: null,
      base_item_id: null,
      fator: 1,
      link: null,
    };
  });
}

describe("EVF exemplo do curso (banheiro)", () => {
  const caps = capitulos();
  const its = itens();

  it("lê os 16 capítulos e os 55 itens do seed", () => {
    expect(caps).toHaveLength(16);
    expect(its).toHaveLength(55);
  });

  it("fecha nos totais da planilha do curso", () => {
    const r = resumo(its, caps);
    expect(r.direto).toBeCloseTo(40208.5, 1);
    expect(r.taxas).toBeCloseTo(4394.55, 1);
    expect(r.geral).toBeCloseTo(44603.06, 1);
  });

  it("curva ABC: 18 itens na classe A, acumulado termina em 100%", () => {
    const abc = curvaABC(its);
    expect(abc.nA).toBe(18);
    expect(abc.rows.at(-1)?.acum).toBeCloseTo(100, 6);
    expect(abc.rows[0]?.item.descricao).toBe("Armário farmacinha");
  });
});

describe("regras auxiliares", () => {
  it("critério de cotação", () => {
    expect(valorCotacao([8000, 4600], "media")).toBe(6300);
    expect(valorCotacao([8000, 4600], "menor")).toBe(4600);
    expect(valorCotacao([8000, 4600, 0], "maior")).toBe(8000);
    expect(valorCotacao([], "media")).toBeNull();
  });
  it("próxima revisão", () => {
    expect(proximaRevisao("R00")).toBe("R01");
    expect(proximaRevisao("R09")).toBe("R10");
  });
});
