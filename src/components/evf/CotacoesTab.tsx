import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { itemTotais, sortItens, valorCotacao, type Cotacao, type Item } from "@/lib/calc";
import { atualizarPrecos } from "@/lib/actions";
import { EQUIPE, equipeDoItem } from "@/lib/equipes";
import { agruparPorFase } from "@/lib/fases";
import { fmtR } from "@/lib/format";
import { useReferencia } from "@/lib/precos";
import { dividir } from "@/lib/referencia";
import { cn } from "@/lib/utils";
import { LinkCell, NumCell, TextCell } from "./cells";
import type { EvfData } from "./useEvfData";

const CRITERIOS = [
  { v: "media", l: "Média" },
  { v: "menor", l: "Menor" },
  { v: "maior", l: "Maior" },
];

const semPreco = (i: Item) => Number(i.material_unit) + Number(i.mo_unit) === 0;

/**
 * Preços e cotações: o único lugar onde se lançam valores.
 * - Comprados de fornecedor (tipo cotação): uma ou mais cotações → material; a mão de obra ao lado.
 * - Serviços (composição e verba): material e mão de obra por unidade do item.
 */
export function CotacoesTab({ d, foco }: { d: EvfData; foco?: string | null }) {
  const { itens, cotacoes, mItem, mCot, ambientes } = d;
  const [soFalta, setSoFalta] = useState(false);
  const referencia = useReferencia().data;
  const todos = useMemo(() => sortItens(itens), [itens]);
  const nCot = (i: Item) =>
    cotacoes.filter((c) => c.item_id === i.id && Number(c.valor) > 0).length;
  const falta = (i: Item) => semPreco(i);
  const cotados = todos.filter((i) => i.tipo_preco === "cotacao" && (!soFalta || falta(i)));
  const servicos = todos.filter((i) => i.tipo_preco !== "cotacao" && (!soFalta || falta(i)));
  const nSemPreco = todos.filter(semPreco).length;
  const comCot = todos.filter((i) => i.tipo_preco === "cotacao" && nCot(i) > 0).length;
  const nCotados = todos.filter((i) => i.tipo_preco === "cotacao").length;
  const nomeAmb = (id: string | null) => ambientes.find((a) => a.id === id)?.nome ?? "Obra toda";
  const preenchiveis = todos.filter((i) => semPreco(i) && i.chave && referencia?.has(i.chave));

  useEffect(() => {
    if (!foco) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`preco-${foco}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-primary");
      setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 2500);
    }, 150);
    return () => clearTimeout(t);
  }, [foco]);

  /** Recalcula o valor considerado e grava no material do item. */
  function sincronizar(item: Item, cots: Cotacao[], criterio = item.criterio_cotacao) {
    const v = valorCotacao(
      cots.map((c) => Number(c.valor)),
      criterio,
    );
    const patch: Record<string, unknown> = { criterio_cotacao: criterio };
    if (v != null) {
      patch["material_unit"] = v;
      patch["origem_preco"] = "Cotação";
    }
    mItem.update.mutate({ id: item.id, ...patch });
  }

  async function preencherReferencia() {
    await atualizarPrecos(
      preenchiveis.map((i) => {
        const r = referencia!.get(i.chave!)!;
        return { id: i.id, ...dividir(r.preco, r.pct_mo), origem_preco: `${r.base} · ${r.codigo}` };
      }),
    );
    await mItem.invalidar();
    toast.success(`${preenchiveis.length} itens com preço de referência.`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi titulo="Itens com preço" valor={`${todos.length - nSemPreco} de ${todos.length}`} />
        <Kpi titulo="Comprados com cotação" valor={`${comCot} de ${nCotados}`} />
        <Kpi titulo="Sem preço" valor={String(nSemPreco)} alerta={nSemPreco > 0} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-[18rem] flex-1 text-sm text-muted-foreground">
          Todos os valores são <b>por unidade do item</b> (R$ por m², por un…); o total é quantidade
          × (material + mão de obra). Itens comprados de fornecedor levam uma ou mais cotações (com
          várias, escolha média, menor ou maior); serviços levam material e mão de obra direto.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={soFalta}
            onChange={(e) => setSoFalta(e.target.checked)}
          />
          Só o que falta
        </label>
        {preenchiveis.length ? (
          <Button variant="outline" className="h-9" onClick={preencherReferencia}>
            <Sparkles className="size-4" /> Preencher {preenchiveis.length} com a referência
          </Button>
        ) : null}
      </div>

      <h2 className="pt-2 text-base font-semibold">
        Comprados de fornecedor{" "}
        <span className="font-normal text-muted-foreground">({cotados.length})</span>
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Lance o preço do fornecedor por unidade. O valor considerado (média de 3, ou menor/maior com
        justificativa) vira o material do item. Cole o link do produto; preço da internet é
        referência, não cotação formal.
      </p>
      <div className="space-y-3">
        {cotados.map((i) => {
          const cs = cotacoes.filter((c) => c.item_id === i.id).sort((a, b) => a.ordem - b.ordem);
          const vals = cs.map((c) => Number(c.valor)).filter((v) => v > 0);
          const spread = vals.length > 1 ? (Math.max(...vals) / Math.min(...vals) - 1) * 100 : 0;
          return (
            <section
              key={i.id}
              id={`preco-${i.id}`}
              className="card p-4 transition-shadow"
              aria-label={`Cotações de ${i.descricao}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span>
                      <span className="num mr-2 text-muted-foreground">{i.codigo}</span>
                      {i.descricao}
                    </span>
                    <LinkCell
                      value={i.link}
                      label="Link do produto especificado"
                      onSave={(v) => mItem.update.mutate({ id: i.id, link: v })}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                      {nomeAmb(i.ambiente_id)} · {Number(i.quantidade).toLocaleString("pt-BR")}{" "}
                      {i.unidade}
                    </span>
                    {vals.length ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                        {vals.length} {vals.length === 1 ? "cotação" : "cotações"}
                      </span>
                    ) : null}
                    {spread >= 30 ? (
                      <span className="rounded bg-warning-soft px-2 py-0.5 font-medium text-warning">
                        Diferença de {Math.round(spread)}% entre propostas
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
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
                    <div className="text-xs text-muted-foreground">Material (R$/{i.unidade})</div>
                    <div className="num h-9 font-semibold leading-9">
                      {fmtR(Number(i.material_unit))}
                    </div>
                  </div>
                  <label className="text-right text-xs text-muted-foreground">
                    Mão de obra (R$/{i.unidade})
                    <NumCell
                      value={Number(i.mo_unit)}
                      label={`Mão de obra de ${i.descricao}`}
                      className="w-28 border-border"
                      onSave={(v) => mItem.update.mutate({ id: i.id, mo_unit: v })}
                    />
                    <DicaGlobal i={i} />
                  </label>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="num h-9 font-semibold leading-9">
                      {fmtR(itemTotais(i).total)}
                    </div>
                  </div>
                </div>
              </div>
              <table className="tbl mt-3">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th className="w-40 text-right">Valor (R$ por {i.unidade})</th>
                    <th className="w-40">Data</th>
                    <th className="w-56">Link do produto</th>
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
                        <LinkCell
                          value={c.link}
                          label="Link da cotação"
                          onSave={(v) => mCot.update.mutate({ id: c.id, link: v })}
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
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {cs.length < 3 ? (
                  <button
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-soft"
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
                <button
                  className="ml-auto text-xs text-muted-foreground underline"
                  onClick={() => mItem.update.mutate({ id: i.id, tipo_preco: "composicao" })}
                >
                  não é comprado de fornecedor? passar para serviços
                </button>
              </div>
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
        {!cotados.length ? (
          <div className="card p-6 text-center text-sm text-muted-foreground">
            {soFalta ? "Nada faltando aqui." : "Nenhum item comprado de fornecedor."}
          </div>
        ) : null}
      </div>

      <h2 className="pt-4 text-base font-semibold">
        Serviços <span className="font-normal text-muted-foreground">({servicos.length})</span>
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Composição e verba: digite o material e a mão de obra por unidade, ou preencha pela
        referência (SINAPI) ou pelo catálogo do escritório.
      </p>
      {servicos.length ? (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[900px]">
            <thead>
              <tr>
                <th>Serviço</th>
                <th className="w-40">Local</th>
                <th className="w-28 text-right">Quant.</th>
                <th className="w-32 text-right">Material (R$/un)</th>
                <th className="w-32 text-right">M.O. (R$/un)</th>
                <th className="w-32 text-right">Total</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {agruparPorFase(servicos).map(({ fase, itens: its }) => (
                <FaseServicos key={fase.id} nome={fase.nome} itens={its} d={d} nomeAmb={nomeAmb} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          {soFalta ? "Nada faltando aqui." : "Nenhum serviço."}
        </div>
      )}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className={cn("card px-4 py-3", alerta && "border-warning/40 bg-warning-soft")}>
      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          alerta ? "text-warning" : "text-muted-foreground",
        )}
      >
        {titulo}
      </div>
      <div className={cn("num text-2xl font-semibold", alerta && "text-warning")}>{valor}</div>
    </div>
  );
}

function FaseServicos({
  nome,
  itens,
  d,
  nomeAmb,
}: {
  nome: string;
  itens: Item[];
  d: EvfData;
  nomeAmb: (id: string | null) => string;
}) {
  const { mItem } = d;
  return (
    <>
      <tr className="bg-muted/50">
        <td colSpan={7} className="py-1.5 text-xs font-semibold uppercase tracking-wide">
          {nome}
        </td>
      </tr>
      {itens.map((i) => {
        const origem = i.origem_preco;
        return (
          <tr
            key={i.id}
            id={`preco-${i.id}`}
            className={cn("transition-shadow", semPreco(i) && "bg-warning-soft/40")}
          >
            <td>
              <span className="num mr-2 text-xs text-muted-foreground">{i.codigo}</span>
              {i.descricao}
              {origem ? (
                <span
                  className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  title={origem}
                >
                  {origem.startsWith("Catálogo")
                    ? "catálogo"
                    : origem === "Cotação"
                      ? "cotação"
                      : `ref. ${origem.split(" ")[0]}`}
                </span>
              ) : null}
            </td>
            <td className="text-sm text-muted-foreground">{nomeAmb(i.ambiente_id)}</td>
            <td className="num text-right text-sm">
              {Number(i.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
              {i.unidade}
            </td>
            <td>
              <NumCell
                value={Number(i.material_unit)}
                label={`Material de ${i.descricao}`}
                onSave={(v) =>
                  mItem.update.mutate({ id: i.id, material_unit: v, origem_preco: null })
                }
              />
            </td>
            <td>
              <NumCell
                value={Number(i.mo_unit)}
                label={`Mão de obra de ${i.descricao}`}
                onSave={(v) => mItem.update.mutate({ id: i.id, mo_unit: v })}
              />
            </td>
            <td className="num text-right font-semibold">{fmtR(itemTotais(i).total)}</td>
            <td className="text-right">
              <button
                className="whitespace-nowrap text-xs text-primary underline"
                title="Passa a ser comprado de fornecedor, com cotações (vai para “Comprados de fornecedor”)"
                onClick={() => mItem.update.mutate({ id: i.id, tipo_preco: "cotacao" })}
              >
                pedir cotação
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** A instalação de quem só cobra mão de obra entra no valor global da equipe (aba Equipes). */
function DicaGlobal({ i }: { i: Item }) {
  const eq = EQUIPE[equipeDoItem(i)];
  if (eq?.tipo !== "mo") return null;
  return (
    <span className="mt-0.5 block max-w-[11rem] text-[11px] leading-tight">
      Instalação no valor global do {eq.nome.split(" (")[0]!.toLowerCase()} (aba Equipes)
    </span>
  );
}
