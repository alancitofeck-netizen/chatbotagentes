/**
 * Plantilla verbatim del HTML/CSS/JS adjunto por el usuario para el
 * "Cronograma de Contenido — Sujey Urías" — mismo criterio que
 * diagnosticoTemplate.ts y el resto de plantillas públicas: el diseño se
 * copia literal (clases, estructura, paleta azul/dorado/crema, tipografía
 * Fraunces/Inter/IBM Plex Mono), la ÚNICA diferencia es que feedData/
 * historiasData/referencias se leen de `window.__CONTENT_CALENDAR_DATA__`
 * (datos reales de Supabase) en vez de las constantes hardcodeadas del
 * archivo original. Versión pública = solo lectura: los `contenteditable`
 * quedan en `false` y los `<select>` de estado quedan `disabled` — la
 * edición real vive en el panel interno protegido (/mini-apps/[id]).
 */

export const CONTENT_CALENDAR_CSS = `
  :root{
    --azul:#1B2A4A; --azul-suave:#EDF0F5; --dorado:#C9A227; --crema:#F5F1E6;
    --blanco:#FFFFFF; --texto:#1B2A4A; --texto-suave:#7A7F8C; --verde-pub:#7C9473;
    --radius:14px;
  }
  .cc-page{background:var(--crema);color:var(--texto);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;padding-bottom:60px;}
  .cc-page *{box-sizing:border-box;}
  .cc-page ::selection{background:var(--azul);color:var(--blanco);}
  .cc-page .hero{background:var(--azul);padding:52px 24px 34px;text-align:center;}
  .cc-page .hero-inner{max-width:920px;margin:0 auto;}
  .cc-page .eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dorado);margin-bottom:14px;}
  .cc-page .wordmark{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(38px,7vw,64px);color:var(--blanco);line-height:1;margin:0;}
  .cc-page .hero-sub{font-family:'Fraunces',serif;font-weight:500;font-size:17px;color:var(--dorado);margin:10px 0 4px;}
  .cc-page .hero-meta{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#AEB4C4;margin-bottom:24px;}
  .cc-page .palette-strip{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
  .cc-page .swatch{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 14px 6px 6px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#D8DCE6;}
  .cc-page .swatch i{width:20px;height:20px;border-radius:50%;display:block;border:1px solid rgba(255,255,255,.2);}
  .cc-page nav{position:sticky;top:0;z-index:50;background:var(--blanco);border-bottom:1px solid rgba(27,42,74,.1);display:flex;gap:4px;padding:0 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .cc-page nav button{font-family:'Inter',sans-serif;font-weight:600;font-size:13.5px;background:none;border:none;color:var(--texto-suave);padding:16px 14px 13px;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;}
  .cc-page nav button.active{color:var(--azul);border-bottom-color:var(--dorado);}
  .cc-page main{max-width:1080px;margin:0 auto;padding:34px 20px 0;overflow-wrap:break-word;}
  @media(max-width:600px){.cc-page main{padding:24px 14px 0;} .cc-page .hero{padding:38px 16px 26px;}}
  .cc-page .tabpanel{display:none;animation:cc-fade .25s ease;} .cc-page .tabpanel.active{display:block;}
  @keyframes cc-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
  .cc-page h2.section-title{font-family:'Fraunces',serif;font-weight:600;font-size:28px;margin:0 0 6px;}
  .cc-page p.section-note{color:var(--texto-suave);font-size:14.5px;margin:0 0 26px;max-width:660px;}
  .cc-page .card{background:var(--blanco);border-radius:var(--radius);padding:22px;border:1px solid rgba(27,42,74,.08);margin-bottom:20px;}
  .cc-page .card h3{font-family:'Fraunces',serif;font-weight:600;font-size:17px;margin:0 0 10px;}
  .cc-page .card p{font-size:14px;line-height:1.6;color:var(--texto-suave);margin:0;}
  .cc-page .card ul{margin:6px 0 0;padding-left:18px;} .cc-page .card li{font-size:13.5px;line-height:1.7;color:var(--texto);}
  .cc-page .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;} @media(max-width:720px){.cc-page .grid-2{grid-template-columns:1fr;}}
  .cc-page .pie{display:flex;flex-direction:column;gap:2px;}
  .cc-page .bar{height:22px;border-radius:5px;background:var(--azul-suave);position:relative;overflow:hidden;margin:4px 0;}
  .cc-page .bar-fill{height:100%;background:var(--dorado);}
  .cc-page .week-block{margin-bottom:28px;}
  .cc-page .week-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}
  .cc-page .week-head h4{font-family:'Fraunces',serif;font-weight:600;font-size:17px;margin:0;}
  .cc-page .days-row{display:grid;grid-template-columns:repeat(7,minmax(160px,1fr));gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  @media(max-width:900px){.cc-page .days-row{grid-auto-flow:column;grid-auto-columns:78vw;}}
  @media(min-width:600px) and (max-width:900px){.cc-page .days-row{grid-auto-columns:46vw;}}
  .cc-page .day-card{background:var(--blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:13px;display:flex;flex-direction:column;gap:10px;min-height:120px;}
  .cc-page .day-card.empty{background:transparent;border-style:dashed;min-height:56px;align-items:center;justify-content:center;}
  .cc-page .day-date{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--texto-suave);}
  .cc-page .pieza{border-top:1px dashed rgba(27,42,74,.12);padding-top:8px;}
  .cc-page .pieza:first-child{border-top:none;padding-top:0;}
  .cc-page .pieza-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;}
  .cc-page .tipo-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;}
  .cc-page .tipo-HERO{background:var(--azul);color:var(--blanco);}
  .cc-page .tipo-Support{background:var(--azul-suave);color:var(--azul);}
  .cc-page .hora-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--texto-suave);}
  .cc-page .formato-txt{font-size:12.5px;font-weight:600;color:var(--texto);margin-bottom:2px;}
  .cc-page .funcion-txt{font-size:11px;color:var(--texto-suave);margin-bottom:4px;}
  .cc-page .day-idea{font-size:13px;line-height:1.45;outline:none;border-radius:6px;padding:4px;margin:0 -4px;overflow-wrap:break-word;min-height:20px;color:var(--texto);}
  .cc-page .day-idea:empty:before{content:"Hook / guión — sin definir";color:#B8BCC8;font-style:italic;}
  .cc-page .day-status{font-family:'IBM Plex Mono',monospace;font-size:11px;border:none;border-radius:999px;padding:7px 8px;width:100%;text-align:center;appearance:none;-webkit-appearance:none;margin-top:4px;}
  .cc-page select.st-pendiente{background:var(--azul-suave);color:var(--texto-suave);}
  .cc-page select.st-produccion{background:#EFE3C0;color:#7A5E10;}
  .cc-page select.st-listo{background:#DCE7DC;color:#3E5F3E;}
  .cc-page select.st-publicado{background:var(--verde-pub);color:var(--blanco);}
  .cc-page .descanso{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--texto-suave);text-align:center;}
  .cc-page .hist-tipo{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;background:var(--azul);color:var(--blanco);padding:3px 8px;border-radius:999px;align-self:flex-start;text-transform:uppercase;}
  .cc-page .hist-story{font-size:12.5px;line-height:1.5;outline:none;border-radius:6px;padding:3px 4px;margin:0 -4px;border-top:1px dashed rgba(27,42,74,.12);padding-top:6px;color:var(--texto);}
  .cc-page .hist-story:first-of-type{border-top:none;padding-top:0;}
  .cc-page .ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
  .cc-page .ref-card{background:var(--blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:16px;display:flex;flex-direction:column;gap:8px;}
  .cc-page .ref-top{display:flex;justify-content:space-between;align-items:center;}
  .cc-page .ref-creador{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--texto-suave);}
  .cc-page .ref-vistas{font-family:'Fraunces',serif;font-weight:600;font-size:15px;color:var(--dorado);}
  .cc-page .ref-producto{font-size:11px;background:var(--azul-suave);color:var(--azul);padding:2px 8px;border-radius:999px;display:inline-block;align-self:flex-start;}
  .cc-page .ref-formato{font-size:12px;color:var(--texto-suave);}
  .cc-page .ref-hook{font-size:13px;color:var(--texto);line-height:1.5;font-style:italic;}
  .cc-page .ref-card a{font-size:12.5px;color:var(--azul);text-decoration:none;font-weight:600;}
  .cc-page .ref-card a:hover{text-decoration:underline;}
  .cc-page footer{text-align:center;padding:40px 20px 10px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--texto-suave);}
`;

export const CONTENT_CALENDAR_BODY_HTML = `
<div class="cc-page">

<div class="hero">
  <div class="hero-inner">
    <span class="eyebrow">Grilla de contenido · Instagram</span>
    <h1 class="wordmark">Sujey Urías</h1>
    <p class="hero-sub">Asesora Patrimonial · PPR &amp; Protección</p>
    <p class="hero-meta">MÉXICO — CONTENIDO: GROWTH LINK</p>
  </div>
  <div class="palette-strip">
    <div class="swatch"><i style="background:#1B2A4A"></i>Azul marino · #1B2A4A</div>
    <div class="swatch"><i style="background:#C9A227"></i>Dorado · #C9A227</div>
    <div class="swatch"><i style="background:#F5F1E6"></i>Crema · #F5F1E6</div>
  </div>
</div>

<nav id="cc-tabnav">
  <button data-tab="resumen" class="active">Resumen</button>
  <button data-tab="feed">Feed &amp; Reels</button>
  <button data-tab="historias">Historias</button>
  <button data-tab="referencias">Referencias</button>
</nav>

<main>

  <section class="tabpanel active" id="cc-tab-resumen">
    <h2 class="section-title">Resumen de estrategia</h2>
    <p class="section-note">Septiembre 2026.</p>

    <div class="card">
      <h3>El patrón que mejor funciona</h3>
      <p><strong>PPR + SAT + beneficio fiscal + números concretos + hook que habla de dinero = descubrimiento.</strong> No es una corazonada: se repite en los virales de la competencia (5M, 3.6M, 2.5M, 2M vistas). Los números también son parte del formato, no solo del argumento — hacen tangible un producto financiero abstracto. Por eso el eje comercial de la cuenta debería ser PPR/retiro, no "tips financieros generales".</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Estructura semanal (7 piezas)</h3>
        <p><strong>4 Reels HERO</strong> — mayor producción, hook trabajado, guion, edición, potencial de anuncio.</p>
        <p style="margin-top:8px;"><strong>3 contenidos Support</strong> — carruseles o reels simples, menor producción, profundizan o capitalizan lo que abrió un HERO.</p>
        <p style="margin-top:8px;">Pensado así porque en el onboarding de Sujey apareció como preocupación que el proceso le demande demasiado tiempo.</p>
      </div>
      <div class="card">
        <h3>Los 4 formatos HERO</h3>
        <ul>
          <li><strong>Sketch / doble personaje</strong> — mayor techo de alcance (SAT, AFORE, cliente vs. asesora)</li>
          <li><strong>Talking Head + números/simulación</strong> — aprovecha sus 16 años de experiencia</li>
          <li><strong>Reacción / actualidad financiera</strong> — solo si hay noticia real, no fabricar por calendario</li>
          <li><strong>Storytelling / opinión / confrontación</strong> — "16 años asesorando personas", lo que la competencia no puede copiar</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <h3>Distribución temática del mes</h3>
      <div class="pie">
        <div>PPR / retiro / beneficios fiscales — 4 de 7 (eje principal)</div>
        <div class="bar"><div class="bar-fill" style="width:57%;"></div></div>
        <div>Protección patrimonial / Vida / GMM — 1 de 7</div>
        <div class="bar"><div class="bar-fill" style="width:14%;"></div></div>
        <div>Educación financiera amplia — 1 de 7</div>
        <div class="bar"><div class="bar-fill" style="width:14%;"></div></div>
        <div>Marca personal / autoridad / experiencia — 1 de 7</div>
        <div class="bar"><div class="bar-fill" style="width:14%;"></div></div>
      </div>
      <p style="margin-top:10px;">Hombre Clave (línea B2B) queda para más adelante — buen margen pero todavía no vende, no le daría el mismo volumen que a PPR mientras se construye audiencia.</p>
    </div>

    <div class="card">
      <h3>Por qué el sábado libre y el domingo doble</h3>
      <p>Sábado sin publicar. El domingo lleva dos piezas (12:00 y 20:00) para mantener el sábado completamente limpio y separar ambas publicaciones por varias horas. Nunca dos formatos iguales consecutivos.</p>
    </div>
  </section>

  <section class="tabpanel" id="cc-tab-feed">
    <h2 class="section-title">Feed &amp; Reels — Septiembre 2026</h2>
    <div id="cc-feed-weeks"></div>
  </section>

  <section class="tabpanel" id="cc-tab-historias">
    <h2 class="section-title">Historias — Septiembre 2026</h2>
    <div id="cc-hist-weeks"></div>
  </section>

  <section class="tabpanel" id="cc-tab-referencias">
    <h2 class="section-title">Referencias — Research de competencia</h2>
    <p class="section-note">Swipe file de reels virales de la competencia (PPR, seguro de vida, GMM, educación financiera), con hook, formato y métricas de cada uno.</p>
    <div class="ref-grid" id="cc-ref-grid" style="margin-top:16px;"></div>
  </section>

</main>

<footer>SUJEY URÍAS · GRILLA DE CONTENIDO · SEPTIEMBRE 2026 — GROWTH LINK</footer>

</div>
`;

/** A diferencia del HTML original (JS con const/arrow functions/template
 * literals ES6+), esto se ejecuta tal cual como texto inyectado vía
 * dangerouslySetInnerHTML — se usa `var`/`function` a propósito (mismo
 * criterio que el resto de *LogicJs de este proyecto) para evitar cualquier
 * fricción de parseo/strict-mode al inyectarlo crudo en la página. Lee los
 * datos reales desde `window.__CONTENT_CALENDAR_DATA__` (Supabase) en vez
 * de constantes hardcodeadas. Solo lectura: sin contenteditable, selects
 * deshabilitados — la edición real vive en el panel interno. */
export const CONTENT_CALENDAR_LOGIC_JS = `
(function () {
  var DATA = window.__CONTENT_CALENDAR_DATA__ || { feedData: [], historiasData: [], referencias: [] };
  var feedData = DATA.feedData;
  var historiasData = DATA.historiasData;
  var referencias = DATA.referencias;

  var STATUS = [
    { v: "pendiente", l: "Pendiente", c: "st-pendiente" },
    { v: "produccion", l: "En producción", c: "st-produccion" },
    { v: "listo", l: "Listo para publicar", c: "st-listo" },
    { v: "publicado", l: "Publicado", c: "st-publicado" }
  ];
  function statusOptions(sel) {
    return STATUS.map(function (s) {
      return '<option value="' + s.v + '" ' + (s.v === sel ? "selected" : "") + ">" + s.l + "</option>";
    }).join("");
  }
  function statusClass(sel) {
    var found = STATUS.filter(function (s) { return s.v === sel; })[0];
    return found ? found.c : "st-pendiente";
  }

  function renderFeed() {
    var container = document.getElementById("cc-feed-weeks");
    var html = "";
    feedData.forEach(function (week) {
      html += '<div class="week-block"><div class="week-head"><h4>' + week.semana + "</h4></div>" + '<div class="days-row">';
      week.dias.forEach(function (day) {
        if (day.piezas.length === 0) {
          html +=
            '<div class="day-card empty"><div><span class="day-date">' +
            day.fecha +
            '</span><div class="descanso">Descanso — no se publica</div></div></div>';
          return;
        }
        var piezasHtml = day.piezas
          .map(function (p) {
            return (
              '<div class="pieza">' +
              '<div class="pieza-top">' +
              '<span class="tipo-tag tipo-' + p.tipo + '">' + p.tipo + "</span>" +
              (p.hora ? '<span class="hora-tag">' + p.hora + "</span>" : "") +
              "</div>" +
              '<div class="formato-txt">' + p.formato + "</div>" +
              '<div class="funcion-txt">' + p.funcion + "</div>" +
              '<div class="day-idea" contenteditable="false">' + (p.idea || "") + "</div>" +
              '<select class="day-status ' + statusClass(p.status) + '" disabled>' + statusOptions(p.status) + "</select>" +
              "</div>"
            );
          })
          .join("");
        html += '<div class="day-card"><span class="day-date">' + day.fecha + "</span>" + piezasHtml + "</div>";
      });
      html += "</div></div>";
    });
    container.innerHTML = html;
  }

  function renderReferencias() {
    var grid = document.getElementById("cc-ref-grid");
    grid.innerHTML = referencias
      .map(function (r) {
        var hook = (r.hook || "").replace(/^[\\u201c\\u201d"]+|[\\u201c\\u201d"]+$/g, "");
        return (
          '<div class="ref-card">' +
          '<div class="ref-top"><span class="ref-creador">@' + r.creador + '</span><span class="ref-vistas">' + r.vistas + "</span></div>" +
          (r.producto ? '<span class="ref-producto">' + r.producto + "</span>" : "") +
          '<div class="ref-formato">' + r.formato + "</div>" +
          '<div class="ref-hook">\\u201c' + hook + '\\u201d</div>' +
          '<div class="ref-formato">' + r.comentarios + " comentarios</div>" +
          (r.url ? '<a href="' + r.url + '" target="_blank" rel="noopener">Ver en Instagram →</a>' : "") +
          "</div>"
        );
      })
      .join("");
  }

  function renderHistorias() {
    var container = document.getElementById("cc-hist-weeks");
    var html = "";
    historiasData.forEach(function (week) {
      html += '<div class="week-block"><div class="week-head"><h4>' + week.semana + "</h4></div>" + '<div class="days-row">';
      week.dias.forEach(function (day) {
        var storiesHtml = day.stories
          .map(function (s) {
            return '<div class="hist-story" contenteditable="false">' + s + "</div>";
          })
          .join("");
        html +=
          '<div class="day-card">' +
          '<span class="day-date">' + day.fecha + "</span>" +
          '<span class="hist-tipo">' + day.tipo + "</span>" +
          storiesHtml +
          "</div>";
      });
      html += "</div></div>";
    });
    container.innerHTML = html;
  }

  renderFeed();
  renderHistorias();
  renderReferencias();

  var buttons = document.querySelectorAll("#cc-tabnav button");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tabpanel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("cc-tab-" + btn.dataset.tab).classList.add("active");
    });
  });
})();
`;
