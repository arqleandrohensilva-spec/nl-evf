import { useMemo, useState } from "react";
import { porAmbiente, porEtapa, resumo } from "@/lib/calc";
import { fmtPct, fmtR } from "@/lib/format";
import { Kpi } from "./cells";
import type { EvfData } from "./useEvfData";

export function ResumoTab({ d }: { d: EvfData }) {
  const { evf, itens, caps, capsBase, config, todosItens, filtro, ambientes, mEvf } = d;
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const resTodos = useMemo(() => resumo(todosItens, caps), [todosItens, caps]);
  /** O mesmo EVF com as taxas da tabela do escritório (cenário com a nossa gestão). */
  const comGestao = useMemo(() => resumo(itens, capsBase), [itens, capsBase]);
  const [ratear, setRatear] = useState(false);
  const pa = useMemo(
    () => porAmbiente(todosItens, caps, ambientes, ratear),
    [todosItens, caps, ambientes, ratear],
  );
  const nomeFiltro =
    filtro === "geral" ? "Itens gerais (obra toda)" : ambientes.find((a) => a.id === filtro)?.nome;
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
          titulo={nomeFiltro ? `Total — ${nomeFiltro}` : "Total geral"}
          valor={fmtR(res.geral)}
          nota={
            margem
              ? `Faixa ±${fmtPct(margem, 0)}: ${fmtR(res.geral * (1 - margem / 100))} a ${fmtR(res.geral * (1 + margem / 100))}`
              : undefined
          }
        />
        {nomeFiltro ? (
          <>
            <Kpi
              titulo="Total do EVF (todos)"
              valor={fmtR(resTodos.geral)}
              nota={target ? `Target ${fmtR(target)} vale para o EVF inteiro` : "Defina o target"}
            />
            <Kpi
              titulo="Peso no EVF"
              valor={fmtPct(resTodos.geral ? (res.geral / resTodos.geral) * 100 : 0)}
              nota="Parte deste ambiente no total"
            />
          </>
        ) : (
          <>
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
          </>
        )}
        {evf.sem_gestao ? (
          <Kpi
            titulo="Com a gestão do escritório"
            valor={fmtR(comGestao.geral)}
            nota={`+${fmtR(comGestao.taxas)} de taxas (${fmtPct(comGestao.taxaEfetiva)} sobre o custo direto)`}
          />
        ) : (
          <Kpi
            titulo="Taxa efetiva"
            valor={fmtPct(res.taxaEfetiva)}
            nota={`${fmtR(res.taxas)} sobre o custo direto`}
          />
        )}
      </div>

      {!nomeFiltro ? (
        <section
          className="card flex flex-wrap items-center justify-between gap-3 p-4"
          aria-label="Gestão do escritório"
        >
          <div className="min-w-[16rem] flex-1">
            <h2 className="font-semibold">Gestão da obra pelo escritório</h2>
            <p className="text-sm text-muted-foreground">
              {evf.sem_gestao
                ? `Sem a nossa gestão: o EVF não leva taxas de administração. Com a gestão, o total seria ${fmtR(comGestao.geral)}.`
                : `Com a nossa gestão: as taxas de administração por capítulo somam ${fmtR(res.taxas)}. Desligue se o cliente for contratar a obra direto.`}
            </p>
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={!evf.sem_gestao}
              onChange={(e) => mEvf.update.mutate({ id: evf.id, sem_gestao: !e.target.checked })}
            />
            Incluir a gestão do escritório
          </label>
        </section>
      ) : null}

      {!nomeFiltro && Number(evf.area_m2) > 0 ? (
        <CustoPorM2
          total={res.geral}
          area={Number(evf.area_m2)}
          cub={Number(config?.cub_valor) || 0}
          cubRef={config?.cub_ref ?? ""}
          semPreco={itens.filter((i) => Number(i.material_unit) + Number(i.mo_unit) === 0).length}
        />
      ) : null}

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
          {target && !nomeFiltro ? (
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
          {target && !nomeFiltro ? (
            <Legenda cor="bg-warning w-[3px]" t={`Target ${fmtR(target)}`} />
          ) : null}
        </div>
      </section>

      {ambientes.length ? (
        <section className="card overflow-x-auto" aria-label="Resumo por ambiente">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="font-semibold">Por ambiente</h2>
              <p className="text-sm text-muted-foreground">
                A junção de todos os ambientes. Itens sem ambiente (gestão, seguro, caçamba,
                limpeza) ficam em “Itens gerais” ou são distribuídos entre os ambientes.
              </p>
            </div>
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={ratear}
                onChange={(e) => setRatear(e.target.checked)}
              />
              Distribuir itens gerais proporcionalmente
            </label>
          </div>
          <table className="tbl mt-2 min-w-[760px]">
            <thead>
              <tr>
                <th>Ambiente</th>
                <th className="text-right">Itens</th>
                <th className="text-right">Material</th>
                <th className="text-right">M.O.</th>
                <th className="text-right">Taxas</th>
                <th className="text-right">Total</th>
                {ratear ? <th className="text-right">+ Gerais</th> : null}
                {ratear ? <th className="text-right">Total final</th> : null}
                <th className="text-right">% do EVF</th>
              </tr>
            </thead>
            <tbody>
              {pa.linhas.map((l) => (
                <tr key={l.id} className={filtro === l.id ? "bg-primary-soft" : undefined}>
                  <td className="py-2 font-medium">{l.nome}</td>
                  <td className="num text-right">{l.itens}</td>
                  <td className="num text-right">{fmtR(l.mat)}</td>
                  <td className="num text-right">{fmtR(l.mo)}</td>
                  <td className="num text-right">{fmtR(l.taxas)}</td>
                  <td className="num text-right font-medium">{fmtR(l.geral)}</td>
                  {ratear ? <td className="num text-right">{fmtR(l.rateio)}</td> : null}
                  {ratear ? (
                    <td className="num text-right font-semibold">{fmtR(l.final)}</td>
                  ) : null}
                  <td className="num text-right text-muted-foreground">
                    {fmtPct(pa.total ? (l.final / pa.total) * 100 : 0)}
                  </td>
                </tr>
              ))}
              {pa.geral ? (
                <tr
                  className={`text-muted-foreground ${filtro === "geral" ? "bg-primary-soft" : ""}`}
                >
                  <td className="py-2">
                    {pa.geral.nome}
                    {ratear ? " — distribuídos acima" : ""}
                  </td>
                  <td className="num text-right">{pa.geral.itens}</td>
                  <td className="num text-right">{fmtR(pa.geral.mat)}</td>
                  <td className="num text-right">{fmtR(pa.geral.mo)}</td>
                  <td className="num text-right">{fmtR(pa.geral.taxas)}</td>
                  <td className="num text-right">{fmtR(pa.geral.geral)}</td>
                  {ratear ? <td /> : null}
                  {ratear ? <td /> : null}
                  <td className="num text-right">
                    {ratear ? "—" : fmtPct(pa.total ? (pa.geral.geral / pa.total) * 100 : 0)}
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={ratear ? 7 : 5} className="py-3">
                  TOTAL GERAL
                </td>
                <td className="num text-right">{fmtR(pa.total)}</td>
                <td className="num text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </section>
      ) : null}

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
          {target && !nomeFiltro ? (
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

/** Custo por m² do EVF comparado ao CUB: um teste de sanidade, não um orçamento. */
function CustoPorM2({
  total,
  area,
  cub,
  cubRef,
  semPreco,
}: {
  total: number;
  area: number;
  cub: number;
  cubRef: string;
  semPreco: number;
}) {
  const m2 = total / area;
  const rel = cub ? (m2 / cub - 1) * 100 : 0;
  return (
    <section
      className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-5"
      aria-label="Custo por m²"
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Custo por m²
        </div>
        <div className="num text-2xl font-semibold">{fmtR(m2)}</div>
        <div className="text-xs text-muted-foreground">
          {fmtR(total)} ÷ {area.toLocaleString("pt-BR")} m²
        </div>
      </div>
      {cub ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CUB {cubRef}
          </div>
          <div className="num text-2xl font-semibold text-muted-foreground">{fmtR(cub)}</div>
          <div className="text-xs text-muted-foreground">
            EVF {rel >= 0 ? "+" : "−"}
            {fmtPct(Math.abs(rel), 0)} em relação ao CUB
          </div>
        </div>
      ) : null}
      <p className="min-w-[16rem] flex-1 text-sm text-muted-foreground">
        {semPreco
          ? `${semPreco} serviços ainda sem preço: o custo por m² vai subir até as cotações entrarem.`
          : "O CUB não inclui projetos, taxas, fundações especiais, muro, paisagismo nem equipamentos; um EVF completo costuma ficar acima dele."}
      </p>
    </section>
  );
}
