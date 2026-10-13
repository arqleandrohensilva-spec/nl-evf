create table public.configuracoes (id int primary key default 1, nome_escritorio text not null default 'NL Arquitetos', cub_valor numeric not null default 0, cub_ref text not null default '', cub_uf text not null default 'SP', margem_erro_pct numeric not null default 15);
create table public.capitulos (id uuid primary key default gen_random_uuid(), codigo int not null unique, nome text not null, ordem int not null default 0, taxa_adm_pct numeric);
create table public.catalogo_servicos (id uuid primary key default gen_random_uuid(), codigo text not null default '', capitulo_codigo int not null, descricao text not null, unidade text not null default 'un', tipo_preco text not null default 'composicao', material_unit numeric not null default 0, mo_unit numeric not null default 0, data_preco date, fonte text default '', created_at timestamptz not null default now());
create table public.fornecedores (id uuid primary key default gen_random_uuid(), nome text not null, categoria text default '', contato text default '', observacoes text default '', created_at timestamptz not null default now());
create table public.evfs (id uuid primary key default gen_random_uuid(), cliente text not null default '', obra text not null default '', tipo_obra text not null default 'Reforma de interiores', cidade_uf text default '', area_m2 numeric not null default 0, padrao text not null default 'Médio', target numeric not null default 0, origem_recurso text not null default 'Próprio', revisao text not null default 'R00', data_base date not null default current_date, status text not null default 'Rascunho', observacoes text default '', created_at timestamptz not null default now());
create table public.ambientes (id uuid primary key default gen_random_uuid(), evf_id uuid not null references public.evfs(id) on delete cascade, nome text not null, ordem int not null default 0);
create table public.medicoes (id uuid primary key default gen_random_uuid(), ambiente_id uuid not null references public.ambientes(id) on delete cascade, descricao text default '', largura numeric not null default 0, altura numeric not null default 0, quantidade numeric not null default 1, sinal int not null default 1, ordem int not null default 0, created_at timestamptz not null default now());
create table public.itens_evf (id uuid primary key default gen_random_uuid(), evf_id uuid not null references public.evfs(id) on delete cascade, ambiente_id uuid references public.ambientes(id) on delete set null, capitulo_codigo int not null, codigo text not null default '', descricao text not null default '', unidade text not null default 'un', quantidade numeric not null default 0, perda_pct numeric not null default 0, material_unit numeric not null default 0, mo_unit numeric not null default 0, tipo_preco text not null default 'composicao', etapa text not null default 'Agora', ordem int not null default 0, criterio_cotacao text not null default 'media', justificativa text default '');
create table public.cotacoes (id uuid primary key default gen_random_uuid(), item_id uuid not null references public.itens_evf(id) on delete cascade, fornecedor_nome text default '', valor numeric not null default 0, data date, ordem int not null default 0);

do $$ declare t text; begin
foreach t in array array['configuracoes','capitulos','catalogo_servicos','fornecedores','evfs','ambientes','medicoes','itens_evf','cotacoes'] loop
 execute format('grant select, insert, update, delete on public.%I to authenticated', t);
 execute format('grant all on public.%I to service_role', t);
 execute format('alter table public.%I enable row level security', t);
 execute format('create policy "auth all %s" on public.%I for all to authenticated using (true) with check (true)', t, t);
end loop; end $$;

insert into public.configuracoes values (1,'NL Arquitetos',2591.41,'R-1 N · ago/2026','SP',15);
insert into public.capitulos (codigo,nome,ordem,taxa_adm_pct) values
(1,'Serviços técnicos – profissionais',1,0),(2,'Serviços preliminares',2,25),(3,'Instalação do canteiro de obras',3,25),(4,'Demolições e retiradas',4,25),(5,'Serviços civis',5,20),(6,'Instalações hidrossanitárias',6,20),(7,'Instalações elétricas',7,20),(8,'Forro',8,15),(9,'Revestimentos',9,10),(10,'Louças e metais',10,8),(11,'Pintura',11,15),(12,'Iluminação',12,7),(13,'Marmoraria',13,5),(14,'Marcenaria',14,5),(15,'Box e espelhos',15,10),(16,'Limpeza pós-obra',16,10);
insert into public.evfs (id,cliente,obra,tipo_obra,cidade_uf,area_m2,padrao,target,origem_recurso,revisao,data_base,status) values ('00000000-0000-4000-8000-000000000001','Cliente Exemplo','Banheiro social','Reforma de interiores','São Paulo/SP',2.77,'Alto',35000,'Próprio','R00','2022-10-03','Apresentado');
insert into public.ambientes (id,evf_id,nome,ordem) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Banheiro social',0);

create temp table _s(k int,cap int,cod text,descr text,un text,qt numeric,mat numeric,mo numeric,tipo text,cot numeric[]) on commit drop;
insert into _s values
(0,1,'1.1','Gestão da obra – custo mensal','mês',1,0,3256,'verba','{}'),
(1,2,'2.1','Seguro de obra','vb',1,560,0,'verba','{}'),
(2,2,'2.2','Impressão de projetos','vb',1,90,0,'verba','{}'),
(3,2,'2.3','Placa da obra','un',1,60,0,'verba','{}'),
(4,3,'3.1.1','Salva piso','rolo',1,195.83,0,'cotacao','{175,197.5,215}'),
(5,3,'3.1.2','Lona plástica preta 4 m','m',10,6.75,0,'cotacao','{6,7.5}'),
(6,3,'3.1.3','Fita crepe 48x50','un',4,20.9,0,'cotacao','{19.5,22.3}'),
(7,3,'3.2.1','Vassoura','un',1,23.67,0,'cotacao','{20,30,21}'),
(8,3,'3.2.2','Rodo 60 cm','un',1,33.67,0,'cotacao','{30,34,37}'),
(9,3,'3.2.3','Pano de chão','un',3,5.33,0,'cotacao','{5,6.5,4.5}'),
(10,3,'3.3.1','Locação de caçamba de entulho','un',2,430,0,'cotacao','{450,410}'),
(11,4,'4.1','Remoção de marcenaria','vb',1,0,120,'verba','{}'),
(12,4,'4.2','Remoção de bancada','un',1,0,100,'composicao','{}'),
(13,4,'4.3','Remoção de box','un',1,0,100,'composicao','{}'),
(14,4,'4.4','Remoção de louças e metais','vb',1,0,100,'verba','{}'),
(15,4,'4.5','Remoção de forro de gesso','m²',2.766,0,20,'composicao','{}'),
(16,4,'4.6','Remoção de revestimento cerâmico de piso','m²',2.766,0,30,'composicao','{}'),
(17,4,'4.7','Remoção de revestimento cerâmico de parede','m²',14.2976,0,30,'composicao','{}'),
(18,4,'4.8','Mão de obra – demolições e retiradas','vb',1,0,3000,'verba','{}'),
(19,5,'5.1','Regularização de reboco nas paredes','m²',14.2976,28.9,45,'composicao','{}'),
(20,5,'5.2','Regularização de contrapiso','m²',2.766,11.0308,45,'composicao','{}'),
(21,5,'5.3','Impermeabilização de piso, argamassa semiflexível','m²',2.766,18.4267,38,'composicao','{}'),
(22,5,'5.4','Impermeabilização de parede até 1,80 m','m²',11.664,18.4267,38,'composicao','{}'),
(23,6,'6.1','Novo ponto de água fria para ducha higiênica','un',1,61.97,150,'composicao','{}'),
(24,6,'6.2','Troca da base de registro de gaveta 3/4','un',1,64.9,150,'composicao','{}'),
(25,6,'6.3','Troca da base de registro de pressão 3/4','un',1,69.41,150,'composicao','{}'),
(26,7,'7.1','Novo ponto de tomada','un',1,140.855,200,'composicao','{}'),
(27,7,'7.2','Novo ponto de interruptor','un',1,97.405,200,'composicao','{}'),
(28,7,'7.3','Novo ponto de iluminação','un',4,34.46,200,'composicao','{}'),
(29,8,'8.1','Rebaixo de forro em drywall, placa RU','m²',2.766,95.9492,120,'composicao','{}'),
(30,9,'9.1','Revestimento de piso 90x90 branco acetinado','m²',2.766,240.8465,120,'composicao','{}'),
(31,9,'9.2','Revestimento de parede 5x20 branco mate','m²',6.1406,321.37,120,'composicao','{}'),
(32,10,'10.1','Torneira de parede','un',1,908,50,'cotacao','{890,926}'),
(33,10,'10.2','Sifão rígido','un',1,209.5,50,'cotacao','{230,189}'),
(34,10,'10.3','Vaso sanitário','un',1,1535.67,200,'cotacao','{1459,1648,1500}'),
(35,10,'10.4','Ducha higiênica','un',1,360,50,'cotacao','{360}'),
(36,10,'10.5','Ralo quadrado 15x15','un',1,280,50,'cotacao','{280}'),
(37,10,'10.6','Toalheiro 60 cm','un',1,640,50,'cotacao','{640}'),
(38,10,'10.7','Papeleira','un',1,350,50,'cotacao','{350}'),
(39,10,'10.8','Chuveiro elétrico','un',1,499,50,'cotacao','{499}'),
(40,10,'10.9','Acabamento de registro de gaveta 3/4','un',1,180,50,'cotacao','{180}'),
(41,10,'10.10','Acabamento de registro de pressão 3/4','un',1,180,50,'cotacao','{180}'),
(42,10,'10.11','Ralo linear do box','un',1,340,50,'cotacao','{340}'),
(43,11,'11.1','Emassamento e textura de parede fulget cinza claro','m²',7.7726,123.2959,60,'composicao','{}'),
(44,11,'11.2','Emassamento e pintura de teto branco fosco','m²',2.766,28.3317,40,'composicao','{}'),
(45,12,'12.1','Spot de embutir quadrado','un',2,66.33,50,'cotacao','{60,75,64}'),
(46,12,'12.2','Fita de LED 3000K 5 m','rolo',1,178.67,50,'cotacao','{159,198,179}'),
(47,12,'12.3','Fonte driver para fita LED','un',1,61.1,0,'cotacao','{57,62,64.3}'),
(48,13,'13.1','Bancada com cuba esculpida em granito cinza andorinha levigado','un',1,3025,0,'cotacao','{2900,3150}'),
(49,13,'13.2','Nicho vertical em granito cinza andorinha levigado','un',1,2050,0,'cotacao','{1800,2300}'),
(50,14,'14.1','Armário farmacinha','vb',1,6300,0,'cotacao','{8000,4600}'),
(51,14,'14.2','Prateleira','vb',1,492.5,0,'cotacao','{625,360}'),
(52,15,'15.1','Box em vidro, 1 folha de abrir, estrutura preto fosco','un',1,1113.33,0,'cotacao','{1260,980,1100}'),
(53,15,'15.2','Espelho para porta do armário farmacinha','un',4,193,0,'cotacao','{180,195,204}'),
(54,16,'16.1','Limpeza pós-obra','vb',1,0,350,'verba','{}');
update _s set mat=(select avg(x) from unnest(cot) x) where cardinality(cot)>0;
insert into public.itens_evf (id,evf_id,ambiente_id,capitulo_codigo,codigo,descricao,unidade,quantidade,material_unit,mo_unit,tipo_preco,ordem)
 select ('00000000-0000-4000-9000-'||lpad(k::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',cap,cod,descr,un,qt,mat,mo,tipo,k from _s;
insert into public.cotacoes (item_id,fornecedor_nome,valor,data,ordem)
 select ('00000000-0000-4000-9000-'||lpad(k::text,12,'0'))::uuid,'Fornecedor '||chr(64+o::int),v,'2022-10-03',o-1 from _s, unnest(cot) with ordinality u(v,o);
insert into public.catalogo_servicos (codigo,capitulo_codigo,descricao,unidade,tipo_preco,material_unit,mo_unit,data_preco,fonte)
 select cod,cap,descr,un,tipo,mat,mo,'2022-10-03','EVF exemplo do curso' from _s order by k;