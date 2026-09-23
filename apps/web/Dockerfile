FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# The standalone server writes its runtime cache to .next/cache, so that directory has to
# exist and belong to the app user. The base image ships "node" with UID/GID 1000, which is
# what k8s/05-web.yaml pins via runAsUser/runAsGroup.
RUN mkdir -p .next/cache && chown node:node /app /app/.next /app/.next/cache
EXPOSE 3000
USER node
CMD ["node", "server.js"]
