FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/api/ ./
RUN npm run build

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
WORKDIR /app
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
