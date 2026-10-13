import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { run, useAllItens, useCapitulos, useConfig, useEvfs } from "@/lib/data";
import { resumo } from "@/lib/calc";
import { fmtData, fmtPct, fmtR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EvfFormDialog } from "@/components/evf/EvfForm";
import { aplicarPacote } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/evfs/")({
  head: () => ({
    meta: [
      { title: "Meus EVFs — NL · EVF" },
      { name: "description", content: "Lista de estudos de viabilidade financeira." },
      { property: "og:title", content: "Meus EVFs — NL · EVF" },
      { property: "og:description", content: "Lista de estudos de viabilidade financeira." },
    ],
  }),
  component: Page,
});

function Page() {
  const evfs = useEvfs().data ?? [];
  const itens = useAllItens().data ?? [];
  const caps = useCapitulos().data ?? [];
  const config = useConfig().data;
  const nav = useNavigate();
  const qc = useQueryClient();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Meus EVFs</h1>
          <p className="text-sm text-muted-foreground">
            Cada EVF compara o custo estimado com o target do cliente.
          </p>
        </div>
        <EvfFormDialog
          titulo="Novo EVF"
          textoBotao="Criar e abrir"
          config={config}
          trigger={<Button className="h-11">Novo EVF</Button>}
          comPacote
          onSubmit={async (d, pacote) => {
            const [novo] = await run(
              supabase
                .from("evfs")
                .insert({ ...d, status: "Rascunho", revisao: "R00" })
                .select(),
            );
            if (!novo) return;
            await aplicarPacote(novo.id, pacote);
            await qc.invalidateQueries({ queryKey: ["evfs"] });
            toast.success("EVF criado.");
            nav({ to: "/evfs/$id", params: { id: novo.id } });
          }}
        />
      </header>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[760px]">
          <thead>
            <tr>
              <th>Obra</th>
              <th>Status</th>
              <th className="text-right">Total geral</th>
              <th className="text-right">Target</th>
              <th className="text-right">Desvio</th>
              <th>Revisão</th>
            </tr>
          </thead>
          <tbody>
            {evfs.map((e) => {
              const r = resumo(
                itens.filter((i) => i.evf_id === e.id),
                caps,
              );
              const t = Number(e.target);
              const d = t ? ((r.geral - t) / t) * 100 : 0;
              return (
                <tr key={e.id} className="hover:bg-muted/60">
                  <td className="py-3">
                    <Link
                      to="/evfs/$id"
                      params={{ id: e.id }}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {e.obra || "(sem nome)"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {e.cliente} · {e.tipo_obra}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.status === "Aprovado" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="num text-right">{fmtR(r.geral)}</td>
                  <td className="num text-right text-muted-foreground">{t ? fmtR(t) : "—"}</td>
                  <td
                    className={`num text-right font-semibold ${t ? (d > 0 ? "text-warning" : "text-primary") : "text-muted-foreground"}`}
                  >
                    {t ? `${d > 0 ? "+" : ""}${fmtPct(d)}` : "—"}
                  </td>
                  <td className="text-muted-foreground">
                    {e.revisao} · {fmtData(e.data_base)}
                  </td>
                </tr>
              );
            })}
            {!evfs.length ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum EVF ainda. Clique em “Novo EVF”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
