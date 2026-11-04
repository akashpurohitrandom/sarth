# Sārth

A living museum of photography.

## Infrastructure

- Source: https://github.com/akashpurohitrandom/sarth
- Database, authentication, and photograph storage: Supabase project `soefubigjyedirgjcvhs`.
- Website and server-side image processing: Vercel.
- Intended production domain: sarth.art.

## Status

Recovered application source, not yet connected to the new infrastructure. The new Supabase public schema is empty. Existing photographs and stories have not been migrated. Database definitions and storage policies must be reconstructed and reviewed before use.

## Development

Copy `.env.example` to `.env.local` and populate credentials securely. Never commit local environment files. Install dependencies with `npm ci`; use `npm run build` to check the production build.

## Release workflow

Develop on a branch, verify changes, and prepare a preview for review. Production deployment, production database migrations, and domain cutover require explicit user approval. Do not configure unapproved pushes to deploy automatically to production.

## Known blockers before launch

- Authenticate and authorize the privileged image-processing endpoint.
- Reconstruct database functions, RLS, and storage policies with single-admin access.
- Publish only after successful image processing; remove the private-original public-URL fallback.
- Invalidate the website cache when publishing, unpublishing, or deleting stories.
- Replace the old Supabase hostname in image configuration.
- Confirm whether existing stories and original photographs need migration.
