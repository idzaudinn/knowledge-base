-- Run this in the Supabase SQL editor (or as a migration) before using the app.

-- Categories table
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null,
  created_at timestamptz default now()
);

-- Nodes table
create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  content text not null,
  category_id uuid references categories(id),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Edges table
create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references nodes(id) on delete cascade,
  target_id uuid references nodes(id) on delete cascade,
  relationship text not null,
  strength float default 1.0,
  created_at timestamptz default now(),
  unique(source_id, target_id)
);

-- Chat history
create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  message_type text not null check (message_type in ('feed', 'question', 'system')),
  created_at timestamptz default now()
);

alter table categories enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table chat_history enable row level security;

create policy "Allow all on categories" on categories for all using (true);
create policy "Allow all on nodes" on nodes for all using (true);
create policy "Allow all on edges" on edges for all using (true);
create policy "Allow all on chat_history" on chat_history for all using (true);

-- Realtime: add tables to Supabase Realtime publication (in Dashboard: Database > Replication, or:)
-- alter publication supabase_realtime add table nodes;
-- alter publication supabase_realtime add table edges;
-- alter publication supabase_realtime add table categories;

-- Full text search indexes
create index if not exists nodes_content_search on nodes using gin(to_tsvector('english', coalesce(content, '')));
create index if not exists nodes_label_search on nodes using gin(to_tsvector('english', coalesce(label, '')));

-- Optional: Supabase can call this for Ask mode relevance; app also does client-style scoring.
create or replace function public.search_knowledge(query_text text, max_rows int default 80)
returns setof public.nodes
language sql
stable
as $$
  select * from public.nodes
  where to_tsvector('english', coalesce(label, '') || ' ' || coalesce(content, ''))
    @@ websearch_to_tsquery('english', query_text)
  limit coalesce(nullif(max_rows, 0), 80);
$$;
