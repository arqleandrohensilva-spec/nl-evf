import { useQuery } from "@tanstack/react-query";
import { carregarReferencia, criarPrecificador, type Precificador } from "@/lib/actions";
import { useCatalogo } from "@/lib/data";

/** Preço de cada serviço: catálogo do escritório primeiro, depois a referência vinculada (SINAPI). */
export function usePrecificador(): Precificador {
  const catalogo = useCatalogo().data ?? [];
  const ref = useQuery({ queryKey: ["referencia"], queryFn: carregarReferencia }).data;
  return criarPrecificador(catalogo, ref ?? new Map());
}

export function useReferencia() {
  return useQuery({ queryKey: ["referencia"], queryFn: carregarReferencia });
}
