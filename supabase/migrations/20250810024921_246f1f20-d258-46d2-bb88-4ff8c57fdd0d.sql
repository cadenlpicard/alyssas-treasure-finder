-- Enable pgvector (if not already)
create extension if not exists vector;

-- Ensure items.embedding uses OpenAI embedding dimension (1536)
alter table public.items
  alter column embedding type vector(1536)
  using case when embedding is null then null else embedding end;

-- Create IVFFlat index for cosine similarity on embeddings
create index if not exists idx_items_embedding_ivfflat
  on public.items
  using ivfflat (embedding vector_cosine_ops);

-- Helpful secondary index for normalized name lookups
create index if not exists idx_items_name_normalized on public.items (name_normalized);
