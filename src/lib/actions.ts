import { supabase } from "@/integrations/supabase/client";
import {
  curvaABC,
  filtrarPorAmbiente,
  itemTotais,
  porAmbiente,
  proximaRevisao,
  resumo,
  sortItens,
  type Capitulo,
  type Cotacao,
  type Evf,
  type Item,
} from "@/lib/calc";
import { run } from "@/lib/data";
import type { TablesInsert } from "@/integrations/supabase/types";
import { PACOTES_INICIAIS } from "@/lib/biblioteca";
import { linhasDoModelo, normaliza } from "@/lib/sugestoes";

/** Copia o EVF inteiro (ambientes, medições, itens e cotações) como uma nova revisão. Retorna o id novo. */
export async function duplicarEvf(evfId: string): Promise<string> {
  const evf = await run(supabase.from("evfs").select("*").eq("id", evfId).single());
  const ambientes = await run(
    supabase.from("ambientes").select("*").eq("evf_id", evfId).order("ordem"),
  );
  const ambIds = ambientes.map((a) => a.id);
  const medicoes = ambIds.length
    ? await run(supabase.from("medicoes").select("*").in("ambiente_id", ambIds))
    : [];
  const itens = await run(
    supabase.from("itens_evf").select("*").eq("evf_id", evfId).order("ordem"),
  );
  const itemIds = itens.map((i) => i.id);
  const cotacoes: Cotacao[] = [];
  for (let k = 0; k < itemIds.length; k += 150)
    cotacoes.push(
      ...(await run(
        supabase
          .from("cotacoes")
          .select("*")
          .in("item_id", itemIds.slice(k, k + 150)),
      )),
    );

  const { id: _id, created_at: _c, ...dadosEvf } = evf;
  const [novo] = await run(
    supabase
      .from("evfs")
      .insert({ ...dadosEvf, revisao: proximaRevisao(evf.revisao), status: "Rascunho" })
      .select(),
  );
  if (!novo) throw new Error("Não foi possível criar a nova revisão.");

  const mapaAmb = new Map<string, string>();
  for (const a of ambientes) {
    const [na] = await run(
      supabase
        .from("ambientes")
        .insert({
          evf_id: novo.id,
          nome: a.nome,
          ordem: a.ordem,
          comprimento: a.comprimento,
          largura: a.largura,
          pe_direito: a.pe_direito,
          area_vaos: a.area_vaos,
        })
        .select(),
    );
    if (na) mapaAmb.set(a.id, na.id);
  }
  const novasMed = medicoes.map(({ id: _m, created_at: _mc, ambiente_id, ...m }) => ({
    ...m,
    ambiente_id: mapaAmb.get(ambiente_id) ?? ambiente_id,
  }));
  if (novasMed.length) await run(supabase.from("medicoes").insert(novasMed).select());

  const mapaItem = new Map<string, string>();
  for (let k = 0; k < itens.length; k += 100) {
    const lote = itens.slice(k, k + 100);
    const inseridos = await run(
      supabase
        .from("itens_evf")
        .insert(
          lote.map(({ id: _i, evf_id: _e, ambiente_id, ...it }) => ({
            ...it,
            evf_id: novo.id,
            ambiente_id: ambiente_id ? (mapaAmb.get(ambiente_id) ?? null) : null,
          })),
        )
        .select(),
    );
    lote.forEach((orig, idx) => {
      const ins = inseridos[idx];
      if (ins) mapaItem.set(orig.id, ins.id);
    });
  }
  // Itens que copiam a quantidade de outro item passam a apontar para a cópia nova.
  for (const orig of itens) {
    const novoId = mapaItem.get(orig.id);
    const ref = orig.base_item_id ? mapaItem.get(orig.base_item_id) : undefined;
    if (novoId && ref)
      await run(supabase.from("itens_evf").update({ base_item_id: ref }).eq("id", novoId));
  }
  const novasCot = cotacoes
    .filter((c) => mapaItem.has(c.item_id))
    .map(({ id: _c2, item_id, ...c }) => ({ ...c, item_id: mapaItem.get(item_id) ?? item_id }));
  for (let k = 0; k < novasCot.length; k += 200)
    await run(
      supabase
        .from("cotacoes")
        .insert(novasCot.slice(k, k + 200))
        .select(),
    );
  return novo.id;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Gera o .xlsx no formato das planilhas do curso (5 abas entregáveis). */
export async function exportarXlsx(
  evf: Evf,
  itens: Item[],
  caps: Capitulo[],
  cotacoes: Cotacao[],
  escritorio: string,
  opts: { ambientes?: { id: string; nome: string }[]; filtro?: string } = {},
) {
  const XLSX = await import("xlsx");
  const ambientes = opts.ambientes ?? [];
  const filtro = opts.filtro ?? "";
  const todos = itens;
  itens = filtrarPorAmbiente(todos, filtro);
  const nomeAmb =
    filtro === "geral" ? "Itens gerais" : (ambientes.find((a) => a.id === filtro)?.nome ?? "");
  const res = resumo(itens, caps);
  const cab = [
    [escritorio, "", "Cliente:", evf.cliente],
    [
      "ESTUDO DE VIABILIDADE FINANCEIRA",
      "",
      "Obra:",
      nomeAmb ? `${evf.obra} — ${nomeAmb}` : evf.obra,
    ],
    ["Planilha de estimativa de custos diretos", "", "Data-base:", evf.data_base],
    ["", "", "Revisão:", evf.revisao],
    [],
  ];

  const resumoAoa = [
    ...cab,
    ["ITEM", "SERVIÇOS", "Valor total material", "Valor total M.O.", "Total"],
    ...res.capitulos.map((c) => [c.codigo, c.nome.toUpperCase(), r2(c.mat), r2(c.mo), r2(c.total)]),
    ["", "TOTAL – MÃO DE OBRA E MATERIAIS", "", "", r2(res.direto)],
    ["", "TOTAL – TAXAS DE ADMINISTRAÇÃO", "", "", r2(res.taxas)],
    ["", "TOTAL GERAL", "", "", r2(res.geral)],
    [],
    ["", "Target do cliente", "", "", Number(evf.target) || 0],
    ["", "Desvio", "", "", r2(res.geral - (Number(evf.target) || 0))],
  ];

  const det: (string | number)[][] = [
    ...cab,
    [
      "ITEM",
      "SERVIÇOS",
      "unid.",
      "Quant.",
      "Perda %",
      "Valor material",
      "Valor total material",
      "Valor M.O.",
      "Valor total M.O.",
      "Total",
      "Tipo",
      "Etapa",
    ],
  ];
  for (const c of res.capitulos) {
    det.push([
      c.codigo,
      c.nome.toUpperCase(),
      "",
      "",
      "",
      "",
      r2(c.mat),
      "",
      r2(c.mo),
      r2(c.total),
      "",
      "",
    ]);
    for (const i of c.itens) {
      const t = itemTotais(i);
      det.push([
        i.codigo,
        i.descricao,
        i.unidade,
        Number(i.quantidade),
        Number(i.perda_pct),
        r2(Number(i.material_unit)),
        r2(t.mat),
        r2(Number(i.mo_unit)),
        r2(t.mo),
        r2(t.total),
        i.tipo_preco,
        i.etapa,
      ]);
    }
  }
  det.push([
    "",
    "TOTAL – MÃO DE OBRA E MATERIAIS",
    "",
    "",
    "",
    "",
    r2(res.mat),
    "",
    r2(res.mo),
    r2(res.direto),
    "",
    "",
  ]);

  const pesq: (string | number)[][] = [
    ...cab,
    [
      "ITEM",
      "MATERIAL",
      "VALOR CONSIDERADO",
      "CRITÉRIO",
      "Fornecedor 1",
      "Valor 1",
      "Link 1",
      "Fornecedor 2",
      "Valor 2",
      "Link 2",
      "Fornecedor 3",
      "Valor 3",
      "Link 3",
      "LINK DO PRODUTO",
    ],
  ];
  for (const i of sortItens(itens).filter((x) => x.tipo_preco === "cotacao")) {
    const cs = cotacoes.filter((c) => c.item_id === i.id).sort((a, b) => a.ordem - b.ordem);
    const linha: (string | number)[] = [
      i.codigo,
      i.descricao,
      r2(Number(i.material_unit)),
      i.criterio_cotacao,
    ];
    for (let k = 0; k < 3; k++) {
      const c = cs[k];
      linha.push(c?.fornecedor_nome ?? "", c ? Number(c.valor) : "", c?.link ?? "");
    }
    linha.push(i.link ?? "");
    pesq.push(linha);
  }

  const taxa: (string | number)[][] = [...cab, ["ITEM", "SERVIÇOS", "%", "Total"]];
  for (const c of res.capitulos) {
    taxa.push([c.codigo, c.nome.toUpperCase(), "", r2(c.total)]);
    taxa.push(["", "TAXA DE ADM", (c.taxaPct ?? 0) / 100, r2(c.taxa)]);
  }
  taxa.push(
    ["", "TOTAL – MAT. E M.O.", "", r2(res.direto)],
    ["", "TOTAL – TAXAS DE ADMINISTRAÇÃO", "", r2(res.taxas)],
    ["", "TOTAL GERAL", "", r2(res.geral)],
  );

  const abc = curvaABC(itens);
  const abcAoa: (string | number)[][] = [
    ...cab,
    ["ITEM", "SERVIÇOS", "unid.", "Quant.", "Total", "%", "% acumulado", "Classe"],
  ];
  for (const r of abc.rows)
    abcAoa.push([
      r.item.codigo,
      r.item.descricao,
      r.item.unidade,
      Number(r.item.quantidade),
      r2(r.total),
      r.pct / 100,
      r.acum / 100,
      r.classe,
    ]);

  const wb = XLSX.utils.book_new();
  const add = (nome: string, aoa: (string | number)[][], cols: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cols.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };
  add("1_RESUMO", resumoAoa, [8, 42, 18, 18, 16]);
  add("2_PLANILHA DETALHADA", det, [8, 58, 7, 9, 8, 14, 16, 12, 16, 14, 12, 12]);
  add("3_PESQUISA DE PREÇOS", pesq, [8, 50, 16, 10, 18, 12, 30, 18, 12, 30, 18, 12, 30, 30]);
  add("4_TAXA ADM", taxa, [8, 42, 8, 16]);
  add("5_CURVA ABC", abcAoa, [8, 58, 7, 9, 14, 10, 12, 8]);
  if (!filtro && ambientes.length) {
    const pa = porAmbiente(todos, caps, ambientes, true);
    const aoa: (string | number)[][] = [
      ...cab,
      [
        "AMBIENTE",
        "Itens",
        "Material",
        "M.O.",
        "Custo direto",
        "Taxas adm.",
        "Total do ambiente",
        "Rateio dos itens gerais",
        "Total com rateio",
      ],
      ...pa.linhas.map((l) => [
        l.nome,
        l.itens,
        r2(l.mat),
        r2(l.mo),
        r2(l.direto),
        r2(l.taxas),
        r2(l.geral),
        r2(l.rateio),
        r2(l.final),
      ]),
    ];
    if (pa.geral)
      aoa.push([
        `${pa.geral.nome} — distribuídos na coluna de rateio`,
        pa.geral.itens,
        r2(pa.geral.mat),
        r2(pa.geral.mo),
        r2(pa.geral.direto),
        r2(pa.geral.taxas),
        r2(pa.geral.geral),
        "",
        "",
      ]);
    aoa.push(["TOTAL GERAL", "", "", "", "", "", "", "", r2(pa.total)]);
    add("6_POR AMBIENTE", aoa, [36, 7, 14, 14, 14, 13, 16, 16, 16]);
  }
  const sufixo = nomeAmb ? `_${nomeAmb.replace(/[^\w-]+/g, "_")}` : "";
  const nome = `EVF_${(evf.obra || "obra").replace(/[^\w-]+/g, "_")}${sufixo}_${evf.revisao}.xlsx`;
  XLSX.writeFile(wb, nome);
}

type LinhaNova = Omit<TablesInsert<"itens_evf">, "evf_id" | "codigo" | "ordem">;

/** Insere itens novos numerando o código dentro de cada capítulo (ex.: 5.3, 5.4…). */
export async function inserirItens(evfId: string, linhas: LinhaNova[], existentes: Item[]) {
  if (!linhas.length) return [];
  const proximo = new Map<number, number>();
  for (const i of existentes) {
    const p = i.codigo.split(".");
    if (p.length === 2 && Number(p[0]) === i.capitulo_codigo)
      proximo.set(
        i.capitulo_codigo,
        Math.max(proximo.get(i.capitulo_codigo) ?? 0, Number(p[1]) || 0),
      );
  }
  let ordem = existentes.reduce((m, i) => Math.max(m, i.ordem), 0);
  const rows = linhas.map((l) => {
    const n = (proximo.get(l.capitulo_codigo) ?? 0) + 1;
    proximo.set(l.capitulo_codigo, n);
    ordem += 1;
    return { ...l, evf_id: evfId, codigo: `${l.capitulo_codigo}.${n}`, ordem };
  });
  return run(supabase.from("itens_evf").insert(rows).select());
}

/** Preço do catálogo pela descrição (igual, sem acento/maiúscula). */
export function buscadorDePreco(
  catalogo: { descricao: string; material_unit: number; mo_unit: number }[],
) {
  const mapa = new Map(catalogo.map((c) => [normaliza(c.descricao), c]));
  return (desc: string) => {
    const c = mapa.get(normaliza(desc));
    return c ? { material_unit: Number(c.material_unit), mo_unit: Number(c.mo_unit) } : null;
  };
}

/** Cria os ambientes e os itens de um pacote inicial (Novo EVF). */
export async function aplicarPacote(evfId: string, pacoteId: string) {
  const pacote = PACOTES_INICIAIS.find((p) => p.id === pacoteId) ?? PACOTES_INICIAIS[0];
  if (!pacote) return;
  const catalogo = await run(
    supabase.from("catalogo_servicos").select("descricao, material_unit, mo_unit"),
  );
  const preco = buscadorDePreco(catalogo);
  const linhas: LinhaNova[] = [];
  let ordem = 1;
  for (const a of pacote.ambientes) {
    const [amb] = await run(
      supabase.from("ambientes").insert({ evf_id: evfId, nome: a.nome, ordem: ordem++ }).select(),
    );
    if (amb && a.modelo) linhas.push(...linhasDoModelo(a.modelo, amb, [], preco));
  }
  if (pacote.geral) linhas.push(...linhasDoModelo(pacote.geral, null, [], preco));
  await inserirItens(evfId, linhas, []);
}
