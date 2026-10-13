/** Fases da obra na ordem de execução. Agrupam os capítulos para a leitura por ambiente. */
export const FASES = [
  { id: "doc", nome: "Documentação e gestão", caps: [1, 17] },
  { id: "prep", nome: "Preparação e canteiro", caps: [2, 3] },
  { id: "demo", nome: "Demolição e retiradas", caps: [4] },
  { id: "estr", nome: "Fundação, estrutura e vedações", caps: [18, 19, 20, 21] },
  { id: "base", nome: "Base e impermeabilização", caps: [5] },
  { id: "inst", nome: "Instalações", caps: [6, 7, 23] },
  { id: "forro", nome: "Forro", caps: [8] },
  { id: "esq", nome: "Esquadrias", caps: [22] },
  { id: "rev", nome: "Revestimentos", caps: [9] },
  { id: "marm", nome: "Marmoraria", caps: [13] },
  { id: "pint", nome: "Pintura", caps: [11] },
  { id: "lou", nome: "Louças, metais e acessórios", caps: [10] },
  { id: "ilu", nome: "Iluminação", caps: [12] },
  { id: "marc", nome: "Marcenaria, vidros e equipamentos", caps: [14, 15, 25] },
  { id: "ext", nome: "Área externa", caps: [24] },
  { id: "limp", nome: "Limpeza e entrega", caps: [16] },
] as const;

export type Fase = (typeof FASES)[number] | { id: "outros"; nome: string; caps: readonly number[] };

export function faseDe(capitulo: number): Fase {
  return (
    FASES.find((f) => (f.caps as readonly number[]).includes(capitulo)) ?? {
      id: "outros",
      nome: "Outros",
      caps: [],
    }
  );
}

/** Agrupa itens por fase, na ordem da obra. */
export function agruparPorFase<T extends { capitulo_codigo: number; ordem: number }>(itens: T[]) {
  const ordem = [...FASES.map((f) => f.id), "outros"];
  const mapa = new Map<string, { fase: Fase; itens: T[] }>();
  for (const i of itens) {
    const f = faseDe(i.capitulo_codigo);
    const g = mapa.get(f.id) ?? { fase: f, itens: [] };
    g.itens.push(i);
    mapa.set(f.id, g);
  }
  return [...mapa.values()]
    .sort((a, b) => ordem.indexOf(a.fase.id) - ordem.indexOf(b.fase.id))
    .map((g) => ({
      ...g,
      itens: g.itens.sort((a, b) => a.capitulo_codigo - b.capitulo_codigo || a.ordem - b.ordem),
    }));
}
