# Sārth

A living museum of photography.

## Infrastructure

- Source: https://github.com/akashpurohitrandom/sarth
- Database, authentication, and photograph storage: Supabase project `soefubigjyedirgjcvhs`.
- Website and server-side image processing: Vercel.
- Intended production domain: sarth.art.

## Status

The recovered application is preserved on main. Infrastructure work is on setup/supabase-vercel. This is a fresh start: existing stories and photographs will not be migrated. database/bootstrap.sql defines the initial schema and storage policies and was applied once to the new project. `database/migrations/20261105145100_add_photograph_display_metadata.sql` adds the per-photograph title, date, city, and country fields used by the gallery; it has been applied to the new project. The sole admin is registered in admin_users. Originals are private; web images and thumbnails are public.

## Development

Copy `.env.example` to `.env.local` and populate credentials securely. Never commit local environment files. Install dependencies with `npm ci`; use `npm run build` to check the production build.

## Release workflow

Develop on a branch, verify changes, and prepare a preview for review. Production deployment, production database migrations, and domain cutover require explicit user approval. Do not configure unapproved pushes to deploy automatically to production.

## Known blockers before launch

- Disable public signups in Supabase Auth settings. Database and API access already require the explicitly registered administrator.
- Do not rerun database/bootstrap.sql against the initialized database. Use reviewed migrations for subsequent changes.
- SUPABASE_SERVICE_ROLE_KEY is configured as a sensitive Vercel variable for Preview and Production. Both modern sb_secret_ keys and legacy service-role keys are supported; never share or commit them. Public configuration uses the new publishable key, despite the retained ANON_KEY variable name.
- Verify an authenticated upload, publication, unpublication, and storage deletion through the preview before releasing.
- Connect GitHub to Vercel with automatic deployments disabled. Explicit preview deployments are allowed; production requires approval.
- Review and approve the production release and sarth.art domain cutover.

## Validation

`npm run build` checks compilation and TypeScript. `node scripts/smoke.mjs <base-url>` verifies admin login and denial of unsigned privileged requests. The initial dependency audit is clean. React 18 remains supported but deprecated by Next.js 16; migrate separately before Next.js 17.

Preview currently targets the new empty Supabase project intended for production. Until a separate staging database is configured, admin writes from the preview affect that same project; never run destructive checks against real uploaded content.
