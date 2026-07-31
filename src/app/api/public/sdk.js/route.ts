import { NextResponse } from "next/server";
import { SDK_VERSION } from "@/lib/miniApps/linkedAppOptions";

/** Generic JS SDK for "Vincular App" — served as a Route Handler (not a
 * static public/ file) so the response can carry an explicit Content-Type +
 * cache lifetime. Works for ANY mini app, not just app_vinculada:
 * `endpoint`/`apiKey` are supplied at `init()` time, reusing the exact same
 * public ingestion route every hosted template already POSTs to
 * (src/app/api/public/mini-apps/[slug]/leads/route.ts) — no new backend
 * surface besides the two small fixes documented in ingest.ts/
 * bundle-upload/route.ts.
 *
 * v2 adds fully automatic capture: any <form> submit, or a click on a
 * button/submit-input whose visible text is a common action word (Guardar/
 * Continuar/Enviar/Calcular/Finalizar/...), reads every field on the page
 * (or just that form), maps common field-name aliases (English/Spanish) to
 * the canonical keys ingest.ts/fieldDictionary.ts already recognize, and
 * fires a background sync once a name+phone are known — no
 * preventDefault()/stopPropagation() anywhere, so the embedding app's own
 * behavior is never touched. `captureLead`/`captureForm` remain as manual
 * escape hatches. Written in plain ES5-style JS (var/function, no arrow
 * functions/const/let, no template literals) since this runs inside
 * arbitrary third-party HTML with an unknown build/transpile baseline. */
const SDK_SOURCE = `
(function () {
  var VERSION = "${SDK_VERSION}";

  // ---- config + accumulator state (module-scope closure, not on
  // window.GrowthLink itself, so arbitrary page script can't clobber it) ----
  var currentConfig = null;
  var memoryStore = {};

  function storageKey(appId) {
    return "growthlink_capture_" + appId;
  }

  // sessionStorage throws SecurityError from an opaque origin (GrowthLink-
  // hosted bundles render inside a sandboxed iframe without
  // allow-same-origin, by design — see LinkedAppLanding.tsx) — the
  // in-memory object is the real store; sessionStorage is a best-effort
  // extra that degrades silently everywhere it isn't available.
  function loadAccumulator(appId) {
    if (memoryStore[appId]) return memoryStore[appId];
    var fromSession = null;
    try {
      var raw = window.sessionStorage.getItem(storageKey(appId));
      if (raw) fromSession = JSON.parse(raw);
    } catch (e) {}
    var acc = fromSession || { fields: {}, sessionId: null, lastSentSnapshot: null };
    memoryStore[appId] = acc;
    return acc;
  }

  function saveAccumulator(appId, acc) {
    memoryStore[appId] = acc;
    try {
      window.sessionStorage.setItem(storageKey(appId), JSON.stringify(acc));
    } catch (e) {}
  }

  function getScriptOrigin() {
    // document.currentScript is only the sdk.js <script> tag itself while
    // sdk.js's own top-level code is synchronously executing — by the time
    // init() runs (called from the embedding page's OWN separate <script>
    // block), currentScript is that inline script instead, which has no
    // src at all. Fall back to finding the sdk.js tag by its src, which
    // stays in the DOM regardless of when init() is called.
    var scriptEl = document.currentScript;
    if (!scriptEl || !scriptEl.src) scriptEl = document.querySelector('script[src*="sdk.js"]');
    if (!scriptEl || !scriptEl.src) return null;
    try {
      return new URL(scriptEl.src).origin;
    } catch (e) {
      return null;
    }
  }

  // ---- field-name alias mapping ----
  // Exact match only, never substring — "companyname"/"username" must never
  // alias to the name field just because they contain "name".
  function normalizeKey(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  var NAME_ISH_ALIASES = ["nombre", "nombrecompleto", "fullname", "name", "firstname", "first", "primernombre"];
  var LASTNAME_ALIASES = ["apellido", "apellidos", "lastname", "last", "surname"];
  var PHONE_ALIASES = ["whatsapp", "telefono", "phone", "celular", "mobile", "numerotelefono", "tel"];

  var FIELD_ALIASES = {
    fecha_nacimiento: ["fechanacimiento", "birthdate", "dob", "dateofbirth"],
    lugar_nacimiento: ["lugarnacimiento", "birthplace"],
    sexo: ["sexo", "sex", "gender"],
    estado_civil: ["estadocivil", "maritalstatus"],
    profesion: ["profesion", "profession", "career"],
    ocupacion: ["ocupacion", "occupation", "job"],
    empresa: ["empresa", "company", "employer"],
    antiguedad_laboral: ["antiguedadlaboral", "tenure", "employmenttenure"],
    ingreso_mensual: ["ingresomensual", "monthlyincome", "income", "salary"],
    estatura: ["estatura", "height", "altura"],
    peso: ["peso", "weight"],
    fuma: ["fuma", "smoker", "smokes"],
    alcohol: ["alcohol", "drinksalcohol", "bebealcohol"],
    actividad_fisica: ["actividadfisica", "exercise", "exercises", "physicalactivity"],
    estudios: ["estudios", "education", "studies"],
    profesion_obtenida: ["profesionobtenida", "degree", "degreeobtained"],
    especializaciones: ["especializaciones", "specializations"],
    hobbies: ["hobbies", "hobby"],
    deportes: ["deportes", "sports"],
    intereses: ["intereses", "interests"],
    email: ["email", "correo", "mail"],
    ciudad: ["ciudad", "city"],
    provincia: ["provincia", "province", "state"],
    pais: ["pais", "country"]
  };

  function buildAliasSet(list) {
    var set = {};
    for (var i = 0; i < list.length; i++) set[normalizeKey(list[i])] = true;
    return set;
  }

  function buildReverseAliasMap() {
    var map = {};
    for (var i = 0; i < PHONE_ALIASES.length; i++) map[normalizeKey(PHONE_ALIASES[i])] = "whatsapp";
    for (var key in FIELD_ALIASES) {
      if (!Object.prototype.hasOwnProperty.call(FIELD_ALIASES, key)) continue;
      var aliases = FIELD_ALIASES[key];
      for (var j = 0; j < aliases.length; j++) map[normalizeKey(aliases[j])] = key;
    }
    return map;
  }

  var NAME_ISH_SET = buildAliasSet(NAME_ISH_ALIASES);
  var LASTNAME_SET = buildAliasSet(LASTNAME_ALIASES);
  var REVERSE_ALIAS = buildReverseAliasMap();

  // "nombre"/"name"/"firstname" alone is ambiguous (full name in a
  // single-field form, or just a first name in a form that also has a
  // separate apellido/lastname field) — resolved by combining the two only
  // when both are actually present, never guessed otherwise.
  function mapRawFields(raw) {
    var mapped = {};
    var nameIsh = null;
    var lastName = null;
    for (var rawKey in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, rawKey)) continue;
      var value = raw[rawKey];
      if (value === "" || value === null || value === undefined) continue;
      var norm = normalizeKey(rawKey);
      if (LASTNAME_SET[norm]) {
        lastName = value;
        continue;
      }
      if (NAME_ISH_SET[norm]) {
        nameIsh = value;
        continue;
      }
      var canonical = REVERSE_ALIAS[norm];
      mapped[canonical || rawKey] = value;
    }
    if (nameIsh && lastName) mapped.nombre = nameIsh + " " + lastName;
    else if (nameIsh) mapped.nombre = nameIsh;
    else if (lastName) mapped.nombre = lastName;
    return mapped;
  }

  // ---- reading fields from the DOM ----
  var SKIP_INPUT_TYPES = { submit: true, button: true, reset: true, file: true, password: true, image: true };

  function readFieldsFromScope(scope) {
    var raw = {};
    var elements = scope.querySelectorAll("input, select, textarea");
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el.disabled) continue;
      var name = el.name || el.id;
      if (!name) continue;
      var type = (el.type || "").toLowerCase();
      if (SKIP_INPUT_TYPES[type]) continue;

      var value;
      if (type === "checkbox" || type === "radio") {
        if (!el.checked) continue;
        value = el.value || "on";
      } else if (el.tagName === "SELECT" && el.multiple) {
        var selected = [];
        for (var o = 0; o < el.options.length; o++) {
          if (el.options[o].selected) selected.push(el.options[o].value);
        }
        value = selected.join(", ");
      } else {
        value = el.value;
      }
      if (value === "" || value === null || value === undefined) continue;

      if (Object.prototype.hasOwnProperty.call(raw, name)) {
        raw[name] = raw[name] + ", " + value;
      } else {
        raw[name] = value;
      }
    }
    return raw;
  }

  // ---- send pipeline ----
  function stableStringify(obj) {
    var keys = Object.keys(obj).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(JSON.stringify(keys[i]) + ":" + JSON.stringify(obj[keys[i]]));
    }
    return "{" + parts.join(",") + "}";
  }

  function generateSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "gl-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function mergeIntoAccumulator(appId, mapped) {
    var acc = loadAccumulator(appId);
    for (var k in mapped) {
      if (Object.prototype.hasOwnProperty.call(mapped, k)) acc.fields[k] = mapped[k];
    }
    saveAccumulator(appId, acc);
    return acc;
  }

  function maybeSend() {
    if (!currentConfig || !currentConfig.appId || !currentConfig.apiKey || !currentConfig.endpoint) return;
    var acc = loadAccumulator(currentConfig.appId);
    var fields = acc.fields;
    // The server hard-requires both — keep buffering silently until both
    // show up (no failed requests / console noise on early steps).
    if (!fields.nombre || !fields.whatsapp) return;

    var snapshot = stableStringify(fields);
    if (acc.lastSentSnapshot === snapshot) return;

    if (!acc.sessionId) acc.sessionId = generateSessionId();
    acc.lastSentSnapshot = snapshot;
    saveAccumulator(currentConfig.appId, acc);

    var now = new Date().toISOString();
    var payload = {};
    for (var k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) payload[k] = fields[k];
    }
    payload.consentimiento = true;
    payload.consentimiento_fecha = now;
    payload.fecha = now;
    payload.growthlink_session_id = acc.sessionId;
    payload.pagina_origen = window.location.href;

    fetch(currentConfig.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": currentConfig.apiKey },
      body: JSON.stringify(payload),
    }).catch(function () {});
  }

  function processCapture(rawFields) {
    if (!currentConfig || !currentConfig.appId) return;
    var mapped = mapRawFields(rawFields);
    mergeIntoAccumulator(currentConfig.appId, mapped);
    maybeSend();
  }

  // ---- automatic listeners: never preventDefault()/stopPropagation(),
  // the embedding app's own behavior is never touched ----
  var ACTION_WORD_PATTERNS = [
    "guardar", "continuar", "siguiente", "finalizar", "calcular", "enviar",
    "empezar", "comenzar", "confirmar",
    "submit", "continue", "next", "finish", "calculate", "save", "send"
  ].map(function (w) {
    return new RegExp("\\\\b" + w + "\\\\b", "i");
  });

  function isActionWord(text) {
    var norm = String(text || "").trim();
    if (!norm) return false;
    for (var i = 0; i < ACTION_WORD_PATTERNS.length; i++) {
      if (ACTION_WORD_PATTERNS[i].test(norm)) return true;
    }
    return false;
  }

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      processCapture(readFieldsFromScope(form));
    },
    true,
  );

  document.addEventListener(
    "click",
    function (e) {
      var target = e.target;
      var el = target && typeof target.closest === "function" ? target.closest("button, input[type=submit]") : null;
      if (!el) return;
      if (el.closest("form")) return; // already covered by the submit listener above
      var label = el.tagName === "INPUT" ? el.value : el.textContent;
      if (!isActionWord(label)) return;
      processCapture(readFieldsFromScope(document));
    },
    true,
  );

  // ---- public API ----
  window.GrowthLink = {
    version: VERSION,
    init: function (config) {
      config = config || {};
      var endpoint = config.endpoint;
      if (!endpoint && config.appId) {
        var origin = getScriptOrigin();
        if (origin) endpoint = origin + "/api/public/mini-apps/" + config.appId + "/leads";
      }
      currentConfig = {
        appId: config.appId || null,
        apiKey: config.apiKey,
        endpoint: endpoint,
        workspaceId: config.workspaceId || null,
      };
    },
    // Manual/advanced escape hatch — runs the same read+map+maybe-send
    // pipeline on a given form/container explicitly.
    captureForm: function (el) {
      if (!el) return;
      processCapture(readFieldsFromScope(el));
    },
    // Unchanged from v1 — fixed-shape manual lead capture, kept for
    // backward compat with snippets already pasted into external HTML.
    captureLead: function (lead) {
      lead = lead || {};
      if (!currentConfig || !currentConfig.apiKey || !currentConfig.endpoint) {
        console.error("GrowthLink SDK: llama a GrowthLink.init({ appId, apiKey }) antes de captureLead().");
        return Promise.reject(new Error("GrowthLink SDK no inicializado"));
      }
      var now = new Date().toISOString();
      return fetch(currentConfig.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": currentConfig.apiKey },
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
