# Alyssa's Treasure Finder — Upgrade Pack

This pack adds: shared schemas, adapters, caching, batch geocoding, route optimization fallback, and edge function stubs.

## How to Apply

1. **Copy files** into your repo, preserving paths.
2. **Merge `package.additions.json`** into your `package.json`:
   - Add the dependencies/devDependencies/scripts.
3. `pnpm i` (or `npm i`, `yarn`).
4. Apply SQL migration in Supabase: `supabase db push` or run the SQL.
5. Deploy edge functions: `supabase functions deploy firecrawl-scrape geocode-batch optimize-route get-mapbox-token`.
6. Wire your frontend API routes or proxies to call these functions (the code currently uses `/api/*` paths — map them to Supabase functions in your dev/prod config).

> NOTE: The edge functions are stubs for structure. Plug in your Firecrawl parsing and Mapbox Optimization API where noted.
