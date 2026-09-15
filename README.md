# Claude Queue Platform

[![CI/CD](https://github.com/lukislp/claude-queue-platform/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/lukislp/claude-queue-platform/actions/workflows/ci-cd.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/lukislp/claude-queue-platform/badge)](https://scorecard.dev/viewer/?uri=github.com/lukislp/claude-queue-platform) [![CodeQL](https://github.com/lukislp/claude-queue-platform/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/lukislp/claude-queue-platform/security/code-scanning)
[![Release](https://img.shields.io/github/v/release/lukislp/claude-queue-platform)](https://github.com/lukislp/claude-queue-platform/releases)
[![License: MIT](https://img.shields.io/github/license/lukislp/claude-queue-platform)](LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-brightgreen)](.github/workflows/ci-cd.yml)

Multi-user platform with its own authentication, where every user creates projects and
writes tasks into a queue that is worked off automatically - including automatic waiting
and resuming on rate/usage limits. Each user picks freely: their own Anthropic API key
(server-side, 24/7) or a local client running on their own Claude subscription (available
as long as their own machine is online).

## Features

- **Two execution modes, one queue**: Anthropic API key (server-side) or a local agent
  that runs tasks through the installed Claude Code CLI
- **Automatic rate-limit handling**: tasks pause themselves when a limit is hit and resume
  at the reset time without any manual intervention
- **Per-task model selection**: in API-key mode taken live from the Anthropic Models API,
  in CLI mode via aliases (`opus`/`sonnet`/`haiku`) that always point at the current version
- **Full task control**: pause (the Claude session is preserved), resume via session resume
  and permanent cancellation
- **Live logs in the dashboard**: tool calls, text output, token usage, cost and duration
  per task, streamed over WebSocket
- **Project working directories**: every project automatically gets its own subdirectory
  inside the agent's base directory
- **Concurrency 1-4** per user, taking effect immediately in both modes
- **Tenant isolation**: a user's projects, tasks and devices are never reachable by anyone else

## Layout

```
apps/api/       NestJS backend (auth, projects, tasks, queue, WebSocket, device pairing)
apps/web/       Next.js dashboard
apps/agent/     Local client (npm CLI) for subscription mode
migrations/     SQL schema (applied automatically on startup)
k8s/            Kubernetes manifests for the prod deployment (Flux)
docker-compose.yml
```

## Quick start with Docker (recommended)

Requirements: Docker + Docker Compose.

```bash
cp .env.example .env
# Set JWT_SECRET and CLAUDE_KEY_ENCRYPTION_SECRET in .env to random, long values
# e.g. with: openssl rand -hex 32

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

On first start the backend creates the database schema automatically (no manual migration
step needed).

## Manual start without Docker (for development)

Requirements: Node.js 20+, a running PostgreSQL and Redis instance.

```bash
# Backend
cd apps/api
cp .env.example .env   # adjust the values (DATABASE_URL, REDIS_URL, secrets)
npm install
npm run build && npm run start
# or for hot reload: npm run start:dev

# Frontend (new terminal)
cd apps/web
npm install
npm run dev
```

## Create the first user and try it out

1. Open http://localhost:3000/register and create an account.
2. Under "Settings", pick a mode:
   - **API key**: enter your own Anthropic API key, pick a concurrency (1-4), save.
   - **Local client**: click "Pair new device" and run the command shown on your own
     machine (see below); Claude Code has to be installed there and logged in via
     `claude login`.
3. Create a project, write a task into the queue - it is worked off automatically.

### Installing the local agent (only for "Local client" mode)

```bash
cd apps/agent
npm install && npm run build
npm link   # makes "claude-queue-agent" globally available

claude-queue-agent pair --url http://localhost:4000 --code <CODE-FROM-THE-DASHBOARD> --name "My laptop"
claude-queue-agent start
```

Further commands:

```bash
claude-queue-agent config                    # show the current configuration
claude-queue-agent config --baseDir <path>   # set the base directory for project folders
```

The agent has to be running for tasks to be executed in local mode. If it is not, tasks
stay "Queued" and are picked up automatically as soon as it is back online. Windows is
supported (the npm installation of the Claude CLI is resolved automatically).

## Deployment on Kubernetes

The manifests under [`k8s/`](k8s/) target a k3s cluster (arm64) with Flux, Gateway API,
CloudNativePG and SealedSecrets:

- Postgres runs as a CNPG cluster; the operator generates the application credentials
- `JWT_SECRET` and `CLAUDE_KEY_ENCRYPTION_SECRET` are applied as a SealedSecret
  (instructions in the header of `k8s/01-secrets-sealed.yaml`)
- Routing via HTTPRoute over the existing Gateway; the required listeners and certificates
  are documented in the header of `k8s/06-routes.yaml`
- The images come out of the CI/CD pipeline (see below) and are multi-arch
  (amd64 + arm64)

## CI/CD

The pipeline ([`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)) builds all three
apps on every push and pull request. On `main` it additionally versions and releases
automatically via semantic-release (Conventional Commits): the images
`ghcr.io/lukislp/claude-queue-api` and `ghcr.io/lukislp/claude-queue-web` are built natively
for amd64 and arm64, merged into a multi-arch manifest and scanned with Trivy.

## Architecture in a nutshell

- **Dispatch**: `apps/api/src/tasks/tasks.service.ts` decides whether a task goes to BullMQ
  (API-key mode) or to the WebSocket dispatcher (local mode).
- **Rate-limit handling**: `apps/api/src/queue/queue-manager.service.ts` (API-key mode) and
  `apps/agent/src/claude-runner.ts` (local mode) set the status `PAUSED_RATE_LIMIT` with a
  `retryAt` when a limit is hit and schedule a delayed retry on their own.
- **Task control**: pausing terminates the running CLI process but keeps the Claude session
  ID; resuming re-queues the task with `--resume`.
- **Raw SQL instead of an ORM**: migrations live under `migrations/*.sql` and are applied
  automatically and idempotently on startup.
