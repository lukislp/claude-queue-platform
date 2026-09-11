FROM node:24-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./
RUN npm run build

FROM node:24-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations /app/migrations
EXPOSE 4000
CMD ["node", "dist/main.js"]
