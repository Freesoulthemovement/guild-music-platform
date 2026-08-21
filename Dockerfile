# Portable image: works on Render, Fly, Railway, Cloud Run or any container host.

FROM node:22-slim AS build
WORKDIR /app

# Dependencies first, so a source-only change reuses this layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
USER node

# esbuild bundles every runtime dependency into dist/index.cjs, so the image
# needs no node_modules at all — verified by booting dist/ on its own. Copying
# only dist keeps the runtime layer to the built app and the static client.
COPY --from=build --chown=node:node /app/dist ./dist

# Informational; the platform sets PORT and the server reads it.
EXPOSE 5000

# Direct node, not npm, so the process receives SIGTERM and can drain.
CMD ["node", "dist/index.cjs"]
