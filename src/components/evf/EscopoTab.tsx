import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareCodigo, itemTotais, resumo, type Item } from "@/lib/calc";
import { useCatalogo } from "@/lib/data";
import { BASE_LABEL, SERVICOS, type Base } from "@/lib/biblioteca";
import { geometria, linhaDoServico, normaliza, quantidadeVinculada } from "@/lib/sugestoes";
import { buscadorDePreco, inserirItens } from "@/lib/actions";
import type { Ambiente } from "@/lib/calc";
import { SugestoesPainel } from "./SugestoesPainel";
import { fmtN, fmtR } from "@/lib/format";
import { ETAPA_OPTIONS, LinkCell, NumCell, SelectCell, TextCell, TIPO_OPTIONS } from "./cells";
import type { EvfData } from "./useEvfData";

function proximoCodigo(itens: Item[], cap: number) {
  const nums = itens
    .filter((i) => i.capitulo_codigo === cap)
    .map((i) => i.codigo.split("."))
    .filter((p) => p.length === 2 && p[0] === String(cap))
    .map((p) => Number(p[1]) || 0);
  return `${cap}.${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

export function EscopoTab({ d }: { d: EvfData }) {
  const { evf, itens, todosItens, filtro, caps, mItem, ambientes, medicoes } = d;
  const ambFiltro = filtro && filtro !== "geral" ? filtro : "";
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const [catOpen, setCatOpen] = useState(false);
  const [livreCap, setLivreCap] = useState<string>("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => setSel(new Set()), [filtro]);
  const catalogo = useCatalogo().data ?? [];
  if (!evf) return null;

  const upd = (id: string, v: Record<string, unknown>) => mItem.update.mutate({ id, ...v });
  const selecionados = itens.filter((i) => sel.has(i.id));
  const alternar = (ids: string[], marcar: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (marcar) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  async function excluirSelecionados() {
    const n = selecionados.length;
    if (!n) return;
    const total = selecionados.reduce((s, i) => s + itemTotais(i).total, 0);
    if (
      !confirm(
        `Excluir ${n} ${n === 1 ? "item" : "itens"} (${fmtR(total)})? As cotações deles também saem. Não dá para desfazer.`,
      )
    )
      return;
    await mItem.removeMany.mutateAsync(selecionados.map((i) => i.id));
    setSel(new Set());
    toast.success(`${n} ${n === 1 ? "item excluído" : "itens excluídos"}.`);
  }
  const maxOrdem = todosItens.reduce((m, i) => Math.max(m, i.ordem), 0);

  async function addLivre() {
    const cap = Number(livreCap);
    if (!cap) {
      toast.error("Escolha o capítulo do item.");
      return;
    }
    await mItem.insert.mutateAsync({
      evf_id: evf!.id,
      ambiente_id: ambFiltro || null,
      capitulo_codigo: cap,
      codigo: proximoCodigo(todosItens, cap),
      descricao: "Novo item",
      unidade: "un",
      quantidade: 1,
      ordem: maxOrdem + 1,
    });
    setLivreCap("");
  }

  function mover(item: Item, dir: -1 | 1) {
    const doCap = res.capitulos.find((c) => c.codigo === item.capitulo_codigo)?.itens ?? [];
    const idx = doCap.findIndex((i) => i.id === item.id);
    const outro = doCap[idx + dir];
    if (!outro) return;
    const a = item.ordem === outro.ordem ? item.ordem + dir : outro.ordem;
    upd(item.id, { ordem: a });
    upd(outro.id, { ordem: item.ordem });
  }

  return (
    <div className="space-y-4">
      <SugestoesPainel d={d} />
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-10" onClick={() => setCatOpen(true)}>
          <Plus className="size-4" /> Serviço do catálogo
        </Button>
        <div className="flex items-center gap-2">
          <select
            className="field h-10 w-56"
            value={livreCap}
            onChange={(e) => setLivreCap(e.target.value)}
            aria-label="Capítulo do item livre"
          >
            <option value="">Capítulo do item livre…</option>
            {caps.map((c) => (
              <option key={c.id} value={c.codigo}>
                {c.codigo} · {c.nome}
              </option>
            ))}
          </select>
          <Button variant="outline" className="h-10" onClick={addLivre}>
            + Item livre
          </Button>
        </div>
        {ambientes.length && !filtro ? (
          <select
            className="field h-10 w-56"
            value=""
            aria-label="Selecionar itens de um ambiente"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              alternar(
                itens
                  .filter((i) => (v === "geral" ? !i.ambiente_id : i.ambiente_id === v))
                  .map((i) => i.id),
                true,
              );
            }}
          >
            <option value="">Selecionar itens do ambiente…</option>
            {ambientes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
            <option value="geral">Itens gerais (sem ambiente)</option>
          </select>
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

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[1560px]">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Selecionar todos os itens"
                  checked={itens.length > 0 && sel.size === itens.length}
                  ref={(el) => {
                    if (el) el.indeterminate = sel.size > 0 && sel.size < itens.length;
                  }}
                  onChange={(e) =>
                    e.target.checked ? setSel(new Set(itens.map((i) => i.id))) : setSel(new Set())
                  }
                />
              </th>
              <th className="w-16">Item</th>
              <th>Serviço</th>
              <th className="w-44">Ambiente</th>
              <th className="w-16">Un.</th>
              <th className="w-24 text-right">Quant.</th>
              <th className="w-56">Quantidade vem de</th>
              <th className="w-20 text-right">Perda %</th>
              <th className="w-28 text-right">Mat. unit.</th>
              <th className="w-28 text-right">M.O. unit.</th>
              <th className="w-28 text-right">Total mat.</th>
              <th className="w-28 text-right">Total M.O.</th>
              <th className="w-28 text-right">Total</th>
              <th className="w-32">Tipo</th>
              <th className="w-32">Etapa</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {res.capitulos.map((c) => (
              <CapituloRows
                key={c.codigo}
                c={c}
                upd={upd}
                mover={mover}
                remover={(id) => {
                  mItem.remove.mutate(id);
                  alternar([id], false);
                }}
                sel={sel}
                alternar={alternar}
                ambientes={ambientes}
                todos={todosItens}
                medicoes={d.medicoes}
              />
            ))}
            {!itens.length ? (
              <tr>
                <td colSpan={16} className="py-8 text-center text-muted-foreground">
                  {filtro
                    ? "Nenhum item neste ambiente. Adicione serviços do catálogo ou itens livres: eles já entram neste ambiente."
                    : "Nenhum item. Adicione serviços do catálogo ou itens livres."}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={10} className="py-3">
                Custo direto (material + mão de obra)
              </td>
              <td className="num text-right">{fmtR(res.mat)}</td>
              <td className="num text-right">{fmtR(res.mo)}</td>
              <td className="num text-right">{fmtR(res.direto)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <CatalogoDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        ambientes={ambientes}
        ambInicial={ambFiltro}
        onPick={async (s, ambienteId) => {
          const amb = ambientes.find((a) => a.id === ambienteId) ?? null;
          if (s.chave) {
            const linha = linhaDoServico(
              { chave: s.chave },
              amb,
              amb ? geometria(amb, medicoes) : null,
              buscadorDePreco(catalogo),
            );
            if (linha) await inserirItens(evf.id, [linha], todosItens);
            await d.mItem.invalidar();
          } else {
            await mItem.insert.mutateAsync({
              evf_id: evf.id,
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
          toast.success(`Adicionado: ${s.descricao}`);
        }}
      />
    </div>
  );
}

const BASES_AMB: Base[] = ["piso", "teto", "paredes", "perimetro", "medicoes"];

function CapituloRows({
  c,
  upd,
  mover,
  remover,
  ambientes,
  todos,
  medicoes,
  sel,
  alternar,
}: {
  sel: Set<string>;
  alternar: (ids: string[], marcar: boolean) => void;
  c: ReturnType<typeof resumo>["capitulos"][number];
  upd: (id: string, v: Record<string, unknown>) => void;
  mover: (i: Item, d: -1 | 1) => void;
  remover: (id: string) => void;
  ambientes: Ambiente[];
  todos: Item[];
  medicoes: EvfData["medicoes"];
}) {
  const opcoesAmbiente = [
    { value: "", label: "Obra toda (gerais)" },
    ...ambientes.map((a) => ({ value: a.id, label: a.nome })),
  ];
  const opcoesVinculo = [
    { value: "manual", label: "digitada (manual)" },
    ...ambientes.flatMap((a) =>
      BASES_AMB.map((b) => ({ value: `${a.id}|${b}`, label: `${a.nome} · ${BASE_LABEL[b]}` })),
    ),
  ];
  const idsCap = c.itens.map((i) => i.id);
  const nSel = idsCap.filter((id) => sel.has(id)).length;
  return (
    <>
      <tr className="bg-muted/70">
        <td>
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={`Selecionar todos os itens de ${c.nome}`}
            checked={idsCap.length > 0 && nSel === idsCap.length}
            ref={(el) => {
              if (el) el.indeterminate = nSel > 0 && nSel < idsCap.length;
            }}
            onChange={(e) => alternar(idsCap, e.target.checked)}
          />
        </td>
        <td className="num py-2 font-semibold">{c.codigo}</td>
        <td colSpan={8} className="font-semibold uppercase tracking-wide">
          {c.nome}
        </td>
        <td className="num text-right font-semibold">{fmtR(c.mat)}</td>
        <td className="num text-right font-semibold">{fmtR(c.mo)}</td>
        <td className="num text-right font-semibold">{fmtR(c.total)}</td>
        <td colSpan={3} />
      </tr>
      {c.itens.map((i) => {
        const t = itemTotais(i);
        return (
          <tr key={i.id} className={sel.has(i.id) ? "bg-warning-soft/60" : undefined}>
            <td>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={`Selecionar ${i.codigo} ${i.descricao}`}
                checked={sel.has(i.id)}
                onChange={(e) => alternar([i.id], e.target.checked)}
              />
            </td>
            <td>
              <TextCell
                value={i.codigo}
                label="Código"
                className="num w-16"
                onSave={(v) => upd(i.id, { codigo: v })}
              />
            </td>
            <td>
              <div className="flex items-center gap-1">
                <TextCell
                  value={i.descricao}
                  label="Serviço"
                  className="min-w-64"
                  onSave={(v) => upd(i.id, { descricao: v })}
                />
                <LinkCell compact value={i.link} onSave={(v) => upd(i.id, { link: v })} />
              </div>
            </td>
            <td>
              <SelectCell
                value={i.ambiente_id ?? ""}
                options={opcoesAmbiente}
                label="Ambiente do item"
                className="min-w-[9rem] text-xs"
                onSave={(v) => upd(i.id, { ambiente_id: v || null })}
              />
            </td>
            <td>
              <TextCell
                value={i.unidade}
                label="Unidade"
                className="w-14"
                onSave={(v) => upd(i.id, { unidade: v })}
              />
            </td>
            <td>
              {i.base_qtd && i.base_qtd !== "manual" ? (
                <span
                  className="num flex items-center justify-end gap-1 px-1.5 text-primary"
                  title="Calculada pelo vínculo"
                >
                  <Link2 className="size-3" aria-hidden />
                  {fmtN(quantidadeVinculada(i, todos, ambientes, medicoes) ?? Number(i.quantidade))}
                </span>
              ) : (
                <NumCell
                  value={Number(i.quantidade)}
                  decimals={2}
                  label="Quantidade"
                  onSave={(v) => upd(i.id, { quantidade: v })}
                />
              )}
            </td>
            <td>
              <div className="flex items-center gap-1">
                {i.base_qtd === "item" ? (
                  <span className="truncate px-1.5 text-xs text-muted-foreground">
                    {todos.find((x) => x.id === i.base_item_id)?.codigo ?? "?"} ×
                  </span>
                ) : (
                  <SelectCell
                    value={
                      i.base_qtd && i.base_qtd !== "manual" && i.ambiente_id
                        ? `${i.ambiente_id}|${i.base_qtd}`
                        : "manual"
                    }
                    options={opcoesVinculo}
                    label="Quantidade vem de"
                    className="min-w-[10rem] text-xs"
                    onSave={(v) => {
                      if (v === "manual") upd(i.id, { base_qtd: null, base_item_id: null });
                      else {
                        const [amb, base] = v.split("|");
                        upd(i.id, { ambiente_id: amb, base_qtd: base, base_item_id: null });
                      }
                    }}
                  />
                )}
                {i.base_qtd && i.base_qtd !== "manual" ? (
                  <NumCell
                    value={Number(i.fator)}
                    decimals={2}
                    label="Fator"
                    className="min-w-[3.5rem] w-14 text-xs"
                    onSave={(v) => upd(i.id, { fator: v })}
                  />
                ) : null}
                {i.base_qtd === "item" ? (
                  <button
                    className="px-1 text-xs text-muted-foreground underline"
                    onClick={() => upd(i.id, { base_qtd: null, base_item_id: null })}
                  >
                    soltar
                  </button>
                ) : null}
              </div>
            </td>
            <td>
              <NumCell
                value={Number(i.perda_pct)}
                decimals={0}
                label="Perda %"
                onSave={(v) => upd(i.id, { perda_pct: v })}
              />
            </td>
            <td>
              {i.tipo_preco === "cotacao" ? (
                <span className="num block px-1.5 text-right" title="Vem da aba Cotações">
                  {fmtN(Number(i.material_unit))}
                </span>
              ) : (
                <NumCell
                  value={Number(i.material_unit)}
                  label="Material unitário"
                  onSave={(v) => upd(i.id, { material_unit: v })}
                />
              )}
            </td>
            <td>
              <NumCell
                value={Number(i.mo_unit)}
                label="Mão de obra unitária"
                onSave={(v) => upd(i.id, { mo_unit: v })}
              />
            </td>
            <td className="num text-right">{fmtR(t.mat)}</td>
            <td className="num text-right">{fmtR(t.mo)}</td>
            <td className="num text-right font-semibold">{fmtR(t.total)}</td>
            <td>
              <SelectCell
                value={i.tipo_preco}
                options={TIPO_OPTIONS}
                label="Tipo de preço"
                onSave={(v) => upd(i.id, { tipo_preco: v })}
              />
            </td>
            <td>
              <SelectCell
                value={i.etapa}
                options={ETAPA_OPTIONS}
                label="Etapa"
                onSave={(v) => upd(i.id, { etapa: v })}
              />
            </td>
            <td>
              <div className="flex justify-end gap-0.5">
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Subir"
                  onClick={() => mover(i, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Descer"
                  onClick={() => mover(i, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                  aria-label="Excluir item"
                  onClick={() => {
                    if (confirm(`Excluir o item ${i.codigo} ${i.descricao}?`)) remover(i.id);
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

interface Escolha {
  chave?: string;
  capitulo_codigo: number;
  descricao: string;
  unidade: string;
  material_unit: number;
  mo_unit: number;
  tipo_preco: string;
  origem: "catalogo" | "biblioteca";
  base?: string;
  id: string;
  codigo: string;
}

function CatalogoDialog({
  open,
  onOpenChange,
  onPick,
  ambientes,
  ambInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (s: Escolha, ambienteId: string) => Promise<void>;
  ambientes: Ambiente[];
  ambInicial: string;
}) {
  const catalogo = useCatalogo().data ?? [];
  const [q, setQ] = useState("");
  const [amb, setAmb] = useState(ambInicial);
  useEffect(() => {
    if (open) setAmb(ambInicial);
  }, [open, ambInicial]);
  const noCatalogo = new Set(catalogo.map((c) => normaliza(c.descricao)));
  const todos: Escolha[] = [
    ...catalogo.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      capitulo_codigo: c.capitulo_codigo,
      descricao: c.descricao,
      unidade: c.unidade,
      material_unit: Number(c.material_unit),
      mo_unit: Number(c.mo_unit),
      tipo_preco: c.tipo_preco,
      origem: "catalogo" as const,
    })),
    ...SERVICOS.filter((sv) => !noCatalogo.has(normaliza(sv.desc))).map((sv) => ({
      id: `lib-${sv.chave}`,
      codigo: "",
      chave: sv.chave,
      capitulo_codigo: sv.cap,
      descricao: sv.desc,
      unidade: sv.un,
      material_unit: 0,
      mo_unit: sv.mo ?? 0,
      tipo_preco: sv.tipo,
      origem: "biblioteca" as const,
      ...(sv.base && sv.base !== "manual" ? { base: BASE_LABEL[sv.base] } : {}),
    })),
  ];
  const qn = normaliza(q);
  const lista = todos
    .filter((s) => !qn || normaliza(s.descricao).includes(qn) || s.codigo.startsWith(q))
    .sort((a, b) => a.capitulo_codigo - b.capitulo_codigo || compareCodigo(a.codigo, b.codigo));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar serviço do catálogo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <input
            className="field"
            autoFocus
            placeholder="Buscar serviço… (ex.: reboco, porcelanato, alvenaria)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar serviço"
          />
          <select
            className="field"
            value={amb}
            onChange={(e) => setAmb(e.target.value)}
            aria-label="Ambiente do serviço"
          >
            <option value="">Sem ambiente (obra toda)</option>
            {ambientes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
          <table className="tbl">
            <tbody>
              {lista.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-primary-soft"
                  onClick={() => onPick(s, amb)}
                >
                  <td className="num w-14 text-muted-foreground">
                    {s.codigo || s.capitulo_codigo}
                  </td>
                  <td className="py-2">
                    {s.descricao}
                    {s.origem === "biblioteca" ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        biblioteca{s.base ? ` · qtd. pelo ${s.base}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="w-12">{s.unidade}</td>
                  <td className="num w-28 text-right">
                    {s.material_unit + s.mo_unit ? fmtR(s.material_unit + s.mo_unit) : "a cotar"}
                  </td>
                </tr>
              ))}
              {!lista.length ? (
                <tr>
                  <td className="py-6 text-center text-muted-foreground">
                    Nada encontrado. Cadastre em Base › Catálogo de serviços.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Itens do catálogo trazem o preço do escritório. Itens da biblioteca trazem o escopo e, com
          um ambiente escolhido, a quantidade calculada pelas medidas; o preço fica para cotar.
        </p>
      </DialogContent>
    </Dialog>
  );
}
