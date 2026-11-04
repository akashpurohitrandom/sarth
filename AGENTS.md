# Sārth working agreement

- GitHub is the source of truth. Work on branches and provide a reviewable preview.
- Production deployment, production database migrations, and domain/DNS cutover require the user's explicit approval for the concrete release.
- Keep automatic Git deployments disabled in vercel.json. Never treat a push or merge as production-release approval.
- Never commit .env files or credentials. Keep service-role credentials server-side.
- Preserve the photography-first vision in README.md and the project compendium: The World and Stories, no cover images or camera metadata.
- Verify changes with a production build and relevant flow checks before proposing a release.
