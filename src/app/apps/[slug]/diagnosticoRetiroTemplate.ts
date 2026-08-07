/** Plantilla verbatim de "Diagnóstico Financiero - Retiro" — CSS, HTML y JS
 * copiados literal del archivo original que sirvió de base a este tipo de
 * Mini App (mismo diseño navy/dorado, gauge circular, flujo y lógica de
 * score, sin ningún rediseño). El original YA usaba `addEventListener`
 * dentro de un IIFE en cada botón (nunca `onclick=""` inline) — se preserva
 * ese wiring tal cual, sin necesidad del fix que sí hizo falta en
 * diagnosticoTemplate.ts. Las diferencias respecto del original, todas
 * dentro de DIAGNOSTICO_RETIRO_LOGIC_JS, son:
 *
 * 1. `CONFIG`/`QUESTIONS`/`AREA_LABEL` (antes hardcodeados) ahora leen de
 *    `window.__DIAGNOSTICO_RETIRO_DATA__`, inyectado por
 *    DiagnosticoRetiroApp a partir de la config guardada en el CRM.
 * 2. `AREA_MAX` deja de ser el objeto literal `{retiro:75,ahorro:75,
 *    fiscal:50,proteccion:50}` — se calcula con `computeAreaMax(QUESTIONS)`
 *    (mismo algoritmo, a mano en JS, que diagnosticoRetiroDefaults.ts
 *    exporta para el server) porque los puntajes por opción son editables
 *    desde el wizard: si el máximo quedara fijo, editar un puntaje dejaría
 *    el % de esa área matemáticamente inconsistente.
 * 3. La selección de perfil deja de ser el if/else literal
 *    (`if(overall<40){perfil="Constructor inicial"...`) y pasa a resolverse
 *    contra `DATA.umbral1`/`DATA.umbral2` + `DATA.perfiles` (3, inyectados)
 *    — único punto donde el JS cambia de FORMA, no solo de dónde lee los
 *    datos (mismo criterio para el motor server-side, ver
 *    diagnosticoRetiroEngine.ts).
 * 4. `RECO_POOL`/`THEME_POOL` (antes objetos literales con 12/4 entradas
 *    hardcodeadas) ahora leen de `DATA.recoPool`/`DATA.themePool`.
 * 5. Se agrega un `fetch` fire-and-forget a `/api/public/mini-apps/{slug}/
 *    visit` al cargar, igual que los demás tipos de Mini App, para que el
 *    conteo de visitas de la pestaña Analíticas funcione también acá (el
 *    original no lo tenía por ser un HTML standalone, sin CRM detrás).
 * 6. Dentro del handler de `btn-capture`, además de la lógica original
 *    (revelar recomendaciones, armar el link de WhatsApp al asesor), se
 *    agrega un `fetch` a `/api/public/mini-apps/{slug}/hosted-lead` con el
 *    contrato que `processLeadSubmission` (ingest.ts) exige — así el lead
 *    queda registrado en el CRM con score/perfil/áreas recalculados
 *    server-side (nunca confía en lo que calculó el navegador). Si hay
 *    `asesor.webhookUrl` configurado, se agrega también un `fetch`
 *    fire-and-forget a esa URL con una copia del resultado, mismo criterio
 *    que diagnosticoTemplate.ts.
 * 7. El logo hardcodeado en base64 (`<img src="data:image/png;base64,...">`,
 *    específico del asesor original) se reemplaza por el mecanismo genérico
 *    ya existente para todo Mini App (`branding.logoUrl`, subido desde el
 *    wizard) con fallback a iniciales — mismo patrón que
 *    DiagnosticoFinancieroApp/diagnosticoTemplate.ts.
 *
 * Todo el resto — CSS completo, estructura del HTML, y cada función de
 * DIAGNOSTICO_RETIRO_LOGIC_JS (render de preguntas, análisis animada,
 * gauge, desglose por área, captura, descarga, reset, referidos) — es una
 * copia literal del archivo original, solo generalizando el nombre/marca/
 * WhatsApp/producto hardcodeados del asesor original a los datos inyectados.
 */

export const DIAGNOSTICO_RETIRO_CSS = `
  :root{
    --navy:#030E22;
    --navy-2:#0B1A34;
    --cream:#F0E8D7;
    --cream-dim:#B7AF9C;
    --gold:#C6A667;
    --gold-bright:#E2C68C;
    --wa:#25D366;
    --danger:#D97757;
    --font-display:'Fraunces', Georgia, 'Times New Roman', serif;
    --font-body:'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
    --font-mono:'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
    --radius:18px;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    background:
      radial-gradient(ellipse 900px 500px at 50% -10%, rgba(198,166,103,0.10), transparent 60%),
      var(--navy);
    color:var(--cream);
    font-family:var(--font-body);
    min-height:100vh;
    display:flex;
    justify-content:center;
    padding:32px 16px 56px;
    line-height:1.5;
    -webkit-font-smoothing:antialiased;
  }
  .page{ width:100%; max-width:620px; }

  /* ---------- Brand bar ---------- */
  .brandbar{
    display:flex; align-items:center; gap:14px;
    margin-bottom:22px;
    opacity:0; animation:fadeUp .6s ease forwards;
  }
  .brandbar img{ width:44px; height:44px; object-fit:contain; flex-shrink:0; border-radius:10px; }
  .brandbar .brand-initials{
    width:44px; height:44px; border-radius:10px; flex-shrink:0;
    background:linear-gradient(160deg, var(--navy-2), var(--navy));
    border:1px solid rgba(240,232,215,0.14);
    color:var(--gold-bright); font-family:var(--font-display); font-weight:600; font-size:15px;
    display:flex; align-items:center; justify-content:center;
  }
  .brandbar .names{ display:flex; flex-direction:column; }
  .brandbar .asesor{ font-family:var(--font-display); font-weight:600; font-size:16px; color:var(--cream); letter-spacing:.2px;}
  .brandbar .lema{ font-size:11px; color:var(--gold); letter-spacing:1.5px; text-transform:uppercase; margin-top:2px;}

  /* ---------- Signature frame ---------- */
  .frame{
    position:relative;
    background:var(--navy-2);
    border:1px solid rgba(240,232,215,0.10);
    border-radius:var(--radius);
    padding:40px 34px;
    overflow:hidden;
  }
  .frame::after{
    content:"";
    position:absolute; inset:0;
    background:radial-gradient(circle at 85% -10%, rgba(198,166,103,0.08), transparent 55%);
    pointer-events:none;
  }
  .corner{ position:absolute; width:22px; height:22px; pointer-events:none; z-index:2;}
  .corner.tl{ top:-1px; left:-1px; border-top:2px solid var(--gold); border-left:2px solid var(--gold); border-top-left-radius:9px;}
  .corner.tr{ top:-1px; right:-1px; border-top:2px solid var(--gold); border-right:2px solid var(--gold); border-top-right-radius:9px;}
  .corner.bl{ bottom:-1px; left:-1px; border-bottom:2px solid var(--gold); border-left:2px solid var(--gold); border-bottom-left-radius:9px;}
  .corner.br{ bottom:-1px; right:-1px; border-bottom:2px solid var(--gold); border-right:2px solid var(--gold); border-bottom-right-radius:9px;}

  .screen{ display:none; }
  .screen.active{ display:block; }

  @media (prefers-reduced-motion: no-preference){
    .stagger > *{ opacity:0; animation:fadeUp .55s ease forwards; }
    .stagger > *:nth-child(1){animation-delay:.02s;}
    .stagger > *:nth-child(2){animation-delay:.10s;}
    .stagger > *:nth-child(3){animation-delay:.18s;}
    .stagger > *:nth-child(4){animation-delay:.26s;}
    .stagger > *:nth-child(5){animation-delay:.34s;}
    .stagger > *:nth-child(6){animation-delay:.42s;}
  }
  @media (prefers-reduced-motion: reduce){
    .stagger > *{ opacity:1; }
    .brandbar{opacity:1;}
  }
  @keyframes fadeUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }

  /* ---------- Typography ---------- */
  .eyebrow{
    display:inline-flex; align-items:center; gap:6px;
    font-size:11px; letter-spacing:1.6px; text-transform:uppercase;
    color:var(--gold); font-weight:600; margin-bottom:18px;
  }
  .eyebrow .dot{ width:5px; height:5px; border-radius:50%; background:var(--gold); }
  h1{
    font-family:var(--font-display); font-weight:600; font-style:italic;
    font-size:clamp(24px,5vw,32px); line-height:1.22; margin:0 0 14px;
    color:var(--cream);
  }
  .lead{ color:var(--cream-dim); font-size:15px; margin:0 0 26px; }
  .meta-row{ display:flex; gap:10px; margin-bottom:28px; }
  .meta-chip{
    font-size:12px; color:var(--cream-dim); background:rgba(240,232,215,0.06);
    border:1px solid rgba(240,232,215,0.12); padding:6px 12px; border-radius:100px;
  }

  /* ---------- Buttons ---------- */
  .btn{
    font-family:var(--font-body); font-weight:600; font-size:14.5px;
    border-radius:12px; border:none; cursor:pointer;
    padding:14px 22px; transition:transform .15s ease, filter .15s ease, opacity .15s ease;
  }
  .btn:focus-visible{ outline:2px solid var(--gold-bright); outline-offset:2px; }
  .btn-primary{ background:var(--gold); color:var(--navy); }
  .btn-primary:hover{ filter:brightness(1.08); }
  .btn-primary:disabled{ opacity:.35; cursor:not-allowed; }
  .btn-ghost{ background:transparent; color:var(--cream-dim); border:1px solid rgba(240,232,215,0.18); }
  .btn-ghost:hover{ color:var(--cream); border-color:rgba(240,232,215,0.32); }
  .btn-wa{ background:var(--wa); color:#04210f; display:inline-flex; align-items:center; gap:8px; text-decoration:none; }
  .btn-wa:hover{ filter:brightness(1.06); }
  .btn-block{ width:100%; }
  .btn-row{ display:flex; gap:10px; margin-top:28px; flex-wrap:wrap; }
  .btn-row .btn{ flex:1; min-width:140px; text-align:center; }

  /* ---------- Questions ---------- */
  .progress-track{ height:4px; background:rgba(240,232,215,0.10); border-radius:100px; overflow:hidden; margin-bottom:10px; }
  .progress-fill{ height:100%; background:linear-gradient(90deg, var(--gold), var(--gold-bright)); width:0%; transition:width .5s ease; }
  .progress-label{ display:flex; justify-content:space-between; font-size:11.5px; color:var(--cream-dim); margin-bottom:24px; font-family:var(--font-mono); }
  .q-eyebrow{ font-size:11px; letter-spacing:1.4px; text-transform:uppercase; color:var(--gold); font-weight:600; margin-bottom:10px; }
  .q-text{ font-family:var(--font-display); font-size:21px; font-weight:600; line-height:1.35; margin:0 0 24px; }
  .options{ display:flex; flex-direction:column; gap:10px; }
  .option{
    display:flex; align-items:center; gap:14px; text-align:left;
    background:rgba(240,232,215,0.03); border:1px solid rgba(240,232,215,0.14);
    border-radius:12px; padding:15px 16px; cursor:pointer; color:var(--cream);
    font-family:var(--font-body); font-size:14.5px; transition:border-color .15s ease, background .15s ease;
  }
  .option:hover{ border-color:rgba(198,166,103,0.5); background:rgba(198,166,103,0.06); }
  .option.selected{ border-color:var(--gold); background:rgba(198,166,103,0.12); }
  .option .letter{
    width:24px; height:24px; border-radius:50%; flex-shrink:0;
    border:1px solid rgba(240,232,215,0.3); display:flex; align-items:center; justify-content:center;
    font-family:var(--font-mono); font-size:11px; color:var(--cream-dim);
  }
  .option.selected .letter{ background:var(--gold); border-color:var(--gold); color:var(--navy); }
  .q-nav{ display:flex; justify-content:space-between; margin-top:28px; }

  /* ---------- Analyzing ---------- */
  .analyzing{ text-align:center; padding:20px 0 8px; }
  .spinner{
    width:56px; height:56px; margin:0 auto 26px; border-radius:50%;
    border:2px solid rgba(240,232,215,0.15); border-top-color:var(--gold);
    animation:spin 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce){ .spinner{ animation:none; } }
  @keyframes spin{ to{ transform:rotate(360deg);} }
  .analyzing h2{ font-family:var(--font-display); font-weight:600; font-size:20px; margin:0 0 22px; }
  .check-list{ display:flex; flex-direction:column; gap:12px; text-align:left; max-width:280px; margin:0 auto; }
  .check-item{ display:flex; align-items:center; gap:10px; font-size:14px; color:var(--cream-dim); }
  .check-item .mark{
    width:18px; height:18px; border-radius:50%; border:1px solid rgba(240,232,215,0.25);
    flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px;
    transition:background .3s ease, border-color .3s ease;
  }
  .check-item.done .mark{ background:var(--gold); border-color:var(--gold); color:var(--navy); }
  .check-item.done{ color:var(--cream); }

  /* ---------- Result ---------- */
  .score-wrap{ display:flex; flex-direction:column; align-items:center; margin-bottom:8px; }
  .gauge{ position:relative; width:150px; height:150px; margin-bottom:16px; }
  .gauge svg{ transform:rotate(-90deg); width:100%; height:100%; }
  .gauge-bg{ fill:none; stroke:rgba(240,232,215,0.10); stroke-width:9; }
  .gauge-fill{ fill:none; stroke:var(--gold); stroke-width:9; stroke-linecap:round; transition:stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1); }
  .gauge-center{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .gauge-score{ font-family:var(--font-mono); font-weight:600; font-size:34px; color:var(--cream); font-variant-numeric:tabular-nums; }
  .gauge-of100{ font-size:10px; color:var(--cream-dim); letter-spacing:1px; margin-top:2px; }
  .perfil-badge{
    font-size:12px; font-weight:600; color:var(--navy); background:var(--gold);
    padding:5px 14px; border-radius:100px; margin-bottom:18px; letter-spacing:.3px;
  }
  .result-headline{ font-family:var(--font-display); font-weight:600; font-size:22px; text-align:center; margin:0 0 10px; }
  .result-desc{ color:var(--cream-dim); font-size:14.5px; text-align:center; margin:0 0 30px; }

  .areas{ display:flex; flex-direction:column; gap:16px; margin-bottom:6px; }
  .area-row .area-top{ display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; }
  .area-row .area-name{ color:var(--cream); font-weight:500; }
  .area-row .area-val{ font-family:var(--font-mono); color:var(--gold-bright); font-variant-numeric:tabular-nums; }
  .area-track{ height:6px; border-radius:100px; background:rgba(240,232,215,0.08); overflow:hidden; }
  .area-fill{ height:100%; border-radius:100px; width:0%; background:linear-gradient(90deg, var(--gold), var(--gold-bright)); transition:width 1s cubic-bezier(.2,.7,.2,1); }

  .divider{ height:1px; background:rgba(240,232,215,0.10); margin:32px 0; border:none; }

  /* ---------- Capture ---------- */
  .capture h3{ font-family:var(--font-display); font-weight:600; font-size:19px; margin:0 0 6px; }
  .capture p.sub{ color:var(--cream-dim); font-size:13.5px; margin:0 0 20px; }
  .field{ margin-bottom:14px; }
  .field label{ display:block; font-size:12.5px; color:var(--cream-dim); margin-bottom:6px; }
  .field input{
    width:100%; background:rgba(240,232,215,0.04); border:1px solid rgba(240,232,215,0.18);
    border-radius:10px; padding:12px 14px; color:var(--cream); font-family:var(--font-body); font-size:14px;
  }
  .field input:focus-visible{ outline:none; border-color:var(--gold); }
  .field input::placeholder{ color:rgba(183,175,156,0.5); }
  .consent{ display:flex; gap:10px; align-items:flex-start; margin:18px 0 22px; }
  .consent input{ margin-top:3px; accent-color:var(--gold); flex-shrink:0; }
  .consent label{ font-size:12px; color:var(--cream-dim); line-height:1.5; }

  /* ---------- Recommendations ---------- */
  .reveal{ display:none; }
  .reveal.show{ display:block; }
  .recos{ display:flex; flex-direction:column; gap:14px; margin:0 0 4px; }
  .reco{ display:flex; gap:14px; background:rgba(240,232,215,0.03); border:1px solid rgba(240,232,215,0.10); border-radius:12px; padding:16px; }
  .reco .num{
    font-family:var(--font-mono); font-weight:600; color:var(--gold); font-size:13px;
    width:24px; height:24px; border-radius:50%; border:1px solid rgba(198,166,103,0.4);
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .reco p{ margin:0; font-size:13.8px; color:var(--cream-dim); line-height:1.55; }

  .disclaimer-inline{ font-size:11.5px; color:var(--cream-dim); opacity:.75; margin-top:22px; text-align:center; }

  /* ---------- Referral ---------- */
  .referral-card{
    margin-top:36px; padding-top:30px; border-top:1px solid rgba(240,232,215,0.10);
  }
  .referral-card h3{ font-family:var(--font-display); font-weight:600; font-size:18px; margin:0 0 6px; }
  .referral-card p.sub{ color:var(--cream-dim); font-size:13px; margin:0 0 20px; }
  .ref-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
  .ref-row input{
    background:rgba(240,232,215,0.04); border:1px solid rgba(240,232,215,0.18);
    border-radius:10px; padding:11px 13px; color:var(--cream); font-family:var(--font-body); font-size:13.5px;
  }
  .ref-consent{ display:flex; gap:8px; align-items:center; margin-bottom:20px; }
  .ref-consent input{ accent-color:var(--gold); }
  .ref-consent label{ font-size:11.5px; color:var(--cream-dim); }
  .ref-block{ margin-bottom:22px; padding-bottom:18px; border-bottom:1px dashed rgba(240,232,215,0.12); }
  .ref-block:last-child{ border-bottom:none; }
  #referral-add{ font-size:13px; color:var(--gold); background:none; border:none; cursor:pointer; padding:0; margin-bottom:18px; text-decoration:underline; }
  .ref-results{ display:flex; flex-direction:column; gap:10px; margin-top:18px; }
  .ref-result-item{ display:flex; justify-content:space-between; align-items:center; gap:10px; background:rgba(240,232,215,0.03); border:1px solid rgba(240,232,215,0.10); border-radius:10px; padding:12px 14px; }
  .ref-result-item span{ font-size:13px; }
  .ref-code{ font-family:var(--font-mono); font-size:11px; color:var(--gold-bright); text-align:center; margin-top:4px; }
  .small-wa{ background:var(--wa); color:#04210f; text-decoration:none; font-size:12.5px; font-weight:600; padding:8px 12px; border-radius:8px; white-space:nowrap; }

  footer.page-disclaimer{ text-align:center; margin-top:24px; font-size:11.5px; color:var(--cream-dim); opacity:.6; }

  @media (max-width:480px){
    .frame{ padding:30px 20px; }
    .ref-row{ grid-template-columns:1fr; }
    h1{ font-size:23px; }
  }
`;

export const DIAGNOSTICO_RETIRO_BODY_HTML = `
<div class="page">

  <div class="brandbar">
    <img class="brand-logo" id="brand-logo" src="" alt="" style="display:none">
    <span class="brand-initials" id="brand-initials" style="display:none"></span>
    <div class="names">
      <span class="asesor" id="brand-asesor">—</span>
      <span class="lema" id="brand-lema">—</span>
    </div>
  </div>

  <main class="frame" id="app">
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>

    <!-- LANDING -->
    <section class="screen active stagger" id="screen-landing">
      <div class="eyebrow"><span class="dot"></span>Diagnóstico interactivo</div>
      <h1 id="hero-pregunta">—</h1>
      <p class="lead" id="hero-sub">—</p>
      <div class="meta-row">
        <span class="meta-chip">⏱ ~3 min</span>
        <span class="meta-chip">☑ 8 preguntas</span>
      </div>
      <button class="btn btn-primary" id="btn-start">Comenzar diagnóstico →</button>
    </section>

    <!-- QUESTIONS -->
    <section class="screen" id="screen-questions">
      <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
      <div class="progress-label"><span id="progress-text">Pregunta 1 de 8</span><span id="progress-pct">13%</span></div>
      <div class="q-eyebrow" id="q-eyebrow">Pregunta 1 de 8</div>
      <p class="q-text" id="q-text">—</p>
      <div class="options" id="q-options"></div>
      <div class="q-nav">
        <button class="btn btn-ghost" id="btn-prev">← Anterior</button>
        <button class="btn btn-primary" id="btn-next" disabled>Siguiente →</button>
      </div>
    </section>

    <!-- ANALYZING -->
    <section class="screen" id="screen-analyzing">
      <div class="analyzing">
        <div class="spinner"></div>
        <h2>Analizando tus respuestas</h2>
        <div class="check-list">
          <div class="check-item" id="chk-1"><span class="mark"></span>Evaluando respuestas...</div>
          <div class="check-item" id="chk-2"><span class="mark"></span>Calculando tu perfil...</div>
          <div class="check-item" id="chk-3"><span class="mark"></span>Generando recomendaciones...</div>
        </div>
      </div>
    </section>

    <!-- RESULT -->
    <section class="screen" id="screen-result">
      <div class="score-wrap">
        <div class="gauge">
          <svg viewBox="0 0 120 120">
            <circle class="gauge-bg" cx="60" cy="60" r="52"></circle>
            <circle class="gauge-fill" id="gauge-fill" cx="60" cy="60" r="52" stroke-dasharray="326.7" stroke-dashoffset="326.7"></circle>
          </svg>
          <div class="gauge-center">
            <span class="gauge-score" id="gauge-score">0</span>
            <span class="gauge-of100">PUNTOS DE 100</span>
          </div>
        </div>
        <span class="perfil-badge" id="perfil-badge">—</span>
        <h2 class="result-headline" id="result-headline">—</h2>
        <p class="result-desc" id="result-desc">—</p>
      </div>

      <div class="areas" id="areas"></div>

      <hr class="divider">

      <!-- CAPTURE (gate) -->
      <div class="capture" id="capture-block">
        <h3>Recibe tu diagnóstico completo</h3>
        <p class="sub">Compártenos tus datos y desbloquea tus 3 recomendaciones personalizadas.</p>
        <div class="field">
          <label for="cap-nombre">Nombre</label>
          <input type="text" id="cap-nombre" placeholder="Tu nombre">
        </div>
        <div class="field">
          <label for="cap-whatsapp">WhatsApp</label>
          <input type="tel" id="cap-whatsapp" placeholder="55 1234 5678">
        </div>
        <div class="field">
          <label for="cap-email">Correo (opcional)</label>
          <input type="email" id="cap-email" placeholder="tu@correo.com">
        </div>
        <div class="consent">
          <input type="checkbox" id="cap-consent">
          <label for="cap-consent" id="cap-consent-label">—</label>
        </div>
        <button class="btn btn-primary btn-block" id="btn-capture" disabled>Ver mis recomendaciones →</button>
      </div>

      <!-- REVEALED CONTENT -->
      <div class="reveal" id="reveal-block">
        <div class="recos" id="recos"></div>
        <p class="disclaimer-inline" id="disclaimer-text">—</p>

        <div class="btn-row">
          <a class="btn btn-wa btn-block" id="btn-wa-asesor" href="#" target="_blank" rel="noopener">💬 Hablar por WhatsApp</a>
          <button class="btn btn-ghost" id="btn-download">Descargar resultado</button>
          <button class="btn btn-ghost" id="btn-reset">Empezar de nuevo</button>
        </div>

        <!-- REFERRALS -->
        <div class="referral-card">
          <h3>¿Conoces a alguien a quien le sirva este diagnóstico?</h3>
          <p class="sub">Compártelo tú mismo — tu recomendación queda registrada con tu código <span id="ref-code-inline" style="color:var(--gold-bright); font-family:var(--font-mono);">—</span>.</p>
          <div id="ref-rows"></div>
          <button id="referral-add">+ Agregar otro referido</button>
          <button class="btn btn-primary btn-block" id="btn-referral-generate">Generar mensajes de WhatsApp</button>
          <div class="ref-results" id="ref-results"></div>
        </div>
      </div>
    </section>

  </main>

  <footer class="page-disclaimer" id="footer-text">—</footer>
</div>
`;

export const DIAGNOSTICO_RETIRO_LOGIC_JS = `
(function(){
"use strict";
const DATA = window.__DIAGNOSTICO_RETIRO_DATA__;
const SLUG = DATA.slug;

fetch("/api/public/mini-apps/" + SLUG + "/visit", { method: "POST", keepalive: true }).catch(function(){});

const CONFIG = {
  asesor: DATA.asesor,
  referido: DATA.referido,
  producto: DATA.producto,
  textos: DATA.textos
};

document.getElementById('brand-asesor').textContent = CONFIG.asesor.nombre;
document.getElementById('brand-lema').textContent = CONFIG.asesor.lema;
const brandLogo = document.getElementById('brand-logo');
const brandInitials = document.getElementById('brand-initials');
if (CONFIG.asesor.logoUrl) {
  brandLogo.src = CONFIG.asesor.logoUrl;
  brandLogo.alt = CONFIG.asesor.nombre;
  brandLogo.style.display = '';
  brandInitials.style.display = 'none';
} else {
  brandLogo.style.display = 'none';
  brandInitials.style.display = 'flex';
  brandInitials.textContent = (CONFIG.asesor.nombre || '??').slice(0,2).toUpperCase();
}
document.getElementById('hero-pregunta').textContent = CONFIG.textos.heroPregunta;
document.getElementById('hero-sub').textContent = CONFIG.textos.heroSub;
document.getElementById('disclaimer-text').textContent = CONFIG.textos.disclaimer;
document.getElementById('cap-consent-label').textContent = CONFIG.textos.consentLabel;
document.getElementById('footer-text').textContent = (CONFIG.asesor.marca || CONFIG.asesor.nombre) + " — " + CONFIG.asesor.nombre + " © " + new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ QUESTIONS ============ */
const QUESTIONS = DATA.questions;
const AREA_LABEL = DATA.areaLabels;
const AREAS = ['retiro','ahorro','proteccion','fiscal'];

/* Máximo posible por área a partir de las preguntas ACTUALES — nunca una
   constante (ver el comentario al inicio del archivo). Mismo algoritmo,
   a mano en JS vanilla, que computeAreaMax en diagnosticoRetiroDefaults.ts. */
function computeAreaMax(questions){
  const max = { retiro:0, ahorro:0, fiscal:0, proteccion:0 };
  questions.forEach(function(q){
    AREAS.forEach(function(area){
      let best = 0;
      q.options.forEach(function(o){
        const v = (o.points && o.points[area]) || 0;
        if (v > best) best = v;
      });
      max[area] += best;
    });
  });
  return max;
}
const AREA_MAX = computeAreaMax(QUESTIONS);

/* ============ STATE ============ */
const state = {
  idx:0,
  answers: new Array(QUESTIONS.length).fill(null),
  areaScores:{}, overall:0, perfil:"", headline:"", desc:"",
  theme:"", referralCode:"", captured:false,
  referralRowCount:0
};

/* ============ NAVIGATION: LANDING -> QUESTIONS ============ */
const screens = {
  landing: document.getElementById('screen-landing'),
  questions: document.getElementById('screen-questions'),
  analyzing: document.getElementById('screen-analyzing'),
  result: document.getElementById('screen-result')
};
function showScreen(name){
  Object.values(screens).forEach(function(s){ s.classList.remove('active'); });
  screens[name].classList.add('active');
}

document.getElementById('btn-start').addEventListener('click', function(){
  showScreen('questions');
  renderQuestion();
});

/* ============ QUESTIONS RENDER ============ */
const qEyebrow = document.getElementById('q-eyebrow');
const qText = document.getElementById('q-text');
const qOptions = document.getElementById('q-options');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressPct = document.getElementById('progress-pct');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

function renderQuestion(){
  const i = state.idx;
  const q = QUESTIONS[i];
  const total = QUESTIONS.length;
  const pct = Math.round(((i+1)/total)*100);

  qEyebrow.textContent = "Pregunta " + (i+1) + " de " + total;
  progressText.textContent = "Pregunta " + (i+1) + " de " + total;
  progressPct.textContent = pct + "%";
  progressFill.style.width = pct + "%";
  qText.textContent = q.text;

  qOptions.innerHTML = "";
  const letters = ["A","B","C","D"];
  q.options.forEach(function(opt, oi){
    const div = document.createElement('button');
    div.type = "button";
    div.className = "option" + (state.answers[i]===oi ? " selected" : "");
    div.innerHTML = '<span class="letter">'+letters[oi]+'</span><span>'+opt.label+'</span>';
    div.addEventListener('click', function(){ selectOption(oi); });
    qOptions.appendChild(div);
  });

  btnPrev.style.visibility = i===0 ? "hidden" : "visible";
  btnNext.disabled = state.answers[i]===null;
  btnNext.textContent = (i===total-1) ? "Ver resultado →" : "Siguiente →";
}

function selectOption(oi){
  state.answers[state.idx] = oi;
  renderQuestion();
}

btnPrev.addEventListener('click', function(){
  if(state.idx>0){ state.idx--; renderQuestion(); }
});
btnNext.addEventListener('click', function(){
  if(state.idx < QUESTIONS.length-1){
    state.idx++; renderQuestion();
  } else {
    finishQuestions();
  }
});

/* ============ ANALYZING ============ */
function finishQuestions(){
  showScreen('analyzing');
  ['chk-1','chk-2','chk-3'].forEach(function(id){ document.getElementById(id).classList.remove('done'); });
  const delays = reduceMotion ? [0,0,0] : [500, 1100, 1700];
  const totalDelay = reduceMotion ? 50 : 2100;
  delays.forEach(function(d, idx){
    setTimeout(function(){ document.getElementById('chk-'+(idx+1)).classList.add('done'); }, d);
  });
  setTimeout(function(){
    computeResults();
    showScreen('result');
    renderResult();
  }, totalDelay);
}

/* ============ SCORING ============ */
function computeResults(){
  const sums = { retiro:0, ahorro:0, fiscal:0, proteccion:0 };
  let themeChosen = "";
  QUESTIONS.forEach(function(q, i){
    const oi = state.answers[i];
    if(oi===null) return;
    const opt = q.options[oi];
    AREAS.forEach(function(area){ sums[area] += (opt.points && opt.points[area]) || 0; });
    if(opt.theme) themeChosen = opt.theme;
  });
  state.theme = themeChosen;

  const areaScores = {};
  AREAS.forEach(function(area){
    areaScores[area] = AREA_MAX[area] > 0 ? Math.round((sums[area] / AREA_MAX[area]) * 100) : 0;
  });
  state.areaScores = areaScores;
  state.overall = Math.round((areaScores.retiro + areaScores.ahorro + areaScores.fiscal + areaScores.proteccion) / 4);

  const perfiles = DATA.perfiles;
  const perfil = state.overall < DATA.umbral1 ? perfiles[0] : (state.overall < DATA.umbral2 ? perfiles[1] : perfiles[2]);
  state.perfil = perfil.name;
  state.headline = perfil.headline;
  state.desc = perfil.desc;
}

function tier(score){ return score<45 ? 'low' : (score<75 ? 'mid' : 'high'); }

const RECO_POOL = DATA.recoPool;
const THEME_POOL = DATA.themePool;

function getRecommendations(){
  const entries = Object.entries(state.areaScores).sort(function(a,b){ return a[1]-b[1]; });
  const recs = [];
  for(let k=0;k<entries.length && recs.length<2;k++){
    const area = entries[k][0];
    const key = area+"_"+tier(entries[k][1]);
    if(RECO_POOL[key]){ recs.push(RECO_POOL[key]); }
  }
  if(state.theme && THEME_POOL[state.theme]) recs.push(THEME_POOL[state.theme]);
  return recs;
}

/* ============ RESULT RENDER ============ */
function renderResult(){
  const circumference = 2 * Math.PI * 52;
  const gaugeFill = document.getElementById('gauge-fill');
  const gaugeScore = document.getElementById('gauge-score');
  const target = state.overall;
  const offset = circumference - (target/100)*circumference;
  requestAnimationFrame(function(){ gaugeFill.style.strokeDashoffset = offset; });

  if(reduceMotion){
    gaugeScore.textContent = target;
  } else {
    let cur = 0;
    const step = Math.max(1, Math.round(target/40));
    const iv = setInterval(function(){
      cur += step;
      if(cur>=target){ cur=target; clearInterval(iv); }
      gaugeScore.textContent = cur;
    }, 20);
  }

  document.getElementById('perfil-badge').textContent = state.perfil;
  document.getElementById('result-headline').textContent = state.headline;
  document.getElementById('result-desc').textContent = state.desc;

  const areasEl = document.getElementById('areas');
  areasEl.innerHTML = "";
  AREAS.forEach(function(area){
    const val = state.areaScores[area];
    const row = document.createElement('div');
    row.className = 'area-row';
    row.innerHTML = '<div class="area-top"><span class="area-name">'+AREA_LABEL[area]+'</span><span class="area-val">'+val+'/100</span></div><div class="area-track"><div class="area-fill" data-val="'+val+'"></div></div>';
    areasEl.appendChild(row);
  });
  requestAnimationFrame(function(){
    document.querySelectorAll('.area-fill').forEach(function(el){ el.style.width = el.dataset.val + '%'; });
  });

  document.getElementById('capture-block').style.display = 'block';
  document.getElementById('reveal-block').classList.remove('show');
}

/* ============ CAPTURE ============ */
const capNombre = document.getElementById('cap-nombre');
const capWhats = document.getElementById('cap-whatsapp');
const capEmail = document.getElementById('cap-email');
const capConsent = document.getElementById('cap-consent');
const btnCapture = document.getElementById('btn-capture');

function validateCapture(){
  const ok = capNombre.value.trim().length>1 && capWhats.value.trim().length>=8 && capConsent.checked;
  btnCapture.disabled = !ok;
}
[capNombre, capWhats, capConsent].forEach(function(el){
  el.addEventListener('input', validateCapture);
  el.addEventListener('change', validateCapture);
});

function genReferralCode(nombre){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<4;i++){ code += chars[Math.floor(Math.random()*chars.length)]; }
  return CONFIG.referido.prefijoCodigo + "-" + code;
}

btnCapture.addEventListener('click', function(){
  if(btnCapture.disabled) return;
  state.captured = true;
  state.referralCode = genReferralCode(capNombre.value.trim());
  document.getElementById('ref-code-inline').textContent = state.referralCode;

  document.getElementById('capture-block').style.display = 'none';
  const recos = getRecommendations();
  const recosEl = document.getElementById('recos');
  recosEl.innerHTML = "";
  recos.forEach(function(text, i){
    const div = document.createElement('div');
    div.className = 'reco';
    div.innerHTML = '<span class="num">'+(i+1)+'</span><p>'+text+'</p>';
    recosEl.appendChild(div);
  });

  const nombre = capNombre.value.trim();
  const whats = capWhats.value.trim();
  const emailVal = capEmail.value.trim();
  const emailNote = emailVal ? (" Mi correo es " + emailVal + ".") : "";
  const waMsg = "Hola " + CONFIG.asesor.nombre + ", soy " + nombre + ". Hice tu Diagnóstico Financiero con IA y obtuve " + state.overall + "/100 (perfil: “" + state.perfil + "”)." + emailNote + " Me gustaría platicar sobre mis próximos pasos.";
  document.getElementById('btn-wa-asesor').href = "https://wa.me/" + CONFIG.asesor.whatsapp + "?text=" + encodeURIComponent(waMsg);

  document.getElementById('reveal-block').classList.add('show');

  /* registra el lead en el CRM — nunca confía el server en el score/perfil/
     áreas que pudiera calcular este navegador, siempre los recalcula desde
     las respuestas crudas (ver diagnosticoRetiroEngine.ts). */
  const nowIso = new Date().toISOString();
  const leadPayload = {
    nombre: nombre,
    whatsapp: whats,
    fecha: nowIso,
    consentimiento: true,
    consentimiento_fecha: nowIso,
    answers: state.answers
  };
  if (emailVal) leadPayload.email = emailVal;
  fetch("/api/public/mini-apps/" + SLUG + "/hosted-lead", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(leadPayload)
  }).catch(function(){});

  if(CONFIG.asesor.webhookUrl){
    fetch(CONFIG.asesor.webhookUrl, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ nombre:nombre, whatsapp:whats, email:emailVal, score:state.overall, perfil:state.perfil, areas:state.areaScores, ts:nowIso })
    }).catch(function(){});
  }
});

/* ============ DOWNLOAD ============ */
document.getElementById('btn-download').addEventListener('click', function(){
  const recos = getRecommendations();
  const fecha = new Date().toLocaleDateString('es-MX', {year:'numeric', month:'long', day:'numeric'});
  const marcaOrNombre = CONFIG.asesor.marca || CONFIG.asesor.nombre;
  let txt = "DIAGNÓSTICO FINANCIERO — " + marcaOrNombre + "\\n";
  txt += "Asesor: " + CONFIG.asesor.nombre + "\\n";
  txt += "Fecha: " + fecha + "\\n\\n";
  txt += "Resultado: " + state.overall + "/100 — " + state.perfil + "\\n";
  txt += state.headline + "\\n\\n";
  txt += "Desglose por área:\\n";
  AREAS.forEach(function(a){
    txt += "- " + AREA_LABEL[a] + ": " + state.areaScores[a] + "/100\\n";
  });
  txt += "\\nRecomendaciones:\\n";
  recos.forEach(function(r,i){ txt += (i+1) + ". " + r + "\\n\\n"; });
  txt += CONFIG.textos.disclaimer + "\\n";

  const blob = new Blob([txt], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = "diagnostico-financiero-retiro.txt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ============ RESET ============ */
document.getElementById('btn-reset').addEventListener('click', function(){
  state.idx = 0;
  state.answers = new Array(QUESTIONS.length).fill(null);
  state.captured = false;
  capNombre.value = ""; capWhats.value = ""; capEmail.value = ""; capConsent.checked = false;
  document.getElementById('ref-rows').innerHTML = "";
  document.getElementById('ref-results').innerHTML = "";
  state.referralRowCount = 0;
  addReferralRow();
  showScreen('landing');
});

/* ============ REFERRALS ============ */
const refRows = document.getElementById('ref-rows');
const refAddBtn = document.getElementById('referral-add');

function addReferralRow(){
  if(state.referralRowCount >= 3) return;
  state.referralRowCount++;
  const n = state.referralRowCount;
  const block = document.createElement('div');
  block.className = 'ref-block';
  block.dataset.row = n;
  block.innerHTML =
    '<div class="ref-row">' +
      '<input type="text" placeholder="Nombre del referido" class="ref-nombre">' +
      '<input type="tel" placeholder="WhatsApp (10 dígitos)" class="ref-whats">' +
    '</div>' +
    '<div class="ref-consent">' +
      '<input type="checkbox" class="ref-consent-check" id="ref-consent-'+n+'">' +
      '<label for="ref-consent-'+n+'">Tengo su consentimiento para compartir sus datos de contacto</label>' +
    '</div>';
  refRows.appendChild(block);
  if(state.referralRowCount >= 3) refAddBtn.style.display = 'none';
}
refAddBtn.addEventListener('click', addReferralRow);
addReferralRow();

function normalizePhone(raw){
  let digits = raw.replace(/\\D/g,'');
  if(digits.length===10) digits = "52" + digits;
  return digits;
}

document.getElementById('btn-referral-generate').addEventListener('click', function(){
  const blocks = refRows.querySelectorAll('.ref-block');
  const valid = [];
  blocks.forEach(function(b){
    const nombre = b.querySelector('.ref-nombre').value.trim();
    const whats = b.querySelector('.ref-whats').value.trim();
    const consent = b.querySelector('.ref-consent-check').checked;
    if(nombre && whats && consent){ valid.push({nombre:nombre, whats:whats}); }
  });

  const resultsEl = document.getElementById('ref-results');
  resultsEl.innerHTML = "";

  if(valid.length===0){
    const warn = document.createElement('p');
    warn.style.cssText = "font-size:12.5px; color:var(--danger); margin-top:8px;";
    warn.textContent = "Agrega al menos un referido con nombre, WhatsApp y su consentimiento marcado.";
    resultsEl.appendChild(warn);
    return;
  }

  const asesorLabel = CONFIG.asesor.marca ? (CONFIG.asesor.nombre + " (" + CONFIG.asesor.marca + ")") : CONFIG.asesor.nombre;
  const miNombre = capNombre.value.trim() || ("un cliente de " + (CONFIG.asesor.marca || CONFIG.asesor.nombre));
  const linkTxt = " Aquí está el link: " + window.location.href;

  valid.forEach(function(r){
    const inviteMsg = "Hola " + r.nombre + "! Te comparto este diagnóstico financiero de " + asesorLabel + " — a mí me sirvió." + linkTxt + " Cuando lo hagas, menciona que te contacté yo (código " + state.referralCode + ").";
    const item = document.createElement('div');
    item.className = 'ref-result-item';
    item.innerHTML = '<span>' + r.nombre + '</span><a class="small-wa" target="_blank" rel="noopener" href="https://wa.me/' + normalizePhone(r.whats) + '?text=' + encodeURIComponent(inviteMsg) + '">Enviarle mensaje</a>';
    resultsEl.appendChild(item);
  });

  const listaTexto = valid.map(function(r){ return r.nombre + " (" + r.whats + ")"; }).join(", ");
  const asesorMsg = "Hola " + CONFIG.asesor.nombre + ", soy " + miNombre + ". Te quiero referir a: " + listaTexto + ". Mi código de referido es " + state.referralCode + ".";
  const asesorItem = document.createElement('div');
  asesorItem.className = 'ref-result-item';
  asesorItem.innerHTML = '<span>Avisarle a ' + CONFIG.asesor.nombre + ' de estos referidos</span><a class="small-wa" target="_blank" rel="noopener" href="https://wa.me/' + CONFIG.asesor.whatsapp + '?text=' + encodeURIComponent(asesorMsg) + '">Avisar</a>';
  resultsEl.appendChild(asesorItem);

  const codeNote = document.createElement('p');
  codeNote.className = 'ref-code';
  codeNote.textContent = "Código de referido: " + state.referralCode;
  resultsEl.appendChild(codeNote);
});

})();
`;
