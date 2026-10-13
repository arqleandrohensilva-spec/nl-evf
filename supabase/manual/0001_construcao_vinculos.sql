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
