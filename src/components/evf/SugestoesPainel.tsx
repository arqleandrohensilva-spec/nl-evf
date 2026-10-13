import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SERVICO } from "@/lib/biblioteca";
import { buscadorDePreco, inserirItens } from "@/lib/actions";
import { useCatalogo } from "@/lib/data";
import { fmtN } from "@/lib/format";
import { geometria, linhaDoServico, sugerir, type Sugestao } from "@/lib/sugestoes";
import type { EvfData } from "./useEvfData";

/** "O EVF lembra": o que provavelmente está faltando, com um clique para adicionar. */
export function SugestoesPainel({ d, aberto = true }: { d: EvfData; aberto?: boolean }) {
  const { evf, todosItens: itens, filtro, ambientes, medicoes, mItem, mEvf } = d;
  const catalogo = useCatalogo().data ?? [];
  const [open, setOpen] = useState(aberto);
  const [ocupado, setOcupado] = useState(false);
  // As regras olham a obra inteira; com um ambiente em foco, mostra só o que é dele.
  const lista = useMemo(() => {
    const todas = evf ? sugerir(evf, itens, ambientes) : [];
    if (!filtro) return todas;
    return todas.filter((s) => (filtro === "geral" ? !s.ambienteId : s.ambienteId === filtro));
  }, [evf, itens, ambientes, filtro]);
  if (!evf) return null;

  function linhaDe(s: Sugestao) {
    const amb = ambientes.find((a) => a.id === s.ambienteId) ?? null;
    const base = linhaDoServico(
      { chave: s.chave, ...(s.base === "manual" || s.base === "item" ? { qtd: s.qtd } : {}) },
      s.base === "item" ? null : amb,
      amb ? geometria(amb, medicoes) : null,
      buscadorDePreco(catalogo),
    );
    if (!base) return null;
    const svc = SERVICO[s.chave];
    if (s.base === "item")
      return {
        ...base,
        ambiente_id: s.ambienteId,
        descricao: svc ? `${svc.desc}${amb ? ` – ${amb.nome}` : ""}` : base.descricao,
        base_qtd: "item",
        base_item_id: s.baseItemId,
        fator: s.fator,
        quantidade: s.qtd,
      };
    return base;
  }

  async function adicionar(ss: Sugestao[]) {
    setOcupado(true);
    try {
      const linhas = ss.map(linhaDe).filter((l): l is NonNullable<typeof l> => l != null);
      await inserirItens(evf!.id, linhas, itens);
      await mItem.invalidar();
      toast.success(
        ss.length === 1 ? `Adicionado: ${ss[0]?.titulo}` : `${linhas.length} itens adicionados.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar.");
    } finally {
      setOcupado(false);
    }
  }

  function ignorar(s: Sugestao) {
    const atuais = Array.isArray(evf!.sugestoes_ignoradas)
      ? (evf!.sugestoes_ignoradas as string[])
      : [];
    mEvf.update.mutate({ id: evf!.id, sugestoes_ignoradas: [...atuais, s.id] });
  }

  return (
    <section className="card border-primary/30" aria-label="Sugestões do EVF">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Lightbulb className="size-5 text-primary" aria-hidden />
        <div className="flex-1">
          <div className="font-semibold">
            {lista.length
              ? `O EVF lembra: ${lista.length} ${lista.length === 1 ? "item que costuma" : "itens que costumam"} faltar`
              : "O EVF lembra: nada faltando pelas regras de obra"}
          </div>
          <div className="text-xs text-muted-foreground">
            Regras de obra: o que um serviço puxa (parede nova → chapisco, reboco, pintura) e o que
            toda obra deste tipo costuma ter.
          </div>
        </div>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && lista.length ? (
        <div className="border-t px-4 pb-4">
          <ul className="divide-y">
            {lista.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {s.titulo}
                    {s.ambienteNome ? (
                      <span className="ml-1 text-muted-foreground">· {s.ambienteNome}</span>
                    ) : null}
                    {s.base === "item" ? (
                      <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[11px] text-primary">
                        qtd. {fmtN(s.qtd)} (× {fmtN(s.fator, 0)})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.motivo}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={ocupado}
                  onClick={() => adicionar([s])}
                >
                  <Plus className="size-3.5" /> Adicionar
                </Button>
                <button
                  className="rounded p-2 text-muted-foreground hover:bg-muted"
                  aria-label={`Ignorar sugestão ${s.titulo}`}
                  title="Não se aplica a esta obra"
                  onClick={() => ignorar(s)}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-xs text-muted-foreground">
              Os itens entram com o preço do catálogo quando existir; os demais ficam “a cotar”.
            </span>
            <Button className="h-9" disabled={ocupado} onClick={() => adicionar(lista)}>
              Adicionar todos
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
