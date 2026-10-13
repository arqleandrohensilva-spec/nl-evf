import { Plus, Trash2 } from "lucide-react";
import { sortItens, valorCotacao, type Cotacao, type Item } from "@/lib/calc";
import { fmtR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NumCell, TextCell } from "./cells";
import type { EvfData } from "./useEvfData";

const CRITERIOS = [
  { v: "media", l: "Média" },
  { v: "menor", l: "Menor" },
  { v: "maior", l: "Maior" },
];

export function CotacoesTab({ d }: { d: EvfData }) {
  const { itens, cotacoes, mItem, mCot } = d;
  const lista = sortItens(itens).filter((i) => i.tipo_preco === "cotacao");
  const com3 = lista.filter(
    (i) => cotacoes.filter((c) => c.item_id === i.id && Number(c.valor) > 0).length >= 3,
  ).length;

  /** Recalcula o valor considerado e grava no material_unit do item. */
  function sincronizar(item: Item, cots: Cotacao[], criterio = item.criterio_cotacao) {
    const v = valorCotacao(
      cots.map((c) => Number(c.valor)),
      criterio,
    );
    const patch: Record<string, unknown> = { criterio_cotacao: criterio };
    if (v != null) patch["material_unit"] = v;
    mItem.update.mutate({ id: item.id, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Itens por cotação
          </div>
          <div className="num text-2xl font-semibold">{lista.length}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Com 3 cotações
          </div>
          <div className="num text-2xl font-semibold">{com3}</div>
        </div>
        <div
          className={cn(
            "card px-4 py-3",
            lista.length - com3 > 0 && "border-warning/40 bg-warning-soft",
          )}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-warning">
            Faltam cotações
          </div>
          <div className="num text-2xl font-semibold text-warning">{lista.length - com3}</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Padrão: média de 3 fornecedores. O valor considerado vira o preço unitário de material do
        item. Ao trocar o critério, registre a justificativa.
      </p>
      <div className="space-y-3">
        {lista.map((i) => {
          const cs = cotacoes.filter((c) => c.item_id === i.id).sort((a, b) => a.ordem - b.ordem);
          const vals = cs.map((c) => Number(c.valor)).filter((v) => v > 0);
          const spread = vals.length > 1 ? (Math.max(...vals) / Math.min(...vals) - 1) * 100 : 0;
          return (
            <section key={i.id} className="card p-4" aria-label={`Cotações de ${i.descricao}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    <span className="num mr-2 text-muted-foreground">{i.codigo}</span>
                    {i.descricao}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {vals.length < 3 ? (
                      <span className="rounded bg-warning-soft px-2 py-0.5 font-medium text-warning">
                        Só {vals.length} cotação{vals.length === 1 ? "" : "ões"}
                      </span>
                    ) : (
                      <span className="rounded bg-primary-soft px-2 py-0.5 font-medium text-primary">
                        3 cotações
                      </span>
                    )}
                    {spread >= 30 ? (
                      <span className="rounded bg-warning-soft px-2 py-0.5 font-medium text-warning">
                        Diferença de {Math.round(spread)}% entre propostas
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    role="group"
                    aria-label="Critério"
                    className="inline-flex overflow-hidden rounded-lg border"
                  >
                    {CRITERIOS.map((c) => (
                      <button
                        key={c.v}
                        type="button"
                        aria-pressed={i.criterio_cotacao === c.v}
                        className={cn(
                          "min-h-9 px-3 text-sm",
                          i.criterio_cotacao === c.v
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "bg-card hover:bg-muted",
                        )}
                        onClick={() => sincronizar(i, cs, c.v)}
                      >
                        {c.l}
                      </button>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Considerado</div>
                    <div className="num font-semibold">{fmtR(Number(i.material_unit))}</div>
                  </div>
                </div>
              </div>
              <table className="tbl mt-3">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th className="w-36 text-right">Valor (R$)</th>
                    <th className="w-40">Data</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {cs.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <TextCell
                          value={c.fornecedor_nome ?? ""}
                          placeholder="Nome do fornecedor"
                          label="Fornecedor"
                          onSave={(v) => mCot.update.mutate({ id: c.id, fornecedor_nome: v })}
                        />
                      </td>
                      <td>
                        <NumCell
                          value={Number(c.valor)}
                          label="Valor"
                          onSave={async (v) => {
                            await mCot.update.mutateAsync({ id: c.id, valor: v });
                            sincronizar(
                              i,
                              cs.map((x) => (x.id === c.id ? { ...x, valor: v } : x)),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          aria-label="Data da cotação"
                          className="cell-input"
                          value={c.data ?? ""}
                          onChange={(e) =>
                            mCot.update.mutate({ id: c.id, data: e.target.value || null })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                          aria-label="Excluir cotação"
                          onClick={async () => {
                            await mCot.remove.mutateAsync(c.id);
                            sincronizar(
                              i,
                              cs.filter((x) => x.id !== c.id),
                            );
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cs.length < 3 ? (
                <button
                  className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-soft"
                  onClick={() =>
                    mCot.insert.mutate({
                      item_id: i.id,
                      fornecedor_nome: "",
                      valor: 0,
                      ordem: cs.length + 1,
                      data: new Date().toISOString().slice(0, 10),
                    })
                  }
                >
                  <Plus className="size-4" /> Adicionar cotação
                </button>
              ) : null}
              {i.criterio_cotacao !== "media" ? (
                <div className="mt-2">
                  <TextCell
                    value={i.justificativa ?? ""}
                    placeholder="Justificativa do critério (obrigatória quando não for a média)"
                    label="Justificativa"
                    className="border-border"
                    onSave={(v) => mItem.update.mutate({ id: i.id, justificativa: v })}
                  />
                </div>
              ) : null}
            </section>
          );
        })}
        {!lista.length ? (
          <div className="card p-8 text-center text-muted-foreground">
            Nenhum item do tipo “Cotação”. Mude o tipo do item na aba Escopo.
          </div>
        ) : null}
      </div>
    </div>
  );
}
