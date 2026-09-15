# Contributing

Thanks for taking the time. This is a single-maintainer project, so the process is deliberately
small - but it is the same for every change, including the maintainer's own.

## How changes get in

1. Open an issue first for anything bigger than a typo or an obvious bug fix, so the direction can
   be agreed before you spend time on it. Use the templates under `.github/ISSUE_TEMPLATE/`.
2. Fork the repository (or branch, if you have write access) and make your change on a branch.
3. Open a pull request against `main`. The pull-request template asks for what changed and why.
4. `main` is protected: a PR merges only after the test stage of
   [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) is green and the branch is up to
   date with `main` (enable auto-merge and it lands on its own once that is the case). Nobody
   pushes to `main` directly, not even the maintainer.

## Repository layout

Three independent npm projects under `apps/`, each with its own `package.json` and lockfile:

- `apps/api` - the NestJS backend (`nest build`, jest tests)
- `apps/web` - the Next.js frontend (`next build`, eslint)
- `apps/agent` - the local agent CLI (`tsc`, jest tests)

## What a pull request needs

- **Conventional Commits.** The version and the changelog are generated from the commit messages
  (`feat:` = minor release, `fix:` = patch release, `build:`/`ci:`/`docs:`/`test:` = no release).
  Squash-merge keeps the PR title as the commit message, so give the PR a Conventional Commit
  title.
- **Green required checks.** `build (api)`, `build (web)`, `build (agent)` and
  `review / dependency-review` are required; a red one blocks the merge. The `build` job is a
  matrix that runs the same five steps in each app directory.
- **Tests for new functionality.** Tests live next to the sources as `*.spec.ts` (for example
  `apps/api/src/tasks/tasks.service.spec.ts`, `apps/agent/src/list-output-files.spec.ts`). `apps/api`
  and `apps/agent` run jest; `apps/web` has no suite yet, which is why CI uses
  `npm test --if-present`. A PR that adds behaviour to api or agent without a test is asked to add
  one.
- **Lint.** `apps/web` lints with eslint-config-next; api and agent have no lint script yet, so
  `npm run lint --if-present` is a deliberate no-op there.
- **Dependencies.** `npm audit --audit-level=high` runs per app and must stay clean.

## Running things locally

CI uses Node 24. With Docker:

```bash
cp .env.example .env
# Set the two secrets marked in .env to random, long values
# e.g. with: openssl rand -hex 32

docker compose up --build
```

Without Docker you need a running PostgreSQL and Redis:

```bash
# Backend
cd apps/api
cp .env.example .env   # adjust DATABASE_URL, REDIS_URL, secrets
npm install
npm run build && npm run start
# or for hot reload: npm run start:dev

# Frontend (new terminal)
cd apps/web
npm install
npm run dev
```

The same steps CI runs, per app (`apps/api`, `apps/web`, `apps/agent`):

```bash
npm ci
npm run build
npm run lint --if-present
npm test --if-present
npm audit --audit-level=high
```

## Security issues

Please do not open a public issue for a vulnerability - use the private reporting path described
in [SECURITY.md](SECURITY.md). The [Code of Conduct](CODE_OF_CONDUCT.md) applies to every
interaction in this repository.
