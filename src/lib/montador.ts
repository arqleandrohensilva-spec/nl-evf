/**
 * Montador de propostas: transforma pedidos ("rem_piso", "parede até 1,75 m"…) em propostas de
 * adicionar / atualizar / tirar do Escopo, comparando com o que o ambiente já tem.
 * Usado pelo texto livre ("O que será feito") e pelas perguntas guiadas.
 */
import { SERVICO, type Base } from "@/lib/biblioteca";
import { tipoMedicao, type Ambiente, type Item, type Medicao } from "@/lib/calc";
import { geometria, itemEh, normaliza } from "@/lib/sugestoes";
import type { Interpretacao, Proposta } from "@/lib/interpretar";

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => r2(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Serviços que pertencem à obra toda, não a um ambiente. */
export const OBRA_TODA = new Set([
  "gestao_mensal",
  "seguro_obra",
  "rrt",
  "aprovacao_condominio",
  "cacamba",
  "protecao_piso",
  "limpeza_final",
  "material_limpeza",
  "impressao_projetos",
  "isolamento_area",
  "frete",
]);

export function criarMontador(amb: Ambiente | null, medicoes: Medicao[], itens: Item[]) {
  const geo = amb ? geometria(amb, medicoes) : null;
  const pd = n(amb?.pe_direito);
  const meds = amb ? medicoes.filter((m) => m.ambiente_id === amb.id) : [];
  const jaNoEscopo: string[] = [];

  // Parede revestida até H: perímetro × H, descontando portas inteiras e a parte das janelas abaixo de H.
  function paredeAte(H: number | null) {
    if (!geo) return { qtd: 0, base: null as Base | null, portas: 0 };
    let portas = 0;
    for (const m of meds)
      if (tipoMedicao(m) === "vao" && n(m.altura) >= 1.8) portas += n(m.largura) * n(m.quantidade);
    if (!H || H >= pd - 0.01) return { qtd: geo.paredes, base: "paredes" as Base, portas };
    let area = geo.perimetro * H;
    for (const m of meds) {
      const l = n(m.largura),
        h = n(m.altura),
        q = n(m.quantidade);
      const t = tipoMedicao(m);
      if (t === "vao_area") area -= l * q * Math.min(1, H / (pd || H));
      else if (t === "vao") {
        if (/total/.test(normaliza(m.descricao ?? "")))
          area -= l * h * q * Math.min(1, H / (pd || H));
        else if (h >= 1.8) area -= l * Math.min(H, h) * q;
        else area -= l * Math.max(0, Math.min(H, 2.1) - (2.1 - h)) * q; // janela com topo a 2,10 m
      } else if (t === "shaft_parede") area += 2 * n(m.profundidade) * Math.min(H, h || pd) * q;
    }
    return { qtd: Math.max(0, area), base: null as Base | null, portas };
  }

  const props = new Map<string, Proposta>();
  const especificas = new Set<string>();
  let seq = 0;

  function propor(
    chave: string,
    trecho: string,
    motivo: string,
    o: { qtd?: number | null; base?: Base | null; desc?: string; especifico?: boolean } = {},
  ) {
    if (props.has(chave)) return;
    const s = SERVICO[chave];
    if (!s) return;
    const obraToda = OBRA_TODA.has(chave) && amb != null;
    if (obraToda) o = { ...o, base: null };
    const ambBase = s.base && s.base !== "manual" && s.base !== "item" ? s.base : null;
    let base: Base | null = o.base !== undefined ? o.base : amb ? ambBase : null;
    if (!geo) base = null;
    const fator = base && base === ambBase ? (s.fator ?? 1) : 1;
    const qtd =
      o.qtd != null
        ? o.qtd
        : base && geo
          ? geo[base as Exclude<Base, "manual" | "item">] * fator
          : (s.qtd ?? 1);
    const desc = o.desc ?? (amb && ambBase ? `${s.desc} – ${amb.nome}` : s.desc);
    props.set(chave, {
      id: `p${++seq}`,
      acao: "adicionar",
      chave,
      itemId: null,
      descricao: desc,
      unidade: s.un,
      capitulo: s.cap,
      quantidade: r2(qtd),
      base_qtd: base,
      fator,
      perda: s.perda ?? 0,
      tipo: s.tipo,
      mo: s.mo ?? 0,
      trecho,
      motivo,
    });
    if (obraToda) props.get(chave)!.obraToda = true;
    if (o.especifico) especificas.add(chave);
  }

  const remover: Proposta[] = [];
  function tirarDoEscopo(chaves: string[], trecho: string, motivo: string) {
    for (const i of itens) {
      if ((i.ambiente_id ?? null) !== (amb?.id ?? null)) continue;
      if (!chaves.some((c) => itemEh(i, c))) continue;
      if (remover.some((r) => r.itemId === i.id)) continue;
      remover.push({
        id: `p${++seq}`,
        acao: "remover",
        chave: i.chave,
        itemId: i.id,
        descricao: i.descricao,
        unidade: i.unidade,
        capitulo: i.capitulo_codigo,
        quantidade: n(i.quantidade),
        base_qtd: null,
        fator: 1,
        perda: 0,
        tipo: i.tipo_preco,
        mo: 0,
        antes: `${i.codigo} · ${fmt(n(i.quantidade))} ${i.unidade}`,
        trecho,
        motivo,
      });
    }
  }

  function fechar(avisos: string[], naoEntendi: string[]): Interpretacao {
    // Compara com o que já está no escopo do ambiente.
    const out: Proposta[] = [];
    for (const p of props.values()) {
      const alvoId = p.obraToda ? null : (amb?.id ?? null);
      const ex = itens.find(
        (i) => (i.ambiente_id ?? null) === alvoId && p.chave && itemEh(i, p.chave),
      );
      if (!ex) {
        out.push(p);
        continue;
      }
      const mudouQtd =
        Math.abs(n(ex.quantidade) - p.quantidade) > Math.max(0.01, p.quantidade * 0.01);
      if (
        p.chave &&
        especificas.has(p.chave) &&
        (mudouQtd || normaliza(ex.descricao) !== normaliza(p.descricao))
      ) {
        out.push({
          ...p,
          acao: "atualizar",
          itemId: ex.id,
          antes: `${ex.codigo} ${ex.descricao} · ${fmt(n(ex.quantidade))} ${ex.unidade}`,
        });
      } else jaNoEscopo.push(`${ex.codigo} ${ex.descricao}`);
    }
    // Não tira o que o próprio texto pediu.
    const pedidas = new Set(out.map((p) => p.chave));
    return {
      propostas: [...out, ...remover.filter((r) => !r.chave || !pedidas.has(r.chave))],
      jaNoEscopo,
      naoEntendi,
      avisos,
    };
  }

  return { geo, pd, paredeAte, propor, tirarDoEscopo, props, especificas, remover, fechar };
}
