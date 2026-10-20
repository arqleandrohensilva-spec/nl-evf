import { semPrecoItem } from "@/lib/equipes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvfData } from "./useEvfData";

interface Passo {
  n: number;
  aba: string;
  titulo: string;
  status: string;
  feito: boolean;
}

/** Caminho do EVF: medidas → o que será feito → preços → resumo, cada passo dizendo o que falta. */
export function Caminho({
  d,
  aba,
  setAba,
}: {
  d: EvfData;
  aba: string;
  setAba: (v: string) => void;
}) {
  const { evf, ambientes, todosItens } = d;
  if (!evf) return null;
  const comMedidas = ambientes.filter((a) => Number(a.comprimento) > 0 && Number(a.largura) > 0);
  const locais = [
    {
      nome: "Obra toda",
      tem: Boolean(evf.descricao_obra) || todosItens.some((i) => !i.ambiente_id),
    },
    ...ambientes.map((a) => ({
      nome: a.nome,
      tem: Boolean(a.descricao_servico) || todosItens.some((i) => i.ambiente_id === a.id),
    })),
  ];
  const faltaEscopo = locais.filter((l) => !l.tem);
  const semPreco = todosItens.filter(semPrecoItem);
  const target = Number(evf.target) || 0;

  const passos: Passo[] = [
    {
      n: 1,
      aba: "levantamento",
      titulo: "Ambientes e medidas",
      feito: ambientes.length > 0 && comMedidas.length === ambientes.length,
      status: !ambientes.length
        ? /constru|ampliac/i.test(evf.tipo_obra)
          ? "Preencha os dados da casa"
          : "Crie os ambientes da obra"
        : comMedidas.length < ambientes.length
          ? `Faltam medidas em ${ambientes.length - comMedidas.length} de ${ambientes.length}`
          : `${ambientes.length} ${ambientes.length === 1 ? "ambiente medido" : "ambientes medidos"}`,
    },
    {
      n: 2,
      aba: "escopo",
      titulo: "O que será feito",
      feito: todosItens.length > 0 && !faltaEscopo.length,
      status: !todosItens.length
        ? "Descreva cada local e gere os serviços"
        : faltaEscopo.length
          ? `Falta: ${faltaEscopo.map((l) => l.nome).join(", ")}`
          : `${todosItens.length} serviços em ${locais.length} locais`,
    },
    {
      n: 3,
      aba: "cotacoes",
      titulo: "Preços e cotações",
      feito: todosItens.length > 0 && !semPreco.length,
      status: !todosItens.length
        ? "Depois do escopo"
        : semPreco.length
          ? `${semPreco.length} ${semPreco.length === 1 ? "serviço sem preço" : "serviços sem preço"}`
          : "Todos com preço",
    },
    {
      n: 4,
      aba: "resumo",
      titulo: "Resumo e target",
      feito: target > 0 && todosItens.length > 0 && !semPreco.length,
      status: !target ? "Defina o target do cliente" : "Compare com o target e os cenários",
    },
  ];
  const proximo = passos.find((p) => !p.feito)?.n;

  return (
    <nav aria-label="Caminho do EVF" className="no-print">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {passos.map((p) => {
          const ativo = aba === p.aba;
          return (
            <li key={p.n}>
              <button
                type="button"
                onClick={() => setAba(p.aba)}
                aria-current={ativo ? "step" : undefined}
                className={cn(
                  "flex h-full w-full items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary",
                  ativo && "border-primary bg-primary-soft",
                  !ativo && p.n === proximo && "border-warning/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    p.feito
                      ? "bg-primary text-primary-foreground"
                      : p.n === proximo
                        ? "bg-warning text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {p.feito ? <Check className="size-3.5" /> : p.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{p.titulo}</span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      p.n === proximo ? "text-warning" : "text-muted-foreground",
                    )}
                    title={p.status}
                  >
                    {p.n === proximo ? `Próximo passo: ${p.status}` : p.status}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
