# Standalone worker — built and deployed independently of the Next.js app.
# Host-agnostic by design: no platform-specific config anywhere in this
# file, only environment variables read at runtime (see README.md).
#
# Base image: ghcr.io/puppeteer/puppeteer — not for its pre-baked Chromium
# (that build is version-matched to WHATEVER puppeteer version that image
# itself bundles, which is not guaranteed to match the `puppeteer` version
# actually resolved by this project's own package-lock.json — silently
# relying on that alignment is exactly the kind of dev/prod inconsistency
# to avoid). It's used purely for the system libraries Chrome needs
# (libnss3, libatk, libcups2, libxss1, libasound2, fonts, etc.), which are
# otherwise a fragile hand-rolled apt-get list to maintain. This build
# installs its OWN Chrome via the normal `puppeteer` postinstall (no
# PUPPETEER_SKIP_DOWNLOAD) into an explicit, fixed cache dir — the exact
# same mechanism used for local development (see README.md), so the
# resolved browser is always version-matched to package-lock.json in both
# environments, never an arbitrary system-installed Chrome.

FROM ghcr.io/puppeteer/puppeteer:latest AS build
USER root
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM ghcr.io/puppeteer/puppeteer:latest AS runtime
USER root
WORKDIR /app
ENV NODE_ENV=production PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.wwebjs_auth && chown -R pptruser:pptruser /app "$PUPPETEER_CACHE_DIR"

USER pptruser
EXPOSE 8080
CMD ["node", "dist/index.js"]
