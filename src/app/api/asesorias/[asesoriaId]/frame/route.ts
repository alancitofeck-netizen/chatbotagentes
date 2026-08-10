import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getAsesoriaById } from "@/lib/asesorias/queries";
import { MEETING_OS_CSS, MEETING_OS_BODY_HTML, MEETING_OS_LOGIC_JS } from "@/lib/asesorias/meetingOsTemplate";

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
