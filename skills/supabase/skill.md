---
name: supabase
description: PostgreSQL database modeling, Row Level Security (RLS) policies, Supabase Auth, SSR clients, and Realtime subscriptions
version: 1.0.0
category: engineering
tools:
  - memory
  - fetch_url
triggers:
  - supabase
  - postgres
  - postgresql
  - rls
  - sql
  - migration
  - edge function
---

# Supabase & PostgreSQL Architecture

## Architectural Standards
1. **Row Level Security (RLS)**: Always enable RLS on every table (`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`). Create explicit granular policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` checking `auth.uid() = user_id`.
2. **SSR Client Conventions**: Use `@supabase/ssr` `createServerClient` in Next.js Server Components, Actions, and Route Handlers. Use `createBrowserClient` in Client Components.
3. **Indexing**: Add B-tree indexes for all foreign keys and frequently filtered columns (`CREATE INDEX ON <table> (user_id, updated_at DESC);`).
4. **Data Isolation**: Never use the `service_role` key on the client. Restrict `service_role` usage strictly to server-side background job workers and administrative webhooks.
