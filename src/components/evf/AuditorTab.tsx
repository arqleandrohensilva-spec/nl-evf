import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { auditar } from "@/lib/calc";
import { cn } from "@/lib/utils";
import type { EvfData } from "./useEvfData";
import { SugestoesPainel } from "./SugestoesPainel";

export function AuditorTab({ d }: { d: EvfData }) {
  const { evf, itens, caps, cotacoes } = d;
  const alertas = useMemo(
    () => (evf ? auditar(evf, itens, caps, cotacoes) : []),
    [evf, itens, caps, cotacoes],
  );
  if (!evf) return null;
  const altos = alertas.filter((a) => a.nivel === "alto");
  const medios = alertas.filter((a) => a.nivel === "medio");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conferência automática antes de apresentar o EVF. Os alertas são sugestões: confira e
        corrija na aba indicada.
      </p>
      <SugestoesPainel d={d} />
      {!alertas.length ? (
        <div className="card flex items-center gap-3 p-5 text-primary">
          <CheckCircle2 className="size-5" /> Nenhum alerta. O EVF passou nas conferências
          automáticas.
        </div>
      ) : null}
      {[...altos, ...medios].map((a, idx) => (
        <div
          key={idx}
          className={cn(
            "card flex gap-3 p-4",
            a.nivel === "alto" ? "border-warning/40 bg-warning-soft" : "",
          )}
        >
          {a.nivel === "alto" ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <div>
            <div className={cn("font-semibold", a.nivel === "alto" && "text-warning")}>
              {a.titulo}
            </div>
            <div className="text-sm text-foreground/80">{a.detalhe}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
