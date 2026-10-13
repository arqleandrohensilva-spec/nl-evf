import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = keyof Database["public"]["Tables"];

async function run<R>(p: PromiseLike<{ data: R; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export const useCapitulos = () =>
  useQuery({ queryKey: ["capitulos"], queryFn: () => run(supabase.from("capitulos").select("*").order("codigo")) });
export const useConfig = () =>
  useQuery({ queryKey: ["config"], queryFn: () => run(supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle()) });
export const useCatalogo = () =>
  useQuery({ queryKey: ["catalogo"], queryFn: () => run(supabase.from("catalogo_servicos").select("*").order("capitulo_codigo").order("codigo")) });
export const useFornecedores = () =>
  useQuery({ queryKey: ["fornecedores"], queryFn: () => run(supabase.from("fornecedores").select("*").order("nome")) });
export const useEvfs = () =>
  useQuery({ queryKey: ["evfs"], queryFn: () => run(supabase.from("evfs").select("*").order("created_at", { ascending: false })) });
export const useAllItens = () =>
  useQuery({ queryKey: ["itens", "all"], queryFn: () => run(supabase.from("itens_evf").select("*")) });

export const useEvf = (id: string) =>
  useQuery({ queryKey: ["evf", id], queryFn: () => run(supabase.from("evfs").select("*").eq("id", id).single()) });
export const useItens = (id: string) =>
  useQuery({ queryKey: ["itens", id], queryFn: () => run(supabase.from("itens_evf").select("*").eq("evf_id", id).order("ordem")) });
export const useAmbientes = (id: string) =>
  useQuery({ queryKey: ["ambientes", id], queryFn: () => run(supabase.from("ambientes").select("*").eq("evf_id", id).order("ordem")) });
export const useMedicoes = (ambIds: string[]) =>
  useQuery({
    queryKey: ["medicoes", ambIds],
    queryFn: () => (ambIds.length ? run(supabase.from("medicoes").select("*").in("ambiente_id", ambIds).order("ordem").order("created_at")) : Promise.resolve([])),
  });
export const useCotacoes = (itemIds: string[]) =>
  useQuery({
    queryKey: ["cotacoes", itemIds.length, itemIds[0] ?? ""],
    queryFn: async () => {
      if (!itemIds.length) return [];
      const out = [];
      for (let k = 0; k < itemIds.length; k += 150)
        out.push(...(await run(supabase.from("cotacoes").select("*").in("item_id", itemIds.slice(k, k + 150)).order("ordem"))));
      return out;
    },
  });

/** Mutação genérica: insert / update / delete em qualquer tabela, invalidando as chaves indicadas. */
export function useMut(table: T, invalidate: string[] = []) {
  const qc = useQueryClient();
  const done = () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const onError = (e: Error) => toast.error(e.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tb = () => supabase.from(table) as any;
  return {
    insert: useMutation({ mutationFn: (v: Record<string, unknown> | Record<string, unknown>[]) => run(tb().insert(v).select()), onSuccess: done, onError }),
    update: useMutation({
      mutationFn: ({ id, ...v }: { id: string | number } & Record<string, unknown>) => run(tb().update(v).eq("id", id)),
      onSuccess: done,
      onError,
    }),
    remove: useMutation({ mutationFn: (id: string) => run(tb().delete().eq("id", id)), onSuccess: done, onError }),
  };
}

export { run };
