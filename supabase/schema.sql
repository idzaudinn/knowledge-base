-- Run this in the Supabase SQL editor (or as a migration) before using the app.
-- This version introduces first-class knowledge base isolation with foreign keys.

create table if not exists knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from knowledge_bases where lower(name) = 'main') then
    insert into knowledge_bases (name) values ('Main');
  end if;
end $$;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade,
  label text not null,
  content text not null,
  category_id uuid references categories(id),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade,
  source_id uuid references nodes(id) on delete cascade,
  target_id uuid references nodes(id) on delete cascade,
  relationship text not null,
  strength float default 1.0,
  created_at timestamptz default now()
);

create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid references knowledge_bases(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  message_type text not null check (message_type in ('feed', 'question', 'system')),
  created_at timestamptz default now()
);

-- Migration safety for existing databases.
alter table categories add column if not exists knowledge_base_id uuid references knowledge_bases(id) on delete cascade;
alter table nodes add column if not exists knowledge_base_id uuid references knowledge_bases(id) on delete cascade;
alter table edges add column if not exists knowledge_base_id uuid references knowledge_bases(id) on delete cascade;
alter table chat_history add column if not exists knowledge_base_id uuid references knowledge_bases(id) on delete cascade;

do $$
declare
  main_kb uuid;
begin
  select id into main_kb from knowledge_bases where lower(name) = 'main' order by created_at asc limit 1;
  if main_kb is null then
    insert into knowledge_bases (name) values ('Main') returning id into main_kb;
  end if;

  update categories set knowledge_base_id = main_kb where knowledge_base_id is null;
  update nodes set knowledge_base_id = main_kb where knowledge_base_id is null;
  update edges set knowledge_base_id = main_kb where knowledge_base_id is null;
  update chat_history set knowledge_base_id = main_kb where knowledge_base_id is null;
end $$;

alter table categories alter column knowledge_base_id set not null;
alter table nodes alter column knowledge_base_id set not null;
alter table edges alter column knowledge_base_id set not null;
alter table chat_history alter column knowledge_base_id set not null;

alter table categories drop constraint if exists categories_name_key;
alter table edges drop constraint if exists edges_source_id_target_id_key;
create unique index if not exists categories_kb_name_unique on categories(knowledge_base_id, lower(name));
create unique index if not exists edges_kb_source_target_unique on edges(knowledge_base_id, source_id, target_id);

create index if not exists idx_nodes_kb on nodes(knowledge_base_id);
create index if not exists idx_edges_kb on edges(knowledge_base_id);
create index if not exists idx_categories_kb on categories(knowledge_base_id);
create index if not exists idx_chat_history_kb on chat_history(knowledge_base_id);

alter table knowledge_bases enable row level security;
alter table categories enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table chat_history enable row level security;

drop policy if exists "Allow all on knowledge_bases" on knowledge_bases;
drop policy if exists "Allow all on categories" on categories;
drop policy if exists "Allow all on nodes" on nodes;
drop policy if exists "Allow all on edges" on edges;
drop policy if exists "Allow all on chat_history" on chat_history;

create policy "Allow all on knowledge_bases" on knowledge_bases for all using (true);
create policy "Allow all on categories" on categories for all using (true);
create policy "Allow all on nodes" on nodes for all using (true);
create policy "Allow all on edges" on edges for all using (true);
create policy "Allow all on chat_history" on chat_history for all using (true);

-- Realtime: add tables to Supabase Realtime publication (in Dashboard: Database > Replication, or:)
-- alter publication supabase_realtime add table knowledge_bases;
-- alter publication supabase_realtime add table nodes;
-- alter publication supabase_realtime add table edges;
-- alter publication supabase_realtime add table categories;
-- alter publication supabase_realtime add table chat_history;

-- Full text search indexes
create index if not exists nodes_content_search on nodes using gin(to_tsvector('english', coalesce(content, '')));
create index if not exists nodes_label_search on nodes using gin(to_tsvector('english', coalesce(label, '')));

-- Optional: Supabase can call this for Ask mode relevance; app also does client-style scoring.
create or replace function public.search_knowledge(query_text text, kb_id uuid, max_rows int default 80)
returns setof public.nodes
language sql
stable
as $$
  select * from public.nodes
  where knowledge_base_id = kb_id
    and to_tsvector('english', coalesce(label, '') || ' ' || coalesce(content, ''))
      @@ websearch_to_tsquery('english', query_text)
  limit coalesce(nullif(max_rows, 0), 80);
$$;
