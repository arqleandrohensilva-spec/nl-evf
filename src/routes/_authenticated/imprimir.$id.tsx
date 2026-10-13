import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { curvaABC, itemTotais, porEtapa, resumo } from "@/lib/calc";
import { fmtData, fmtN, fmtPct, fmtR } from "@/lib/format";
import { useEvfData } from "@/components/evf/useEvfData";

export const Route = createFileRoute("/_authenticated/imprimir/$id")({
  head: () => ({ meta: [{ title: "EVF para o cliente — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const d = useEvfData(id);
  const { evf, itens, caps, config } = d;
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const abc = useMemo(() => curvaABC(itens), [itens]);
  const etapas = useMemo(() => porEtapa(itens, caps), [itens, caps]);
  if (!evf) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const target = Number(evf.target) || 0;
  const margem = Number(config?.margem_erro_pct) || 0;
  const temFutura = etapas.futura.direto > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/evfs/$id" params={{ id: evf.id }} className="text-sm">
          ← Voltar ao EVF
        </Link>
        <Button className="h-10" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / salvar em PDF
        </Button>
      </div>

      <article className="space-y-8 bg-card p-8 text-[13px] leading-relaxed print:p-0">
        <header className="flex items-start justify-between gap-6 border-b pb-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {config?.nome_escritorio ?? "NL Arquitetos"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Estudo de Viabilidade Financeira</h1>
            <div className="mt-1 text-base">
              {evf.obra} — {evf.cliente}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-xs">
            <dt className="text-muted-foreground">Revisão</dt>
            <dd className="num">{evf.revisao}</dd>
            <dt className="text-muted-foreground">Data-base dos preços</dt>
            <dd className="num">{fmtData(evf.data_base)}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{evf.tipo_obra}</dd>
            <dt className="text-muted-foreground">Área</dt>
            <dd className="num">{fmtN(Number(evf.area_m2))} m²</dd>
          </dl>
        </header>

        <section>
          <h2 className="mb-2 text-base font-semibold">Escopo e especificações</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2">Item</th>
                <th className="py-1.5 pr-2">Serviço / especificação</th>
                <th className="py-1.5 pr-2">Un.</th>
                <th className="py-1.5 pr-2 text-right">Quant.</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {res.capitulos.map((c) => (
                <FragmentCap key={c.codigo} c={c} />
              ))}
            </tbody>
          </table>
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-1 text-base font-semibold">Onde está o dinheiro (curva ABC)</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {abc.nA} de {abc.rows.length} itens concentram cerca de 80% do custo. As decisões nesses
            itens são as que mais mudam o valor da obra.
          </p>
          <table className="w-full border-collapse">
            <tbody>
              {abc.rows.slice(0, 10).map((r, idx) => (
                <tr key={r.item.id} className="border-b border-dashed">
                  <td className="num w-8 py-1 text-muted-foreground">{idx + 1}</td>
                  <td className="py-1">{r.item.descricao}</td>
                  <td className="num w-28 py-1 text-right">{fmtR(r.total)}</td>
                  <td className="num w-16 py-1 text-right text-muted-foreground">
                    {fmtPct(r.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold">Resumo</h2>
          <table className="w-full border-collapse">
            <tbody>
              {res.capitulos.map((c) => (
                <tr key={c.codigo} className="border-b">
                  <td className="num w-8 py-1 text-muted-foreground">{c.codigo}</td>
                  <td className="py-1">{c.nome}</td>
                  <td className="num py-1 text-right">{fmtR(c.total + c.taxa)}</td>
                </tr>
              ))}
              <tr className="text-base font-bold">
                <td />
                <td className="py-3">Total geral estimado</td>
                <td className="num py-3 text-right">{fmtR(res.geral)}</td>
              </tr>
              {temFutura ? (
                <>
                  <tr>
                    <td />
                    <td className="py-0.5">Executar agora</td>
                    <td className="num py-0.5 text-right">{fmtR(etapas.agora.geral)}</td>
                  </tr>
                  <tr>
                    <td />
                    <td className="py-0.5">Etapa futura</td>
                    <td className="num py-0.5 text-right">{fmtR(etapas.futura.geral)}</td>
                  </tr>
                </>
              ) : null}
              {target ? (
                <tr>
                  <td />
                  <td className="py-0.5 text-muted-foreground">
                    Investimento previsto pelo cliente (target)
                  </td>
                  <td className="num py-0.5 text-right text-muted-foreground">{fmtR(target)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p>
              Valores por item já incluem materiais, mão de obra e taxa de administração da obra.
              Este é um estudo de viabilidade feito sobre o Estudo Preliminar: os valores são
              estimativas{margem ? ` com margem de ±${fmtPct(margem, 0)}` : ""} e serão confirmados
              no orçamento executivo, após o projeto executivo.
            </p>
            <p>
              Preços com data-base de {fmtData(evf.data_base)}. Valores podem variar com o tempo, a
              disponibilidade e as escolhas finais de acabamento.
            </p>
            {evf.observacoes ? <p>Premissas: {evf.observacoes}</p> : null}
          </div>
        </section>
      </article>
    </div>
  );
}

function FragmentCap({ c }: { c: ReturnType<typeof resumo>["capitulos"][number] }) {
  const fator = c.total ? (c.total + c.taxa) / c.total : 1;
  return (
    <>
      <tr className="break-inside-avoid border-b bg-muted/60">
        <td className="num py-1.5 pr-2 font-semibold">{c.codigo}</td>
        <td colSpan={3} className="py-1.5 pr-2 font-semibold uppercase">
          {c.nome}
        </td>
        <td className="num py-1.5 text-right font-semibold">{fmtR(c.total + c.taxa)}</td>
      </tr>
      {c.itens.map((i) => (
        <tr key={i.id} className="border-b border-dashed">
          <td className="num py-1 pr-2 text-muted-foreground">{i.codigo}</td>
          <td className="py-1 pr-2">
            {i.descricao}
            {i.etapa === "Etapa futura" ? (
              <span className="ml-1 text-xs text-muted-foreground">(etapa futura)</span>
            ) : null}
          </td>
          <td className="py-1 pr-2">{i.unidade}</td>
          <td className="num py-1 pr-2 text-right">{fmtN(Number(i.quantidade))}</td>
          <td className="num py-1 text-right">{fmtR(itemTotais(i).total * fator)}</td>
        </tr>
      ))}
    </>
  );
}
