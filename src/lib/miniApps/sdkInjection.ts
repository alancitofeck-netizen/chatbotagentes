/**
 * Auto-embeds the GrowthLink SDK snippet into an uploaded "Vincular App"
 * bundle's index.html — a workspace member uploading their own HTML (as
 * opposed to pasting the snippet by hand, which the wizard/Configuración UI
 * still document as the contract for genuinely third-party-hosted apps)
 * must never have to edit their file for lead capture to work. Called from
 * src/app/api/mini-apps/bundle-upload/route.ts on every upload AND replace,
 * with a freshly generated plaintext API key (the only moment one exists —
 * see apiKey.ts, only the hash is ever persisted).
 *
 * Idempotent via a marker comment: a re-upload/repair replaces the existing
 * block in place instead of accumulating duplicate <script> tags, and always
 * leaves the embedded key in sync with whatever was just (re)generated.
 */

const MARKER_START = "<!-- growthlink-sdk:start -->";
const MARKER_END = "<!-- growthlink-sdk:end -->";

function buildSnippetBlock(opts: { appId: string; apiKey: string; sdkOrigin: string }): string {
  return [
    MARKER_START,
    `<script src="${opts.sdkOrigin}/api/public/sdk.js"></script>`,
    "<script>",
    "  GrowthLink.init({",
    `    appId: "${opts.appId}",`,
    `    apiKey: "${opts.apiKey}",`,
    "  });",
    "</script>",
    MARKER_END,
  ].join("\n");
}

export function injectSdkSnippet(html: string, opts: { appId: string; apiKey: string; sdkOrigin: string }): string {
  const block = buildSnippetBlock(opts);

  const markerRegex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "i");
  if (markerRegex.test(html)) {
    return html.replace(markerRegex, block);
  }

  const lastMatch = [...html.matchAll(/<\/body\s*>/gi)].pop();
  if (lastMatch && lastMatch.index !== undefined) {
    return html.slice(0, lastMatch.index) + block + "\n" + html.slice(lastMatch.index);
  }

  return `${html}\n${block}\n`;
}
