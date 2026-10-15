import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Link2, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { baseAtiva, carregarBase, importarBase } from "@/lib/actions";
import { SERVICO, type Servico } from "@/lib/biblioteca";
import { run, useConfig, useMut } from "@/lib/data";
import { fmtR } from "@/lib/format";
import {
  detectarColunas,
  dividir,
  extrair,
  SERVICOS_VINCULAVEIS,
  sugerir,
  type Candidato,
  type Mapa,
  type Registro,
} from "@/lib/referencia";
import { normaliza } from "@/lib/sugestoes";

export const Route = createFileRoute("/_authenticated/base/precos")({
  head: () => ({ meta: [{ title: "Preços de referência — NL · EVF" }] }),
  component: Page,
});

const useBases = () =>
  useQuery({
    queryKey: ["bases_referencia"],
    queryFn: () =>
      run(supabase.from("bases_referencia").select("*").order("data_base", { ascending: false })),
  });
const useVinculos = () =>
  useQuery({
    queryKey: ["vinculos_preco"],
    queryFn: () => run(supabase.from("vinculos_preco").select("*")),
  });

function Page() {
  const bases = useBases().data ?? [];
  const config = useConfig().data;
  const mCfg = useMut("configuracoes", ["config", "referencia"]);
  const qc = useQueryClient();
  const ativaQ = useQuery({
    queryKey: ["base_ativa", config?.base_preco, bases.length],
    queryFn: baseAtiva,
  });
  const ativa = ativaQ.data ?? null;
  const refsQ = useQuery({
    queryKey: ["base_linhas", ativa],
    queryFn: () => (ativa ? carregarBase(ativa) : Promise.resolve([])),
    enabled: Boolean(ativa),
  });

  async function apagarBase(base: string) {
    if (
      !confirm(
        `Apagar a base “${base}”? Os vínculos continuam, mas ficam sem preço até outra base.`,
      )
    )
      return;
    await run(supabase.from("precos_referencia").delete().eq("base", base));
    if (config?.base_preco === base) mCfg.update.mutate({ id: config.id, base_preco: null });
    await qc.invalidateQueries();
    toast.success("Base apagada.");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Preços de referência</h1>
        <p className="text-sm text-muted-foreground">
          Importe a tabela do SINAPI (ou outra) e vincule cada serviço do sistema a uma composição.
          Itens sem preço no catálogo do escritório passam a entrar com o preço de referência, com
          fonte e data. Referência não é cotação: os itens mais caros (curva A) continuam pedindo 3
          cotações.
        </p>
      </header>

      <Importador />

      <section className="card space-y-3 p-5" aria-label="Bases importadas">
        <h2 className="font-semibold">Bases importadas</h2>
        {bases.length ? (
          <>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Base usada nos EVFs:
              <select
                className="field h-9 w-96"
                value={config?.base_preco ?? ""}
                onChange={(e) =>
                  config &&
                  mCfg.update.mutate({ id: config.id, base_preco: e.target.value || null })
                }
                aria-label="Base de preços ativa"
              >
                <option value="">A mais recente (não desonerada primeiro)</option>
                {bases.map((b) => (
                  <option key={b.base} value={b.base}>
                    {b.base}
                  </option>
                ))}
              </select>
              {ativa ? (
                <span className="text-xs text-muted-foreground">em uso: {ativa}</span>
              ) : null}
            </label>
            <ul className="divide-y rounded-lg border">
              {bases.map((b) => (
                <li key={b.base} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileSpreadsheet className="size-4 text-primary" />
                  <span className="flex-1 font-medium">{b.base}</span>
                  <span className="num text-muted-foreground">
                    {b.n.toLocaleString("pt-BR")} itens
                  </span>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                    aria-label={`Apagar ${b.base}`}
                    onClick={() => apagarBase(b.base)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma base ainda. Importe a primeira acima.
          </p>
        )}
      </section>

      <Vinculos refs={refsQ.data ?? []} carregando={refsQ.isLoading} ativa={ativa} />
    </div>
  );
}

const MESES = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

function Importador() {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<string>("");
  const [abas, setAbas] = useState<{ nome: string; linhas: unknown[][] }[]>([]);
  const [aba, setAba] = useState(0);
  const [uf, setUf] = useState("SP");
  const [fonte, setFonte] = useState("SINAPI");
  const [mes, setMes] = useState(MESES);
  const [desonerado, setDesonerado] = useState(false);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const linhas = abas[aba]?.linhas ?? [];
  const registros = useMemo(() => (mapa ? extrair(linhas, mapa) : []), [linhas, mapa]);
  const cab = mapa ? (linhas[mapa.linhaCabecalho] ?? []).map((c) => String(c ?? "")) : [];

  async function abrir(f: File) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const lidas = wb.SheetNames.map((nome) => ({
      nome,
      linhas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome]!, {
        header: 1,
        raw: true,
        defval: "",
      }),
    }));
    setArquivo(f.name);
    setAbas(lidas);
    const preferida = lidas.findIndex((a) => /csd|composi|sintet/i.test(a.nome));
    const i = preferida >= 0 ? preferida : 0;
    setAba(i);
    setMapa(detectarColunas(lidas[i]?.linhas ?? [], uf));
    const m = f.name.match(/(20\d{2})[-_]?(0[1-9]|1[0-2])/);
    if (m) setMes(`${m[1]}-${m[2]}`);
    if (/desonerad/i.test(f.name) && !/n[aã]o.?desonerad/i.test(f.name)) setDesonerado(true);
  }

  function trocarAba(i: number) {
    setAba(i);
    setMapa(detectarColunas(abas[i]?.linhas ?? [], uf));
  }

  const base = `${fonte} ${uf} ${mes.slice(5, 7)}/${mes.slice(0, 4)} · ${desonerado ? "desonerado" : "não desonerado"}`;

  async function importar() {
    if (!registros.length) return;
    setProgresso(0);
    try {
      await importarBase(
        { base, fonte, uf, data_base: `${mes}-01`, desonerado },
        registros,
        setProgresso,
      );
      await qc.invalidateQueries();
      toast.success(`${registros.length.toLocaleString("pt-BR")} itens importados em “${base}”.`);
      setAbas([]);
      setArquivo("");
      setMapa(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setProgresso(null);
    }
  }

  const colSel = (k: keyof Omit<Mapa, "linhaCabecalho">, rotulo: string, opcional = false) => (
    <label className="text-xs font-medium text-muted-foreground">
      {rotulo}
      <select
        className="field mt-1 h-9 w-full"
        value={mapa?.[k] ?? -1}
        onChange={(e) =>
          mapa &&
          setMapa({
            ...mapa,
            [k]: Number(e.target.value) >= 0 ? Number(e.target.value) : opcional ? null : 0,
          })
        }
      >
        {opcional ? <option value={-1}>— nenhuma —</option> : null}
        {cab.map((c, i) => (
          <option key={i} value={i}>
            {String.fromCharCode(65 + (i % 26))} · {c || "(vazia)"}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="card space-y-3 p-5" aria-label="Importar tabela">
      <h2 className="flex items-center gap-2 font-semibold">
        <Upload className="size-4 text-primary" /> Importar tabela
      </h2>
      <p className="text-sm text-muted-foreground">
        Baixe no site da Caixa (SINAPI → relatórios mensais) a planilha de <b>composições</b> e
        envie aqui (.xlsx ou .csv). O sistema acha sozinho o cabeçalho e as colunas de código,
        descrição, unidade e o preço da UF; confira antes de importar.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Arquivo
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="mt-1 block text-sm"
            aria-label="Arquivo da tabela"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) abrir(f).catch((err: unknown) => toast.error(String(err)));
            }}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Fonte
          <input
            className="field mt-1 h-9 w-28"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            aria-label="Fonte"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          UF
          <input
            className="field mt-1 h-9 w-16 uppercase"
            value={uf}
            maxLength={2}
            aria-label="UF"
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setUf(v);
              if (v.length === 2 && linhas.length) setMapa(detectarColunas(linhas, v));
            }}
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Mês de referência
          <input
            type="month"
            className="field mt-1 h-9"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-label="Mês de referência"
          />
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={desonerado}
            onChange={(e) => setDesonerado(e.target.checked)}
          />
          Desonerado
        </label>
      </div>

      {abas.length ? (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{arquivo}</span>
            {abas.length > 1 ? (
              <select
                className="field h-9"
                value={aba}
                onChange={(e) => trocarAba(Number(e.target.value))}
                aria-label="Aba da planilha"
              >
                {abas.map((a, i) => (
                  <option key={a.nome} value={i}>
                    Aba: {a.nome}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {mapa ? (
            <>
              <div className="grid gap-2 sm:grid-cols-5">
                {colSel("codigo", "Código")}
                {colSel("descricao", "Descrição")}
                {colSel("unidade", "Unidade")}
                {colSel("preco", `Preço (${uf})`)}
                {colSel("pctMo", "% mão de obra", true)}
              </div>
              <div className="overflow-x-auto">
                <table className="tbl text-sm">
                  <thead>
                    <tr>
                      <th className="w-24">Código</th>
                      <th>Descrição</th>
                      <th className="w-14">Un</th>
                      <th className="w-28 text-right">Preço</th>
                      <th className="w-20 text-right">% M.O.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.slice(0, 8).map((r) => (
                      <tr key={r.codigo}>
                        <td className="num">{r.codigo}</td>
                        <td className="max-w-md truncate">{r.descricao}</td>
                        <td>{r.unidade}</td>
                        <td className="num text-right">{fmtR(r.preco)}</td>
                        <td className="num text-right">
                          {r.pct_mo != null ? `${Math.round(r.pct_mo * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-10"
                  disabled={!registros.length || progresso != null}
                  onClick={importar}
                >
                  <Upload className="size-4" />
                  {progresso != null
                    ? `Importando ${progresso.toLocaleString("pt-BR")} de ${registros.length.toLocaleString("pt-BR")}…`
                    : `Importar ${registros.length.toLocaleString("pt-BR")} itens como “${base}”`}
                </Button>
                {!registros.length ? (
                  <span className="text-sm text-warning">
                    Nenhuma linha válida com essas colunas: ajuste os campos acima.
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-warning">
              Não achei o cabeçalho (código, descrição e preço) nesta aba. Escolha outra aba ou
              confira se é a planilha de composições.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Vinculos({
  refs,
  carregando,
  ativa,
}: {
  refs: Registro[];
  carregando: boolean;
  ativa: string | null;
}) {
  const vinculos = useVinculos().data ?? [];
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<Servico | null>(null);
  const [lote, setLote] = useState<
    { s: Servico; c: Candidato[]; escolha: number; ok: boolean }[] | null
  >(null);
  const porChave = new Map(vinculos.map((v) => [v.chave, v]));
  const porCodigo = useMemo(() => new Map(refs.map((r) => [r.codigo, r])), [refs]);
  const [busca, setBusca] = useState("");
  const lista = SERVICOS_VINCULAVEIS.filter(
    (s) => !busca || normaliza(s.desc).includes(normaliza(busca)),
  );
  const vinculados = SERVICOS_VINCULAVEIS.filter((s) => porChave.has(s.chave)).length;

  async function salvar(itens: { chave: string; codigo: string; descricao: string }[]) {
    if (!itens.length) return;
    await run(
      supabase
        .from("vinculos_preco")
        .upsert(itens.map((i) => ({ ...i, fonte: "SINAPI", updated_at: new Date().toISOString() })))
        .select(),
    );
    await qc.invalidateQueries({ queryKey: ["vinculos_preco"] });
    await qc.invalidateQueries({ queryKey: ["referencia"] });
    toast.success(`${itens.length} ${itens.length === 1 ? "vínculo salvo" : "vínculos salvos"}.`);
  }

  function sugerirTodos() {
    const sem = SERVICOS_VINCULAVEIS.filter((s) => !porChave.has(s.chave));
    const out = sem
      .map((s) => ({ s, c: sugerir(s, refs, 3), escolha: 0, ok: false }))
      .filter((x) => x.c.length)
      .map((x) => ({ ...x, ok: (x.c[0]?.pontos ?? 0) >= 6 }));
    if (!out.length) toast.message("Nenhuma sugestão nova com segurança para esta base.");
    else setLote(out);
  }

  return (
    <section className="card space-y-3 p-5" aria-label="Vínculos de preço">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 font-semibold">
          Serviços vinculados à referência{" "}
          <span className="font-normal text-muted-foreground">
            ({vinculados} de {SERVICOS_VINCULAVEIS.length})
          </span>
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field h-9 w-56 pl-8"
            placeholder="Filtrar serviço…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Filtrar serviço"
          />
        </div>
        <Button className="h-9" disabled={!refs.length} onClick={sugerirTodos}>
          <Sparkles className="size-4" /> Sugerir vínculos
        </Button>
      </div>
      {!ativa ? (
        <p className="text-sm text-muted-foreground">Importe uma base para vincular os serviços.</p>
      ) : carregando ? (
        <p className="text-sm text-muted-foreground">Carregando {ativa}…</p>
      ) : null}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
        <table className="tbl text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th>Serviço do sistema</th>
              <th className="w-12">Un</th>
              <th>Composição de referência</th>
              <th className="w-28 text-right">Preço</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => {
              const v = porChave.get(s.chave);
              const r = v ? porCodigo.get(v.codigo) : undefined;
              return (
                <tr key={s.chave}>
                  <td>{s.desc}</td>
                  <td>{s.un}</td>
                  <td className="text-xs">
                    {v ? (
                      <span className="flex items-start gap-1">
                        <Link2 className="mt-0.5 size-3 shrink-0 text-primary" />
                        <span>
                          <span className="num">{v.codigo}</span> · {v.descricao}
                          {!r && refs.length ? (
                            <span className="ml-1 text-warning">(não está na base ativa)</span>
                          ) : null}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="num text-right">{r ? fmtR(r.preco) : "—"}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        disabled={!refs.length}
                        onClick={() => setAberto(s)}
                      >
                        {v ? "Trocar" : "Vincular"}
                      </Button>
                      {v ? (
                        <button
                          className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                          aria-label={`Tirar vínculo de ${s.desc}`}
                          onClick={async () => {
                            await run(
                              supabase.from("vinculos_preco").delete().eq("chave", s.chave),
                            );
                            await qc.invalidateQueries({ queryKey: ["vinculos_preco"] });
                            await qc.invalidateQueries({ queryKey: ["referencia"] });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberto ? (
        <EscolherComposicao
          servico={aberto}
          refs={refs}
          onClose={() => setAberto(null)}
          onPick={async (r) => {
            await salvar([{ chave: aberto.chave, codigo: r.codigo, descricao: r.descricao }]);
            setAberto(null);
          }}
        />
      ) : null}

      {lote ? (
        <Dialog open onOpenChange={(v) => !v && setLote(null)}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Vínculos sugeridos · confira antes de salvar</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Marcados: sugestões com boa correspondência de descrição e mesma unidade. Desmarque o
              que não fizer sentido ou escolha outra opção.
            </p>
            <ul className="divide-y rounded-lg border">
              {lote.map((x, i) => (
                <li key={x.s.chave} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={x.ok}
                    aria-label={`Vincular ${x.s.desc}`}
                    onChange={(e) =>
                      setLote((l) =>
                        l!.map((y, k) => (k === i ? { ...y, ok: e.target.checked } : y)),
                      )
                    }
                  />
                  <span className="w-64 font-medium">
                    {x.s.desc} <span className="text-xs text-muted-foreground">({x.s.un})</span>
                  </span>
                  <select
                    className="field h-9 min-w-0 flex-1 text-xs"
                    value={x.escolha}
                    aria-label={`Composição para ${x.s.desc}`}
                    onChange={(e) =>
                      setLote((l) =>
                        l!.map((y, k) =>
                          k === i ? { ...y, escolha: Number(e.target.value), ok: true } : y,
                        ),
                      )
                    }
                  >
                    {x.c.map((c, k) => (
                      <option key={c.codigo} value={k}>
                        {c.codigo} · {c.descricao.slice(0, 110)} — {fmtR(c.preco)}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="h-10" onClick={() => setLote(null)}>
                Cancelar
              </Button>
              <Button
                className="h-10"
                onClick={async () => {
                  const itens = lote
                    .filter((x) => x.ok)
                    .map((x) => {
                      const c = x.c[x.escolha]!;
                      return { chave: x.s.chave, codigo: c.codigo, descricao: c.descricao };
                    });
                  await salvar(itens);
                  setLote(null);
                }}
              >
                Salvar {lote.filter((x) => x.ok).length} vínculos
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}

function EscolherComposicao({
  servico,
  refs,
  onClose,
  onPick,
}: {
  servico: Servico;
  refs: Registro[];
  onClose: () => void;
  onPick: (r: Registro) => void;
}) {
  const [q, setQ] = useState("");
  const sugeridas = useMemo(() => sugerir(servico, refs, 8), [servico, refs]);
  const qn = normaliza(q.trim());
  const achadas = qn
    ? refs
        .filter((r) => qn.split(/\s+/).every((t) => normaliza(r.descricao).includes(t)))
        .slice(0, 30)
    : sugeridas;
  const p = (r: Registro) => dividir(r.preco, r.pct_mo);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {servico.desc}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({SERVICO[servico.chave]?.un})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            className="field w-full pl-9"
            placeholder="Buscar na base (ex.: alvenaria bloco ceramico 14)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar composição"
          />
        </div>
        <ul className="divide-y rounded-lg border">
          {achadas.map((r) => (
            <li key={r.codigo}>
              <button
                className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-primary-soft"
                onClick={() => onPick(r)}
              >
                <span className="num w-20 shrink-0 text-xs text-muted-foreground">{r.codigo}</span>
                <span className="flex-1">{r.descricao}</span>
                <span className="w-10 text-xs">{r.unidade}</span>
                <span className="num w-24 text-right text-xs">
                  {fmtR(r.preco)}
                  {r.pct_mo != null ? (
                    <span className="block text-muted-foreground">M.O. {fmtR(p(r).mo_unit)}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          {!achadas.length ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nada encontrado.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
