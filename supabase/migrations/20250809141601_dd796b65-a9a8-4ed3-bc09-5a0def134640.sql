-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Helper function to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enum for image job status
DO $$ BEGIN
  CREATE TYPE public.image_job_status AS ENUM ('queued', 'processing', 'done', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Items table stores normalized item names and optional embeddings
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_name_normalized_unique UNIQUE(name_normalized)
);

-- Join table linking detected items to a sale identifier (string id) and optional source/url
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id text NOT NULL,
  sale_url text,
  source text,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Image processing job queue
CREATE TABLE IF NOT EXISTS public.image_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id text NOT NULL,
  image_url text NOT NULL,
  status public.image_job_status NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_jobs_unique UNIQUE (sale_id, image_url)
);

-- Triggers for updated_at
DO $$ BEGIN
  CREATE TRIGGER set_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_sale_items_updated_at
  BEFORE UPDATE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_image_jobs_updated_at
  BEFORE UPDATE ON public.image_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_name_normalized ON public.items (name_normalized);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON public.sale_items (item_id);
CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON public.image_jobs (status);

-- Vector index for fast ANN search (cosine distance)
DO $$ BEGIN
  CREATE INDEX idx_items_embedding_ivfflat ON public.items USING ivfflat (embedding vector_cosine_ops);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_jobs ENABLE ROW LEVEL SECURITY;

-- Public read-only access for items and sale_items
DO $$ BEGIN
  CREATE POLICY "Public can read items" ON public.items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can read sale_items" ON public.sale_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No public access to image_jobs (service role in edge functions bypasses RLS)