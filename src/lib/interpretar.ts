/**
 * Lê o "O que será feito" escrito pelo arquiteto (português do dia a dia) e propõe serviços para o
 * ambiente: o que adicionar, o que atualizar (ex.: altura do revestimento) e o que tirar do escopo
 * (ex.: "manter o forro"). Tudo por regras locais e transparentes: cada proposta guarda o trecho do
 * texto que a originou, e o que não foi reconhecido volta como "não entendi".
 */
import { SERVICO, type Base } from "@/lib/biblioteca";
import { tipoMedicao, type Ambiente, type Item, type Medicao } from "@/lib/calc";
import { geometria, itemEh, normaliza } from "@/lib/sugestoes";

export type Acao = "adicionar" | "atualizar" | "remover";

export interface Proposta {
  id: string;
  acao: Acao;
  chave: string | null;
  itemId: string | null;
  descricao: string;
  unidade: string;
  capitulo: number;
  quantidade: number;
  base_qtd: Base | null;
  fator: number;
  perda: number;
  tipo: string;
  mo: number;
  /** Como está hoje (atualizar/remover). */
  antes?: string;
  trecho: string;
  motivo: string;
  /** Serviço da obra toda (vai para Itens gerais mesmo quando escrito num ambiente). */
  obraToda?: boolean;
}

/** Serviços que pertencem à obra toda, não a um ambiente. */
const OBRA_TODA = new Set([
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

export interface Interpretacao {
  propostas: Proposta[];
  jaNoEscopo: string[];
  naoEntendi: string[];
  avisos: string[];
}

type Sup = "piso" | "parede" | "teto";

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => r2(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const NUM_PALAVRA: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

const RE = {
  negacao:
    /\b(manter|mantem|mantido|mantida|mantidos|mantidas|permanece|permanecem|aproveitar|reaproveitar|preservar|nao (mexer|mexe|vai|vamos|trocar|precisa)|sem (mexer|trocar)|continua|fica(m)? como esta)\b/,
  remover:
    /\b(tirar|tira|retirar|retira|remover|remove|remocao|arrancar|demolir|demolicao|quebrar|retirada|descascar)\b/,
  piso: /\b(piso|pisos|chao|contrapiso)\b/,
  parede: /\b(parede|paredes|azulejo|azulejos)\b/,
  teto: /\b(teto|forro|laje)\b/,
  alvo: /\b(?:na|nas|no|nos|em|para a|para o|pra)\s+(parede|paredes|piso|chao|teto|forro)\b/g,
  nivelar: /\b(plano|plana|nivelad[oa]|nivelar|regulariz\w*|contrapiso|caimento|desnivel)\b/,
  rebocar: /\b(regulariz\w*|prumo|reboco|rebocar|emboco|massa grossa)\b/,
  lixar: /\b(lixar|lixa|lixamento|apicoar|apicoamento|chapisc\w*|escarificar)\b/,
  imperm: /\bimpermeabiliz\w*/,
  revestir:
    /\b(revestimento|revestir|porcelanato|ceramica|azulejo|pastilha|assentar|granilite|vinilico|laminado|piso novo|novo piso)\b/,
  novo: /\b(nov[oa]s?|colocar|coloca|assentar|aplicar|instalar|trocar|troca|substituir|mesmo|mesma|revestir|ate)\b/,
  pintar: /\b(pint\w*|textura|emass\w*|massa corrida|grafiato)\b/,
  forroNovo:
    /\b(forro novo|novo forro|trocar o forro|troca do forro|rebaix\w*|fazer (o )?forro|forro de (drywall|gesso))\b/,
  ralo: /\bralos?\b/,
  raloAcao: /\b(arrumar|trocar|ajustar|adequar|consertar|mudar|novo|refazer|nivel|corrigir)\b/,
  loucas: /\b(loucas?|vasos?|bacias?|cubas?|pias?)\b/,
  metais: /\b(metais|torneiras?|misturador|registros?|ducha|chuveiro)\b/,
  tomada: /\btomadas?\b/,
  interruptor: /\binterruptor(es)?\b/,
  iluminacao: /\b(iluminacao|luminarias?|spots?|lampadas?|plafon|plafons|pendentes?)\b/,
  pontoLuz: /\b(novos? pontos?|ponto de luz|pontos de luz|ponto de iluminacao)\b/,
  fitaLed: /\bfita( de)? led\b/,
  exaustor: /\b(exaustor|ventilacao mecanica)\b/,
  sensor: /\bsensor\b/,
  aguaFria: /\b(ponto de agua|agua fria)\b/,
  aguaQuente: /\bagua quente\b/,
  esgoto: /\b(ponto de esgoto|esgoto)\b/,
  baseRegistro: /\b(base (do|de|dos|das) registros?|trocar (o |os )?registros?)\b/,
  rasgos: /\brasgos?\b/,
  estanqueidade: /\bestanqueidade\b/,
  rejunte: /\brejuntes?\b/,
  mictorio: /\bmictorios?\b/,
  entulho: /\b(entulho|ensac\w*)\b/,
  isolamento: /\b(isolamento|isolar|tapume|fechamento provisorio)\b/,
  sinalizacao: /\bsinaliza\w*/,
  frete: /\bfretes?\b/,
  impressao: /\bimpress\w*/,
  ajustePorta: /\b(ajust\w*|revis\w*|regul\w*|aparar|consert\w*)\b/,
  bancada: /\b(bancada|bancadas|tampo|granito|marmore|quartzo)\b/,
  nicho: /\bnichos?\b/,
  soleira: /\bsoleiras?\b/,
  espelho: /\bespelhos?\b/,
  box: /\bbox\b/,
  porta: /\bportas?\b/,
  janela: /\bjanelas?\b/,
  divisoria: /\b(divisori\w*|cabines?)\b/,
  pcd: /\b(pcd|acessivel|acessibilidade|barras? de apoio)\b/,
  rodape: /\brodapes?\b/,
  marcenaria: /\b(armario|armarios|marcenaria|gabinete)\b/,
  dispensers: /\b(dispensers?|saboneteira|papeleira|toalheiro|porta[- ]papel)\b/,
  lixeira: /\blixeiras?\b/,
  cacamba: /\bcacambas?\b/,
  protecao: /\b(proteger|protecao|salva[- ]?piso)\b/,
  limpeza: /\blimpeza\b/,
  gestao: /\b(gestao|administracao|gerenciamento)\b/,
  seguro: /\bseguro\b/,
  rrt: /\b(rrt|art)\b/,
  condominio: /\b(condominio|plano de reforma|sindico)\b/,
  andaime: /\bandaimes?\b/,
  demolirParede: /\b(demolir|derrubar|quebrar|abrir)\s+(a |uma |essa |esta )?parede\b/,
};

/** Vocabulário que o interpretador conhece; palavras digitadas com 1 ou 2 letras trocadas são corrigidas. */
const VOCAB = [
  "piso",
  "pisos",
  "parede",
  "paredes",
  "teto",
  "forro",
  "contrapiso",
  "azulejo",
  "azulejos",
  "impermeabilizar",
  "impermeabilizacao",
  "revestimento",
  "revestir",
  "porcelanato",
  "ceramica",
  "regularizar",
  "regularizacao",
  "nivelar",
  "nivelado",
  "pintar",
  "pintura",
  "textura",
  "chapisco",
  "lixar",
  "lixamento",
  "remover",
  "retirar",
  "demolir",
  "manter",
  "loucas",
  "metais",
  "torneira",
  "tomada",
  "tomadas",
  "interruptor",
  "luminaria",
  "luminarias",
  "iluminacao",
  "espelho",
  "bancada",
  "divisoria",
  "exaustor",
  "cacamba",
  "entulho",
  "rodape",
  "soleira",
  "caimento",
  "chuveiro",
];
const VOCAB_SET = new Set(VOCAB);

/** Distância de edição com transposição (psio → piso = 1). */
function distancia(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  return d[a.length]![b.length]!;
}

/** Corrige erros de digitação nas palavras-chave ("impermebilizar", "psio", "aprede"). */
export function corrigir(textoNormalizado: string) {
  return textoNormalizado.replace(/[a-z]{4,}/g, (w) => {
    if (VOCAB_SET.has(w)) return w;
    if (/^imper/.test(w)) return w.endsWith("cao") ? "impermeabilizacao" : "impermeabilizar";
    const limite = w.length >= 8 ? 2 : 1;
    let melhor = w;
    let menor = limite + 1;
    for (const v of VOCAB) {
      if (Math.abs(v.length - w.length) > limite) continue;
      const dd = distancia(w, v);
      if (dd < menor) {
        menor = dd;
        melhor = v;
      }
    }
    return menor <= limite ? melhor : w;
  });
}

function quantidadeNoTexto(f: string, nome: string): number | null {
  const re = new RegExp(
    `\\b(\\d+|${Object.keys(NUM_PALAVRA).join("|")})\\s+(?:nov[oa]s?\\s+)?(?:${nome})`,
  );
  const m = f.match(re);
  if (!m?.[1]) return null;
  const v = NUM_PALAVRA[m[1]] ?? Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function alturaNoTexto(f: string, pd: number): { h: number | null; aviso?: string } {
  if (
    /\b(ate o teto|parede inteira|toda a parede|paredes inteiras|do piso ao teto|altura total)\b/.test(
      f,
    )
  )
    return { h: pd || null };
  const m =
    f.match(/\bate\s+(?:a\s+)?(?:altura\s+de\s+)?(\d+(?:[.,]\d+)?)\s*(cm|m)?\b/) ??
    f.match(/\b(\d+(?:[.,]\d+)?)\s*(cm|m)\s+de\s+altura\b/);
  if (m?.[1]) {
    let v = Number(m[1].replace(",", "."));
    if (m[2] === "cm" || v > 10) v = v / 100;
    if (v > 0.1 && v < 6) return { h: v };
  }
  if (/\b(meia altura|meia parede)\b/.test(f))
    return {
      h: 1.2,
      aviso: "“Meia altura” entrou como 1,20 m. Se for outra, escreva “até 1,50 m”, por exemplo.",
    };
  if (/\b(certa altura|uma altura|alguma altura)\b/.test(f))
    return {
      h: null,
      aviso: "Faltou a altura do revestimento na parede: escreva, por exemplo, “até 1,75 m”.",
    };
  return { h: null };
}

function superficies(f: string): Sup[] {
  const out: Sup[] = [];
  if (RE.piso.test(f)) out.push("piso");
  if (RE.parede.test(f)) out.push("parede");
  if (RE.teto.test(f)) out.push("teto");
  return out;
}

/** Superfície-alvo: a que vem depois de "na/no/em" ganha ("mesmo revestimento do piso NA parede"). */
function alvos(f: string, fallback: Sup[]): Sup[] {
  const preferidas = new Set<Sup>();
  for (const m of f.matchAll(RE.alvo)) {
    const w = m[1] ?? "";
    preferidas.add(/parede/.test(w) ? "parede" : /piso|chao/.test(w) ? "piso" : "teto");
  }
  if (preferidas.size) return [...preferidas];
  const s = superficies(f);
  return s.length ? s : fallback;
}

export function interpretar(
  texto: string,
  amb: Ambiente | null,
  medicoes: Medicao[],
  itens: Item[],
): Interpretacao {
  const avisos: string[] = [];
  const naoEntendi: string[] = [];
  const jaNoEscopo: string[] = [];
  const geo = amb ? geometria(amb, medicoes) : null;
  const pd = n(amb?.pe_direito);
  const meds = amb ? medicoes.filter((m) => m.ambiente_id === amb.id) : [];
  const nomeAmb = normaliza(amb?.nome ?? "");
  const cozinha = /cozinha|copa|gourmet|churrasq/.test(nomeAmb);
  const textoTodo = corrigir(normaliza(texto));

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
      if (t === "vao") {
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

  let alturaParede: number | null = null;
  let supAnterior: Sup[] = [];
  // O que a frase anterior pediu, para "o mesmo da parede" repetir na parede.
  let anterior = { removeu: false, nivelou: false };
  const frases = texto
    .split(/[\n.;!?]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  for (const frase of frases) {
    const f = corrigir(normaliza(frase));
    const clausulas = f
      .split(/,|\bmas\b|\bporem\b/)
      .map((c) => c.trim())
      .filter(Boolean);
    const neg = clausulas.filter((c) => RE.negacao.test(c));
    const ativo = clausulas.filter((c) => !RE.negacao.test(c)).join(" , ");
    const supFrase = superficies(f);
    const sups = superficies(ativo).length
      ? superficies(ativo)
      : supFrase.length
        ? supFrase
        : supAnterior;
    if (supFrase.length) supAnterior = supFrase;
    const alt = alturaNoTexto(f, pd);
    if (alt.aviso && !avisos.includes(alt.aviso)) avisos.push(alt.aviso);
    if (alt.h) alturaParede = alt.h;
    const H = alt.h ?? alturaParede;
    const antes = props.size + remover.length;
    let reconheceu = false;
    const ok = () => (reconheceu = true);

    // "manter o forro", "não mexer no piso"…
    for (const c of neg) {
      const s = superficies(c);
      if (s.includes("teto"))
        tirarDoEscopo(
          ["rem_forro", "forro_drywall", "forro_gesso"],
          frase,
          "Você escreveu que o forro fica.",
        );
      if (s.includes("piso"))
        tirarDoEscopo(
          ["rem_piso", "piso", "regularizacao_contrapiso"],
          frase,
          "Você escreveu que o piso fica.",
        );
      if (s.includes("parede"))
        tirarDoEscopo(["rem_parede", "parede_rev"], frase, "Você escreveu que a parede fica.");
      if (RE.loucas.test(c))
        tirarDoEscopo(["rem_loucas", "vaso", "cuba"], frase, "Você escreveu que as louças ficam.");
      if (RE.bancada.test(c))
        tirarDoEscopo(
          ["rem_bancada", "bancada_banheiro", "bancada_cozinha"],
          frase,
          "Você escreveu que a bancada fica.",
        );
      if (RE.box.test(c)) tirarDoEscopo(["rem_box", "box"], frase, "Você escreveu que o box fica.");
      if (RE.porta.test(c))
        tirarDoEscopo(
          ["rem_esquadria", "porta_interna", "porta_acessivel"],
          frase,
          "Você escreveu que a porta fica.",
        );
      ok();
    }

    const mesmoNaParede = /\bo mesm[oa] (da|na|nas|das|para a|pra|com a) paredes?\b/.test(ativo);
    if (mesmoNaParede) {
      ok();
      if (anterior.removeu) {
        const p = paredeAte(H);
        propor(
          "rem_parede",
          frase,
          "“O mesmo da parede”: tirar o revestimento existente, como no piso.",
          {
            qtd: p.qtd,
            base: p.base,
            ...(H && H < pd
              ? {
                  desc: `Remoção do revestimento existente da parede até ${fmt(H)} m (confira a altura do azulejo atual)${amb ? ` – ${amb.nome}` : ""}`,
                  especifico: true,
                }
              : {}),
          },
        );
      }
      if (anterior.nivelou)
        propor(
          "regularizacao_reboco",
          frase,
          "“O mesmo da parede”: deixar a parede plana, como o piso.",
        );
    }
    const agora = { removeu: RE.remover.test(ativo), nivelou: RE.nivelar.test(ativo) };

    if (ativo) {
      const alvo = alvos(ativo, sups);
      const removeu = RE.remover.test(ativo);
      // Frase só de retirada ("retirada de louças, torneira e espelho") não pede itens novos.
      const soRemocao = removeu && !RE.novo.test(ativo);

      if (removeu) {
        ok();
        if (RE.demolirParede.test(ativo)) {
          propor("demol_alvenaria", frase, "Demolição de parede: informe a área em m².", {
            qtd: 0,
          });
          avisos.push(
            "Demolição de parede entrou com quantidade 0: informe a área (comprimento × altura).",
          );
        }
        const supsRemover = superficies(ativo);
        if (supsRemover.includes("piso")) propor("rem_piso", frase, "Tirar o piso existente.");
        if (supsRemover.includes("parede") && !RE.demolirParede.test(ativo)) {
          const p = H && H < pd ? paredeAte(H) : paredeAte(null);
          propor("rem_parede", frase, "Tirar o revestimento existente da parede.", {
            ...(H && H < pd
              ? {
                  qtd: p.qtd,
                  base: null,
                  desc: `Remoção do revestimento de parede até ${fmt(H)} m – ${amb?.nome ?? ""}`.trim(),
                  especifico: true,
                }
              : {}),
          });
        }
        if (supsRemover.includes("teto")) propor("rem_forro", frase, "Tirar o forro existente.");
        if (RE.loucas.test(ativo)) propor("rem_loucas", frase, "Tirar louças e metais existentes.");
        if (RE.bancada.test(ativo)) propor("rem_bancada", frase, "Tirar a bancada existente.");
        if (RE.box.test(ativo)) propor("rem_box", frase, "Tirar o box existente.");
        if (RE.marcenaria.test(ativo))
          propor("rem_marcenaria", frase, "Tirar a marcenaria existente.");
        if (RE.porta.test(ativo) || RE.janela.test(ativo))
          propor("rem_esquadria", frase, "Tirar a esquadria existente.");
      }

      if (RE.nivelar.test(ativo) && (alvo.includes("piso") || !superficies(ativo).length)) {
        ok();
        propor("regularizacao_contrapiso", frase, "Deixar o piso plano antes do revestimento.", {
          desc: `Regularização de contrapiso${RE.ralo.test(textoTodo) ? ", nivelado e com caimento para o ralo" : ""}${amb ? ` – ${amb.nome}` : ""}`,
        });
      }
      if (RE.rebocar.test(ativo) && alvo.includes("parede")) {
        ok();
        propor("regularizacao_reboco", frase, "Acertar prumo e plano da parede.");
      }
      if (RE.lixar.test(ativo)) {
        ok();
        const p = paredeAte(H);
        propor("lixamento_parede", frase, "Preparar a parede para o revestimento aderir.", {
          qtd: p.qtd,
          base: p.base,
          ...(H && H < pd
            ? {
                desc: `Lixamento/apicoamento e chapisco da parede até ${fmt(H)} m – ${amb?.nome ?? ""}`.trim(),
                especifico: true,
              }
            : {}),
        });
      }
      if (RE.imperm.test(ativo)) {
        ok();
        const naParede = alvo.includes("parede");
        const noPiso = alvo.includes("piso") || !naParede;
        if (noPiso) {
          propor("imperm_piso", frase, "Impermeabilizar o piso.");
          propor(
            "teste_estanqueidade",
            frase,
            "Toda impermeabilização passa por teste de estanqueidade.",
          );
        }
        if (naParede) {
          const Hi = H ?? 1.8;
          const p = paredeAte(Hi);
          propor(
            "imperm_parede",
            frase,
            H
              ? `Impermeabilizar a parede até ${fmt(Hi)} m.`
              : "Impermeabilizar a parede (altura padrão 1,80 m).",
            {
              qtd: p.qtd,
              base: p.base,
              desc: `Impermeabilização de parede até ${fmt(Hi)} m, argamassa semiflexível${amb ? ` – ${amb.nome}` : ""}`,
              especifico: true,
            },
          );
          propor("regularizacao_reboco", frase, "A impermeabilização pede a parede regularizada.", {
            qtd: p.qtd,
            base: p.base,
            ...(p.base
              ? {}
              : {
                  desc: `Regularização de reboco na faixa impermeabilizada, até ${fmt(Hi)} m${amb ? ` – ${amb.nome}` : ""}`,
                  especifico: true,
                }),
          });
        }
      }
      const pedeRevestir = RE.revestir.test(ativo) && (!removeu || RE.novo.test(ativo));
      if (pedeRevestir) {
        ok();
        const mesmo = /\bmesm[oa] (revestimento|porcelanato|piso|ceramica)\b/.test(ativo)
          ? ", mesmo revestimento do piso"
          : "";
        const alvoRev = alvo.length ? alvo : ["piso" as Sup];
        if (alvoRev.includes("piso")) propor("piso", frase, "Piso novo.");
        if (alvoRev.includes("parede")) {
          const p = paredeAte(H);
          propor(
            "parede_rev",
            frase,
            H && H < pd
              ? `Revestimento na parede até ${fmt(H)} m.`
              : "Revestimento na parede inteira.",
            {
              qtd: p.qtd,
              base: p.base,
              desc: `Revestimento de parede${H && H < pd ? ` até ${fmt(H)} m` : ""}${mesmo}${amb ? ` – ${amb.nome}` : ""}`,
              especifico: Boolean(H),
            },
          );
          if (H && H < pd && geo) {
            propor(
              "perfil_revestimento",
              frase,
              "O revestimento para no meio da parede: precisa de acabamento no topo.",
              {
                qtd: Math.max(0, geo.perimetro - p.portas),
                base: null,
                desc: `Acabamento do topo do revestimento a ${fmt(H)} m (perfil/cantoneira)`,
                especifico: true,
              },
            );
            propor("pint_parede", frase, `Acima de ${fmt(H)} m a parede fica pintada.`, {
              qtd: Math.max(0, geo.paredes - p.qtd),
              base: null,
              desc: `Lixamento, emassamento e pintura de parede acima do revestimento (${fmt(H)} a ${fmt(pd)} m)`,
              especifico: true,
            });
          }
        }
      }
      if (RE.pintar.test(ativo)) {
        ok();
        const alvoP = alvos(ativo, supFrase.length ? supFrase : ["parede", "teto"]);
        if (alvoP.includes("teto")) propor("pint_teto", frase, "Pintar o teto.");
        if (alvoP.includes("parede")) propor("pint_parede", frase, "Pintar as paredes.");
      }
      if (RE.forroNovo.test(ativo)) {
        ok();
        propor(/gesso/.test(ativo) ? "forro_gesso" : "forro_drywall", frase, "Forro novo.");
        if (/\btroc/.test(ativo)) propor("rem_forro", frase, "Trocar o forro: tirar o existente.");
      }
      if (RE.ralo.test(ativo) && !soRemocao) {
        ok();
        if (RE.raloAcao.test(ativo) || /arrum/.test(ativo))
          propor("adequacao_ralo", frase, "Arrumar o ralo e acertar ao nível do piso novo.");
        propor("ralo", frase, "Grelha nova do ralo.", { desc: "Ralo (grelha nova)" });
      }
      if (RE.loucas.test(ativo) && !(removeu && !RE.novo.test(ativo))) {
        ok();
        if (cozinha)
          propor("cuba_cozinha", frase, "Cuba nova.", {
            qtd: quantidadeNoTexto(ativo, "cubas?|pias?"),
          });
        else {
          if (/\b(loucas?|vasos?|bacias?)\b/.test(ativo))
            propor(RE.pcd.test(ativo) ? "bacia_pcd" : "vaso", frase, "Louça nova.", {
              qtd: quantidadeNoTexto(ativo, "vasos?|bacias?"),
            });
          if (/\b(loucas?|cubas?|pias?)\b/.test(ativo)) {
            propor("cuba", frase, "Cuba nova.", { qtd: quantidadeNoTexto(ativo, "cubas?|pias?") });
            propor("sifao", frase, "Cuba nova pede sifão.", {
              qtd: quantidadeNoTexto(ativo, "cubas?|pias?"),
            });
          }
        }
        if (/\b(nov[oa]s?|trocar|substituir)\b/.test(ativo))
          propor("rem_loucas", frase, "Louças novas: tirar as existentes.");
      }
      if (RE.metais.test(ativo) && !soRemocao) {
        ok();
        if (/torneira|misturador|metais/.test(ativo))
          propor(
            cozinha
              ? "torneira_cozinha"
              : /automatic|temporizad/.test(ativo)
                ? "torneira_temporizada"
                : "torneira",
            frase,
            "Metais novos.",
            {
              qtd: quantidadeNoTexto(ativo, "torneiras?"),
            },
          );
        if (/registro|metais/.test(ativo) && !RE.baseRegistro.test(ativo))
          propor("acab_registro", frase, "Acabamento de registro novo.");
        if (/ducha/.test(ativo)) propor("ducha", frase, "Ducha higiênica.");
        if (/chuveiro/.test(ativo)) propor("chuveiro", frase, "Chuveiro.");
      }
      if (RE.baseRegistro.test(ativo)) {
        ok();
        propor("troca_registro", frase, "Trocar a base do registro.");
      }
      if (RE.tomada.test(ativo) && !soRemocao) {
        ok();
        propor("ponto_tomada", frase, "Tomada nova.", {
          qtd: quantidadeNoTexto(ativo, "tomadas?"),
        });
      }
      if (RE.interruptor.test(ativo) && !soRemocao) {
        ok();
        propor("ponto_interruptor", frase, "Interruptor novo.", {
          qtd: quantidadeNoTexto(ativo, "interruptor(?:es)?"),
        });
      }
      if (RE.fitaLed.test(ativo) && !soRemocao) {
        ok();
        propor("fita_led", frase, "Fita de LED.");
      } else if (RE.iluminacao.test(ativo) && !soRemocao) {
        ok();
        const q = quantidadeNoTexto(ativo, "luminarias?|spots?|lampadas?|pendentes?|plafons?");
        propor("luminaria", frase, "Iluminação nova.", { qtd: q });
        if (RE.pontoLuz.test(ativo))
          propor("ponto_iluminacao", frase, "Ponto de luz novo.", { qtd: q });
      }
      if (RE.exaustor.test(ativo)) {
        ok();
        propor("exaustor", frase, "Exaustor.");
      }
      if (RE.sensor.test(ativo)) {
        ok();
        propor("sensor_presenca", frase, "Sensor de presença.");
      }
      if (RE.aguaQuente.test(ativo)) {
        ok();
        propor("ponto_agua_quente", frase, "Ponto de água quente.");
      } else if (RE.aguaFria.test(ativo)) {
        ok();
        propor("ponto_agua_fria", frase, "Ponto de água.");
      }
      if (RE.esgoto.test(ativo)) {
        ok();
        propor("ponto_esgoto", frase, "Ponto de esgoto.");
      }
      if (RE.bancada.test(ativo) && !(removeu && !RE.novo.test(ativo))) {
        ok();
        propor(cozinha ? "bancada_cozinha" : "bancada_banheiro", frase, "Bancada nova.");
      }
      if (RE.nicho.test(ativo) && !soRemocao) {
        ok();
        propor("nicho", frase, "Nicho.");
      }
      if (RE.soleira.test(ativo) && !soRemocao) {
        ok();
        propor("soleira", frase, "Soleira.");
      }
      if (RE.espelho.test(ativo) && !soRemocao) {
        ok();
        propor("espelho", frase, "Espelho.", { qtd: quantidadeNoTexto(ativo, "espelhos?") });
      }
      if (RE.box.test(ativo) && !(removeu && !RE.novo.test(ativo))) {
        ok();
        propor("box", frase, "Box novo.");
      }
      if (RE.porta.test(ativo) && RE.ajustePorta.test(ativo) && !/\bporta nova\b/.test(ativo)) {
        ok();
        propor("ajuste_porta", frase, "A porta fica: ajustar ao piso novo e revisar ferragens.");
      } else if (
        RE.porta.test(ativo) &&
        (RE.pcd.test(ativo) ||
          /\b(porta nova|nova porta|portas novas|trocar (a |as )?portas?|troca da porta|substituir (a )?porta|instalar (a |uma )?porta|colocar (a |uma )?porta)\b/.test(
            ativo,
          ))
      ) {
        ok();
        propor(RE.pcd.test(ativo) ? "porta_acessivel" : "porta_interna", frase, "Porta nova.", {
          qtd: quantidadeNoTexto(ativo, "portas?"),
        });
      }
      if (RE.janela.test(ativo) && !(removeu && !RE.novo.test(ativo))) {
        ok();
        propor("janela", frase, "Janela nova: informe a área em m².", { qtd: 0 });
      }
      if (RE.divisoria.test(ativo)) {
        ok();
        propor("divisoria_cabine", frase, "Divisórias de cabine.", {
          qtd: quantidadeNoTexto(ativo, "divisori\\w*|cabines?"),
        });
      }
      if (RE.pcd.test(ativo)) {
        ok();
        propor("barras_apoio", frase, "Acessibilidade: barras de apoio (NBR 9050).", {
          qtd: quantidadeNoTexto(ativo, "barras?") ?? 3,
        });
      }
      if (RE.rodape.test(ativo)) {
        ok();
        propor("rodape", frase, "Rodapé.");
      }
      if (RE.marcenaria.test(ativo) && !(removeu && !RE.novo.test(ativo))) {
        ok();
        propor(
          cozinha
            ? "armario_cozinha"
            : /quarto|closet|dormit/.test(nomeAmb)
              ? "armario_quarto"
              : "armario_banheiro",
          frase,
          "Marcenaria.",
        );
      }
      if (RE.dispensers.test(ativo) && !soRemocao) {
        ok();
        propor("dispensers", frase, "Dispensers / acessórios.");
      }
      if (RE.lixeira.test(ativo) && !soRemocao) {
        ok();
        propor("lixeira", frase, "Lixeira.");
      }
      if (RE.rasgos.test(ativo)) {
        ok();
        propor("fechamento_rasgos", frase, "Fechar os rasgos das instalações antes do reboco.");
      }
      if (RE.estanqueidade.test(ativo)) {
        ok();
        propor("teste_estanqueidade", frase, "Teste de estanqueidade antes do revestimento.");
      }
      if (RE.rejunte.test(ativo)) {
        ok();
        if (/epox/.test(ativo) && geo) {
          const parede = alturaParede ? paredeAte(alturaParede).qtd : 0;
          propor("rejunte_epoxi", frase, "Rejunte epóxi no piso e na parede revestida.", {
            qtd: geo.piso + parede,
            base: null,
          });
        }
      }
      if (RE.mictorio.test(ativo)) {
        ok();
        propor("mictorio", frase, "Mictório.", { qtd: quantidadeNoTexto(ativo, "mictorios?") });
      }
      if (RE.entulho.test(ativo)) {
        ok();
        propor(
          "transporte_entulho",
          frase,
          "A caçamba não inclui ensacar e levar o entulho até ela.",
        );
      }
      if (RE.isolamento.test(ativo)) {
        ok();
        propor("isolamento_area", frase, "Isolar a área em obra (área comum com circulação).");
      }
      if (RE.sinalizacao.test(ativo) && !RE.isolamento.test(ativo)) {
        ok();
        propor("isolamento_area", frase, "Sinalizar a área em obra.");
      }
      if (RE.impressao.test(ativo)) {
        ok();
        propor("impressao_projetos", frase, "Impressão de projetos para a equipe.");
      }
      if (RE.frete.test(ativo)) {
        ok();
        propor("frete", frase, "Fretes de material.");
      }
      if (RE.cacamba.test(ativo)) {
        ok();
        propor("cacamba", frase, "Caçamba para o entulho.", { base: null });
      }
      if (RE.protecao.test(ativo)) {
        ok();
        propor("protecao_piso", frase, "Proteção dos pisos e acessos.", { base: null });
      }
      if (RE.limpeza.test(ativo)) {
        ok();
        propor("limpeza_final", frase, "Limpeza pós-obra.");
      }
      if (RE.gestao.test(ativo)) {
        ok();
        const meses = f.match(/(\d+)\s*mes(es)?/);
        propor("gestao_mensal", frase, "Gestão da obra.", {
          qtd: meses?.[1] ? Number(meses[1]) : null,
        });
      }
      if (RE.seguro.test(ativo)) {
        ok();
        propor("seguro_obra", frase, "Seguro de obra.");
      }
      if (RE.rrt.test(ativo)) {
        ok();
        propor("rrt", frase, "Responsabilidade técnica.");
      }
      if (RE.condominio.test(ativo)) {
        ok();
        propor("aprovacao_condominio", frase, "Plano de reforma no condomínio (NBR 16280).");
      }
      if (RE.andaime.test(ativo)) {
        ok();
        propor("andaime", frase, "Andaime.");
      }
    }
    if (!reconheceu && props.size + remover.length === antes) naoEntendi.push(frase);
    if (agora.removeu || agora.nivelou) anterior = agora;
  }

  // Serviços que dependem de medidas não fazem sentido sem ambiente.
  if (!amb) {
    for (const [k, p] of props) {
      const s = SERVICO[k];
      if (s?.base && s.base !== "manual" && s.base !== "item" && p.quantidade === 0) {
        avisos.push(
          `“${p.descricao}” precisa de um ambiente com medidas: escolha o ambiente para calcular.`,
        );
      }
    }
  }

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
