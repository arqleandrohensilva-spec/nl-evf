import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/calc";
import { EQUIPE, porEquipe } from "@/lib/equipes";
import { comoSeFaz } from "@/lib/execucao";
import { fmtData, fmtN } from "@/lib/format";
import { useEvfData } from "@/components/evf/useEvfData";

export const Route = createFileRoute("/_authenticated/escopo/$id")({
  head: () => ({ meta: [{ title: "Escopo para proposta — NL · EVF" }] }),
  validateSearch: (s: Record<string, unknown>): { eq: string } => ({
    eq: typeof s["eq"] === "string" && s["eq"] ? s["eq"] : "pedreiro",
  }),
  component: Page,
});

/**
 * Escopo de uma equipe para pedir proposta: tudo o que ela vai fazer, por ambiente, sem valores.
 * O profissional devolve um valor global (não item por item).
 */
function Page() {
  const { id } = Route.useParams();
  const { eq } = Route.useSearch();
  const d = useEvfData(id);
  const { evf, config, ambientes } = d;
  const [comoFaz, setComoFaz] = useState(true);
  const linha = useMemo(() => porEquipe(d.itens).find((l) => l.equipe.id === eq), [d.itens, eq]);
  const grupos = useMemo(() => {
    const ordem = [null, ...ambientes.map((a) => a.id)];
    const map = new Map<string | null, Item[]>();
    for (const i of linha?.itens ?? [])
      map.set(i.ambiente_id, [...(map.get(i.ambiente_id) ?? []), i]);
    return ordem
      .filter((a) => map.has(a))
      .map((a) => ({
        nome: a ? (ambientes.find((x) => x.id === a)?.nome ?? "Ambiente") : "Obra toda",
        itens: map.get(a)!,
      }));
  }, [linha, ambientes]);
  if (!evf) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const equipe = EQUIPE[eq];
  const ehMo = equipe?.tipo === "mo";
  let n = 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/evfs/$id" params={{ id: evf.id }} className="text-sm">
          ← Voltar ao EVF
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={comoFaz}
              onChange={(e) => setComoFaz(e.target.checked)}
            />
            Mostrar como se faz
          </label>
          <Button className="h-10" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / salvar em PDF
          </Button>
        </div>
      </div>

      <article className="space-y-6 bg-card p-8 text-[13px] leading-relaxed print:p-0">
        <header className="flex items-start justify-between gap-6 border-b pb-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              {config?.nome_escritorio ?? "NL Arquitetos"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Escopo de serviços para proposta</h1>
            <div className="mt-1 text-base">{equipe?.nome ?? eq}</div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-xs">
            <dt className="text-muted-foreground">Obra</dt>
            <dd>{evf.obra}</dd>
            {evf.cidade_uf ? (
              <>
                <dt className="text-muted-foreground">Local</dt>
                <dd>{evf.cidade_uf}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Data</dt>
            <dd className="num">{fmtData(new Date().toISOString().slice(0, 10))}</dd>
            <dt className="text-muted-foreground">Revisão</dt>
            <dd className="num">{evf.revisao}</dd>
          </dl>
        </header>

        <section className="space-y-2">
          <p>
            {ehMo ? (
              <>
                Pedimos proposta de <strong>mão de obra</strong> para executar o conjunto de
                serviços abaixo. <strong>Todo o material é comprado e entregue pela obra.</strong>{" "}
                Informe um <strong>valor global</strong> para tudo (não é preciso preço por item), o
                prazo e a forma de pagamento.
              </>
            ) : (
              <>
                Pedimos proposta de <strong>fornecimento e instalação</strong> dos itens abaixo, com
                material, transporte e instalação inclusos. Informe o valor global (e, se possível,
                por item), o prazo e a forma de pagamento.
              </>
            )}
          </p>
          <p className="text-muted-foreground">
            Fase de estudo de viabilidade: a proposta ajuda a decidir o projeto e daremos retorno.
            Quantidades aproximadas, a conferir na visita à obra.
          </p>
        </section>

        {!linha ? (
          <p className="text-muted-foreground">Nenhum serviço desta equipe no EVF.</p>
        ) : (
          grupos.map((g) => (
            <section key={g.nome} className="break-inside-avoid-page space-y-1">
              <h2 className="border-b pb-1 text-base font-semibold">{g.nome}</h2>
              <table className="w-full">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-8 py-1 font-medium">Nº</th>
                    <th className="py-1 font-medium">Serviço</th>
                    <th className="w-28 py-1 text-right font-medium">Quant.</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((i) => {
                    n += 1;
                    const c = comoFaz ? comoSeFaz(i) : null;
                    return (
                      <tr key={i.id} className="break-inside-avoid border-t align-top">
                        <td className="num py-1.5 text-muted-foreground">{n}</td>
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">{i.descricao}</div>
                          {c ? (
                            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                              {c.passos.join(" ")}
                              {c.cuidados?.length ? (
                                <span className="text-foreground">
                                  {" "}
                                  Atenção: {c.cuidados.join(" ")}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className="num whitespace-nowrap py-1.5 text-right">
                          {fmtN(Number(i.quantidade) || 0)} {i.unidade}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))
        )}

        <section className="break-inside-avoid space-y-2">
          <h2 className="border-b pb-1 text-base font-semibold">Condições gerais</h2>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Proteger pisos, peças e áreas que permanecem; limpeza ao fim de cada dia.</li>
            <li>Entulho ensacado e levado para a caçamba (fornecida pela obra).</li>
            <li>Ferramentas e equipamentos de uso pessoal e EPI por conta do profissional.</li>
            <li>Serviço não listado aqui é combinado à parte, antes de executar.</li>
          </ul>
        </section>

        <section className="break-inside-avoid space-y-3 rounded-lg border-2 border-foreground/70 p-4">
          <h2 className="text-base font-semibold">Proposta</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {[
              ehMo ? "Valor global da mão de obra (R$)" : "Valor global (R$)",
              "Prazo de execução (dias úteis)",
              "Forma de pagamento",
              "Validade da proposta",
              "Nome / empresa",
              "Telefone",
            ].map((c) => (
              <div key={c} className="border-b border-foreground/50 pb-6">
                {c}
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
