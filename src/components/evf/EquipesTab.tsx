import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, FileText, HardHat, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { itemTotais } from "@/lib/calc";
import {
  chaveEstimado,
  EQUIPES,
  equipeDoItem,
  equipeSugerida,
  porEquipe,
  ratearProposta,
  textoParaEquipe,
  type LinhaEquipe,
} from "@/lib/equipes";
import { fmtN, fmtPct, fmtR } from "@/lib/format";
import { Kpi, NumCell } from "./cells";
import type { EvfData } from "./useEvfData";

const TIPO_TXT = {
  mo: "Só mão de obra",
  fornecedor: "Fornece e instala",
  compra: "Sem equipe",
} as const;

/** Quem faz o quê: lista por profissional, pedido de proposta pronto e comparação com o previsto. */
export function EquipesTab({ d }: { d: EvfData }) {
  const { evf, itens, ambientes, mEvf } = d;
  const linhas = useMemo(() => porEquipe(itens), [itens]);
  const [aberta, setAberta] = useState<string | null>(null);
  if (!evf) return null;
  const propostas = (
    evf.propostas_equipe && typeof evf.propostas_equipe === "object" ? evf.propostas_equipe : {}
  ) as Record<string, number>;
  const salvarProposta = (id: string, v: number) => {
    const novo = { ...propostas };
    if (v > 0) novo[id] = v;
    else delete novo[id];
    mEvf.update.mutate({ id: evf.id, propostas_equipe: novo });
  };
  /** Estimativa do EVF antes de aplicar qualquer proposta (é a base da comparação). */
  const estimado = (l: LinhaEquipe) => propostas[chaveEstimado(l.equipe.id)] ?? l.previsto;
  /** Grava o valor global nos itens da equipe (rateio pela M.O. estimada). */
  const aplicar = async (l: LinhaEquipe, valor: number, voltar = false) => {
    const novos = ratearProposta(l, valor);
    if (!novos.length) {
      toast.error("Nenhum serviço desta equipe tem quantidade para receber o valor.");
      return;
    }
    try {
      await Promise.all(novos.map((u) => d.mItem.update.mutateAsync(u)));
      const novo = { ...propostas };
      if (voltar) delete novo[chaveEstimado(l.equipe.id)];
      else novo[chaveEstimado(l.equipe.id)] = estimado(l);
      mEvf.update.mutate({ id: evf.id, propostas_equipe: novo });
      toast.success(
        voltar
          ? "Mão de obra voltou à estimativa do EVF."
          : `Proposta de ${fmtR(valor)} aplicada: a M.O. de ${novos.length} serviços foi ajustada.`,
      );
    } catch {
      toast.error("Não foi possível aplicar. Tente de novo.");
    }
  };
  const soma = (f: (l: LinhaEquipe) => boolean) =>
    linhas.filter(f).reduce((s, l) => s + l.previsto, 0);
  const mo = soma((l) => l.equipe.tipo === "mo");
  const forn = soma((l) => l.equipe.tipo === "fornecedor");
  const comp = soma((l) => l.equipe.tipo === "compra");
  const comProposta = linhas.filter((l) => propostas[l.equipe.id]);
  const prevComProposta = comProposta.reduce((s, l) => s + estimado(l), 0);
  const recebido = comProposta.reduce((s, l) => s + (propostas[l.equipe.id] ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Mão de obra das equipes" valor={fmtR(mo)} nota="Pedreiro, gesseiro, pintor…" />
        <Kpi titulo="Fornece e instala" valor={fmtR(forn)} nota="Marmoraria, marcenaria, vidros…" />
        <Kpi titulo="Compras, locações e taxas" valor={fmtR(comp)} nota="Sem equipe de obra" />
        <Kpi
          titulo="Propostas recebidas"
          tom={comProposta.length ? (recebido > prevComProposta ? "alerta" : "ok") : "normal"}
          valor={comProposta.length ? fmtR(recebido) : "—"}
          nota={
            comProposta.length
              ? `${comProposta.length} de ${linhas.length} equipes · previsto ${fmtR(prevComProposta)} (${fmtPct(prevComProposta ? ((recebido - prevComProposta) / prevComProposta) * 100 : 0)})`
              : "Digite o valor de cada proposta na tabela"
          }
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Cada serviço já vem com a equipe que costuma fazer. Abra uma equipe para{" "}
        <strong>imprimir o escopo</strong> (tudo o que ela vai fazer, sem valores) ou copiar o
        pedido para o WhatsApp. O pedreiro e as demais equipes de mão de obra devolvem{" "}
        <strong>um valor global</strong>: digite em “Proposta recebida” e use “Aplicar ao EVF” para
        o total da obra passar a usar esse valor. Itens de etapa futura ficam de fora.
      </p>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Equipe</th>
              <th className="px-3 py-2 font-medium">Serviços</th>
              <th className="px-3 py-2 text-right font-medium">Previsto no EVF</th>
              <th className="px-3 py-2 text-right font-medium">Proposta recebida</th>
              <th className="px-3 py-2 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const p = propostas[l.equipe.id] ?? 0;
              const est = estimado(l);
              const dif = p - est;
              const aberto = aberta === l.equipe.id;
              return (
                <EquipeLinhas
                  key={l.equipe.id}
                  l={l}
                  d={d}
                  aberto={aberto}
                  onToggle={() => setAberta(aberto ? null : l.equipe.id)}
                  proposta={p}
                  dif={dif}
                  estimado={est}
                  aplicada={propostas[chaveEstimado(l.equipe.id)] !== undefined}
                  onAplicar={() => {
                    if (
                      window.confirm(
                        `Aplicar a proposta de ${fmtR(p)} ao EVF?\n\nA mão de obra dos ${l.itens.length} serviços de ${l.equipe.nome} é ajustada na proporção da estimativa, para somar exatamente esse valor. Dá para voltar à estimativa depois.`,
                      )
                    )
                      void aplicar(l, p);
                  }}
                  onVoltar={() => void aplicar(l, est, true)}
                  onProposta={(v) => salvarProposta(l.equipe.id, v)}
                  texto={() =>
                    textoParaEquipe(l, ambientes, { nome: evf.obra, local: evf.cidade_uf })
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquipeLinhas({
  l,
  d,
  aberto,
  onToggle,
  proposta,
  dif,
  estimado,
  aplicada,
  onAplicar,
  onVoltar,
  onProposta,
  texto,
}: {
  l: LinhaEquipe;
  d: EvfData;
  aberto: boolean;
  onToggle: () => void;
  proposta: number;
  dif: number;
  estimado: number;
  aplicada: boolean;
  onAplicar: () => void;
  onVoltar: () => void;
  onProposta: (v: number) => void;
  texto: () => string;
}) {
  const [copiado, setCopiado] = useState(false);
  const semPreco = l.itens.filter((i) => !itemTotais(i).total).length;
  const ehMo = l.equipe.tipo === "mo";
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto());
      setCopiado(true);
      toast.success("Pedido copiado: cole no WhatsApp ou no e-mail.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <>
      <tr className="border-t">
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={aberto}
            className="flex items-center gap-2 text-left font-medium hover:text-primary"
          >
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${aberto ? "" : "-rotate-90"}`}
              aria-hidden
            />
            <HardHat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {l.equipe.nome}
          </button>
          <div className="pl-12 text-xs text-muted-foreground">{TIPO_TXT[l.equipe.tipo]}</div>
        </td>
        <td className="px-3 py-2 text-muted-foreground">
          {l.itens.length}
          {semPreco ? (
            <span className="ml-2 text-xs text-warning">{semPreco} sem preço</span>
          ) : null}
        </td>
        <td className="num px-3 py-2 text-right font-medium">
          {fmtR(l.previsto)}
          {aplicada ? (
            <div className="text-xs font-normal text-muted-foreground">
              proposta aplicada · estimativa {fmtR(estimado)}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 text-right">
          {l.equipe.tipo === "compra" ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <NumCell
              value={proposta}
              onSave={onProposta}
              label={`Proposta recebida – ${l.equipe.nome}`}
            />
          )}
        </td>
        <td
          className={`num px-3 py-2 text-right ${
            !proposta ? "text-muted-foreground" : dif > 0 ? "text-warning" : "text-primary"
          }`}
        >
          {proposta
            ? `${dif > 0 ? "+" : ""}${fmtR(dif)}${estimado ? ` (${fmtPct((dif / estimado) * 100, 0)})` : ""}`
            : "—"}
        </td>
      </tr>
      {aberto ? (
        <tr className="bg-muted/30">
          <td colSpan={5} className="px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {ehMo
                  ? "M.O. por serviço = estimativa (ou rateio da proposta global); o material é comprado pela obra."
                  : l.equipe.tipo === "fornecedor"
                    ? "Fornecimento e instalação (material + mão de obra)."
                    : "Compras e contratações sem equipe de obra."}
              </span>
              <div className="flex flex-wrap gap-2">
                {l.equipe.tipo !== "compra" ? (
                  <Button asChild size="sm" variant="outline" className="h-9 bg-card">
                    <Link to="/escopo/$id" params={{ id: d.evf!.id }} search={{ eq: l.equipe.id }}>
                      <FileText className="size-4" /> Escopo para imprimir / PDF
                    </Link>
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="h-9 bg-card" onClick={copiar}>
                  {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copiar pedido de proposta
                </Button>
              </div>
            </div>
            {ehMo ? (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                {proposta > 0 && Math.abs(proposta - l.previsto) >= 0.01 ? (
                  <>
                    <span>
                      Proposta global de <strong>{fmtR(proposta)}</strong>. Ao aplicar, a M.O. de
                      cada serviço é ajustada na proporção da estimativa e o EVF soma esse valor.
                    </span>
                    <Button size="sm" className="h-9" onClick={onAplicar}>
                      <Wand2 className="size-4" /> Aplicar ao EVF
                    </Button>
                  </>
                ) : proposta > 0 ? (
                  <span className="text-primary">
                    <Check className="mr-1 inline size-4" />A M.O. desta equipe no EVF já é a
                    proposta de {fmtR(proposta)}.
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Quando receber o valor global, digite em “Proposta recebida” e aplique ao EVF.
                  </span>
                )}
                {aplicada ? (
                  <Button size="sm" variant="ghost" className="ml-auto h-9" onClick={onVoltar}>
                    <Undo2 className="size-4" /> Voltar à estimativa ({fmtR(estimado)})
                  </Button>
                ) : null}
              </div>
            ) : null}
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">Serviço</th>
                  <th className="py-1 pr-2 font-medium">Local</th>
                  <th className="py-1 pr-2 text-right font-medium">Qtd</th>
                  <th className="py-1 pr-2 text-right font-medium">
                    {ehMo ? "M.O. unit." : "Unit."}
                  </th>
                  <th className="py-1 pr-2 text-right font-medium">{ehMo ? "M.O." : "Total"}</th>
                  <th className="py-1 font-medium">Quem faz</th>
                </tr>
              </thead>
              <tbody>
                {l.itens.map((i) => {
                  const t = itemTotais(i);
                  const q = Number(i.quantidade) || 0;
                  const unit = ehMo
                    ? Number(i.mo_unit) || 0
                    : (Number(i.material_unit) || 0) + (Number(i.mo_unit) || 0);
                  const sug = equipeSugerida(i);
                  return (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="py-1.5 pr-2">{i.descricao}</td>
                      <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                        {d.ambientes.find((a) => a.id === i.ambiente_id)?.nome ?? "Obra toda"}
                      </td>
                      <td className="num py-1.5 pr-2 text-right whitespace-nowrap">
                        {fmtN(q)} {i.unidade}
                      </td>
                      <td className="num py-1.5 pr-2 text-right">{unit ? fmtR(unit) : "—"}</td>
                      <td className="num py-1.5 pr-2 text-right">{fmtR(ehMo ? t.mo : t.total)}</td>
                      <td className="py-1.5">
                        <select
                          aria-label={`Quem faz – ${i.descricao}`}
                          className="cell-input min-w-[10rem] cursor-pointer"
                          value={equipeDoItem(i)}
                          onChange={(e) =>
                            d.mItem.update.mutate({
                              id: i.id,
                              equipe: e.target.value === sug ? null : e.target.value,
                            })
                          }
                        >
                          {EQUIPES.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}
                              {e.id === sug ? " (sugerido)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}
