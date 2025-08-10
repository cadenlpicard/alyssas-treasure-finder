-- Semantic search helper using pgvector (1536-dim OpenAI embeddings)
-- Uses cosine similarity (1 - <=>) and limits results
create or replace function public.match_items(
  query_embedding vector(1536),
  match_threshold double precision default 0.2,
  match_count integer default 10
)
returns table(
  id uuid,
  name text,
  name_normalized text,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    i.id,
    i.name,
    i.name_normalized,
    1 - (i.embedding <=> query_embedding) as similarity
  from public.items i
  where i.embedding is not null
    and (1 - (i.embedding <=> query_embedding)) >= match_threshold
  order by i.embedding <=> query_embedding
  limit match_count;
$$;