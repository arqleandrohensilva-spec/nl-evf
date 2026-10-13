import { createFileRoute } from "@tanstack/react-router";
import { useAllItens, useCapitulos, useEvfs } from "@/lib/data";
import { resumo } from "@/lib/calc";
import { fmtPct, fmtR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/evfs")({
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
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Meus EVFs</h1>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Obra</th><th>Cliente</th><th>Status</th><th>Total geral</th><th>Target</th><th>Desvio</th><th>Revisão</th>
            </tr>
          </thead>
          <tbody>
            {evfs.map((e) => {
              const r = resumo(itens.filter((i) => i.evf_id === e.id), caps);
              const t = Number(e.target);
              const d = t ? ((r.geral - t) / t) * 100 : 0;
              return (
                <tr key={e.id}>
                  <td>{e.obra}</td><td>{e.cliente}</td><td>{e.status}</td>
                  <td className="num">{fmtR(r.geral)}</td><td className="num">{fmtR(t)}</td>
                  <td className={`num ${d > 0 ? "text-warning" : "text-primary"}`}>{fmtPct(d)}</td>
                  <td className="num">{e.revisao}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
