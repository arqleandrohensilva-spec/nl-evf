import { useMemo } from "react";
import { curvaABC } from "@/lib/calc";
import { fmtN, fmtPct, fmtR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EvfData } from "./useEvfData";

const CLS: Record<string, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-primary-soft text-primary",
  C: "bg-muted text-muted-foreground",
};

export function AbcTab({ d }: { d: EvfData }) {
  const abc = useMemo(() => curvaABC(d.itens), [d.itens]);
  const n = abc.rows.length;
  const somaA = abc.rows.filter((r) => r.classe === "A").reduce((s, r) => s + r.total, 0);
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Classe A
          </div>
          <div className="text-lg font-semibold">
            <span className="num">{abc.nA}</span> de <span className="num">{n}</span> itens somam{" "}
            <span className="num">{fmtPct(abc.soma ? (somaA / abc.soma) * 100 : 0, 0)}</span> do
            custo direto
          </div>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          É nesses itens que vale negociar preço e propor alternativas. Em reformas pequenas a
          classe A costuma ter mais de 20% dos itens; isso é normal.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[820px]">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th className="w-16">Item</th>
              <th>Serviço</th>
              <th className="w-14">Un.</th>
              <th className="w-20 text-right">Quant.</th>
              <th className="w-32 text-right">Total</th>
              <th className="w-20 text-right">%</th>
              <th className="w-40">% acumulado</th>
              <th className="w-16 text-center">Classe</th>
            </tr>
          </thead>
          <tbody>
            {abc.rows.map((r, idx) => (
              <tr key={r.item.id}>
                <td className="num py-2 text-muted-foreground">{idx + 1}</td>
                <td className="num text-muted-foreground">{r.item.codigo}</td>
                <td>{r.item.descricao}</td>
                <td>{r.item.unidade}</td>
                <td className="num text-right">{fmtN(Number(r.item.quantidade))}</td>
                <td className="num text-right font-medium">{fmtR(r.total)}</td>
                <td className="num text-right">{fmtPct(r.pct)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded",
                          r.classe === "A"
                            ? "bg-primary"
                            : r.classe === "B"
                              ? "bg-[#8FAE9F]"
                              : "bg-[#C9C9C2]",
                        )}
                        style={{ width: `${Math.min(100, r.acum)}%` }}
                      />
                    </div>
                    <span className="num w-12 text-right text-xs">{fmtPct(r.acum)}</span>
                  </div>
                </td>
                <td className="text-center">
                  <span
                    className={cn(
                      "inline-block rounded px-2 py-0.5 text-xs font-bold",
                      CLS[r.classe],
                    )}
                  >
                    {r.classe}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
