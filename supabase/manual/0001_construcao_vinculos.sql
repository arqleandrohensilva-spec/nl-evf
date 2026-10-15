-- Aplicado direto no Lovable Cloud em 2026-10-13 (registro para referência).
-- Acesso sem login (o controle virá do NL HUB):
do $$ declare t text; begin
foreach t in array array['configuracoes','capitulos','catalogo_servicos','fornecedores','evfs','ambientes','medicoes','itens_evf','cotacoes'] loop
  execute format('drop policy if exists "anon all %s" on public.%I', t, t);
  execute format('create policy "anon all %s" on public.%I for all to anon using (true) with check (true)', t, t);
  execute format('grant select, insert, update, delete on public.%I to anon', t);
end loop; end $$;

-- Geometria dos ambientes e quantidades vinculadas
alter table public.ambientes add column if not exists comprimento numeric not null default 0, add column if not exists largura numeric not null default 0, add column if not exists pe_direito numeric not null default 2.6, add column if not exists area_vaos numeric not null default 0;
alter table public.itens_evf add column if not exists chave text, add column if not exists base_qtd text, add column if not exists base_item_id uuid references public.itens_evf(id) on delete set null, add column if not exists fator numeric not null default 1;
alter table public.evfs add column if not exists sugestoes_ignoradas jsonb not null default '[]'::jsonb;

-- Capítulos de construção do zero + ordem executiva
insert into public.capitulos (codigo,nome,ordem,taxa_adm_pct) values
(17,'Projetos e aprovações',2,0),(18,'Fundações',6,10),(19,'Estrutura',7,20),(20,'Alvenaria e vedações',8,25),(21,'Cobertura',9,15),(22,'Esquadrias',14,10),(23,'Águas pluviais',12,20),(24,'Paisagismo e área externa',24,10),(25,'Equipamentos',23,5)
on conflict (codigo) do nothing;
update public.capitulos c set ordem = v.o from (values (1,1),(17,2),(2,3),(3,4),(4,5),(18,6),(19,7),(20,8),(21,9),(5,10),(6,11),(23,12),(7,13),(22,14),(8,15),(9,16),(11,17),(10,18),(12,19),(13,20),(14,21),(15,22),(25,23),(24,24),(16,25)) as v(cod,o) where c.codigo=v.cod;

-- Link do produto pesquisado na internet (2026-10-13)
alter table public.cotacoes add column if not exists link text;
alter table public.itens_evf add column if not exists link text;

-- Medições: profundidade e tipo (soma | vao | shaft_canto | shaft_parede) (2026-10-13)
alter table public.medicoes add column if not exists profundidade numeric not null default 0, add column if not exists tipo text;

-- "O que será feito" por ambiente e na obra toda (2026-10-13)
alter table public.ambientes add column if not exists descricao_servico text;
alter table public.evfs add column if not exists descricao_obra text;

-- Dados da construção do zero (programa da casa) (2026-10-15)
alter table public.evfs add column if not exists programa jsonb;

-- Base de preços de referência (SINAPI importado) e vínculo serviço → composição (2026-10-15)
create table if not exists public.precos_referencia (id uuid primary key default gen_random_uuid(), base text not null, fonte text not null default 'SINAPI', uf text not null default 'SP', data_base date not null, desonerado boolean not null default false, codigo text not null, descricao text not null, unidade text not null default '', preco numeric not null default 0, pct_mo numeric, created_at timestamptz not null default now());
create index if not exists precos_referencia_base_idx on public.precos_referencia (base);
create index if not exists precos_referencia_codigo_idx on public.precos_referencia (codigo);
create table if not exists public.vinculos_preco (chave text primary key, codigo text not null, descricao text not null default '', fonte text not null default 'SINAPI', updated_at timestamptz not null default now());
-- + RLS e policies anon iguais às demais tabelas
create or replace view public.bases_referencia with (security_invoker = true) as
  select base, fonte, uf, data_base, desonerado, count(*)::int as n from public.precos_referencia group by base, fonte, uf, data_base, desonerado;
grant select on public.bases_referencia to anon;
alter table public.configuracoes add column if not exists base_preco text;
alter table public.itens_evf add column if not exists origem_preco text;
