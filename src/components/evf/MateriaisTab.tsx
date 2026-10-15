import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { COMPOSICOES, composicaoDoItem, listaDeMateriais } from "@/lib/insumos";
import { fmtN } from "@/lib/format";
import type { EvfData } from "./useEvfData";

/** Quanto material comprar: consumo de cada serviço somado e convertido em embalagens. */
export function MateriaisTab({ d }: { d: EvfData }) {
  const { itens, ambientes } = d;
  const lista = useMemo(() => listaDeMateriais(itens), [itens]);
  const [aberto, setAberto] = useState<Set<string>>(new Set());
  const nomeAmb = (id: string | null) => ambientes.find((a) => a.id === id)?.nome ?? "Obra toda";
  const semComposicao = itens.filter(
    (i) =>
      !composicaoDoItem(i) && i.tipo_preco !== "verba" && i.unidade !== "vb" && i.unidade !== "mês",
  ).length;
  const notas = useMemo(() => {
    const usadas = new Set(
      itens.map((i) => composicaoDoItem(i)?.chave).filter(Boolean) as string[],
    );
    return [...usadas].map((k) => ({ k, nota: COMPOSICOES[k]!.nota }));
  }, [itens]);

  const alternar = (k: string) =>
    setAberto((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Quanto comprar de cada material, somando o consumo de todos os serviços (placas já com a
        perda do item). Coeficientes de referência de mercado para o EVF: o quantitativo final sai
        do projeto executivo e das fichas dos fabricantes. Itens em “Etapa futura” ficam de fora.
      </p>
      {lista.length ? (
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>Material</th>
                <th className="w-36 text-right">Quantidade</th>
                <th className="w-64">Comprar</th>
                <th className="w-32 text-right">Vem de</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <Fragment key={l.insumo}>
                  <tr>
                    <td className="py-2 font-medium">
                      <button
                        className="flex items-center gap-1.5 text-left"
                        onClick={() => alternar(l.insumo)}
                        aria-expanded={aberto.has(l.insumo)}
                      >
                        {aberto.has(l.insumo) ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        {l.nome}
                      </button>
                    </td>
                    <td className="num text-right">
                      {fmtN(l.total)} {l.un}
                    </td>
                    <td className="font-semibold">{l.compra}</td>
                    <td className="text-right text-sm text-muted-foreground">
                      {l.origens.length} {l.origens.length === 1 ? "serviço" : "serviços"}
                    </td>
                  </tr>
                  {aberto.has(l.insumo)
                    ? l.origens.map((o) => (
                        <tr key={o.item.id} className="bg-muted/40 text-sm">
                          <td className="pl-9 text-muted-foreground">
                            {o.item.descricao}
                            <span className="ml-2 text-xs">· {nomeAmb(o.item.ambiente_id)}</span>
                          </td>
                          <td className="num text-right text-muted-foreground">
                            {fmtN(o.qtd)} {l.un}
                          </td>
                          <td className="text-xs text-muted-foreground">
                            {fmtN(Number(o.item.quantidade))} {o.item.unidade} do serviço
                          </td>
                          <td />
                        </tr>
                      ))
                    : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
          <Package className="size-6" />
          Nenhum serviço com consumo de material calculável ainda (piso, revestimento, contrapiso,
          reboco, alvenaria, pintura, forro, impermeabilização, concreto…).
        </div>
      )}
      {semComposicao ? (
        <p className="text-xs text-muted-foreground">
          {semComposicao} serviços medidos (louças, metais, esquadrias, pedras, marcenaria…) são
          comprados como produto pronto e aparecem na aba Cotações, não aqui.
        </p>
      ) : null}
      {notas.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-primary">
            Coeficientes usados ({notas.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {notas.map((x) => (
              <li key={x.k}>{x.nota}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
