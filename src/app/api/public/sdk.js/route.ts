import { NextResponse } from "next/server";
import { SDK_VERSION } from "@/lib/miniApps/linkedAppOptions";

/** Generic JS SDK for "Vincular App" (botón "Vincular App", Fase 1) — served
 * as a Route Handler (not a static public/ file) so the response can carry
 * an explicit Content-Type + long cache lifetime. Works for ANY mini app,
 * not just app_vinculada: `endpoint`/`apiKey` are supplied at `init()` time
 * by whichever page embeds it, reusing the exact same public ingestion
 * route every hosted template already POSTs to
 * (src/app/api/public/mini-apps/[slug]/leads/route.ts) — no new backend
 * surface, this file is the only genuinely new piece. `captureLead` fills
 * in `consentimiento`/`consentimiento_fecha`/`fecha` automatically so the
 * embedding developer never needs to know those fields exist; this implies
 * the external page already obtained the visitor's consent before calling
 * captureLead, same responsibility as any third-party integration. */
const SDK_SOURCE = `
(function () {
  window.GrowthLink = {
    _config: null,
    version: "${SDK_VERSION}",
    init: function (config) {
      this._config = config || null;
    },
    captureLead: function (lead) {
      lead = lead || {};
      if (!this._config || !this._config.apiKey || !this._config.endpoint) {
        console.error("GrowthLink SDK: llama a GrowthLink.init({ apiKey, endpoint }) antes de captureLead().");
        return Promise.reject(new Error("GrowthLink SDK no inicializado"));
      }
      var now = new Date().toISOString();
      return fetch(this._config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": this._config.apiKey },
        body: JSON.stringify({
          nombre: lead.name,
          whatsapp: lead.phone,
          email: lead.email,
          empresa: lead.company,
          notas: lead.notes,
          consentimiento: true,
          consentimiento_fecha: now,
          fecha: now,
        }),
      }).then(function (r) {
        return r.json();
      });
    },
  };
})();
`;

export async function GET() {
  return new NextResponse(SDK_SOURCE, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
