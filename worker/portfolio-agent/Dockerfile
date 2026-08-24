# Standalone worker — built and deployed independently of the Next.js app.
# Host-agnostic by design: no platform-specific config anywhere in this
# file, only environment variables read at runtime (see README.md).
#
# Base image: Playwright's OWN official Docker image — unlike
# worker/whatsapp-connector's Dockerfile (which uses the Puppeteer
# community image purely for its bundled OS libraries and lets `npm
# install` download its own version-matched Chromium), Playwright's
# documented approach is different: this image tag ships browsers ALREADY
# PINNED to that exact Playwright version. That means the version in this
# FROM line and the "playwright" dependency in package.json MUST match
# exactly — bump both together, never one without the other.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

# NOTE: unlike whatsapp-connector's Dockerfile (which chowns to and runs as
# the puppeteer image's non-root `pptruser`), the Playwright base image does
# not ship a documented non-root user of that kind — this runs as the
# image's default (root) for now. Hardening to a non-root user is a
# reasonable follow-up once this is deployed and verified, not something to
# guess a username for here.
EXPOSE 8081
CMD ["node", "dist/index.js"]
