FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/api/ ./
RUN npm run build

FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
# Pull the Debian security fix for perl-base (CVE-2026-13221, CVE-2026-42496, CVE-2026-8376,
# fixed in 5.36.0-7+deb12u4) until the pinned node:24-slim digest ships it; the Trivy gate
# fails on CRITICAL otherwise. Drop this once Dependabot bumps the base image past it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade perl-base \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node migrations /app/migrations
# /app itself stays root-owned and read-only for the app; only the directories the process
# actually touches are handed over. The base image ships "node" with UID/GID 1000, which is
# what k8s/04-api.yaml pins via runAsUser/runAsGroup.
RUN chown node:node /app
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
