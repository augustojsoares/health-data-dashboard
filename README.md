# Health Data Dashboard

Generic private health dashboard built with React, TypeScript, Tailwind, Supabase and Netlify. It contains no data exports, account identifiers, project identifiers, or credentials.

## Source and deployments

The configured Git remote is the canonical source. Netlify builds the `main` branch with `npm run build` and publishes `dist`, as defined in [netlify.toml](netlify.toml).

Every change follows this sequence:

1. Make the change locally and run `pnpm run build`.
2. Commit the verified change and push it to GitHub.
3. Confirm Netlify has deployed that Git commit and smoke-test the live site.

Do not use Netlify Drop uploads for application updates. They do not create a traceable Git revision and are only retained here as historical deployment provenance.

## What is implemented

- A normalized observation/metric schema with raw-record provenance and idempotent source identities.
- Database RLS restricts each authenticated user to rows whose `owner_id` matches `auth.uid()`. Ingestion uses a server-only service-role key.
- `ingest-openscale`: authenticated, idempotent webhook ingestion. The identity is `openscale + userId + measurementId`; `water: 0` is omitted as missing data.
- `ingest-health-sync`: generic idempotent endpoint for CSV imports.
- An optional Apps Script CSV importer with a daily trigger entry point.
- A React dashboard with authentication, provenance-aware current metrics, and a weight trend.
- `@health-data-dashboard/health-core`, a dependency-free TypeScript package that
  defines the canonical metric registry and runs declarative import mappings.

## Health mapping core

The canonical registry in `packages/health-core` is the contract for the next
ingestion adapters and mapper UI. It defines stable metric keys, canonical
units, import guardrails, record-time semantics, and the record types each
metric can appear in. Its range checks catch malformed source data; they are
not clinical reference ranges.

The mapper supports nested, indexed, collected, and quoted-key paths;
fallbacks, defaults, conditional fields, nested objects, object merges, and
per-array-item mappings; controlled number/unit/duration/timestamp transforms;
and registry validation. It has no browser UI and performs no storage. An
adapter maps raw data to the canonical observation contract, then the ingestion
endpoint remains responsible for authorization and persistence.

Run `pnpm test` to compile and test the package, or `pnpm run build` to test it
as part of the dashboard build.

## Deploy Supabase

1. Create a Supabase project in the free plan and enable the Google provider. Add `https://YOUR-NETLIFY-SITE.netlify.app` and `http://localhost:5173` to Supabase Authentication URL Configuration after the site is created.
2. Apply `supabase/migrations/202609260001_health_schema.sql` in the Supabase SQL editor.
3. Deploy both Edge Functions from this repository.
4. Set Edge Function secrets, never in the client:

   - `OPENSCALE_WEBHOOK_SECRET`: `Bearer ` followed by a long random secret.
   - `HEALTH_SYNC_INGEST_SECRET`: a different `Bearer ` secret.
   - `HEALTH_DATA_OWNER_ID`: destination authenticated user UUID, stored only in the function environment.

   Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Edge Functions; do not expose the latter.

The webhook URL will be:

`https://YOUR-PROJECT-REF.supabase.co/functions/v1/ingest-openscale`

Configure the upstream webhook with that URL and the `OPENSCALE_WEBHOOK_SECRET` authorization value.

## Deploy the dashboard

1. Copy `.env.example` to `.env` and add the project’s public URL and anon key.
2. Build with `npm install` and `npm run build`.
3. Add the same two `VITE_*` values to Netlify build environment variables. Netlify obtains the code from GitHub and runs the build configured in `netlify.toml`; never commit a real `.env` file.

## CSV importer

Create a standalone Apps Script project, paste [apps-script/Code.gs](apps-script/Code.gs), and set these Script Properties:

- `SUPABASE_INGEST_URL`: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/ingest-health-sync`
- `HEALTH_SYNC_INGEST_SECRET`: the separate value created above
- `HEALTH_DATA_EXPORT_FOLDER_ID`: Drive folder containing CSV exports

Run `importCsvExports` once to authorize Drive access and import CSV files. Add a daily time-driven trigger for the same function. It tracks imported file IDs only after Supabase accepts them; Supabase also upserts source records, so retries and overlapping exports are safe.

## Data precedence

When matching records share a logical identity, the `primary` source wins in `dashboard_metrics`. Both original observations and raw webhook/file payloads remain stored.
