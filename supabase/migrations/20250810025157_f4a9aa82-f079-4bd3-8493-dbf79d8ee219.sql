-- Ensure the extensions schema exists
create schema if not exists extensions;

-- Move pgvector extension to the extensions schema (best practice)
alter extension vector set schema extensions;