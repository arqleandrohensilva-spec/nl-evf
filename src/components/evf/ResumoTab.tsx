import { useMemo } from "react";
import { porEtapa, resumo } from "@/lib/calc";
import { fmtPct, fmtR } from "@/lib/format";
import { Kpi } from "./cells";
import type { EvfData } from "./useEvfData";

export function ResumoTab({ d }: { d: EvfData }) {
  const { evf, itens, caps, config } = d;
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const etapas = useMemo(() => porEtapa(itens, caps), [itens, caps]);
  if (!evf) return null;
  const target = Number(evf.target) || 0;
  const desvio = res.geral - target;
  const escala = Math.max(res.geral, target) || 1;
  const w = (v: number) => `${((v / escala) * 100).toFixed(2)}%`;
  const margem = Number(config?.margem_erro_pct) || 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          titulo="Total geral"
          valor={fmtR(res.geral)}
          nota={
            margem
              ? `Faixa ±${fmtPct(margem, 0)}: ${fmtR(res.geral * (1 - margem / 100))} a ${fmtR(res.geral * (1 + margem / 100))}`
              : undefined
          }
        />
        <Kpi
          titulo="Target do cliente"
          valor={target ? fmtR(target) : "—"}
          nota="Informado no briefing"
        />
        <Kpi
          titulo="Desvio"
          tom={target ? (desvio > 0 ? "alerta" : "ok") : "normal"}
          valor={target ? `${desvio > 0 ? "+" : "−"}${fmtR(Math.abs(desvio))}` : "—"}
          nota={
            target
              ? `${desvio > 0 ? "+" : ""}${fmtPct((desvio / target) * 100)} ${desvio > 0 ? "acima do target" : "dentro do target"}`
              : "Defina o target"
          }
        />
        <Kpi
          titulo="Taxa efetiva"
          valor={fmtPct(res.taxaEfetiva)}
          nota={`${fmtR(res.taxas)} sobre o custo direto`}
        />
      </div>

      <section className="card space-y-3 p-5" aria-label="Total contra o target">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-semibold">Total × target</h2>
          <span className="text-sm text-muted-foreground">
            Material {fmtPct(res.geral ? (res.mat / res.geral) * 100 : 0, 0)} · Mão de obra{" "}
            {fmtPct(res.geral ? (res.mo / res.geral) * 100 : 0, 0)} · Taxas{" "}
            {fmtPct(res.geral ? (res.taxas / res.geral) * 100 : 0, 0)}
          </span>
        </div>
        <div className="relative h-7 overflow-hidden rounded-md bg-muted">
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: w(res.mat) }} />
          <div
            className="absolute inset-y-0 bg-[#6E9585]"
            style={{ left: w(res.mat), width: w(res.mo) }}
          />
          <div
            className="absolute inset-y-0 bg-[#B9CDC4]"
            style={{ left: w(res.mat + res.mo), width: w(res.taxas) }}
          />
          {target ? (
            <div
              className="absolute -inset-y-0.5 w-[3px] bg-warning"
              style={{ left: w(target) }}
              title={`Target ${fmtR(target)}`}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legenda cor="bg-primary" t="Material" />
          <Legenda cor="bg-[#6E9585]" t="Mão de obra" />
          <Legenda cor="bg-[#B9CDC4]" t="Taxas de administração" />
          {target ? <Legenda cor="bg-warning w-[3px]" t={`Target ${fmtR(target)}`} /> : null}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card overflow-x-auto" aria-label="Resumo por capítulo">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Serviços</th>
                <th className="text-right">Material</th>
                <th className="text-right">M.O.</th>
                <th className="text-right">Total</th>
                <th className="text-right">Taxa</th>
                <th className="text-right">Valor taxa</th>
              </tr>
            </thead>
            <tbody>
              {res.capitulos.map((c) => (
                <tr key={c.codigo}>
                  <td className="num py-2 text-muted-foreground">{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td className="num text-right">{fmtR(c.mat)}</td>
                  <td className="num text-right">{fmtR(c.mo)}</td>
                  <td className="num text-right font-medium">{fmtR(c.total)}</td>
                  <td className="num text-right text-muted-foreground">
                    {c.taxaPct == null ? "—" : fmtPct(c.taxaPct, 0)}
                  </td>
                  <td className="num text-right">{fmtR(c.taxa)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={2} className="py-2">
                  Custo direto
                </td>
                <td className="num text-right">{fmtR(res.mat)}</td>
                <td className="num text-right">{fmtR(res.mo)}</td>
                <td className="num text-right">{fmtR(res.direto)}</td>
                <td />
                <td className="num text-right">{fmtR(res.taxas)}</td>
              </tr>
              <tr className="text-base font-bold">
                <td colSpan={4} className="py-3">
                  TOTAL GERAL (custo direto + taxas)
                </td>
                <td colSpan={3} className="num text-right">
                  {fmtR(res.geral)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="card space-y-3 p-5" aria-label="Execução por etapa">
          <h2 className="font-semibold">Execução por etapa</h2>
          <p className="text-sm text-muted-foreground">
            Itens marcados como “Etapa futura” na aba Escopo saem do valor de agora.
          </p>
          <div className="rounded-lg bg-primary-soft p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              Agora (com taxas)
            </div>
            <div className="num text-xl font-semibold">{fmtR(etapas.agora.geral)}</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Etapa futura (com taxas)
            </div>
            <div className="num text-xl font-semibold">{fmtR(etapas.futura.geral)}</div>
          </div>
          {target ? (
            <p
              className={`text-sm ${etapas.agora.geral > target ? "text-warning" : "text-primary"}`}
            >
              {etapas.agora.geral > target
                ? `Agora fica ${fmtR(etapas.agora.geral - target)} acima do target.`
                : `Agora cabe no target, com folga de ${fmtR(target - etapas.agora.geral)}.`}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Legenda({ cor, t }: { cor: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${cor}`} />
      {t}
    </span>
  );
}
