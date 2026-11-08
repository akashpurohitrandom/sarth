# Sārth

A living museum of photography.

## Infrastructure

- Source: https://github.com/akashpurohitrandom/sarth
- Database, authentication, and photograph storage: Supabase project `soefubigjyedirgjcvhs`.
- Website and server-side image processing: Vercel.
- Intended production domain: sarth.art.

## Status

The public site is a single-photo viewer over one global photograph collection. The ordering is regenerated for each page load: it starts with a random photo, then favors the remaining photo with the fewest tags in common with the previous one. Admins upload photographs with optional tags, city, country, and year, and can upload the centered site logo. The production Supabase database currently has no photographs. `database/migrations/20261108120000_remove_stories_add_photo_tags_and_logo.sql` prepares the schema change from stories to photographs and adds the logo setting; it has not been applied to production. Originals are private; processed photographs, thumbnails, and brand logos are public.

## Development

Copy `.env.example` to `.env.local` and populate credentials securely. Never commit local environment files. Install dependencies with `npm ci`; use `npm run build` to check the production build.

## Release workflow

Develop on a branch, verify changes, and prepare a preview for review. Production deployment, production database migrations, and domain cutover require explicit user approval. Do not configure unapproved pushes to deploy automatically to production.

## Known blockers before launch

- Disable public signups in Supabase Auth settings. Database and API access already require the explicitly registered administrator.
- Do not rerun database/bootstrap.sql against the initialized database. Use reviewed migrations for subsequent changes.
- SUPABASE_SERVICE_ROLE_KEY is configured as a sensitive Vercel variable for Preview and Production. Both modern sb_secret_ keys and legacy service-role keys are supported; never share or commit them. Public configuration uses the new publishable key, despite the retained ANON_KEY variable name.
- Verify an authenticated photograph upload, logo upload, and storage deletion through a preview before releasing.
- Connect GitHub to Vercel with automatic deployments disabled. Explicit preview deployments are allowed; production requires approval.
- Review and approve the production release and sarth.art domain cutover.

## Validation

`npm run build` checks compilation and TypeScript. `node scripts/smoke.mjs <base-url>` verifies admin login and denial of unsigned privileged requests. The initial dependency audit is clean. React 18 remains supported but deprecated by Next.js 16; migrate separately before Next.js 17.

Preview currently targets the new empty Supabase project intended for production. Until a separate staging database is configured, admin writes from the preview affect that same project; never run destructive checks against real uploaded content.
