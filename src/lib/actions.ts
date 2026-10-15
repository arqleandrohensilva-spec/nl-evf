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
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { PACOTES_INICIAIS, SERVICO } from "@/lib/biblioteca";
import { linhasDoModelo, normaliza } from "@/lib/sugestoes";
import { listaDeMateriais } from "@/lib/insumos";
import { dividir } from "@/lib/referencia";

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
  const mats = listaDeMateriais(itens);
  if (mats.length)
    add(
      "LISTA DE MATERIAIS",
      [
        ...cab,
        ["MATERIAL", "QUANTIDADE", "UN", "COMPRAR", "SERVIÇOS DE ORIGEM"],
        ...mats.map((m) => [
          m.nome,
          r2(m.total),
          m.un,
          m.compra,
          m.origens.map((o) => o.item.codigo).join(", "),
        ]),
        [],
        ["Coeficientes de referência para EVF; o quantitativo final sai do projeto executivo."],
      ],
      [44, 14, 6, 30, 40],
    );
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

export type LinhaNova = Omit<TablesInsert<"itens_evf">, "evf_id" | "codigo" | "ordem">;

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
  const preco = await carregarPrecificador();
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

/**
 * Construção do zero: cria os ambientes (com portas e janelas) e todos os serviços estimados.
 * Os itens entram com o preço do catálogo quando existir; os demais ficam para cotar.
 */
export async function gerarObraNova(
  evfId: string,
  obra: import("@/lib/obraNova").ObraEstimada,
  programa: import("@/lib/obraNova").Programa,
  existentes: Item[],
  ordemAmbientes: number,
) {
  const preco = await carregarPrecificador();
  const comPreco = (l: LinhaNova): LinhaNova => {
    const p = preco(l.descricao ?? "", l.chave);
    return p
      ? {
          ...l,
          material_unit: p.material_unit,
          mo_unit: p.mo_unit,
          origem_preco: p.origem,
        }
      : l;
  };
  const linhas: LinhaNova[] = obra.gerais.map(comPreco);
  for (const [k, a] of obra.ambientes.entries()) {
    const [amb] = await run(
      supabase
        .from("ambientes")
        .insert({
          evf_id: evfId,
          nome: a.nome,
          ordem: ordemAmbientes + k + 1,
          comprimento: a.comprimento,
          largura: a.largura,
          pe_direito: a.pe_direito,
        })
        .select(),
    );
    if (!amb) continue;
    if (a.vaos.length)
      await run(
        supabase
          .from("medicoes")
          .insert(
            a.vaos.map((v, i) => ({
              ambiente_id: amb.id,
              descricao: v.descricao,
              largura: v.largura,
              altura: v.altura,
              quantidade: 1,
              sinal: -1,
              tipo: "vao",
              ordem: i + 1,
            })),
          )
          .select(),
      );
    for (const l of a.linhas) linhas.push(comPreco({ ...l, ambiente_id: amb.id }));
  }
  await inserirItens(evfId, linhas, existentes);
  await run(
    supabase
      .from("evfs")
      .update({
        programa: programa as unknown as Json,
        area_m2: obra.numeros.areaConstruida,
      })
      .eq("id", evfId)
      .select(),
  );
  return linhas.length;
}

// ------------------------------------------------------------------ Preços: catálogo + referência

export interface RefPreco {
  codigo: string;
  descricao: string;
  preco: number;
  pct_mo: number | null;
  base: string;
}

export interface PrecoAchado {
  material_unit: number;
  mo_unit: number;
  origem: string;
}

/** (descrição, chave do serviço) → preço do catálogo do escritório ou da referência vinculada. */
export type Precificador = (desc: string, chave?: string | null) => PrecoAchado | null;

/** Base de referência ativa: a escolhida nas configurações ou a mais recente (não desonerada primeiro). */
export async function baseAtiva(): Promise<string | null> {
  const cfg = await run(
    supabase.from("configuracoes").select("base_preco").eq("id", 1).maybeSingle(),
  );
  if (cfg?.base_preco) return cfg.base_preco;
  const bs = await run(
    supabase
      .from("bases_referencia")
      .select("*")
      .order("desonerado")
      .order("data_base", { ascending: false })
      .limit(1),
  );
  return bs[0]?.base ?? null;
}

/** Preço de referência de cada serviço vinculado, na base ativa. */
export async function carregarReferencia(): Promise<Map<string, RefPreco>> {
  const mapa = new Map<string, RefPreco>();
  const base = await baseAtiva();
  if (!base) return mapa;
  const vinc = await run(supabase.from("vinculos_preco").select("*"));
  if (!vinc.length) return mapa;
  const codigos = [...new Set(vinc.map((v) => v.codigo))];
  const precos: { codigo: string; descricao: string; preco: number; pct_mo: number | null }[] = [];
  for (let k = 0; k < codigos.length; k += 150)
    precos.push(
      ...(await run(
        supabase
          .from("precos_referencia")
          .select("codigo, descricao, preco, pct_mo")
          .eq("base", base)
          .in("codigo", codigos.slice(k, k + 150)),
      )),
    );
  const porCodigo = new Map(precos.map((p) => [p.codigo, p]));
  for (const v of vinc) {
    const p = porCodigo.get(v.codigo);
    if (p)
      mapa.set(v.chave, {
        codigo: p.codigo,
        descricao: p.descricao,
        preco: Number(p.preco),
        pct_mo: p.pct_mo == null ? null : Number(p.pct_mo),
        base,
      });
  }
  return mapa;
}

export function criarPrecificador(
  catalogo: { descricao: string; material_unit: number; mo_unit: number }[],
  ref: Map<string, RefPreco>,
): Precificador {
  const cat = buscadorDePreco(catalogo);
  return (desc, chave) => {
    const c = cat(desc) ?? (chave && SERVICO[chave] ? cat(SERVICO[chave].desc) : null);
    if (c) return { ...c, origem: "Catálogo do escritório" };
    const r = chave ? ref.get(chave) : undefined;
    if (r) return { ...dividir(r.preco, r.pct_mo), origem: `${r.base} · ${r.codigo}` };
    return null;
  };
}

export async function carregarPrecificador(): Promise<Precificador> {
  const catalogo = await run(
    supabase.from("catalogo_servicos").select("descricao, material_unit, mo_unit"),
  );
  return criarPrecificador(catalogo, await carregarReferencia());
}

/** Todas as linhas de uma base de referência (paginado: o banco devolve 1.000 por vez). */
export async function carregarBase(base: string) {
  const out: {
    codigo: string;
    descricao: string;
    unidade: string;
    preco: number;
    pct_mo: number | null;
  }[] = [];
  for (let de = 0; ; de += 1000) {
    const lote = await run(
      supabase
        .from("precos_referencia")
        .select("codigo, descricao, unidade, preco, pct_mo")
        .eq("base", base)
        .order("codigo")
        .range(de, de + 999),
    );
    out.push(
      ...lote.map((r) => ({
        ...r,
        preco: Number(r.preco),
        pct_mo: r.pct_mo == null ? null : Number(r.pct_mo),
      })),
    );
    if (lote.length < 1000) break;
  }
  return out;
}

/** Grava uma base importada (substitui a de mesmo nome). */
export async function importarBase(
  meta: { base: string; fonte: string; uf: string; data_base: string; desonerado: boolean },
  registros: {
    codigo: string;
    descricao: string;
    unidade: string;
    preco: number;
    pct_mo: number | null;
  }[],
  progresso?: (feito: number) => void,
) {
  await run(supabase.from("precos_referencia").delete().eq("base", meta.base));
  for (let k = 0; k < registros.length; k += 500) {
    await run(
      supabase
        .from("precos_referencia")
        .insert(registros.slice(k, k + 500).map((r) => ({ ...meta, ...r })))
        .select("id"),
    );
    progresso?.(Math.min(registros.length, k + 500));
  }
}

/** Grava preços em vários itens de uma vez (em paralelo, de 10 em 10). */
export async function atualizarPrecos(
  itens: { id: string; material_unit: number; mo_unit: number; origem_preco: string }[],
) {
  for (let k = 0; k < itens.length; k += 10)
    await Promise.all(
      itens
        .slice(k, k + 10)
        .map(({ id, ...v }) => run(supabase.from("itens_evf").update(v).eq("id", id))),
    );
}
