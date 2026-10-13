import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { quantidadeVinculada, sugerir } from "@/lib/sugestoes";
import { Copy, FileDown, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditar, filtrarPorAmbiente, porAmbiente, resumo } from "@/lib/calc";
import { duplicarEvf, exportarXlsx } from "@/lib/actions";
import { fmtData, fmtPct, fmtR } from "@/lib/format";
import { useEvfData } from "@/components/evf/useEvfData";
import { SelectCell, STATUS_OPTIONS } from "@/components/evf/cells";
import { EvfFormDialog } from "@/components/evf/EvfForm";
import { EscopoTab } from "@/components/evf/EscopoTab";
import { CotacoesTab } from "@/components/evf/CotacoesTab";
import { ResumoTab } from "@/components/evf/ResumoTab";
import { AbcTab } from "@/components/evf/AbcTab";
import { AuditorTab } from "@/components/evf/AuditorTab";
import { LevantamentoTab } from "@/components/evf/LevantamentoTab";

export const Route = createFileRoute("/_authenticated/evfs/$id")({
  head: () => ({ meta: [{ title: "EVF — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const d = useEvfData(id);
  const { evf, itens, caps, cotacoes, config, mEvf } = d;
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const nAlertas = useMemo(
    () =>
      evf
        ? auditar(evf, itens, caps, cotacoes).length + sugerir(evf, itens, d.ambientes).length
        : 0,
    [evf, itens, caps, cotacoes, d.ambientes],
  );
  const [aba, setAba] = useState("escopo");
  const [filtro, setFiltroState] = useState("");
  const chaveFiltro = `nl-evf:filtro:${id}`;
  useEffect(() => {
    try {
      setFiltroState(localStorage.getItem(chaveFiltro) ?? "");
    } catch {
      /* sem armazenamento: começa em Todos */
    }
  }, [chaveFiltro]);
  const setFiltro = (v: string) => {
    setFiltroState(v);
    try {
      localStorage.setItem(chaveFiltro, v);
    } catch {
      /* ignora */
    }
  };
  // Se o ambiente filtrado foi apagado, volta para Todos.
  const filtroValido =
    !filtro || filtro === "geral" || d.ambientes.some((a) => a.id === filtro) ? filtro : "";
  const dv = useMemo(
    () => ({ ...d, itens: filtrarPorAmbiente(d.itens, filtroValido), filtro: filtroValido }),
    [d, filtroValido],
  );
  const porAmb = useMemo(() => porAmbiente(itens, caps, d.ambientes), [itens, caps, d.ambientes]);

  // Itens vinculados às medidas (ou a outro item) acompanham as mudanças automaticamente.
  const pendentes = useRef(new Map<string, number>());
  useEffect(() => {
    for (const i of itens) {
      const q = quantidadeVinculada(i, itens, d.ambientes, d.medicoes);
      if (q == null) continue;
      const atual = Number(i.quantidade);
      if (Math.abs(q - atual) < 1e-6) {
        pendentes.current.delete(i.id);
        continue;
      }
      if (pendentes.current.get(i.id) === q) continue;
      pendentes.current.set(i.id, q);
      d.mItem.update.mutate({ id: i.id, quantidade: q });
    }
  }, [itens, d.ambientes, d.medicoes, d.mItem.update]);
  const [ocupado, setOcupado] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();

  if (d.carregando) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!evf)
    return (
      <div className="card p-8">
        EVF não encontrado. <Link to="/evfs">Voltar para Meus EVFs</Link>
      </div>
    );

  const target = Number(evf.target) || 0;
  const desvio = res.geral - target;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-sm text-muted-foreground">
            <Link to="/evfs">Meus EVFs</Link> / {evf.obra}
          </div>
          <h1 className="text-2xl font-semibold">
            {evf.obra} <span className="font-normal text-muted-foreground">— {evf.cliente}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-2.5 py-1">Revisão {evf.revisao}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              Data-base {fmtData(evf.data_base)}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              {evf.tipo_obra} · {String(evf.area_m2).replace(".", ",")} m² · {evf.padrao}
            </span>
            <div className="w-36">
              <SelectCell
                value={evf.status}
                options={STATUS_OPTIONS}
                label="Status"
                className="rounded-full border-border bg-card"
                onSave={(v) => mEvf.update.mutate({ id: evf.id, status: v })}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total geral
            </div>
            <div className="num text-2xl font-semibold">{fmtR(res.geral)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Target
            </div>
            <div className="num text-2xl font-semibold text-muted-foreground">
              {target ? fmtR(target) : "—"}
            </div>
          </div>
          {target ? (
            <div
              className={`rounded-lg px-3 py-1 text-right ${desvio > 0 ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide">Desvio</div>
              <div className="num text-lg font-semibold">
                {desvio > 0 ? "+" : "−"}
                {fmtR(Math.abs(desvio))} ({desvio > 0 ? "+" : ""}
                {fmtPct((desvio / target) * 100)})
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="no-print flex flex-wrap gap-2">
        <EvfFormDialog
          titulo="Editar dados do EVF"
          textoBotao="Salvar"
          config={config}
          inicial={evf}
          trigger={
            <Button variant="outline" className="h-10">
              <Pencil className="size-4" /> Editar dados
            </Button>
          }
          onSubmit={async (v) => {
            await mEvf.update.mutateAsync({ id: evf.id, ...v });
            toast.success("Dados atualizados.");
          }}
        />
        <Button
          variant="outline"
          className="h-10"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              const novo = await duplicarEvf(evf.id);
              await qc.invalidateQueries();
              toast.success("Nova revisão criada. Use-a para montar outro cenário.");
              nav({ to: "/evfs/$id", params: { id: novo } });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao duplicar.");
            } finally {
              setOcupado(false);
            }
          }}
        >
          <Copy className="size-4" /> Duplicar como nova revisão
        </Button>
        <Button
          variant="outline"
          className="h-10"
          onClick={() =>
            exportarXlsx(evf, itens, caps, cotacoes, config?.nome_escritorio ?? "NL Arquitetos", {
              ambientes: d.ambientes,
              filtro: filtroValido,
            }).catch((e: unknown) => toast.error(String(e)))
          }
        >
          <FileDown className="size-4" /> Exportar .xlsx
          {filtroValido ? (
            <span className="text-xs text-muted-foreground">(só o ambiente)</span>
          ) : null}
        </Button>
        <Button asChild variant="outline" className="h-10">
          <Link
            to="/imprimir/$id"
            params={{ id: evf.id }}
            search={filtroValido ? { amb: filtroValido } : {}}
          >
            <Printer className="size-4" /> PDF do cliente
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="h-10 text-muted-foreground hover:text-warning"
          onClick={async () => {
            if (
              !confirm(
                `Excluir o EVF "${evf.obra}" (${evf.revisao}) e todos os itens? Não dá para desfazer.`,
              )
            )
              return;
            await mEvf.remove.mutateAsync(evf.id);
            toast.success("EVF excluído.");
            nav({ to: "/evfs" });
          }}
        >
          <Trash2 className="size-4" /> Excluir
        </Button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="no-print h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {[
            ["levantamento", "Ambientes e medidas"],
            ["escopo", "Escopo"],
            ["cotacoes", "Cotações"],
            ["resumo", "Resumo"],
            ["abc", "Curva ABC"],
            ["auditor", `Auditor${nAlertas ? ` (${nAlertas})` : ""}`],
          ].map(([v, l]) => (
            <TabsTrigger
              key={v}
              value={v ?? ""}
              className="h-10 rounded-lg border border-border bg-card px-4 data-[state=active]:border-primary data-[state=active]:bg-primary-soft data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        {d.ambientes.length && ["escopo", "cotacoes", "resumo", "abc"].includes(aba) ? (
          <div
            role="group"
            aria-label="Ambiente em foco"
            className="no-print mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="text-sm text-muted-foreground">Ambiente:</span>
            {[
              { v: "", l: "Todos", total: res.geral },
              ...porAmb.linhas.map((l) => ({ v: l.id, l: l.nome, total: l.geral })),
              ...(porAmb.geral
                ? [{ v: "geral", l: "Itens gerais", total: porAmb.geral.geral }]
                : []),
            ].map((o) => (
              <button
                key={o.v || "todos"}
                type="button"
                aria-pressed={filtroValido === o.v}
                onClick={() => setFiltro(o.v)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm ${
                  filtroValido === o.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span className="font-medium">{o.l}</span>
                <span className="num text-xs opacity-80">{fmtR(o.total)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <TabsContent value="escopo" className="mt-4">
          <EscopoTab d={dv} />
        </TabsContent>
        <TabsContent value="cotacoes" className="mt-4">
          <CotacoesTab d={dv} />
        </TabsContent>
        <TabsContent value="resumo" className="mt-4">
          <ResumoTab d={dv} />
        </TabsContent>
        <TabsContent value="abc" className="mt-4">
          <AbcTab d={dv} />
        </TabsContent>
        <TabsContent value="auditor" className="mt-4">
          <AuditorTab d={d} />
        </TabsContent>
        <TabsContent value="levantamento" className="mt-4">
          <LevantamentoTab d={d} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
