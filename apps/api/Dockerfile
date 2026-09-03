FROM node:26-slim AS build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./
RUN npm run build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations /app/migrations
EXPOSE 4000
CMD ["node", "dist/main.js"]
