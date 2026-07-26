# Standalone worker — built and deployed independently of the Next.js app.
# Host-agnostic by design: no platform-specific config anywhere in this
# file, only environment variables read at runtime (see README.md). Debian
# slim (not alpine) to avoid musl-libc surprises with native deps pulled in
# by @whiskeysockets/baileys (protobufjs/esbuild).

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/index.js"]
