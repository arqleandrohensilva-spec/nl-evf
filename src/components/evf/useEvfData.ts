import {
  useAmbientes,
  useCapitulos,
  useConfig,
  useCotacoes,
  useEvf,
  useItens,
  useMedicoes,
  useMut,
} from "@/lib/data";

/** Tudo que as abas do EVF precisam, num lugar só. */
export function useEvfData(id: string) {
  const evfQ = useEvf(id);
  const itens = useItens(id).data ?? [];
  const caps = useCapitulos().data ?? [];
  const config = useConfig().data ?? null;
  const ambientes = useAmbientes(id).data ?? [];
  const medicoes = useMedicoes(ambientes.map((a) => a.id)).data ?? [];
  const cotacoes = useCotacoes(itens.map((i) => i.id)).data ?? [];
  const mItem = useMut("itens_evf", ["itens", "cotacoes"]);
  const mCot = useMut("cotacoes", ["cotacoes"]);
  const mEvf = useMut("evfs", ["evf", "evfs"]);
  const mAmb = useMut("ambientes", ["ambientes", "medicoes"]);
  const mMed = useMut("medicoes", ["medicoes"]);
  return {
    evf: evfQ.data,
    carregando: evfQ.isLoading,
    erro: evfQ.error,
    itens,
    /** Todos os itens do EVF, mesmo quando a tela está filtrada por ambiente (use para códigos e regras). */
    todosItens: itens,
    /** Ambiente em foco: "" = todos, "geral" = itens sem ambiente, ou o id do ambiente. */
    filtro: "" as string,
    caps,
    config,
    ambientes,
    medicoes,
    cotacoes,
    mItem,
    mCot,
    mEvf,
    mAmb,
    mMed,
  };
}

export type EvfData = ReturnType<typeof useEvfData>;
