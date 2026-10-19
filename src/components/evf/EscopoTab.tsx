import { EQUIPES, equipeDoItem, equipeSugerida } from "@/lib/equipes";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Package,
  PenLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { itemTotais, resumo, type Ambiente, type Item } from "@/lib/calc";
import { useCatalogo } from "@/lib/data";
import { BASE_LABEL, MODELOS, SERVICOS, type Base } from "@/lib/biblioteca";
import {
  geometria,
  linhaDoServico,
  linhasDoModelo,
  normaliza,
  quantidadeVinculada,
} from "@/lib/sugestoes";
import { inserirItens } from "@/lib/actions";
import { usePrecificador } from "@/lib/precos";
import { compra, consumoDoItem, INSUMOS } from "@/lib/insumos";
import { agruparPorFase } from "@/lib/fases";
import { interpretar, type Interpretacao } from "@/lib/interpretar";
import { fmtM2, fmtN, fmtR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ETAPA_OPTIONS, LinkCell, NumCell, SelectCell, TextCell, TIPO_OPTIONS } from "./cells";
import { EXEMPLO_AMBIENTE, EXEMPLO_OBRA, PropostasDialog } from "./OQueSeraFeito";
import { SugestoesPainel } from "./SugestoesPainel";
import { ehObraNova, ObraNova } from "./ObraNova";
import { IntervencoesBotoes } from "./Intervencoes";
import { comoSeFaz } from "@/lib/execucao";
import type { EvfData } from "./useEvfData";

function proximoCodigo(itens: Item[], cap: number) {
  const nums = itens
    .filter((i) => i.capitulo_codigo === cap)
    .map((i) => i.codigo.split("."))
    .filter((p) => p.length === 2 && p[0] === String(cap))
    .map((p) => Number(p[1]) || 0);
  return `${cap}.${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

type Catalogo = NonNullable<ReturnType<typeof useCatalogo>["data"]>;

/**
 * Escopo por ambiente: um bloco por local (Obra toda + cada ambiente), itens na ordem da obra.
 * Lançar é sempre dentro do bloco: "O que será feito" (texto → serviços) ou "+ Serviço".
 */
export function EscopoTab({
  d,
  onPreco,
}: {
  d: EvfData;
  /** Abre a aba de preços (no item, se houver). */
  onPreco?: (id: string | null) => void;
}) {
  const { evf, itens, filtro, caps, mItem, ambientes, mAmb } = d;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [novoAmb, setNovoAmb] = useState("");
  useEffect(() => setSel(new Set()), [filtro]);
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  if (!evf) return null;

  const ids = new Set(ambientes.map((a) => a.id));
  const blocos: (Ambiente | null)[] = !filtro
    ? [null, ...ambientes]
    : filtro === "geral"
      ? [null]
      : ambientes.filter((a) => a.id === filtro);
  const doBloco = (amb: Ambiente | null) =>
    itens.filter((i) =>
      amb ? i.ambiente_id === amb.id : !i.ambiente_id || !ids.has(i.ambiente_id),
    );
  const semPreco = itens.filter((i) => itemTotais(i).total === 0).length;
  const selecionados = itens.filter((i) => sel.has(i.id));
  const alternar = (lista: string[], marcar: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      for (const id of lista) {
        if (marcar) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  async function excluirSelecionados() {
    const n = selecionados.length;
    const total = selecionados.reduce((s, i) => s + itemTotais(i).total, 0);
    if (
      !confirm(
        `Excluir ${n} ${n === 1 ? "item" : "itens"} (${fmtR(total)})? As cotações deles também saem.`,
      )
    )
      return;
    await mItem.removeMany.mutateAsync(selecionados.map((i) => i.id));
    setSel(new Set());
    toast.success(`${n} ${n === 1 ? "item excluído" : "itens excluídos"}.`);
  }

  const itemAberto = d.todosItens.find((i) => i.id === detalhe) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-muted-foreground">Escopo: </span>
          <span className="num font-semibold">{fmtR(res.geral)}</span>
          <span className="text-muted-foreground"> com taxas · {itens.length} itens</span>
        </span>
        {semPreco ? (
          <button
            className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning hover:underline"
            onClick={() => onPreco?.(null)}
          >
            {semPreco} sem preço — lançar em Preços e cotações
          </button>
        ) : null}
        {!filtro && ehObraNova(evf.tipo_obra) && itens.length ? (
          <span className="ml-auto">
            <ObraNova d={d} />
          </span>
        ) : null}
        {!filtro ? (
          <form
            className={`${ehObraNova(evf.tipo_obra) && itens.length ? "" : "ml-auto "}flex items-center gap-2`}
            onSubmit={(e) => {
              e.preventDefault();
              if (!novoAmb.trim()) return;
              mAmb.insert.mutate({
                evf_id: evf.id,
                nome: novoAmb.trim(),
                ordem: ambientes.length + 1,
              });
              setNovoAmb("");
              toast.success("Ambiente criado. Informe as medidas na aba Ambientes e medidas.");
            }}
          >
            <input
              className="field h-9 w-52"
              placeholder="Novo ambiente (ex.: Cozinha)"
              value={novoAmb}
              onChange={(e) => setNovoAmb(e.target.value)}
              aria-label="Nome do novo ambiente"
            />
            <Button type="submit" variant="outline" className="h-9">
              <Plus className="size-4" /> Ambiente
            </Button>
          </form>
        ) : null}
      </div>

      {selecionados.length ? (
        <div
          role="status"
          className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2"
        >
          <span className="text-sm font-medium">
            {selecionados.length} selecionado{selecionados.length === 1 ? "" : "s"} ·{" "}
            <span className="num">
              {fmtR(selecionados.reduce((s, i) => s + itemTotais(i).total, 0))}
            </span>
          </span>
          <Button
            className="h-9 bg-warning text-white hover:bg-warning/90"
            onClick={excluirSelecionados}
            disabled={mItem.removeMany.isPending}
          >
            <Trash2 className="size-4" /> Excluir selecionados
          </Button>
          <Button variant="ghost" className="h-9" onClick={() => setSel(new Set())}>
            Limpar seleção
          </Button>
        </div>
      ) : null}

      {ehObraNova(evf.tipo_obra) && !d.todosItens.length ? <ObraNova d={d} destaque /> : null}

      {blocos.map((amb) => (
        <Bloco
          key={amb?.id ?? "geral"}
          d={d}
          amb={amb}
          itens={doBloco(amb)}
          sel={sel}
          alternar={alternar}
          abrir={setDetalhe}
          onPreco={onPreco}
        />
      ))}

      <ItemDetalhe d={d} item={itemAberto} onClose={() => setDetalhe(null)} onPreco={onPreco} />
    </div>
  );
}

function Bloco({
  d,
  amb,
  itens,
  sel,
  alternar,
  abrir,
  onPreco,
}: {
  onPreco?: ((id: string | null) => void) | undefined;
  d: EvfData;
  amb: Ambiente | null;
  itens: Item[];
  sel: Set<string>;
  alternar: (ids: string[], marcar: boolean) => void;
  abrir: (id: string) => void;
}) {
  const { evf, caps, medicoes, mAmb, mEvf, todosItens, cotacoes } = d;
  const catalogo = useCatalogo().data ?? [];
  const [aberto, setAberto] = useState(true);
  const salvo = (amb ? amb.descricao_servico : evf?.descricao_obra) ?? "";
  const [texto, setTexto] = useState(salvo);
  useEffect(() => setTexto(salvo), [salvo]);
  const [editando, setEditando] = useState(false);
  const [resultado, setResultado] = useState<Interpretacao | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const r = useMemo(() => resumo(itens, caps), [itens, caps]);
  const grupos = useMemo(() => agruparPorFase(itens), [itens]);
  if (!evf) return null;
  const nome = amb?.nome ?? "Obra toda";
  const g = amb ? geometria(amb, medicoes) : null;
  const mostrarCaixa = editando || (!salvo && !itens.length);
  const nSel = itens.filter((i) => sel.has(i.id)).length;

  function salvarTexto() {
    if (texto === salvo) return;
    if (amb) mAmb.update.mutate({ id: amb.id, descricao_servico: texto });
    else mEvf.update.mutate({ id: evf!.id, descricao_obra: texto });
  }
  function gerar() {
    salvarTexto();
    if (!texto.trim()) {
      setEditando(true);
      toast.error("Escreva o que será feito para gerar os serviços.");
      return;
    }
    setEditando(false);
    setResultado(interpretar(texto, amb, medicoes, todosItens));
  }

  return (
    <section className="card overflow-hidden" aria-label={`Escopo de ${nome}`}>
      <header className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          {aberto ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <span className="text-base font-semibold uppercase tracking-wide">{nome}</span>
          <span className="truncate text-xs text-muted-foreground">
            {amb
              ? g && g.piso
                ? `piso ${fmtM2(g.piso)} · paredes ${fmtM2(g.paredes)} · pé-direito ${fmtN(Number(amb.pe_direito))} m`
                : "sem medidas — informe na aba Ambientes e medidas"
              : "documentação, canteiro, logística e limpeza da obra"}
          </span>
        </button>
        <div className="text-right">
          <div className="num text-lg font-semibold">{fmtR(r.geral)}</div>
          <div className="text-[11px] text-muted-foreground">{itens.length} itens · com taxas</div>
        </div>
      </header>

      {aberto ? (
        <div className="space-y-3 p-4">
          {amb ? <IntervencoesBotoes d={d} amb={amb} onResultado={setResultado} /> : null}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <PenLine className="size-4 text-primary" aria-hidden />{" "}
              {amb ? "Ou descreva com suas palavras" : "O que será feito"}
              {!mostrarCaixa ? (
                <button
                  className="ml-auto text-xs font-normal text-primary underline"
                  onClick={() => setEditando(true)}
                >
                  editar texto
                </button>
              ) : null}
            </div>
            {mostrarCaixa ? (
              <textarea
                className="field min-h-24 w-full py-2 leading-relaxed"
                placeholder={amb ? EXEMPLO_AMBIENTE : EXEMPLO_OBRA}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={salvarTexto}
                aria-label={`O que será feito em ${nome}`}
                autoFocus={editando}
              />
            ) : (
              <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                {salvo || "Descreva o que será feito aqui para gerar os serviços."}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button className="h-9" onClick={gerar}>
                <Sparkles className="size-4" /> Gerar serviços do texto
              </Button>
              <Button variant="outline" className="h-9" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Serviço
              </Button>
              <span className="text-xs text-muted-foreground">
                O texto vira serviços (você revisa antes). “+ Serviço” busca no catálogo, cria item
                livre ou aplica um pacote pronto.
              </span>
            </div>
          </div>

          <SugestoesPainel d={{ ...d, filtro: amb?.id ?? "geral" }} aberto={false} compacto />

          {itens.length ? (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={`Selecionar todos os itens de ${nome}`}
                        checked={nSel > 0 && nSel === itens.length}
                        ref={(el) => {
                          if (el) el.indeterminate = nSel > 0 && nSel < itens.length;
                        }}
                        onChange={(e) =>
                          alternar(
                            itens.map((i) => i.id),
                            e.target.checked,
                          )
                        }
                      />
                    </th>
                    <th>Serviço</th>
                    <th className="w-28 text-right">Qtd</th>
                    <th className="w-14">Un</th>
                    <th className="w-32 text-right">Total</th>
                    <th className="w-28" />
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(({ fase, itens: its }) => (
                    <FaseLinhas
                      onPreco={onPreco}
                      key={fase.id}
                      nome={fase.nome}
                      itens={its}
                      d={d}
                      sel={sel}
                      alternar={alternar}
                      abrir={abrir}
                      nCot={(id) =>
                        cotacoes.filter((c) => c.item_id === id && Number(c.valor) > 0).length
                      }
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="py-2 text-sm text-muted-foreground">
                      Custo direto {fmtR(r.direto)} · Taxas de administração {fmtR(r.taxas)}
                    </td>
                    <td className="num text-right font-semibold">{fmtR(r.geral)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Nenhum serviço ainda. Escreva o que será feito e clique em “Gerar serviços do texto”.
            </p>
          )}
        </div>
      ) : null}

      <PropostasDialog
        d={d}
        resultado={resultado}
        nome={nome}
        ambienteId={amb?.id ?? null}
        onClose={() => setResultado(null)}
        catalogo={catalogo}
      />
      <AdicionarDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        amb={amb}
        d={d}
        catalogo={catalogo}
      />
    </section>
  );
}

function FaseLinhas({
  onPreco,
  nome,
  itens,
  d,
  sel,
  alternar,
  abrir,
  nCot,
}: {
  nome: string;
  itens: Item[];
  d: EvfData;
  sel: Set<string>;
  alternar: (ids: string[], marcar: boolean) => void;
  abrir: (id: string) => void;
  nCot: (id: string) => number;
  onPreco?: ((id: string | null) => void) | undefined;
}) {
  const { mItem, todosItens, ambientes, medicoes } = d;
  const subtotal = itens.reduce((s, i) => s + itemTotais(i).total, 0);
  const upd = (id: string, v: Record<string, unknown>) => mItem.update.mutate({ id, ...v });
  return (
    <>
      <tr className="bg-muted/50">
        <td />
        <td colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide">
          {nome}
        </td>
        <td className="num text-right text-xs font-semibold">{fmtR(subtotal)}</td>
        <td colSpan={2} />
      </tr>
      {itens.map((i) => {
        const t = itemTotais(i);
        const unit = Number(i.material_unit) + Number(i.mo_unit);
        const ligado = Boolean(i.base_qtd && i.base_qtd !== "manual");
        const cots = nCot(i.id);
        const situacao =
          unit === 0
            ? { txt: "sem preço", alerta: true }
            : i.tipo_preco === "cotacao" && cots < 3
              ? { txt: `cotar (${cots}/3)`, alerta: true }
              : i.etapa === "Etapa futura"
                ? { txt: "etapa futura", alerta: false }
                : i.origem_preco &&
                    i.origem_preco !== "Catálogo do escritório" &&
                    i.origem_preco !== "Cotação"
                  ? { txt: `ref. ${i.origem_preco.split(" ")[0]}`, alerta: false }
                  : null;
        return (
          <tr key={i.id} className={sel.has(i.id) ? "bg-warning-soft/60" : undefined}>
            <td>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={`Selecionar ${i.descricao}`}
                checked={sel.has(i.id)}
                onChange={(e) => alternar([i.id], e.target.checked)}
              />
            </td>
            <td>
              <div className="flex items-center gap-1">
                <span className="num w-10 shrink-0 text-xs text-muted-foreground">{i.codigo}</span>
                <TextCell
                  value={i.descricao}
                  label="Serviço"
                  className="min-w-[16rem]"
                  onSave={(v) => upd(i.id, { descricao: v })}
                />
                <LinkCell compact value={i.link} onSave={(v) => upd(i.id, { link: v })} />
              </div>
            </td>
            <td>
              {ligado ? (
                <button
                  className="num flex w-full items-center justify-end gap-1 px-1.5 text-primary"
                  title="Quantidade ligada às medidas. Clique para ver."
                  onClick={() => abrir(i.id)}
                >
                  <Link2 className="size-3" aria-hidden />
                  {fmtN(
                    quantidadeVinculada(i, todosItens, ambientes, medicoes) ?? Number(i.quantidade),
                  )}
                </button>
              ) : (
                <NumCell
                  value={Number(i.quantidade)}
                  label="Quantidade"
                  onSave={(v) => upd(i.id, { quantidade: v })}
                />
              )}
            </td>
            <td className="text-sm">{i.unidade}</td>
            <td className="text-right">
              <button
                className="num w-full rounded px-1 text-right font-semibold hover:bg-muted hover:text-primary"
                title={`Material ${fmtR(Number(i.material_unit))} + M.O. ${fmtR(Number(i.mo_unit))} por ${i.unidade}. Clique para ver o preço.`}
                onClick={() => (onPreco ? onPreco(i.id) : abrir(i.id))}
              >
                {fmtR(t.total)}
              </button>
            </td>
            <td>
              {situacao ? (
                <span
                  className={cn(
                    "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                    situacao.alerta
                      ? "bg-warning-soft text-warning"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {situacao.txt}
                </span>
              ) : null}
            </td>
            <td>
              <div className="flex justify-end gap-0.5">
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={`Detalhes de ${i.descricao}`}
                  title="Material, M.O., vínculo, perda, tipo e etapa"
                  onClick={() => abrir(i.id)}
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                  aria-label="Excluir item"
                  onClick={() => {
                    if (confirm(`Excluir “${i.descricao}”?`)) mItem.remove.mutate(i.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

const BASES_AMB: Base[] = ["piso", "teto", "paredes", "perimetro", "medicoes"];

function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs font-medium text-muted-foreground">
      {rotulo}
      <div className="mt-1 rounded-md border bg-card text-sm text-foreground">{children}</div>
      {dica ? <span className="mt-0.5 block font-normal">{dica}</span> : null}
    </div>
  );
}

/** Painel lateral com tudo do item: preço separado, vínculo, perda, tipo, etapa, capítulo. */
function ItemDetalhe({
  d,
  item,
  onClose,
  onPreco,
}: {
  d: EvfData;
  item: Item | null;
  onClose: () => void;
  onPreco?: ((id: string | null) => void) | undefined;
}) {
  const { mItem, caps, ambientes, todosItens, medicoes } = d;
  if (!item) return null;
  const i = item;
  const upd = (v: Record<string, unknown>) => mItem.update.mutate({ id: i.id, ...v });
  const t = itemTotais(i);
  const ligado = Boolean(i.base_qtd && i.base_qtd !== "manual");
  const opcoesVinculo = [
    { value: "manual", label: "digitada (manual)" },
    ...(i.ambiente_id
      ? BASES_AMB.map((b) => ({ value: b, label: `medidas do ambiente · ${BASE_LABEL[b]}` }))
      : []),
  ];
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">{i.descricao}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Campo rotulo="Serviço">
            <TextCell value={i.descricao} label="Serviço" onSave={(v) => upd({ descricao: v })} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Ambiente">
              <SelectCell
                value={i.ambiente_id ?? ""}
                options={[
                  { value: "", label: "Obra toda" },
                  ...ambientes.map((a) => ({ value: a.id, label: a.nome })),
                ]}
                label="Ambiente"
                className="w-full"
                onSave={(v) => upd({ ambiente_id: v || null })}
              />
            </Campo>
            <Campo rotulo="Capítulo (planilha)">
              <SelectCell
                value={String(i.capitulo_codigo)}
                options={caps.map((c) => ({
                  value: String(c.codigo),
                  label: `${c.codigo} · ${c.nome}`,
                }))}
                label="Capítulo"
                className="w-full"
                onSave={(v) =>
                  upd({ capitulo_codigo: Number(v), codigo: proximoCodigo(todosItens, Number(v)) })
                }
              />
            </Campo>
          </div>
          <Campo rotulo="Quem faz" dica="Define em qual equipe o serviço aparece na aba Equipes.">
            <SelectCell
              value={equipeDoItem(i)}
              options={EQUIPES.map((e) => ({
                value: e.id,
                label: `${e.nome}${e.id === equipeSugerida(i) ? " (sugerido)" : ""}`,
              }))}
              label="Quem faz"
              className="w-full"
              onSave={(v) => upd({ equipe: v === equipeSugerida(i) ? null : v })}
            />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo rotulo="Código">
              <TextCell value={i.codigo} label="Código" onSave={(v) => upd({ codigo: v })} />
            </Campo>
            <Campo rotulo="Unidade">
              <TextCell value={i.unidade} label="Unidade" onSave={(v) => upd({ unidade: v })} />
            </Campo>
            <Campo rotulo="Perda %">
              <NumCell
                value={Number(i.perda_pct)}
                decimals={0}
                label="Perda %"
                onSave={(v) => upd({ perda_pct: v })}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Quantidade">
              {ligado ? (
                <span className="num flex items-center gap-1 px-2 py-2 text-primary">
                  <Link2 className="size-3" />
                  {fmtN(
                    quantidadeVinculada(i, todosItens, ambientes, medicoes) ?? Number(i.quantidade),
                  )}
                </span>
              ) : (
                <NumCell
                  value={Number(i.quantidade)}
                  label="Quantidade"
                  onSave={(v) => upd({ quantidade: v })}
                />
              )}
            </Campo>
            {i.base_qtd === "item" ? (
              <Campo rotulo="Quantidade vem de">
                <span className="flex items-center justify-between px-2 py-2">
                  item {todosItens.find((x) => x.id === i.base_item_id)?.codigo ?? "?"} ×{" "}
                  {fmtN(Number(i.fator))}
                  <button
                    className="text-xs underline"
                    onClick={() => upd({ base_qtd: null, base_item_id: null })}
                  >
                    soltar
                  </button>
                </span>
              </Campo>
            ) : (
              <Campo
                rotulo="Quantidade vem de"
                {...(i.ambiente_id
                  ? {}
                  : { dica: "Itens da obra toda não têm medidas: quantidade digitada." })}
              >
                <SelectCell
                  value={ligado ? (i.base_qtd ?? "manual") : "manual"}
                  options={opcoesVinculo}
                  label="Quantidade vem de"
                  className="w-full"
                  onSave={(v) =>
                    upd(v === "manual" ? { base_qtd: null, base_item_id: null } : { base_qtd: v })
                  }
                />
              </Campo>
            )}
          </div>
          {ligado && i.base_qtd !== "item" ? (
            <Campo
              rotulo="Fator (multiplica a medida)"
              dica="Ex.: 1,8 com o perímetro = parede até 1,80 m."
            >
              <NumCell value={Number(i.fator)} label="Fator" onSave={(v) => upd({ fator: v })} />
            </Campo>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-primary-soft/60 px-3 py-2 text-sm">
            <span>
              Material <span className="num">{fmtR(Number(i.material_unit))}</span> + M.O.{" "}
              <span className="num">{fmtR(Number(i.mo_unit))}</span> por {i.unidade}
            </span>
            {onPreco ? (
              <Button
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  onClose();
                  onPreco(i.id);
                }}
              >
                Editar preço
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Como se orça">
              <SelectCell
                value={i.tipo_preco}
                options={TIPO_OPTIONS}
                label="Tipo de preço"
                className="w-full"
                onSave={(v) => upd({ tipo_preco: v })}
              />
            </Campo>
            <Campo rotulo="Etapa">
              <SelectCell
                value={i.etapa}
                options={ETAPA_OPTIONS}
                label="Etapa"
                className="w-full"
                onSave={(v) => upd({ etapa: v })}
              />
            </Campo>
          </div>
          {i.origem_preco ? (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Preço de: <span className="font-medium text-foreground">{i.origem_preco}</span>.
              Referência não é cotação; nos itens de maior peso, confirme com fornecedores.
            </p>
          ) : null}
          <Campo rotulo="Link do produto">
            <div className="px-1 py-1">
              <LinkCell value={i.link} onSave={(v) => upd({ link: v })} />
            </div>
          </Campo>
          {comoSeFaz(i) ? (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Como se faz
              </summary>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5">
                {comoSeFaz(i)!.passos.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              {comoSeFaz(i)!.cuidados?.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-warning">
                  {comoSeFaz(i)!.cuidados!.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          ) : null}
          {consumoDoItem(i).length ? (
            <div className="rounded-lg border p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Materiais deste item
              </div>
              <ul className="space-y-0.5">
                {consumoDoItem(i).map((c) => (
                  <li key={c.insumo} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">{INSUMOS[c.insumo]?.nome}</span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      <span className="num block">
                        {fmtN(c.qtd)} {INSUMOS[c.insumo]?.un}
                      </span>
                      {compra(c.insumo, c.qtd)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <div className="flex justify-between">
              <span>Material</span>
              <span className="num">{fmtR(t.mat)}</span>
            </div>
            <div className="flex justify-between">
              <span>Mão de obra</span>
              <span className="num">{fmtR(t.mo)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>Total (sem taxa)</span>
              <span className="num">{fmtR(t.total)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="h-10 text-warning hover:bg-warning-soft"
            onClick={() => {
              if (!confirm(`Excluir “${i.descricao}”?`)) return;
              mItem.remove.mutate(i.id);
              onClose();
            }}
          >
            <Trash2 className="size-4" /> Excluir item
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface Escolha {
  id: string;
  chave?: string;
  capitulo_codigo: number;
  descricao: string;
  unidade: string;
  material_unit: number;
  mo_unit: number;
  tipo_preco: string;
  base?: string;
}

/** "+ Serviço": catálogo do escritório + biblioteca, item livre e pacotes prontos — tudo no bloco. */
function AdicionarDialog({
  open,
  onOpenChange,
  amb,
  d,
  catalogo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amb: Ambiente | null;
  d: EvfData;
  catalogo: Catalogo;
}) {
  const { evf, todosItens, mItem, medicoes, caps } = d;
  const [q, setQ] = useState("");
  const [capLivre, setCapLivre] = useState("");
  const precificar = usePrecificador();
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  if (!evf) return null;
  const noCatalogo = new Set(catalogo.map((c) => normaliza(c.descricao)));
  const todos: Escolha[] = [
    ...catalogo.map((c) => ({
      id: c.id,
      capitulo_codigo: c.capitulo_codigo,
      descricao: c.descricao,
      unidade: c.unidade,
      material_unit: Number(c.material_unit),
      mo_unit: Number(c.mo_unit),
      tipo_preco: c.tipo_preco,
    })),
    ...SERVICOS.filter((sv) => !noCatalogo.has(normaliza(sv.desc))).map((sv) => ({
      id: `lib-${sv.chave}`,
      chave: sv.chave,
      capitulo_codigo: sv.cap,
      descricao: sv.desc,
      unidade: sv.un,
      material_unit: 0,
      mo_unit: sv.mo ?? 0,
      tipo_preco: sv.tipo,
      ...(amb && sv.base && sv.base !== "manual" ? { base: BASE_LABEL[sv.base] } : {}),
    })),
  ];
  const qn = normaliza(q.trim());
  const lista = qn ? todos.filter((s) => normaliza(s.descricao).includes(qn)).slice(0, 40) : [];
  const pacotes = MODELOS.filter((m) => (amb ? m.para === "ambiente" : m.para === "obra"));
  const maxOrdem = todosItens.reduce((m, i) => Math.max(m, i.ordem), 0);
  const onde = amb?.nome ?? "Obra toda";

  async function escolher(s: Escolha) {
    if (s.chave) {
      const linha = linhaDoServico(
        { chave: s.chave },
        amb,
        amb ? geometria(amb, medicoes) : null,
        precificar,
      );
      if (linha) await inserirItens(evf!.id, [linha], todosItens);
      await mItem.invalidar();
    } else {
      await mItem.insert.mutateAsync({
        evf_id: evf!.id,
        ambiente_id: amb?.id ?? null,
        capitulo_codigo: s.capitulo_codigo,
        codigo: proximoCodigo(todosItens, s.capitulo_codigo),
        descricao: s.descricao,
        unidade: s.unidade,
        quantidade: 1,
        material_unit: s.material_unit,
        mo_unit: s.mo_unit,
        tipo_preco: s.tipo_preco,
        ordem: maxOrdem + 1,
      });
    }
    toast.success(`Adicionado em ${onde}: ${s.descricao}`);
  }

  async function criarLivre() {
    const cap = Number(capLivre);
    if (!q.trim() || !cap) {
      toast.error("Escreva o nome do serviço e escolha o capítulo.");
      return;
    }
    await mItem.insert.mutateAsync({
      evf_id: evf!.id,
      ambiente_id: amb?.id ?? null,
      capitulo_codigo: cap,
      codigo: proximoCodigo(todosItens, cap),
      descricao: q.trim(),
      unidade: "un",
      quantidade: 1,
      ordem: maxOrdem + 1,
    });
    toast.success(`Item criado em ${onde}: ${q.trim()}`);
    setQ("");
  }

  async function aplicarPacote(id: string) {
    const linhas = linhasDoModelo(id, amb, medicoes, precificar);
    await inserirItens(evf!.id, linhas, todosItens);
    await mItem.invalidar();
    toast.success(`${linhas.length} itens adicionados em ${onde}.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar serviço · {onde}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field w-full pl-9"
            autoFocus
            placeholder="Buscar serviço… (ex.: soleira, porcelanato, tomada)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar serviço"
          />
        </div>
        {qn ? (
          <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
            <ul className="divide-y">
              {lista.map((s) => (
                <li key={s.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary-soft"
                    onClick={() => escolher(s)}
                  >
                    <span className="flex-1">
                      {s.descricao}
                      {s.base ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          qtd. pelo {s.base}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.unidade}</span>
                    <span className="num w-24 text-right text-xs">
                      {s.material_unit + s.mo_unit ? fmtR(s.material_unit + s.mo_unit) : "a cotar"}
                    </span>
                  </button>
                </li>
              ))}
              <li className="flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-2 text-sm">
                <span className="flex-1">
                  {lista.length ? "Não é nenhum desses?" : "Nada encontrado."} Criar item “
                  {q.trim()}”
                </span>
                <select
                  className="field h-9 w-56"
                  value={capLivre}
                  onChange={(e) => setCapLivre(e.target.value)}
                  aria-label="Capítulo do item novo"
                >
                  <option value="">Capítulo…</option>
                  {caps.map((c) => (
                    <option key={c.id} value={c.codigo}>
                      {c.codigo} · {c.nome}
                    </option>
                  ))}
                </select>
                <Button className="h-9" variant="outline" onClick={criarLivre}>
                  Criar
                </Button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="size-4 text-primary" /> Pacotes prontos
            </div>
            <ul className="divide-y rounded-lg border">
              {pacotes.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">{m.descricao}</div>
                  </div>
                  <Button variant="outline" className="h-9" onClick={() => aplicarPacote(m.id)}>
                    Aplicar
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Pacotes trazem todos os serviços típicos de uma vez. Prefira o texto “O que será
              feito” quando a obra tiver nuances.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
