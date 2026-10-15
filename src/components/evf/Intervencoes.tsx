import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Ambiente } from "@/lib/calc";
import { EXECUCAO } from "@/lib/execucao";
import type { Interpretacao } from "@/lib/interpretar";
import {
  aplicarIntervencao,
  contexto,
  INTERVENCOES,
  respostasPadrao,
  type Intervencao,
  type Respostas,
} from "@/lib/intervencoes";
import { fmtN } from "@/lib/format";
import { geometria } from "@/lib/sugestoes";
import type { EvfData } from "./useEvfData";

/** "O que muda aqui?": um botão por intervenção; cada um abre as perguntas de obra. */
export function IntervencoesBotoes({
  d,
  amb,
  onResultado,
}: {
  d: EvfData;
  amb: Ambiente;
  onResultado: (r: Interpretacao) => void;
}) {
  const [aberta, setAberta] = useState<Intervencao | null>(null);
  return (
    <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Hammer className="size-4 text-primary" aria-hidden /> O que muda aqui?
        <span className="text-xs font-normal text-muted-foreground">
          Escolha e responda algumas perguntas: o sistema monta os serviços.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {INTERVENCOES.map((iv) => (
          <Button
            key={iv.id}
            variant="outline"
            className="h-9 bg-card"
            title={iv.descricao}
            onClick={() => setAberta(iv)}
          >
            {iv.nome}
          </Button>
        ))}
      </div>
      {aberta ? (
        <IntervencaoDialog
          d={d}
          amb={amb}
          iv={aberta}
          onClose={() => setAberta(null)}
          onContinuar={(r) => {
            setAberta(null);
            onResultado(r);
          }}
        />
      ) : null}
    </div>
  );
}

function IntervencaoDialog({
  d,
  amb,
  iv,
  onClose,
  onContinuar,
}: {
  d: EvfData;
  amb: Ambiente;
  iv: Intervencao;
  onClose: () => void;
  onContinuar: (r: Interpretacao) => void;
}) {
  const { medicoes, todosItens } = d;
  const ctx = useMemo(() => contexto(amb, geometria(amb, medicoes).perimetro), [amb, medicoes]);
  const [r, setR] = useState<Respostas>(() => respostasPadrao(iv, ctx));
  const [verComo, setVerComo] = useState(false);
  const res = useMemo(
    () => aplicarIntervencao(iv, r, amb, medicoes, todosItens),
    [iv, r, amb, medicoes, todosItens],
  );
  const visiveis = iv.perguntas.filter((p) => !p.quando || p.quando(r));
  const etapas = useMemo(() => {
    const vistos = new Set<string>();
    return res.propostas
      .filter(
        (p) =>
          p.acao !== "remover" &&
          p.chave &&
          EXECUCAO[p.chave] &&
          !vistos.has(p.chave) &&
          vistos.add(p.chave),
      )
      .map((p) => ({ nome: p.descricao, ...EXECUCAO[p.chave!]! }));
  }, [res]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {iv.nome} · {amb.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {visiveis.map((p) => (
              <fieldset key={p.id} className="space-y-1.5">
                <legend className="text-sm font-semibold">{p.texto}</legend>
                {p.tipo === "escolha" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.opcoes!.map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={r[p.id] === v}
                        onClick={() => setR((x) => ({ ...x, [p.id]: v }))}
                        className={`min-h-9 rounded-lg border px-3 text-sm ${
                          r[p.id] === v
                            ? "border-primary bg-primary font-semibold text-primary-foreground"
                            : "bg-card hover:bg-muted"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      step={p.unidade === "un" ? 1 : 0.05}
                      min={0}
                      className="field h-9 w-28 text-right"
                      aria-label={p.texto}
                      value={Number(r[p.id]) || 0}
                      onChange={(e) => setR((x) => ({ ...x, [p.id]: Number(e.target.value) || 0 }))}
                    />
                    {p.unidade}
                  </label>
                )}
                {p.ajuda ? <p className="text-xs text-muted-foreground">{p.ajuda}</p> : null}
              </fieldset>
            ))}
          </div>

          <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm md:self-start">
            <h3 className="font-semibold">Vai entrar no orçamento</h3>
            {res.avisos.map((a) => (
              <p
                key={a}
                className="flex items-start gap-2 rounded-md bg-warning-soft px-2.5 py-2 text-xs text-warning"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {a}
              </p>
            ))}
            <ul className="space-y-1">
              {res.propostas.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3">
                  <span className={p.acao === "remover" ? "text-warning line-through" : ""}>
                    {p.acao === "atualizar" ? "↻ " : p.acao === "remover" ? "− " : "+ "}
                    {p.descricao}
                  </span>
                  {p.acao !== "remover" ? (
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {fmtN(p.quantidade)} {p.unidade}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {res.jaNoEscopo.length ? (
              <p className="text-xs text-muted-foreground">
                Já no orçamento: {res.jaNoEscopo.length}{" "}
                {res.jaNoEscopo.length === 1 ? "serviço" : "serviços"}.
              </p>
            ) : null}
            {etapas.length ? (
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-primary"
                  onClick={() => setVerComo((v) => !v)}
                  aria-expanded={verComo}
                >
                  <BookOpen className="size-3.5" />
                  Como se faz
                  <ChevronDown
                    className={`size-3.5 transition-transform ${verComo ? "rotate-180" : ""}`}
                  />
                </button>
                {verComo ? (
                  <ol className="mt-2 space-y-2 text-xs">
                    {etapas.map((e, k) => (
                      <li key={e.nome}>
                        <div className="font-semibold">
                          {k + 1}. {e.nome}
                        </div>
                        <ul className="list-disc pl-4 text-muted-foreground">
                          {e.passos.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                          {(e.cuidados ?? []).map((s) => (
                            <li key={s} className="text-warning">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}
            <Button
              className="h-10 w-full"
              disabled={!res.propostas.length}
              onClick={() => onContinuar(res)}
            >
              {res.propostas.length
                ? `Revisar e adicionar (${res.propostas.length})`
                : "Nada novo para adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
