import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareCodigo, itemTotais, resumo, type Item } from "@/lib/calc";
import { useCatalogo } from "@/lib/data";
import { fmtN, fmtR } from "@/lib/format";
import { ETAPA_OPTIONS, NumCell, SelectCell, TextCell, TIPO_OPTIONS } from "./cells";
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
  const { evf, itens, caps, mItem } = d;
  const res = useMemo(() => resumo(itens, caps), [itens, caps]);
  const [catOpen, setCatOpen] = useState(false);
  const [livreCap, setLivreCap] = useState<string>("");
  if (!evf) return null;

  const upd = (id: string, v: Record<string, unknown>) => mItem.update.mutate({ id, ...v });
  const maxOrdem = itens.reduce((m, i) => Math.max(m, i.ordem), 0);

  async function addLivre() {
    const cap = Number(livreCap);
    if (!cap) {
      toast.error("Escolha o capítulo do item.");
      return;
    }
    await mItem.insert.mutateAsync({
      evf_id: evf!.id,
      capitulo_codigo: cap,
      codigo: proximoCodigo(itens, cap),
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
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl min-w-[1400px]">
          <thead>
            <tr>
              <th className="w-16">Item</th>
              <th>Serviço</th>
              <th className="w-16">Un.</th>
              <th className="w-24 text-right">Quant.</th>
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
                remover={(id) => mItem.remove.mutate(id)}
              />
            ))}
            {!itens.length ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-muted-foreground">
                  Nenhum item. Adicione serviços do catálogo ou itens livres.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={7} className="py-3">
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
        onPick={async (s) => {
          await mItem.insert.mutateAsync({
            evf_id: evf.id,
            capitulo_codigo: s.capitulo_codigo,
            codigo: proximoCodigo(itens, s.capitulo_codigo),
            descricao: s.descricao,
            unidade: s.unidade,
            quantidade: 1,
            material_unit: s.material_unit,
            mo_unit: s.mo_unit,
            tipo_preco: s.tipo_preco,
            ordem: maxOrdem + 1,
          });
          toast.success(`Adicionado: ${s.descricao}`);
        }}
      />
    </div>
  );
}

function CapituloRows({
  c,
  upd,
  mover,
  remover,
}: {
  c: ReturnType<typeof resumo>["capitulos"][number];
  upd: (id: string, v: Record<string, unknown>) => void;
  mover: (i: Item, d: -1 | 1) => void;
  remover: (id: string) => void;
}) {
  return (
    <>
      <tr className="bg-muted/70">
        <td className="num py-2 font-semibold">{c.codigo}</td>
        <td colSpan={6} className="font-semibold uppercase tracking-wide">
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
          <tr key={i.id}>
            <td>
              <TextCell
                value={i.codigo}
                label="Código"
                className="num w-16"
                onSave={(v) => upd(i.id, { codigo: v })}
              />
            </td>
            <td>
              <TextCell
                value={i.descricao}
                label="Serviço"
                className="min-w-64"
                onSave={(v) => upd(i.id, { descricao: v })}
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
              <NumCell
                value={Number(i.quantidade)}
                decimals={2}
                label="Quantidade"
                onSave={(v) => upd(i.id, { quantidade: v })}
              />
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

function CatalogoDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (s: {
    capitulo_codigo: number;
    descricao: string;
    unidade: string;
    material_unit: number;
    mo_unit: number;
    tipo_preco: string;
  }) => Promise<void>;
}) {
  const catalogo = useCatalogo().data ?? [];
  const [q, setQ] = useState("");
  const lista = catalogo
    .filter(
      (s) => !q || s.descricao.toLowerCase().includes(q.toLowerCase()) || s.codigo.startsWith(q),
    )
    .sort((a, b) => a.capitulo_codigo - b.capitulo_codigo || compareCodigo(a.codigo, b.codigo));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar serviço do catálogo</DialogTitle>
        </DialogHeader>
        <input
          className="field"
          autoFocus
          placeholder="Buscar serviço…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar serviço"
        />
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
          <table className="tbl">
            <tbody>
              {lista.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-primary-soft"
                  onClick={() => onPick(s)}
                >
                  <td className="num w-14 text-muted-foreground">{s.codigo}</td>
                  <td className="py-2">{s.descricao}</td>
                  <td className="w-12">{s.unidade}</td>
                  <td className="num w-28 text-right">
                    {fmtR(Number(s.material_unit) + Number(s.mo_unit))}
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
          Clique num serviço para adicioná-lo (quantidade 1). Ajuste a quantidade na planilha.
        </p>
      </DialogContent>
    </Dialog>
  );
}
