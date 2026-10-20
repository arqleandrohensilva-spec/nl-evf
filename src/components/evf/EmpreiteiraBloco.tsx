import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, FileText, HardHat, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/calc";
import {
  chaveEstimado,
  EMPREITEIRA,
  porEquipe,
  ratearProposta,
  textoParaEquipe,
} from "@/lib/equipes";
import { fmtN, fmtR } from "@/lib/format";
import { NumCell } from "./cells";
import type { EvfData } from "./useEvfData";

/**
 * Mão de obra da empreiteira como um valor só. Mostra, por ambiente, tudo o que ela vai fazer
 * (sem preço por serviço), gera o documento para cotação e aplica o valor global ao EVF.
 */
export function EmpreiteiraBloco({ d }: { d: EvfData }) {
  const { evf, itens, ambientes, mEvf, mItem } = d;
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const linha = useMemo(() => porEquipe(itens).find((l) => l.equipe.id === EMPREITEIRA), [itens]);
  const grupos = useMemo(() => {
    const map = new Map<string | null, Item[]>();
    for (const i of linha?.itens ?? [])
      map.set(i.ambiente_id, [...(map.get(i.ambiente_id) ?? []), i]);
    return [null, ...ambientes.map((a) => a.id)]
      .filter((a) => map.has(a))
      .map((a) => ({
        nome: a ? (ambientes.find((x) => x.id === a)?.nome ?? "Ambiente") : "Obra toda",
        itens: map.get(a)!,
      }));
  }, [linha, ambientes]);
  if (!evf || !linha) return null;

  const propostas = (
    evf.propostas_equipe && typeof evf.propostas_equipe === "object" ? evf.propostas_equipe : {}
  ) as Record<string, number>;
  const valor = propostas[EMPREITEIRA] ?? 0;
  const estimado = propostas[chaveEstimado(EMPREITEIRA)] ?? linha.previsto;
  const aplicada = propostas[chaveEstimado(EMPREITEIRA)] !== undefined;
  const noEvf = linha.previsto;

  const salvarValor = (v: number) => {
    const novo = { ...propostas };
    if (v > 0) novo[EMPREITEIRA] = v;
    else delete novo[EMPREITEIRA];
    mEvf.update.mutate({ id: evf.id, propostas_equipe: novo });
  };
  const aplicar = async (v: number, voltar = false) => {
    const novos = ratearProposta(linha, v);
    if (!novos.length) {
      toast.error("Nenhum serviço da empreiteira tem quantidade para receber o valor.");
      return;
    }
    try {
      await Promise.all(novos.map((u) => mItem.update.mutateAsync(u)));
      const novo = { ...propostas };
      if (voltar) delete novo[chaveEstimado(EMPREITEIRA)];
      else novo[chaveEstimado(EMPREITEIRA)] = estimado;
      mEvf.update.mutate({ id: evf.id, propostas_equipe: novo });
      toast.success(
        voltar ? "Mão de obra voltou à estimativa." : `Valor global de ${fmtR(v)} aplicado ao EVF.`,
      );
    } catch {
      toast.error("Não foi possível aplicar. Tente de novo.");
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(
        textoParaEquipe(linha, ambientes, { nome: evf.obra, local: evf.cidade_uf }),
      );
      setCopiado(true);
      toast.success("Pedido copiado: cole no WhatsApp ou no e-mail.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <HardHat className="size-4 text-muted-foreground" aria-hidden />
            Mão de obra da empreiteira — valor global
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os {linha.itens.length} serviços abaixo vão para uma empreiteira só, que passa{" "}
            <b>um valor para tudo</b>. Não existe preço por serviço: na tabela de serviços entra só
            o material de cada um. Mande o documento de cotação, digite o valor recebido e aplique.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-9">
            <Link to="/escopo/$id" params={{ id: evf.id }} search={{ eq: EMPREITEIRA }}>
              <FileText className="size-4" /> Documento para cotação
            </Link>
          </Button>
          <Button variant="outline" className="h-9" onClick={copiar}>
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar pedido
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-md bg-muted/40 px-3 py-2">
        <label className="text-xs text-muted-foreground">
          Valor global recebido (R$)
          <NumCell
            value={valor}
            onSave={salvarValor}
            label="Valor global da empreiteira"
            className="w-40 border-border"
          />
        </label>
        <div className="text-sm">
          <div className="text-xs text-muted-foreground">
            {aplicada ? "Mão de obra no EVF (valor aplicado)" : "Mão de obra no EVF (estimativa)"}
          </div>
          <div className="num font-semibold">{fmtR(noEvf)}</div>
        </div>
        {valor > 0 && Math.abs(valor - noEvf) >= 0.01 ? (
          <Button
            className="h-9"
            onClick={() => {
              if (
                window.confirm(
                  `Aplicar ${fmtR(valor)} ao EVF?\n\nO valor é distribuído pelos serviços só para manter as taxas por capítulo e a Curva ABC. Dá para voltar à estimativa depois.`,
                )
              )
                void aplicar(valor);
            }}
          >
            <Wand2 className="size-4" /> Aplicar ao EVF
          </Button>
        ) : valor > 0 ? (
          <span className="flex items-center gap-1 text-sm text-primary">
            <Check className="size-4" /> Valor aplicado
          </span>
        ) : null}
        {aplicada ? (
          <Button variant="ghost" className="h-9" onClick={() => void aplicar(estimado, true)}>
            <Undo2 className="size-4" /> Voltar à estimativa ({fmtR(estimado)})
          </Button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary"
      >
        <ChevronDown
          className={`size-4 transition-transform ${aberto ? "" : "-rotate-90"}`}
          aria-hidden
        />
        Ver os serviços por ambiente ({grupos.map((g) => `${g.nome} ${g.itens.length}`).join(" · ")}
        )
      </button>
      {aberto ? (
        <div className="grid gap-4 md:grid-cols-2">
          {grupos.map((g) => (
            <div key={g.nome}>
              <h3 className="border-b pb-1 text-sm font-semibold">{g.nome}</h3>
              <ul className="mt-1 space-y-0.5 text-sm">
                {g.itens.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>{i.descricao}</span>
                    <span className="num whitespace-nowrap text-muted-foreground">
                      {fmtN(Number(i.quantidade) || 0)} {i.unidade}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
