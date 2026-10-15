import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inserirItens } from "@/lib/actions";
import { usePrecificador } from "@/lib/precos";
import { useCatalogo } from "@/lib/data";
import { fmtN } from "@/lib/format";
import type { Interpretacao, Proposta } from "@/lib/interpretar";
import type { EvfData } from "./useEvfData";

export const EXEMPLO_AMBIENTE =
  "Ex.: Tirar todo o piso, deixar plano e arrumar o ralo. Piso novo e louças novas. Na parede, tirar o azulejo, impermeabilizar e colocar o mesmo revestimento do piso até 1,75 m. Manter o forro, só pintar. 2 tomadas novas.";
export const EXEMPLO_OBRA =
  "Ex.: Plano de reforma aprovado pelo síndico e RRT. Gestão por 2 meses. Seguro e impressão de projetos. Isolamento da área, proteção do trajeto até a caçamba, fretes e limpeza pós-obra.";

const TITULO: Record<Proposta["acao"], string> = {
  adicionar: "Adicionar ao Escopo",
  atualizar: "Atualizar o que já existe",
  remover: "Tirar do Escopo",
};

export function PropostasDialog({
  d,
  resultado,
  nome,
  ambienteId,
  onClose,
  catalogo,
}: {
  d: EvfData;
  resultado: Interpretacao | null;
  nome: string;
  ambienteId: string | null;
  onClose: () => void;
  catalogo: ReturnType<typeof useCatalogo>["data"] & object;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const precificar = usePrecificador();
  useEffect(() => {
    setSel(new Set(resultado?.propostas.map((p) => p.id) ?? []));
  }, [resultado]);
  const grupos = useMemo(() => {
    const g: Record<Proposta["acao"], Proposta[]> = { adicionar: [], atualizar: [], remover: [] };
    for (const p of resultado?.propostas ?? []) g[p.acao].push(p);
    return g;
  }, [resultado]);
  if (!resultado) return null;
  const { evf, todosItens, mItem } = d;

  async function aplicar() {
    if (!evf) return;
    setOcupado(true);
    try {
      const escolhidas = resultado!.propostas.filter((p) => sel.has(p.id));
      const linhas = escolhidas
        .filter((p) => p.acao === "adicionar")
        .map((p) => {
          const pr = precificar(p.descricao, p.chave);
          return {
            ambiente_id: p.obraToda ? null : ambienteId,
            capitulo_codigo: p.capitulo,
            descricao: p.descricao,
            unidade: p.unidade,
            quantidade: p.quantidade,
            perda_pct: p.perda,
            material_unit: pr?.material_unit ?? 0,
            mo_unit: pr ? pr.mo_unit : p.mo,
            origem_preco: pr?.origem ?? null,
            tipo_preco: p.tipo,
            chave: p.chave,
            base_qtd: p.base_qtd,
            fator: p.fator,
          };
        });
      if (linhas.length) await inserirItens(evf.id, linhas, todosItens);
      for (const p of escolhidas.filter((x) => x.acao === "atualizar" && x.itemId))
        await mItem.update.mutateAsync({
          id: p.itemId!,
          descricao: p.descricao,
          quantidade: p.quantidade,
          base_qtd: p.base_qtd,
          fator: p.fator,
        });
      const rem = escolhidas.filter((x) => x.acao === "remover" && x.itemId).map((x) => x.itemId!);
      if (rem.length) await mItem.removeMany.mutateAsync(rem);
      await mItem.invalidar();
      const nAt = escolhidas.filter((x) => x.acao === "atualizar").length;
      toast.success(
        [
          linhas.length && `${linhas.length} adicionado${linhas.length > 1 ? "s" : ""}`,
          nAt && `${nAt} atualizado${nAt > 1 ? "s" : ""}`,
          rem.length && `${rem.length} tirado${rem.length > 1 ? "s" : ""}`,
        ]
          .filter(Boolean)
          .join(" · ") || "Nada aplicado.",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar.");
    } finally {
      setOcupado(false);
    }
  }

  const total = resultado.propostas.length;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Serviços propostos · {nome}</DialogTitle>
        </DialogHeader>
        {resultado.avisos.map((a) => (
          <p
            key={a}
            className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {a}
          </p>
        ))}
        {!total ? (
          <p className="text-sm text-muted-foreground">
            Nada novo a propor: o Escopo já cobre o que está escrito.
          </p>
        ) : null}
        {(["adicionar", "atualizar", "remover"] as const).map((acao) =>
          grupos[acao].length ? (
            <section key={acao} className="space-y-1.5">
              <h3
                className={`text-sm font-semibold ${acao === "remover" ? "text-warning" : "text-primary"}`}
              >
                {TITULO[acao]} ({grupos[acao].length})
              </h3>
              <ul className="divide-y rounded-lg border">
                {grupos[acao].map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-primary"
                        checked={sel.has(p.id)}
                        onChange={(e) =>
                          setSel((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(p.id);
                            else n.delete(p.id);
                            return n;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span
                            className={`font-medium ${acao === "remover" ? "line-through" : ""}`}
                          >
                            {p.descricao}
                          </span>
                          {acao !== "remover" ? (
                            <span className="num text-sm text-muted-foreground">
                              {fmtN(p.quantidade)} {p.unidade}
                              {p.base_qtd ? " · ligado às medidas" : ""}
                              {p.obraToda ? " · vai para Itens gerais" : ""}
                            </span>
                          ) : null}
                        </span>
                        {p.antes ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            hoje: {p.antes}
                            {acao === "atualizar" ? <ArrowRight className="size-3" /> : null}
                          </span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">
                          {p.motivo} <span className="italic">“{p.trecho}”</span>
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        {resultado.jaNoEscopo.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              <Check className="mr-1 inline size-3.5" />
              Já está no Escopo ({resultado.jaNoEscopo.length})
            </summary>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground">
              {resultado.jaNoEscopo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {resultado.naoEntendi.length ? (
          <div className="rounded-lg border border-dashed px-3 py-2 text-sm">
            <div className="font-medium">Não reconheci um serviço nestes trechos:</div>
            <ul className="list-disc pl-5 text-muted-foreground">
              {resultado.naoEntendi.map((t) => (
                <li key={t}>“{t}”</li>
              ))}
            </ul>
            <div className="mt-1 text-xs text-muted-foreground">
              Reescreva com o serviço (ex.: “trocar a porta”) ou lance como item livre no Escopo.
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" className="h-10" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="h-10" disabled={!sel.size || ocupado} onClick={aplicar}>
            Aplicar {sel.size} {sel.size === 1 ? "alteração" : "alterações"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Depois de aplicar, os lembretes do bloco conferem o que esses serviços puxam (ex.: teste
          de estanqueidade, soleira).
        </p>
      </DialogContent>
    </Dialog>
  );
}
