# NL EVF

Crie o app "NL · EVF" — sistema de Estudo de Viabilidade Financeira (EVF) de obras residenciais do escritório NL Arquitetos. Tudo em português do Brasil, moeda R$ com formato brasileiro (R$ 44.603,06), áreas em m² com 2 casas. Use o banco (Supabase) com login por e-mail; os 2 sócios logados enxergam e editam todos os dados (sem separação por usuário).

## Visual
Ferramenta de trabalho sóbria e técnica. Fundo #F3F3EF, cartões brancos com borda #DEDED8 e cantos 12px, texto #1C1E1F, texto secundário #5B6062, cor principal verde #2E5A4C (fundo suave #E3ECE7), alertas em âmbar (texto #9A4A12, fundo #FFF8F1). Fontes: IBM Plex Sans (texto) e IBM Plex Mono para números (tabular). Menu lateral à esquerda (em celular vira menu no topo): "Meus EVFs", e no EVF aberto as abas; embaixo "Base do escritório": Catálogo de serviços, Fornecedores, Taxas de administração, Configurações. Nada de emoji, nada de gradiente.

## Conceitos
- EVF = orçamento por cenários feito sobre o Estudo Preliminar, comparado com o TARGET (valor que o cliente quer investir).
- Cada item tem material e mão de obra separados. Total do item = quantidade × (1 + perda%) × (material unitário + M.O. unitária).
- Itens são organizados em CAPÍTULOS (código 1, 2, 3…) e itens (1.1, 3.1.2…).
- Taxa de administração por capítulo = total do capítulo × % do capítulo. Total geral = custo direto + taxas.
- Tipo de preço do item: "composição" (preço próprio), "cotação" (média de até 3 fornecedores) ou "verba" (valor global).

## Tabelas
- evfs: cliente, obra, tipo_obra (Reforma de interiores / Reforma com ampliação / Construção do zero / Comercial), cidade_uf, area_m2, padrao (Baixo/Médio/Alto), target, origem_recurso (Próprio/Financiamento/Misto), revisao (texto, ex. R00), data_base (data dos preços), status (Rascunho/Escopo/Cotações/Apresentado/Aprovado), observacoes, created_at.
- ambientes: evf_id, nome, ordem.
- medicoes (levantamento): ambiente_id, descricao (ex. "parede da porta", "vão porta"), largura, altura, quantidade (padrão 1), sinal (+1 ou −1 para vãos), total calculado = largura × altura × quantidade × sinal.
- capitulos: codigo, nome, ordem, taxa_adm_pct (tabela do escritório, editável em Taxas de administração).
- catalogo_servicos: codigo, capitulo_codigo, descricao, unidade, tipo_preco, material_unit, mo_unit, data_preco, fonte.
- fornecedores: nome, categoria, contato, observacoes.
- itens_evf: evf_id, ambiente_id (opcional), capitulo_codigo, codigo, descricao, unidade, quantidade, perda_pct, material_unit, mo_unit, tipo_preco, etapa (Agora / Etapa futura), ordem.
- cotacoes: item_id, fornecedor_nome, valor, data. Cada item tem um criterio_cotacao (media/menor/maior) e uma justificativa.
- configuracoes: nome do escritório, CUB de referência R$/m² (com mês/ano e UF), margem de erro do EVF em %.

## Telas
1. **Meus EVFs**: tabela com obra, cliente, status, total geral, target, desvio % (verde se dentro do target, âmbar se acima), revisão. Botão "Novo EVF" abre formulário (campos de evfs). No formulário mostrar "Estimativa inicial (norte, não orçamento)": área × CUB de referência das configurações, com aviso de que o valor real sai do EVF.
2. **EVF aberto**, com cabeçalho (obra, cliente, revisão, data-base, status editável, total geral, target, desvio em R$ e %) e abas:
   a. **Ambientes e levantamento**: criar ambientes; em cada um, linhas de medição (descrição, largura, altura, qtd, + ou −) com total em m² por ambiente.
   b. **Escopo**: planilha agrupada por capítulo, com subtotal por capítulo. Colunas: Item, Serviço, Un., Quant., Perda %, Mat. unit., M.O. unit., Total mat., Total M.O., Total, Tipo (etiqueta Composição/Cotação/Verba), Etapa. Edição direto na célula. Botão "+ Serviço do catálogo" (busca no catálogo e copia preços) e "+ Item livre". Excluir e reordenar itens.
   c. **Cotações**: lista os itens do tipo cotação. Para cada um, até 3 linhas de fornecedor + valor + data; seletor Média / Menor / Maior; o valor considerado vira o material_unit do item automaticamente. Alerta âmbar "Só N cotação(ões)" quando houver menos de 3, e "Diferença de X% entre propostas" quando maior/menor passar de 30%.
   d. **Resumo**: tabela por capítulo (Material, M.O., Total, % da taxa, valor da taxa), Custo direto, Total de taxas, TOTAL GERAL; barra horizontal do total com a marca do target; cartões: Total geral, Target, Desvio, Taxa efetiva (%). Também "Agora" × "Etapa futura" (soma por etapa).
   e. **Curva ABC**: itens (não capítulos) em ordem decrescente de total, com % individual, % acumulado e classe A (até 80% acumulado), B (até 95%), C (resto), calculada automaticamente. Mostrar "X de N itens somam 80%".
   f. **Auditor**: lista de alertas automáticos: item tipo cotação com menos de 3 cotações; data_base do EVF com mais de 6 meses (sugerir reajuste pelo INCC ou recotar); capítulo de demolições que tem ao mesmo tempo item "verba" e itens por m²/unidade (possível dupla contagem); itens com total zero; capítulo sem taxa definida.
3. **Ações do EVF**: "Duplicar como nova revisão" (copia tudo, revisão +1, ex. R00→R01) — serve também para montar cenários; "Exportar .xlsx" (biblioteca SheetJS) com as abas 1_RESUMO, 2_PLANILHA DETALHADA, 3_PESQUISA DE PREÇOS, 4_TAXA ADM, 5_CURVA ABC; "PDF do cliente": página pronta para imprimir/salvar em PDF com cabeçalho do escritório, escopo por capítulo, curva ABC (top 10) e o RESUMO com total no final.
4. **Base do escritório**: CRUD do catálogo de serviços, fornecedores, tabela de taxas por capítulo e configurações.

## Dados iniciais (seed, criar automaticamente se o banco estiver vazio)
Capítulos e taxa de administração: 1 Serviços técnicos – profissionais 0%; 2 Serviços preliminares 25%; 3 Instalação do canteiro de obras 25%; 4 Demolições e retiradas 25%; 5 Serviços civis 20%; 6 Instalações hidrossanitárias 20%; 7 Instalações elétricas 20%; 8 Forro 15%; 9 Revestimentos 10%; 10 Louças e metais 8%; 11 Pintura 15%; 12 Iluminação 7%; 13 Marmoraria 5%; 14 Marcenaria 5%; 15 Box e espelhos 10%; 16 Limpeza pós-obra 10%.
Configurações: CUB de referência R$ 2.591,41/m² (R-1 N, SP, ago/2026); margem de erro 15%.

EVF de exemplo "Banheiro social", cliente "Cliente Exemplo", Reforma de interiores, São Paulo/SP, área 2,77 m², padrão Alto, target 35000, revisão R00, data_base 2022-10-03, status Apresentado, ambiente "Banheiro social". Itens (código | descrição | un | quant | material unit | M.O. unit | tipo | cotações):
1.1 | Gestão da obra – custo mensal | mês | 1 | 0 | 3256 | verba
2.1 | Seguro de obra | vb | 1 | 560 | 0 | verba
2.2 | Impressão de projetos | vb | 1 | 90 | 0 | verba
2.3 | Placa da obra | un | 1 | 60 | 0 | verba
3.1.1 | Salva piso | rolo | 1 | 195.83 | 0 | cotação | 175; 197.5; 215
3.1.2 | Lona plástica preta 4 m | m | 10 | 6.75 | 0 | cotação | 6; 7.5
3.1.3 | Fita crepe 48x50 | un | 4 | 20.90 | 0 | cotação | 19.5; 22.3
3.2.1 | Vassoura | un | 1 | 23.67 | 0 | cotação | 20; 30; 21
3.2.2 | Rodo 60 cm | un | 1 | 33.67 | 0 | cotação | 30; 34; 37
3.2.3 | Pano de chão | un | 3 | 5.33 | 0 | cotação | 5; 6.5; 4.5
3.3.1 | Locação de caçamba de entulho | un | 2 | 430 | 0 | cotação | 450; 410
4.1 | Remoção de marcenaria | vb | 1 | 0 | 120 | verba
4.2 | Remoção de bancada | un | 1 | 0 | 100 | composição
4.3 | Remoção de box | un | 1 | 0 | 100 | composição
4.4 | Remoção de louças e metais | vb | 1 | 0 | 100 | verba
4.5 | Remoção de forro de gesso | m² | 2.766 | 0 | 20 | composição
4.6 | Remoção de revestimento cerâmico de piso | m² | 2.766 | 0 | 30 | composição
4.7 | Remoção de revestimento cerâmico de parede | m² | 14.2976 | 0 | 30 | composição
4.8 | Mão de obra – demolições e retiradas | vb | 1 | 0 | 3000 | verba
5.1 | Regularização de reboco nas paredes | m² | 14.2976 | 28.90 | 45 | composição
5.2 | Regularização de contrapiso | m² | 2.766 | 11.0308 | 45 | composição
5.3 | Impermeabilização de piso, argamassa semiflexível | m² | 2.766 | 18.4267 | 38 | composição
5.4 | Impermeabilização de parede até 1,80 m | m² | 11.664 | 18.4267 | 38 | composição
6.1 | Novo ponto de água fria para ducha higiênica | un | 1 | 61.97 | 150 | composição
6.2 | Troca da base de registro de gaveta 3/4 | un | 1 | 64.90 | 150 | composição
6.3 | Troca da base de registro de pressão 3/4 | un | 1 | 69.41 | 150 | composição
7.1 | Novo ponto de tomada | un | 1 | 140.855 | 200 | composição
7.2 | Novo ponto de interruptor | un | 1 | 97.405 | 200 | composição
7.3 | Novo ponto de iluminação | un | 4 | 34.46 | 200 | composição
8.1 | Rebaixo de forro em drywall, placa RU | m² | 2.766 | 95.9492 | 120 | composição
9.1 | Revestimento de piso 90x90 branco acetinado | m² | 2.766 | 240.8465 | 120 | composição
9.2 | Revestimento de parede 5x20 branco mate | m² | 6.1406 | 321.37 | 120 | composição
10.1 | Torneira de parede | un | 1 | 908 | 50 | cotação | 890; 926
10.2 | Sifão rígido | un | 1 | 209.50 | 50 | cotação | 230; 189
10.3 | Vaso sanitário | un | 1 | 1535.67 | 200 | cotação | 1459; 1648; 1500
10.4 | Ducha higiênica | un | 1 | 360 | 50 | cotação | 360
10.5 | Ralo quadrado 15x15 | un | 1 | 280 | 50 | cotação | 280
10.6 | Toalheiro 60 cm | un | 1 | 640 | 50 | cotação | 640
10.7 | Papeleira | un | 1 | 350 | 50 | cotação | 350
10.8 | Chuveiro elétrico | un | 1 | 499 | 50 | cotação | 499
10.9 | Acabamento de registro de gaveta 3/4 | un | 1 | 180 | 50 | cotação | 180
10.10 | Acabamento de registro de pressão 3/4 | un | 1 | 180 | 50 | cotação | 180
10.11 | Ralo linear do box | un | 1 | 340 | 50 | cotação | 340
11.1 | Emassamento e textura de parede fulget cinza claro | m² | 7.7726 | 123.2959 | 60 | composição
11.2 | Emassamento e pintura de teto branco fosco | m² | 2.766 | 28.3317 | 40 | composição
12.1 | Spot de embutir quadrado | un | 2 | 66.33 | 50 | cotação | 60; 75; 64
12.2 | Fita de LED 3000K 5 m | rolo | 1 | 178.67 | 50 | cotação | 159; 198; 179
12.3 | Fonte driver para fita LED | un | 1 | 61.10 | 0 | cotação | 57; 62; 64.3
13.1 | Bancada com cuba esculpida em granito cinza andorinha levigado | un | 1 | 3025 | 0 | cotação | 2900; 3150
13.2 | Nicho vertical em granito cinza andorinha levigado | un | 1 | 2050 | 0 | cotação | 1800; 2300
14.1 | Armário farmacinha | vb | 1 | 6300 | 0 | cotação | 8000; 4600
14.2 | Prateleira | vb | 1 | 492.50 | 0 | cotação | 625; 360
15.1 | Box em vidro, 1 folha de abrir, estrutura preto fosco | un | 1 | 1113.33 | 0 | cotação | 1260; 980; 1100
15.2 | Espelho para porta do armário farmacinha | un | 4 | 193 | 0 | cotação | 180; 195; 204
16.1 | Limpeza pós-obra | vb | 1 | 0 | 350 | verba
Perda 0% em todos os itens do exemplo. Copie também esses serviços (sem quantidade) para o catálogo, com data_preco 2022-10-03 e fonte "EVF exemplo do curso". Com esses dados o EVF de exemplo deve dar exatamente: custo direto R$ 40.208,50; taxas R$ 4.394,55; total geral R$ 44.603,06. Use valores com várias casas decimais nos cálculos e arredonde só na tela.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/391bd4b2-637e-4e01-81fb-308ee5432ec7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
