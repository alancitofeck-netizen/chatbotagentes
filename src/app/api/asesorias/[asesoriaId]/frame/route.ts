import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { getAsesoriaById } from "@/lib/asesorias/queries";
import { MEETING_OS_CSS, MEETING_OS_BODY_HTML, MEETING_OS_LOGIC_JS } from "@/lib/asesorias/meetingOsTemplate";
import { REFERRAL_SYSTEM_HTML } from "@/lib/asesorias/referralSystemTemplate";
import { createClient } from "@/lib/supabase/server";

/** Parte común de los shims del Meeting OS y del Sistema de Referidos: antes de mandar un guardado al
 * servidor, reemplaza las imágenes en base64 por su URL subida (ver el comentario adentro). Espera `ID` en
 * scope y define `sendPayload(url, rawValue)`. */
const IMAGE_OFFLOAD_JS = `
  // El editor incrusta cada imagen subida (recursos de "Referidos", logo,
  // recap) como data: URI base64 dentro del propio JSON de la plantilla
  // (compressImage()/saveLogo(), archivo verbatim) — con un par de fotos ese
  // JSON supera el límite de tamaño de las funciones serverless de Vercel y
  // el guardado falla en silencio. Antes de mandar CUALQUIER payload acá
  // abajo, reemplazamos cada data: URI por su URL subida a Storage (ver
  // upload-template-image/route.ts) — el propio Meeting OS sigue teniendo el
  // base64 en su localStorage/memoria (no tocamos eso), solo la COPIA que
  // viaja por red queda liviana. imageCache evita resubir la misma imagen en
  // cada autoguardado mientras siga en el estado.
  var imageCache = {};
  function hashString(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }
  function offloadValue(container, key) {
    var value = container[key];
    if (typeof value === "string" && value.indexOf("data:image/") === 0) {
      var hash = hashString(value);
      if (imageCache[hash]) {
        container[key] = imageCache[hash];
        return Promise.resolve();
      }
      return fetch("/api/asesorias/" + ID + "/upload-template-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: value }),
      })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (json) {
          if (json && json.url) {
            imageCache[hash] = json.url;
            container[key] = json.url;
          }
        })
        .catch(function () {});
    }
    if (value && typeof value === "object") return offloadImages(value);
    return Promise.resolve();
  }
  function offloadImages(node) {
    var keys = Array.isArray(node) ? node.map(function (_, i) { return i; }) : Object.keys(node);
    var tasks = [];
    for (var i = 0; i < keys.length; i++) tasks.push(offloadValue(node, keys[i]));
    return Promise.all(tasks);
  }
  function sendPayload(url, rawValue) {
    var parsed;
    try { parsed = JSON.parse(rawValue); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== "object") {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: rawValue, keepalive: true }).catch(function () {});
      return;
    }
    offloadImages(parsed)
      .then(function () {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed), keepalive: true }).catch(function () {});
      })
      .catch(function () {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: rawValue, keepalive: true }).catch(function () {});
      });
  }

`;

/** Sirve el documento HTML completo del Meeting OS, cargado dentro de un
 * <iframe> mismo-origen por src/app/asesorias/[asesoriaId]/page.tsx — ver el
 * comentario al inicio de meetingOsTemplate.ts para por qué un iframe (no
 * inyección directa como Mini Apps) es la única forma de servir este archivo
 * sin tocarlo ni un byte y sin arriesgar que sus 100+ funciones globales
 * (declaradas sin ningún IIFE) choquen con algo de Next.js.
 *
 * Devuelve `text/html` en vez de JSON — esto no es un endpoint de datos, es
 * la página real que el iframe navega. Por eso, a diferencia de las otras
 * rutas API de este proyecto (que devuelven 401 JSON), acá una sesión no
 * autenticada redirige a /login — igual que cualquier página normal. En la
 * práctica esto casi nunca dispara: la página contenedora
 * (src/app/asesorias/[asesoriaId]/page.tsx) ya exige sesión activa antes de
 * montar el <iframe>. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ asesoriaId: string }> }) {
  const { asesoriaId } = await params;

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  const asesoria = await getAsesoriaById(active.workspaceId, asesoriaId);
  if (!asesoria) {
    return new NextResponse("<!DOCTYPE html><html><body>Asesoría no encontrada.</body></html>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (asesoria.kind === "referidos") {
    return referralSystemFrame(asesoria.id, asesoria.state, await currentAdvisorName(active.workspaceId));
  }

  // El `state` guardado (armado por buildAsesoriaSeed en la creación, o
  // actualizado en cada autoguardado por /sync) es siempre un
  // `meetingProject` completo y válido — se siembra tal cual, sin volver a
  // construirlo acá. Mismo escape de "<" que el resto de las inyecciones de
  // datos del proyecto (Mini Apps), para que ningún valor editable (nombre,
  // notas) pueda cerrar el <script> antes de tiempo.
  const serializedSeed = JSON.stringify(asesoria.state).replace(/</g, "\\u003c");
  const serializedId = JSON.stringify(asesoria.id);

  const shim = `
window.__ASESORIA_ID__ = ${serializedId};
window.__ASESORIA_SEED__ = ${serializedSeed};
(function(){
  "use strict";
  var SEED = window.__ASESORIA_SEED__;
  var ID = window.__ASESORIA_ID__;
  if (SEED && SEED.template) {
    try { localStorage.setItem("gl-project-current", JSON.stringify(SEED)); } catch (e) {}
  }

${IMAGE_OFFLOAD_JS}
  var origSetItem = Storage.prototype.setItem;
  var timer = null;
  Storage.prototype.setItem = function (key, value) {
    origSetItem.call(this, key, value);
    if (key === "gl-project-current" && ID) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        sendPayload("/api/asesorias/" + ID + "/sync", value);
      }, 400);
    }
    // El propio Meeting OS escribe esta key SOLO cuando el asesor aprieta
    // "Guardar" en el editor (o carga/duplica una plantilla) — nunca en el
    // autoguardado silencioso de respuestas de una reunión en curso. Es la
    // señal para guardar esta plantilla como base de las asesorías nuevas
    // del workspace (ver save-master-template/route.ts) — sin tocar el
    // archivo verbatim para lograrlo.
    if (key.indexOf("gl-template-") === 0 && ID) {
      sendPayload("/api/asesorias/" + ID + "/save-master-template", value);
    }
  };
})();
`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Growth Link · Meeting OS</title>
<script>${shim}</script>
<style>${MEETING_OS_CSS}</style>
</head>
<body class="present">
${MEETING_OS_BODY_HTML}
<script>${MEETING_OS_LOGIC_JS}</script>
</body>
</html>
`;

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function currentAdvisorName(workspaceId: string): Promise<string> {
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return "";
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return ((data ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === memberId)?.full_name ?? "";
}

/** Sistema de Referidos (asesorias.kind = referidos, 0196): el HTML del usuario
 * (referralSystemTemplate.ts) con su propio shim. Diferencias con el Meeting OS:
 *  - El archivo guarda primero en IndexedDB (que este shim no podría escuchar): se desactiva, así cae a su
 *    propio respaldo en localStorage y cada guardado llega a /sync.
 *  - Sus keys de localStorage (gl-project-current, gl-template-*) son las mismas que usa el Meeting OS en
 *    este mismo origen: se guardan con el prefijo "glref:" para que una herramienta nunca lea lo de la otra.
 *  - El nombre del asesor del mensaje de WhatsApp ({{advisor.name}}) es el de quien abre la sesión: la
 *    plantilla del grupo se guarda sin nombre y acá se completa con el propio.
 *  - Se oculta la etiqueta "Modo local — los datos se guardan en este navegador": dentro del CRM es falsa.
 *  - Las notas privadas del editor se corren a la derecha, para no chocar con el botón "Volver". */
function referralSystemFrame(asesoriaId: string, state: Record<string, unknown>, advisorName: string): NextResponse {
  const seed: Record<string, unknown> = state && typeof state === "object" && (state as { template?: unknown }).template ? { ...state } : {};
  if (seed.brand && typeof seed.brand === "object" && advisorName) seed.brand = { ...(seed.brand as Record<string, unknown>), advisorName };
  const serializedSeed = JSON.stringify(seed).replace(/</g, "\\u003c");
  const serializedId = JSON.stringify(asesoriaId);
  const serializedName = JSON.stringify(advisorName).replace(/</g, "\\u003c");

  const shim = `
window.__ASESORIA_ID__ = ${serializedId};
(function(){
  "use strict";
  var SEED = ${serializedSeed};
  var ID = window.__ASESORIA_ID__;
  try { Object.defineProperty(window, "indexedDB", { configurable: true, get: function () { return undefined; } }); } catch (e) {}

  var NS = "glref:";
  var proto = Storage.prototype, origSet = proto.setItem, origGet = proto.getItem, origRemove = proto.removeItem;
  function mapKey(key) { return typeof key === "string" && key.indexOf("gl-") === 0 ? NS + key : key; }
  try {
    if (SEED && SEED.template) origSet.call(localStorage, NS + "gl-project-current", JSON.stringify(SEED));
    else origRemove.call(localStorage, NS + "gl-project-current");
  } catch (e) {}

${IMAGE_OFFLOAD_JS}

  var timer = null;
  proto.getItem = function (key) { return origGet.call(this, mapKey(key)); };
  proto.removeItem = function (key) { return origRemove.call(this, mapKey(key)); };
  proto.setItem = function (key, value) {
    origSet.call(this, mapKey(key), value);
    if (key === "gl-project-current" && ID) {
      clearTimeout(timer);
      timer = setTimeout(function () { sendPayload("/api/asesorias/" + ID + "/sync", value); }, 400);
    }
    // "Guardar" en el editor: la plantilla pasa a ser la del grupo (save-master-template/route.ts).
    if (typeof key === "string" && key.indexOf("gl-template-") === 0 && key !== "gl-template-index" && ID) {
      sendPayload("/api/asesorias/" + ID + "/save-master-template", value);
    }
  };
})();
`;

  // Después del arranque del archivo: deja el nombre de quien abre la sesión como asesor.
  const afterBoot = `
(function(){
  var NAME = ${serializedName};
  if (!NAME) return;
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    try {
      if (document.body.classList.contains("home") && typeof BR === "function") {
        clearInterval(t);
        if (BR().advisorName !== NAME) { BR().advisorName = NAME; if (typeof applyTheme === "function") applyTheme(); }
        var field = document.getElementById("hm_advisor");
        if (field && !field.value) field.value = NAME;
      }
    } catch (e) {}
    if (tries > 150) clearInterval(t);
  }, 100);
})();
`;

  // El botón "Volver" de la página contenedora va abajo a la izquierda: el botón de notas privadas del
  // editor (también abajo a la izquierda) se corre al lado del panel de propiedades.
  const style =
    "<style>.local-badge{display:none!important}body.edit #notesBtn{left:auto;right:356px}body.edit #notesPanel{left:auto;right:356px}</style>";
  let html = REFERRAL_SYSTEM_HTML.replace("<head>", `<head>\n<script>${shim}</script>\n${style}`);
  const bodyEnd = html.lastIndexOf("</body>");
  html = `${html.slice(0, bodyEnd)}<script>${afterBoot}</script>\n${html.slice(bodyEnd)}`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
