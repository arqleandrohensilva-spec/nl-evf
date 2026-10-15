/**
 * "Como se faz": sequência de execução e cuidados de cada serviço. Serve para conferir o escopo,
 * explicar ao cliente e orientar o empreiteiro (memorial do serviço).
 */
import type { Item } from "@/lib/calc";
import { itemEh } from "@/lib/sugestoes";

export interface ComoSeFaz {
  passos: string[];
  cuidados?: string[];
}

export const EXECUCAO: Record<string, ComoSeFaz> = {
  rem_piso: {
    passos: [
      "Proteger ralos e tubulações abertas.",
      "Retirar o revestimento e a argamassa antiga até a base (contrapiso ou laje).",
      "Conferir a base: ocos, trincas e umidade.",
      "Ensacar o entulho e levar para a caçamba.",
    ],
    cuidados: [
      "Em área molhada, avaliar a impermeabilização antiga: comprometida, refazer.",
      "Atenção a tubulações embutidas no contrapiso.",
    ],
  },
  rem_parede: {
    passos: [
      "Desligar circuitos e fechar registros da parede.",
      "Retirar o revestimento e a argamassa até o reboco ou a alvenaria.",
      "Conferir o reboco: partes soltas saem e são refeitas.",
    ],
  },
  rem_forro: {
    passos: [
      "Desligar os circuitos de iluminação.",
      "Retirar luminárias, placas e a estrutura do forro.",
      "Conferir as instalações acima do forro antes de fechar de novo.",
    ],
  },
  rem_loucas: {
    passos: [
      "Fechar os registros.",
      "Retirar louças, metais, acessórios e espelho.",
      "Tampar as saídas de esgoto e de água para não entrar entulho.",
    ],
  },
  lixamento_parede: {
    passos: [
      "Lixar ou apicoar a pintura para abrir os poros da base.",
      "Limpar o pó.",
      "Aplicar chapisco (cimento e areia 1:3) e aguardar 3 dias de cura.",
    ],
    cuidados: ["Revestimento cerâmico direto sobre pintura sem preparo descola."],
  },
  chapisco: {
    passos: [
      "Umedecer a alvenaria.",
      "Aplicar chapisco 1:3 com colher ou rolo.",
      "Aguardar 3 dias.",
    ],
  },
  emboco: {
    passos: [
      "Taliscas e mestras para garantir o prumo.",
      "Lançar a argamassa, sarrafear e desempenar.",
      "Cura: 7 dias antes do revestimento cerâmico, 28 dias antes da pintura.",
    ],
  },
  emboco_externo: {
    passos: [
      "Chapisco em toda a fachada.",
      "Taliscas, mestras e juntas de trabalho conforme o projeto.",
      "Lançar, sarrafear e desempenar; cura de 28 dias antes da pintura.",
    ],
  },
  regularizacao_reboco: {
    passos: [
      "Conferir prumo e planeza com régua de alumínio.",
      "Corrigir com argamassa em camada de até 2 cm.",
      "Cura de 7 dias (ideal 14) antes do revestimento.",
    ],
  },
  contrapiso: {
    passos: [
      "Base limpa e ponte de aderência.",
      "Marcar níveis e caimentos com taliscas.",
      "Lançar argamassa 1:4 com 3 a 5 cm de espessura, sarrafear e desempenar.",
      "Cura de 7 dias.",
    ],
  },
  regularizacao_contrapiso: {
    passos: [
      "Limpar e umedecer a base.",
      "Marcar níveis; em área molhada, caimento de cerca de 1% para o ralo.",
      "Lançar argamassa 1:4, sarrafear e desempenar.",
      "Cura de pelo menos 7 dias antes de impermeabilizar ou assentar.",
    ],
    cuidados: [
      "Espessura mínima de 2 cm; acima de 5 cm, avaliar enchimento leve.",
      "Conferir se a porta ainda abre com o piso mais alto.",
    ],
  },
  imperm_piso: {
    passos: [
      "Base regularizada, seca e limpa, com cantos arredondados (meia-cana).",
      "Reforçar ralos, cantos e tubos com tela de poliéster.",
      "Aplicar a argamassa polimérica em 3 demãos cruzadas, subindo 30 cm nas paredes (no box, até 1,80 m).",
      "Aguardar a cura indicada pelo fabricante.",
    ],
    cuidados: [
      "Fazer o teste de estanqueidade antes do revestimento.",
      "Não furar depois de impermeabilizado.",
    ],
  },
  imperm_parede: {
    passos: [
      "Reboco curado e regularizado.",
      "Tela de poliéster nos cantos e nas passagens de tubos.",
      "Demãos cruzadas até a altura definida.",
    ],
  },
  teste_estanqueidade: {
    passos: [
      "Tampar o ralo e formar lâmina d'água de 2 a 5 cm.",
      "Manter por 72 horas e conferir o ambiente de baixo e as paredes vizinhas.",
      "Sem vazamento, liberar o revestimento.",
    ],
  },
  piso: {
    passos: [
      "Base regularizada e curada (ou impermeabilização testada).",
      "Paginação: começar pela porta ou pelo centro e deixar os recortes nas bordas.",
      "Argamassa AC-III; dupla colagem em placas a partir de 60 × 60.",
      "Juntas do fabricante e sistema de nivelamento.",
      "Rejuntar depois de 72 h e limpar.",
    ],
    cuidados: [
      "Todas as placas do mesmo lote (tonalidade).",
      "Juntas de movimentação em áreas grandes e na transição entre ambientes.",
    ],
  },
  piso_externo: {
    passos: [
      "Base com caimento para escoar a água.",
      "Placa antiderrapante, AC-III e dupla colagem.",
      "Juntas de dilatação a cada 3 m aproximadamente.",
      "Rejunte próprio para área externa.",
    ],
  },
  parede_rev: {
    passos: [
      "Reboco curado e plano (ou impermeabilização pronta).",
      "Paginação a partir de uma linha nivelada.",
      "AC-III com desempenadeira dentada; dupla colagem em placas grandes.",
      "Rejuntar e limpar.",
    ],
    cuidados: [
      "Começar pela 2ª fiada com régua de apoio; a 1ª entra por último, acertada com o piso.",
      "Perfil no topo quando não vai até o teto e cantoneiras nas quinas.",
    ],
  },
  rodape: { passos: ["Assentar depois do piso.", "Alinhar as juntas com as do piso."] },
  perfil_revestimento: {
    passos: ["Instalar junto com a última fiada.", "Conferir o nível da linha de topo."],
  },
  soleira: {
    passos: [
      "Assentar na transição de piso, no nível do piso mais alto.",
      "Em área molhada, com leve caimento para dentro.",
    ],
  },
  pint_parede: {
    passos: [
      "Lixar e limpar a superfície.",
      "Selador.",
      "Massa (acrílica em área úmida, corrida em área seca) em 2 demãos, lixando entre elas.",
      "2 a 3 demãos de tinta acrílica.",
    ],
    cuidados: ["Reboco novo: 28 dias de cura antes de pintar.", "Banheiro: tinta antimofo."],
  },
  pint_teto: {
    passos: ["Lixar e limpar.", "Selador.", "Massa corrida em 2 demãos.", "2 demãos de tinta."],
    cuidados: ["Banheiro e cozinha: tinta antimofo."],
  },
  pint_externa: {
    passos: [
      "Lavar e tratar fissuras.",
      "Selador acrílico.",
      "Textura ou tinta acrílica para fachada.",
    ],
  },
  forro_gesso: {
    passos: [
      "Fixar os tirantes na laje.",
      "Montar as placas niveladas.",
      "Rejuntar com gesso e sisal; recortes para luminárias.",
      "Massa e pintura.",
    ],
    cuidados: [
      "Área molhada: placa resistente à umidade ou drywall RU.",
      "Prever alçapão para registros e instalações.",
    ],
  },
  forro_drywall: {
    passos: [
      "Tabicas no perímetro e perfis.",
      "Tirantes e reguladores.",
      "Chapas parafusadas (RU em área molhada).",
      "Fita e massa nas juntas; pintura.",
    ],
  },
  adequacao_ralo: {
    passos: [
      "Abrir o piso em volta do ralo.",
      "Trocar o corpo do ralo ou a caixa sifonada.",
      "Ajustar a altura ao piso novo.",
      "Testar o escoamento antes de regularizar.",
    ],
  },
  ponto_agua_fria: {
    passos: [
      "Rasgo na parede.",
      "Tubulação e conexões.",
      "Teste de pressão antes de fechar o rasgo.",
    ],
  },
  ponto_esgoto: {
    passos: [
      "Rasgo no piso ou na parede com caimento.",
      "Tubulação e conexões.",
      "Teste de escoamento antes de fechar.",
    ],
  },
  ponto_tomada: {
    passos: [
      "Rasgo, caixa 4×2 e eletroduto.",
      "Fiação até o quadro.",
      "Fechar o rasgo; módulo no acabamento.",
    ],
  },
  ponto_iluminacao: {
    passos: ["Caixa no teto ou no forro.", "Eletroduto e fiação até o interruptor e o quadro."],
  },
  vaso: {
    passos: [
      "Conferir a distância do esgoto até a parede antes de comprar.",
      "Fixar com parafusos e anel de vedação.",
      "Ligação flexível e teste de vazamento.",
    ],
  },
  cuba: {
    passos: [
      "Bancada fixada e nivelada.",
      "Válvula, sifão e ligação flexível.",
      "Testar vazamento.",
    ],
  },
  bancada_banheiro: {
    passos: [
      "Medir no local depois do revestimento.",
      "Instalar sobre chumbadores ou mão-francesa.",
      "Vedar e testar a cuba.",
    ],
    cuidados: ["Fabricação leva de 1 a 3 semanas: medir cedo."],
  },
  bancada_cozinha: {
    passos: [
      "Medir no local depois do revestimento.",
      "Apoio em marcenaria, alvenaria ou mão-francesa.",
      "Vedar cuba e encontros.",
    ],
    cuidados: ["Fabricação leva de 1 a 3 semanas: medir cedo."],
  },
  chumbadores: {
    passos: ["Fixar antes do revestimento, na altura da bancada.", "Conferir o nível."],
  },
  box: {
    passos: ["Medir depois do revestimento.", "Instalar perfis e vidro, vedar com silicone."],
    cuidados: ["Piso do box com caimento para o ralo do box."],
  },
  alvenaria: {
    passos: ["Marcar a primeira fiada.", "Assentar com prumo e nível.", "Encunhar após 7 dias."],
    cuidados: ["Vergas e contravergas em todos os vãos."],
  },
};

/** Como se faz do item (pela chave ou pela descrição). */
export function comoSeFaz(i: Item): ComoSeFaz | null {
  if (i.chave && EXECUCAO[i.chave]) return EXECUCAO[i.chave]!;
  const k = Object.keys(EXECUCAO).find((c) => itemEh(i, c));
  return k ? EXECUCAO[k]! : null;
}
