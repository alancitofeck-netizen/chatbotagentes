/** Plantilla verbatim de "Diagnóstico de Solidez Financiera" — CSS, HTML y
 * JS copiados literal del archivo original que sirvió de base a este tipo
 * de Mini App (mismo diseño, tipografía Fraunces/Hanken Grotesk, paletas de
 * color, animaciones, flujo de 12 preguntas y lógica de score, sin ningún
 * rediseño). Las ÚNICAS diferencias respecto del original, dentro de
 * DIAGNOSTICO_SOLIDEZ_LOGIC_JS, son:
 *
 * 1. `THEME_ACTIVE` y `BRAND_CONFIG` (antes hardcodeados como `const`)
 *    ahora leen de `window.__DIAGNOSTICO_SOLIDEZ_DATA__`, inyectado por
 *    DiagnosticoSolidezApp a partir de la config guardada en el CRM.
 *    `THEMES`, `QUESTIONS`, `TIERS` y `DIM_TEXT` quedan tal cual —no son
 *    editables desde el wizard en esta versión.
 * 2. Dentro de `sendLeadToCRM(lead)`, además del `fetch` original a
 *    `BRAND_CONFIG.webhookURL` (que se deja intacto — sigue disparando solo
 *    si el asesor configuró su propio webhook externo), se agrega un
 *    `fetch` a `/api/public/mini-apps/{slug}/hosted-lead` con el contrato
 *    que `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. La UI de resultado no cambia en nada.
 * 3. Se agrega un `fetch` fire-and-forget a `/api/public/mini-apps/{slug}/
 *    visit` al cargar, igual que los demás tipos de Mini App, para que el
 *    conteo de visitas de la pestaña Analíticas funcione también acá.
 * 4. Los 6 botones que en el HTML original llamaban a sus funciones vía
 *    atributos `onclick="..."` inline (que dependen de que esas funciones
 *    existan como globals de `window`) pasan a conectarse con
 *    `addEventListener` dentro de un IIFE — mismo motivo documentado en
 *    diagnosticoTemplate.ts: `window.next` puede quedar pisado por el
 *    propio runtime de Next.js. Mismos ids ya existentes (qBack/revealBtn/
 *    calendlyBtn/waBtn/fab) más 2 ids nuevos agregados al HTML solo para
 *    poder engancharlos (btnStart/btnRestart) — ningún cambio visual.
 *
 * Todo el resto — CSS, HTML, y cada función de DIAGNOSTICO_SOLIDEZ_LOGIC_JS —
 * es una copia literal del archivo original.
 */

export const DIAGNOSTICO_SOLIDEZ_CSS = `

  :root{
    --ink:#0F2436; --ink-2:#16344C; --accent:#B08D4C; --accent-d:#967534; --accent-2:#C9A15E;
    --solid:#2E6E5B; --alert:#B5623A;
    --bg-1:#EEF1F2; --bg-2:#E4E9EB; --paper:#FCFCFB; --muted:#5D6B79; --line:#DCE0E1; --danger:#B4472F;
    --glow:rgba(176,141,76,.28);
    --shadow:0 30px 70px -32px rgba(15,36,54,.55); --shadow-sm:0 4px 18px -8px rgba(15,36,54,.30);
    --f-display:'Fraunces',Georgia,serif; --f-body:'Hanken Grotesk',system-ui,-apple-system,sans-serif; --r:24px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font-family:var(--f-body);color:var(--ink);line-height:1.5;min-height:100vh;
    display:flex;flex-direction:column;align-items:center;
    padding:20px 16px calc(20px + env(safe-area-inset-bottom));
    background:
      radial-gradient(1000px 520px at 15% -8%, var(--glow), transparent 55%),
      radial-gradient(900px 480px at 100% 8%, rgba(46,110,91,.08), transparent 52%),
      linear-gradient(170deg, var(--bg-1), var(--bg-2));
    background-attachment:fixed;
  }
  .shell{width:100%;max-width:512px;margin:auto 0}

  .advisor{display:flex;align-items:center;gap:12px;padding:11px 15px;margin-bottom:16px;
    background:rgba(252,252,251,.72);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.6);
    border-radius:18px;box-shadow:var(--shadow-sm)}
  .advisor img,.advisor .avatar-fallback{width:46px;height:46px;border-radius:13px;object-fit:cover;flex:0 0 auto}
  .avatar-fallback{background:linear-gradient(145deg,var(--ink),var(--ink-2));color:var(--paper);display:grid;place-items:center;
    font-family:var(--f-display);font-weight:600;font-size:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)}
  .advisor .who{display:flex;flex-direction:column;line-height:1.25}
  .advisor .who b{font-size:14.5px;font-weight:600}
  .advisor .who span{font-size:12px;color:var(--muted)}
  .advisor .badge{margin-left:auto;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-d);
    font-weight:700;text-align:right;white-space:nowrap}

  .card{position:relative;background:var(--paper);border:1px solid rgba(255,255,255,.7);border-radius:var(--r);
    box-shadow:var(--shadow);overflow:hidden}
  .pad{padding:30px 26px}
  @media (max-width:400px){ .pad{padding:26px 20px} }

  .rail{height:5px;background:var(--line);width:100%;position:relative;overflow:hidden}
  .rail>i{display:block;height:100%;width:0;border-radius:0 4px 4px 0;
    background:linear-gradient(90deg,var(--accent-2),var(--accent));
    transition:width .5s cubic-bezier(.4,0,.1,1);box-shadow:0 0 12px var(--glow)}

  .qmeta{font-size:12px;color:var(--muted);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .qmeta .dim{color:var(--accent-d);font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px;
    background:var(--glow);padding:4px 10px;border-radius:20px}

  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-d);font-weight:700;
    margin-bottom:14px;display:inline-flex;align-items:center;gap:8px}
  .eyebrow::before{content:"";width:22px;height:1.5px;background:var(--accent)}
  h1{font-family:var(--f-display);font-weight:600;font-size:clamp(29px,7.8vw,38px);line-height:1.06;letter-spacing:-.015em;margin-bottom:16px}
  h1 em{font-style:italic;color:var(--accent-d);font-weight:600}
  h2{font-family:var(--f-display);font-weight:600;font-size:24px;line-height:1.14;margin-bottom:6px}
  .lede{font-size:15.5px;color:var(--muted);margin-bottom:24px}
  .q{font-size:21px;font-weight:600;line-height:1.28;margin-bottom:6px;font-family:var(--f-display);letter-spacing:-.01em}
  .qsub{font-size:13.5px;color:var(--muted);margin-bottom:20px}

  .ticks{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;margin:22px 0 26px}
  .tick{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink);font-weight:500}
  .tick .tc{width:22px;height:22px;border-radius:50%;background:rgba(46,110,91,.12);display:grid;place-items:center;flex:0 0 auto}

  .btn{font-family:var(--f-body);font-size:16px;font-weight:600;width:100%;padding:17px 20px;border:none;border-radius:15px;cursor:pointer;
    background:linear-gradient(145deg,var(--ink),var(--ink-2));color:var(--paper);
    transition:transform .14s ease,box-shadow .25s;display:flex;align-items:center;justify-content:center;gap:9px;
    box-shadow:0 12px 26px -12px rgba(15,36,54,.6);position:relative;overflow:hidden}
  .btn::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.14),transparent 70%);
    transform:translateX(-120%);transition:transform .6s}
  .btn:hover::after{transform:translateX(120%)}
  .btn:hover{transform:translateY(-1px)}
  .btn:active{transform:scale(.987)}
  .btn.brass{background:linear-gradient(145deg,var(--accent-2),var(--accent-d));box-shadow:0 14px 30px -12px var(--glow)}
  .btn.wa{background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;box-shadow:0 12px 26px -12px rgba(37,211,102,.55)}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:var(--bg-1)}
  .btn[disabled]{opacity:.45;cursor:not-allowed}

  .choices{display:flex;flex-direction:column;gap:11px}
  .choice{text-align:left;width:100%;padding:16px 17px;border:1.5px solid var(--line);border-radius:15px;background:var(--paper);
    cursor:pointer;transition:.18s cubic-bezier(.4,0,.2,1);display:flex;gap:14px;align-items:center;
    font-family:var(--f-body);font-size:15px;color:var(--ink);position:relative}
  .choice:hover{border-color:var(--ink);transform:translateX(3px);box-shadow:var(--shadow-sm)}
  .choice.sel{border-color:var(--accent);background:linear-gradient(100deg,var(--glow),transparent)}
  .choice .mark{width:23px;height:23px;border-radius:50%;border:2px solid var(--line);flex:0 0 auto;display:grid;place-items:center;transition:.18s}
  .choice.sel .mark{border-color:var(--accent);background:var(--accent);box-shadow:0 0 0 4px var(--glow)}
  .choice.sel .mark::after{content:"";width:8px;height:8px;border-radius:50%;background:#fff}

  .scale{display:flex;gap:9px;margin-top:6px}
  .scale button{flex:1;aspect-ratio:1;border:1.5px solid var(--line);border-radius:14px;background:var(--paper);
    font-family:var(--f-display);font-size:19px;font-weight:600;color:var(--ink);cursor:pointer;transition:.18s}
  .scale button:hover{border-color:var(--ink);transform:translateY(-2px)}
  .scale button.sel{background:linear-gradient(145deg,var(--accent-2),var(--accent-d));border-color:var(--accent);color:#fff;box-shadow:0 8px 18px -8px var(--glow)}
  .scale-ends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:9px}

  .back{background:none;border:none;color:var(--muted);font-family:var(--f-body);font-size:13.5px;cursor:pointer;
    padding:4px 0;margin-bottom:16px;display:inline-flex;gap:6px;align-items:center;transition:.15s}
  .back:hover{color:var(--ink);gap:9px}
  .reassure{font-size:12.5px;color:var(--muted);text-align:center;margin-top:18px;line-height:1.45}

  .analyze{padding:52px 26px;text-align:center}
  .orb{width:96px;height:96px;margin:0 auto 30px;position:relative}
  .orb .core{position:absolute;inset:20px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,var(--accent-2),var(--accent-d));box-shadow:0 0 40px var(--glow);
    animation:pulse 1.8s ease-in-out infinite}
  .orb .ring{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;
    border-top-color:var(--accent);border-right-color:var(--accent);animation:spin 1.1s linear infinite}
  .orb .ring.r2{inset:10px;border-top-color:var(--solid);border-right-color:transparent;animation-duration:1.6s;animation-direction:reverse;opacity:.7}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.08);opacity:1}}
  .analyze h2{margin-bottom:26px}
  .checks{display:flex;flex-direction:column;gap:13px;max-width:300px;margin:0 auto;text-align:left}
  .chk{display:flex;align-items:center;gap:12px;font-size:14.5px;color:var(--muted);opacity:.35;transform:translateY(6px);
    transition:.5s cubic-bezier(.22,1,.36,1)}
  .chk.on{opacity:1;transform:none;color:var(--ink);font-weight:500}
  .chk .cbox{width:24px;height:24px;border-radius:8px;border:2px solid var(--line);flex:0 0 auto;display:grid;place-items:center;transition:.3s}
  .chk.on .cbox{background:var(--solid);border-color:var(--solid)}
  .chk .cbox svg{opacity:0;transition:.3s .1s}
  .chk.on .cbox svg{opacity:1}

  .gate{padding:6px 26px 26px}
  .teaser{position:relative;border-radius:18px;overflow:hidden;margin-bottom:22px;box-shadow:var(--shadow-sm)}
  .teaser .blurwrap{filter:blur(7px);opacity:.9;pointer-events:none;user-select:none;padding:22px;
    background:linear-gradient(160deg,var(--ink),var(--ink-2))}
  .teaser .lock{position:absolute;inset:0;display:grid;place-items:center;text-align:center;
    background:linear-gradient(180deg,rgba(252,252,251,.15),rgba(252,252,251,.72))}
  .teaser .lock span{font-size:13px;font-weight:600;color:var(--ink);background:var(--paper);padding:10px 16px;border-radius:22px;
    box-shadow:var(--shadow-sm);display:inline-flex;gap:7px;align-items:center}
  .tzr{display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px;color:#B7C4D1}
  .tzr b{font-family:var(--f-display)}

  .field{margin-bottom:15px}
  .field label{display:block;font-size:14px;font-weight:600;margin-bottom:8px}
  .field .sub{font-weight:400;color:var(--muted);font-size:12.5px}
  .field input{width:100%;font-family:var(--f-body);font-size:16px;padding:14px 15px;border:1.5px solid var(--line);
    border-radius:13px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--glow)}
  .field.err input{border-color:var(--danger)}
  .field .msg{font-size:12.5px;color:var(--danger);margin-top:6px;display:none}
  .field.err .msg{display:block}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

  .consent{display:flex;gap:11px;align-items:flex-start;margin:8px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.45}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--solid)}
  .consent a{color:var(--ink);text-decoration:underline}

  .result-head{position:relative;padding:34px 26px 30px;text-align:center;color:var(--paper);overflow:hidden;
    background:linear-gradient(165deg,var(--ink),var(--ink-2))}
  .result-head::before{content:"";position:absolute;top:-40%;left:50%;transform:translateX(-50%);width:340px;height:340px;
    border-radius:50%;background:radial-gradient(circle,var(--glow),transparent 65%);opacity:.9}
  .result-head>*{position:relative}
  .result-head .eyebrow{color:var(--accent-2);justify-content:center}
  .result-head .eyebrow::before{background:var(--accent-2)}
  .gauge{position:relative;width:212px;height:212px;margin:8px auto 6px}
  .gauge svg{transform:rotate(-90deg);overflow:visible}
  .gauge .score{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .gauge .score b{font-family:var(--f-display);font-size:58px;font-weight:700;line-height:1;color:var(--paper);letter-spacing:-.02em}
  .gauge .score i{font-style:normal;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#9DB0C0;margin-top:4px}
  .tier{font-family:var(--f-display);font-size:21px;font-weight:600;color:var(--accent-2);margin-top:10px}
  .tier-desc{font-size:14px;color:#B7C4D1;margin-top:9px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.55}

  .breakdown{padding:26px}
  .breakdown h3{font-family:var(--f-display);font-size:17px;font-weight:600;margin-bottom:4px}
  .breakdown .subh{font-size:13px;color:var(--muted);margin-bottom:20px}
  .dimrow{margin-bottom:16px}
  .dimrow .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
  .dimrow .top b{font-size:14px;font-weight:600}
  .dimrow .top span{font-family:var(--f-display);font-size:14.5px;font-weight:600;color:var(--muted)}
  .dimrow .track{height:9px;background:var(--bg-1);border-radius:6px;overflow:hidden;border:1px solid var(--line)}
  .dimrow .fill{height:100%;width:0;border-radius:6px;transition:width 1.1s cubic-bezier(.22,1,.36,1)}
  .fill.hi{background:linear-gradient(90deg,#3F8D75,var(--solid))}
  .fill.mid{background:linear-gradient(90deg,var(--accent-2),var(--accent))}
  .fill.lo{background:linear-gradient(90deg,#C9784E,var(--alert))}

  .interp{padding:6px 26px 10px}
  .ibox{padding:17px 19px;border-radius:16px;margin-bottom:13px;border:1px solid var(--line);animation:rise .5s both}
  .ibox .h{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
  .ibox p{font-size:14px;color:var(--ink);line-height:1.6}
  .ibox.win{background:rgba(46,110,91,.07);border-color:rgba(46,110,91,.28)}
  .ibox.win .h{color:var(--solid)}
  .ibox.watch{background:rgba(181,98,58,.06);border-color:rgba(181,98,58,.24)}
  .ibox.watch .h{color:var(--alert)}
  .ibox.opp{background:var(--glow);border-color:var(--accent)}
  .ibox.opp .h{color:var(--accent-d)}
  .ibox b{font-weight:700}

  .cta-block{padding:22px 26px 28px;border-top:1px solid var(--line)}
  .cta-block h3{font-family:var(--f-display);font-size:20px;font-weight:600;margin-bottom:9px}
  .cta-block p{font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:9px}
  .review-card{background:linear-gradient(150deg,var(--bg-1),var(--bg-2));border:1px solid var(--line);border-radius:16px;
    padding:15px 17px;margin:18px 0;display:flex;gap:13px;align-items:center}
  .review-card .rc-ico{width:42px;height:42px;border-radius:12px;background:linear-gradient(145deg,var(--ink),var(--ink-2));
    color:var(--accent-2);display:grid;place-items:center;flex:0 0 auto;font-family:var(--f-display);font-weight:600}
  .review-card b{display:block;font-size:14px}
  .review-card span{font-size:12.5px;color:var(--muted)}
  .cta-block .btn+.btn{margin-top:11px}
  .restart{background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;margin:14px auto 0;display:block;font-family:var(--f-body)}
  .restart:hover{color:var(--ink)}

  .disclaimer{font-size:11px;color:var(--muted);line-height:1.5;padding:18px 26px 24px;border-top:1px solid var(--line)}
  .disclaimer b{color:var(--ink);font-weight:600}
  .foot{text-align:center;font-size:11px;color:var(--muted);margin-top:18px;padding-bottom:4px}
  .foot b{color:var(--ink);font-weight:600}

  .fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:50;display:flex;align-items:center;
    background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;border-radius:30px;
    box-shadow:0 10px 30px -8px rgba(37,211,102,.6);text-decoration:none;overflow:hidden;transition:.28s}
  .fab .ic{width:54px;height:54px;display:grid;place-items:center;flex:0 0 auto}
  .fab .lbl{max-width:0;opacity:0;white-space:nowrap;font-size:13.5px;font-weight:700;transition:.28s;overflow:hidden}
  .fab:hover .lbl{max-width:240px;opacity:1;padding-right:20px}
  @media (hover:none){ .fab .lbl{display:none} }

  .step{display:none}
  .step.on{display:block;animation:rise .45s cubic-bezier(.22,1,.36,1)}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
`;

export const DIAGNOSTICO_SOLIDEZ_BODY_HTML = `
<div class="shell">

  <div class="advisor">
    <div class="avatar-fallback" id="advAvatar">P</div>
    <div class="who"><b id="advName">Patricio Jaik</b><span id="advTitle">Asesor patrimonial</span></div>
    <div class="badge" id="advBadge"></div>
  </div>

  <div class="card">
    <div class="rail"><i id="rail"></i></div>

    <!-- Portada -->
    <div class="step on pad" data-step="intro">
      <div class="eyebrow">Diagnóstico de Solidez Financiera</div>
      <h1>¿Qué tan sólida está realmente <em>tu estructura financiera</em>?</h1>
      <p class="lede">Puedes tener buenos ingresos y aun así tener áreas importantes de tu patrimonio desprotegidas. Descubre tus fortalezas y áreas de atención en menos de 3 minutos.</p>
      <div class="ticks">
        <div class="tick"><span class="tc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2E6E5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span> 3 minutos</div>
        <div class="tick"><span class="tc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2E6E5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Resultado personalizado</div>
        <div class="tick"><span class="tc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2E6E5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Sin llamadas ni reuniones</div>
        <div class="tick"><span class="tc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2E6E5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Información confidencial</div>
      </div>
      <button class="btn brass" id="btnStart">Comenzar mi diagnóstico →</button>
      <p class="reassure">No necesitas ingresar información bancaria, contraseñas ni datos financieros sensibles.</p>
    </div>

    <!-- Pregunta -->
    <div class="step pad" data-step="question">
      <button class="back" id="qBack">← Atrás</button>
      <div class="qmeta"><span id="qCount">Pregunta 1 de 12</span><span class="dim" id="qDim">Protección</span></div>
      <div class="q" id="qText">…</div>
      <div class="qsub" id="qSub"></div>
      <div id="qBody"></div>
      <p class="reassure" id="qReassure">No existen respuestas correctas o incorrectas. Tus respuestas solo se usan para generar tu diagnóstico.</p>
    </div>

    <!-- Análisis -->
    <div class="step analyze" data-step="analyze">
      <div class="orb"><div class="ring"></div><div class="ring r2"></div><div class="core"></div></div>
      <h2>Analizando tus respuestas</h2>
      <div class="checks" id="checks">
        <div class="chk" data-i="0"><span class="cbox"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Evaluando tu protección y liquidez…</div>
        <div class="chk" data-i="1"><span class="cbox"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Calculando tu perfil por área…</div>
        <div class="chk" data-i="2"><span class="cbox"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Generando tu interpretación…</div>
      </div>
    </div>

    <!-- Gate -->
    <div class="step gate" data-step="gate">
      <div style="padding:28px 0 4px">
        <div class="eyebrow">Tu diagnóstico está listo</div>
        <h2 style="margin-bottom:9px">¿A dónde enviamos tu resultado?</h2>
        <p class="lede" style="margin-bottom:20px">Déjanos dónde enviarte tu diagnóstico completo, con tu puntuación por área e interpretación personalizada.</p>
      </div>
      <div class="teaser">
        <div class="blurwrap">
          <div style="color:var(--accent-2);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;text-align:center">Tu Índice de Solidez Financiera</div>
          <div style="font-family:var(--f-display);font-weight:700;color:#fff;font-size:54px;line-height:1;text-align:center;margin:8px 0">XX/100</div>
          <div class="tzr"><span>Protección</span><b>XX</b></div>
          <div class="tzr"><span>Retiro</span><b>XX</b></div>
          <div class="tzr" style="margin-bottom:0"><span>Eficiencia fiscal</span><b>XX</b></div>
        </div>
        <div class="lock"><span>🔒 Desbloquea tu diagnóstico completo</span></div>
      </div>
      <div class="grid2">
        <div class="field" id="f_nombre"><label>Nombre</label><input type="text" id="nombre" placeholder="Tu nombre" autocomplete="given-name"><div class="msg">Escribe tu nombre.</div></div>
        <div class="field" id="f_apellido"><label>Apellido</label><input type="text" id="apellido" placeholder="Tu apellido" autocomplete="family-name"><div class="msg">Escribe tu apellido.</div></div>
      </div>
      <div class="field" id="f_wa"><label>WhatsApp <span class="sub">(10 dígitos)</span></label><input type="tel" id="wa" inputmode="tel" placeholder="Ej. 5512345678" autocomplete="tel"><div class="msg">Ingresa un WhatsApp de 10 dígitos.</div></div>
      <div class="field" id="f_email"><label>Correo <span class="sub">(opcional)</span></label><input type="email" id="email" placeholder="tucorreo@ejemplo.com" autocomplete="email"><div class="msg">Revisa tu correo.</div></div>
      <label class="consent"><input type="checkbox" id="consent"><span>Acepto que <b id="cName">Patricio Jaik</b> use mis datos para enviarme mi diagnóstico y contactarme, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label>
      <button class="btn brass" id="revealBtn">Ver mi diagnóstico completo →</button>
      <p class="reassure">Tu información se mantiene confidencial y solo la utiliza tu asesor.</p>
    </div>

    <!-- Resultado -->
    <div class="step" data-step="result">
      <div class="result-head">
        <div class="eyebrow">Tu Índice de Solidez Financiera</div>
        <div class="gauge">
          <svg width="212" height="212" viewBox="0 0 212 212">
            <circle cx="106" cy="106" r="90" fill="none" stroke="rgba(255,255,255,.13)" stroke-width="15"/>
            <circle id="gaugeArc" cx="106" cy="106" r="90" fill="none" stroke="var(--accent)" stroke-width="15" stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="565.5"/>
          </svg>
          <div class="score"><b id="scoreNum">0</b><i>de 100</i></div>
        </div>
        <div class="tier" id="tierName">—</div>
        <div class="tier-desc" id="tierDesc"></div>
      </div>
      <div class="breakdown">
        <h3 id="bkGreeting">Tu puntuación por área</h3>
        <div class="subh">Cada dimensión sobre 100. Las áreas más bajas son las que más conviene revisar.</div>
        <div id="dims"></div>
      </div>
      <div class="interp" id="interp"></div>
      <div class="cta-block">
        <h3>¿Quieres entender mejor tu resultado?</h3>
        <p>Este diagnóstico ofrece una primera lectura. Pero hay decisiones que dependen de tu edad, objetivos, familia, patrimonio y de las estrategias que ya tengas implementadas.</p>
        <p id="ctaPersonal" style="color:var(--ink)"></p>
        <div class="review-card">
          <div class="rc-ico">PJ</div>
          <div><b>Revisión personalizada con <span id="ctaAdvName">Patricio Jaik</span></b><span>Duración aproximada: 20–30 minutos · sin costo</span></div>
        </div>
        <a class="btn brass" id="calendlyBtn" href="#" target="_blank" rel="noopener">Agendar mi revisión personalizada →</a>
        <a class="btn wa" id="waBtn" href="#" target="_blank" rel="noopener">Hablar con Patricio por WhatsApp</a>
        <button class="restart" id="btnRestart">↺ Volver a empezar</button>
      </div>
      <div class="disclaimer" id="disclaimer"></div>
    </div>

  </div>
  <div class="foot">Una herramienta desarrollada por el despacho de <b id="footName">Patricio Jaik</b></div>
</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Tienes alguna duda? Habla con Patricio</span>
</a>
`;

export const DIAGNOSTICO_SOLIDEZ_LOGIC_JS = `
(function(){
"use strict";
const DATA = window.__DIAGNOSTICO_SOLIDEZ_DATA__;
const DIAGNOSTICO_SOLIDEZ_SLUG = DATA.slug;

fetch('/api/public/mini-apps/'+DIAGNOSTICO_SOLIDEZ_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
/* ==================================================================
   THEME  → Cambiá el color por cliente aquí.
   ================================================================== */
const THEMES = {
  brass:   { ink:"#0F2436", ink2:"#16344C", accent:"#B08D4C", accentD:"#967534", accent2:"#C9A15E", solid:"#2E6E5B", alert:"#B5623A", bg1:"#EEF1F2", bg2:"#E4E9EB", glow:"rgba(176,141,76,.28)" },
  navy:    { ink:"#0B1E3A", ink2:"#13294B", accent:"#3B82C4", accentD:"#2C6AA6", accent2:"#5AA0DC", solid:"#2E7D6B", alert:"#C1663B", bg1:"#EDF1F6", bg2:"#E1E8F1", glow:"rgba(59,130,196,.26)" },
  emerald: { ink:"#0C2A24", ink2:"#123A31", accent:"#2E9E7B", accentD:"#227A5F", accent2:"#4FC59B", solid:"#2E6E5B", alert:"#C1663B", bg1:"#EBF2EF", bg2:"#DFEAE6", glow:"rgba(46,158,123,.24)" },
  wine:    { ink:"#2A1220", ink2:"#3D1B2E", accent:"#A6486B", accentD:"#853954", accent2:"#C56A8B", solid:"#2E6E5B", alert:"#B5623A", bg1:"#F3EEF0", bg2:"#EAE0E5", glow:"rgba(166,72,107,.24)" },
  copper:  { ink:"#1C1C1F", ink2:"#2A2A2F", accent:"#C17A45", accentD:"#9E6034", accent2:"#DB9865", solid:"#3E8871", alert:"#B5623A", bg1:"#F0EFED", bg2:"#E6E4E1", glow:"rgba(193,122,69,.24)" }
};
const THEME_ACTIVE = DATA.theme || "brass";

(function applyTheme(){
  const t = THEMES[THEME_ACTIVE] || THEMES.brass, r = document.documentElement.style;
  r.setProperty('--ink',t.ink); r.setProperty('--ink-2',t.ink2);
  r.setProperty('--accent',t.accent); r.setProperty('--accent-d',t.accentD); r.setProperty('--accent-2',t.accent2);
  r.setProperty('--solid',t.solid); r.setProperty('--alert',t.alert);
  r.setProperty('--bg-1',t.bg1); r.setProperty('--bg-2',t.bg2); r.setProperty('--glow',t.glow);
})();

/* ==================================================================
   BRAND_CONFIG  → Datos del asesor.
   ================================================================== */
const BRAND_CONFIG = DATA.brand;

/* ================= PREGUNTAS · 12 (2 por dimensión) ================= */
const DIMS = { proteccion:"Protección", salud:"Salud", retiro:"Retiro", liquidez:"Liquidez", patrimonio:"Patrimonio", fiscal:"Eficiencia fiscal" };
const QUESTIONS = [
  { dim:"retiro", context:true, key:"edad", q:"¿En qué rango de edad te encuentras?", sub:"Nos ayuda a interpretar tu horizonte de tiempo.",
    opts:[{t:"20–29",v:100},{t:"30–39",v:85},{t:"40–49",v:65},{t:"50–59",v:45},{t:"60 o más",v:30}]},
  { dim:"patrimonio", context:true, key:"ingreso", q:"¿Cuál es aproximadamente tu ingreso mensual?", sub:"Solo por rangos. No pedimos ningún dato bancario.",
    opts:[{t:"Menos de $30,000",v:40},{t:"$30,000 – $60,000",v:60},{t:"$60,000 – $120,000",v:75},{t:"$120,000 – $250,000",v:88},{t:"Más de $250,000",v:100}]},
  { dim:"proteccion", key:"dependientes", q:"¿Alguien depende económicamente de ti?", sub:"Define cuánto pesa tu protección familiar.",
    opts:[{t:"No, nadie depende de mí",v:100},{t:"Sí, mi pareja",v:55},{t:"Sí, mis hijos",v:45},{t:"Sí, pareja e hijos",v:35},{t:"Otros familiares también",v:40}]},
  { dim:"liquidez", q:"Si mañana tus ingresos se detuvieran, ¿cuánto tiempo podrías mantener tu estilo de vida sin endeudarte?",
    opts:[{t:"Menos de 1 mes",v:15},{t:"1 a 3 meses",v:40},{t:"3 a 6 meses",v:70},{t:"6 a 12 meses",v:90},{t:"Más de 12 meses",v:100}]},
  { dim:"proteccion", q:"Si llegaras a faltar mañana, ¿tu familia podría mantener su estabilidad financiera los próximos años?",
    opts:[{t:"Definitivamente sí",v:100},{t:"Probablemente sí",v:75},{t:"No estoy seguro",v:45},{t:"Probablemente no",v:25},{t:"Definitivamente no",v:10}]},
  { dim:"salud", q:"¿Cómo enfrentarías un gasto médico importante de varios cientos de miles de pesos?",
    opts:[{t:"Tengo una cobertura adecuada",v:100},{t:"Tengo cobertura, pero desconozco sus alcances",v:65},{t:"Dependo únicamente del seguro de mi empresa",v:40},{t:"Utilizaría mis ahorros",v:35},{t:"Tendría que endeudarme",v:10}]},
  { dim:"salud", q:"¿Cuentas con un seguro de gastos médicos mayores privado (no solo el de la empresa)?",
    opts:[{t:"Sí, propio y vigente",v:100},{t:"Sí, pero no sé bien qué cubre",v:65},{t:"Solo el de mi empresa",v:35},{t:"No cuento con uno",v:10}]},
  { dim:"retiro", q:"¿Actualmente tienes una estrategia específica para financiar tu retiro?",
    opts:[{t:"Sí, estructurada y con aportaciones constantes",v:100},{t:"Tengo ahorros/inversiones, pero sin estrategia clara",v:55},{t:"Apenas estoy comenzando",v:30},{t:"No tengo ninguna",v:10}]},
  { dim:"retiro", type:"scale", q:"¿Qué tan claro tienes cuánto necesitarías acumular para mantener tu estilo de vida en el retiro?", sub:"1 = no tengo idea · 5 = lo tengo muy claro", ends:["Sin idea","Muy claro"]},
  { dim:"proteccion", q:"¿Cuentas con un seguro de vida o estrategia de protección familiar?",
    opts:[{t:"Sí, y sé que es suficiente",v:100},{t:"Sí, pero desconozco si es suficiente",v:60},{t:"Solo lo que me da mi empresa",v:35},{t:"No",v:10}]},
  { dim:"patrimonio", q:"¿Qué porcentaje de tus ingresos destinas regularmente al ahorro o inversión?",
    opts:[{t:"0%",v:10},{t:"Menos del 5%",v:35},{t:"5% a 10%",v:60},{t:"10% a 20%",v:85},{t:"Más del 20%",v:100}]},
  { dim:"fiscal", q:"¿Utilizas alguna estrategia financiera que además te dé beneficios fiscales?", sub:"Orientación inicial. No sustituye asesoría fiscal.",
    opts:[{t:"Sí, de forma consciente",v:100},{t:"Creo que sí, pero no estoy seguro",v:55},{t:"No",v:25},{t:"Desconocía que existían",v:15}]}
];

const TIERS = [
  { min:85, name:"Estructura financiera sólida", desc:"Tienes muy buenos fundamentos. El objetivo ahora es optimizar y mantener tu estrategia actual." },
  { min:70, name:"Buena estructura con oportunidades", desc:"Tienes bases importantes construidas, aunque existen áreas que podrían fortalecerse." },
  { min:50, name:"Estructura en desarrollo", desc:"Has tomado buenas decisiones, pero todavía hay vulnerabilidades que merece la pena revisar." },
  { min:0,  name:"Estructura por construir", desc:"Varias áreas de tu planificación todavía dependen demasiado de tus ingresos futuros o de circunstancias externas. Es un buen momento para empezar a estructurarlas." }
];

const DIM_TEXT = {
  proteccion:{ strong:"Tu estructura de protección familiar está bien resuelta: tu gente tendría respaldo si algo te faltara.",
    weak:"Parte importante de tu protección familiar todavía depende de tus ingresos futuros. Con la estrategia adecuada, eso puede blindarse sin comprometer tu liquidez." },
  salud:{ strong:"Tienes bien cubierto el frente de salud: un evento médico mayor no pondría en riesgo tu patrimonio.",
    weak:"Un gasto médico importante hoy recaería sobre tus ahorros o tu empresa. Vale la pena revisar cómo darle certeza a ese frente." },
  retiro:{ strong:"Tu retiro está claramente encaminado: tienes horizonte y estrategia trabajando a tu favor.",
    weak:"Tu planificación de retiro todavía no está del todo estructurada. El tiempo puede ser tu mayor aliado si empiezas a ordenarlo con anticipación." },
  liquidez:{ strong:"Tu reserva de liquidez está por encima del promedio: podrías sostener imprevistos sin endeudarte.",
    weak:"Tu colchón de liquidez es más ajustado de lo ideal. Un fondo de emergencia sólido es la base sobre la que se construye todo lo demás." },
  patrimonio:{ strong:"Tienes disciplina de ahorro y una base patrimonial que trabaja para ti.",
    weak:"Hay espacio para fortalecer tu disciplina de ahorro y darle estructura a cómo crece tu patrimonio." },
  fiscal:{ strong:"Aprovechas de forma consciente herramientas con beneficios fiscales dentro de tu estrategia.",
    weak:"Existe espacio para revisar si estás aprovechando herramientas financieras que, además de protegerte, ofrecen beneficios fiscales." }
};

/* ========================= Motor ========================= */
const $ = id => document.getElementById(id);
const state = { answers:[], idx:0, ctx:{}, scores:{}, overall:0 };

(function initBrand(){
  $("advName").textContent=BRAND_CONFIG.advisorName;
  $("advTitle").textContent=BRAND_CONFIG.title;
  $("advBadge").textContent=BRAND_CONFIG.badge||"";
  $("cName").textContent=BRAND_CONFIG.advisorName;
  $("footName").textContent=BRAND_CONFIG.advisorName;
  $("ctaAdvName").textContent=BRAND_CONFIG.advisorName;
  $("privacyLink").href=BRAND_CONFIG.privacyURL||"#";
  const initials=BRAND_CONFIG.advisorName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  if(BRAND_CONFIG.photoURL||BRAND_CONFIG.logoURL){
    const img=document.createElement("img"); img.src=BRAND_CONFIG.logoURL||BRAND_CONFIG.photoURL; img.alt=BRAND_CONFIG.advisorName;
    $("advAvatar").replaceWith(img);
  } else { $("advAvatar").textContent=initials; }
  document.querySelectorAll(".rc-ico").forEach(e=>e.textContent=initials);
  $("fab").href="https://wa.me/"+BRAND_CONFIG.whatsapp+"?text="+encodeURIComponent(BRAND_CONFIG.waGreeting);
})();

function track(event,data){ try{ console.log("[track]",event,data||""); }catch(e){} }
function show(step){
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('on'));
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  document.querySelector('.card').scrollIntoView({behavior:'smooth',block:'start'});
}
function setRail(){ $("rail").style.width = Math.round((state.idx/QUESTIONS.length)*100) + "%"; }

function startDiagnostic(){ track('diagnostic_started'); state.idx=0; state.answers=[]; renderQuestion(); show('question'); }

function renderQuestion(){
  const q=QUESTIONS[state.idx], total=QUESTIONS.length;
  $("qCount").textContent="Pregunta "+(state.idx+1)+" de "+total;
  $("qDim").textContent=DIMS[q.dim];
  $("qText").textContent=q.q;
  $("qSub").textContent=q.sub||""; $("qSub").style.display=q.sub?"block":"none";
  $("qBack").style.visibility=state.idx===0?"hidden":"visible";
  setRail();
  const body=$("qBody"); body.innerHTML=""; const prev=state.answers[state.idx];
  if(q.type==="scale"){
    const wrap=document.createElement("div"), row=document.createElement("div"); row.className="scale";
    for(let n=1;n<=5;n++){ const b=document.createElement("button"); b.textContent=n; if(prev&&prev.scale===n)b.classList.add("sel"); b.onclick=(function(x){return function(){answerScale(x)}})(n); row.appendChild(b); }
    wrap.appendChild(row);
    const ends=document.createElement("div"); ends.className="scale-ends"; ends.innerHTML="<span>"+q.ends[0]+"</span><span>"+q.ends[1]+"</span>";
    wrap.appendChild(ends); body.appendChild(wrap);
  } else {
    const list=document.createElement("div"); list.className="choices";
    q.opts.forEach(function(o,i){ const b=document.createElement("button"); b.className="choice"; if(prev&&prev.i===i)b.classList.add("sel");
      b.innerHTML='<span class="mark"></span><span>'+o.t+'</span>'; b.onclick=function(){answerChoice(i,o)}; list.appendChild(b); });
    body.appendChild(list);
  }
}
function answerChoice(i,o){ const q=QUESTIONS[state.idx]; state.answers[state.idx]={i:i,v:o.v,t:o.t,dim:q.dim}; if(q.context&&q.key)state.ctx[q.key]=o.t; advance(); }
function answerScale(n){ const q=QUESTIONS[state.idx]; state.answers[state.idx]={scale:n,v:(n-1)/4*100,t:n+"/5",dim:q.dim}; advance(); }
function advance(){
  track('question_completed',{n:state.idx+1});
  const next=state.idx+1;
  if(next<QUESTIONS.length){ state.idx=next; setTimeout(function(){ renderQuestion(); show('question'); },170); }
  else { runAnalysis(); }
}
function prevQuestion(){ if(state.idx>0){ state.idx--; renderQuestion(); } }

function runAnalysis(){
  computeScores();
  track('diagnostic_completed',{overall:state.overall});
  track('score_generated',{scores:state.scores});
  setRail(); $("rail").style.width="100%";
  document.querySelectorAll('.chk').forEach(function(c){ c.classList.remove('on'); });
  show('analyze');
  const chks=Array.prototype.slice.call(document.querySelectorAll('.chk'));
  chks.forEach(function(c,i){ setTimeout(function(){ c.classList.add('on'); }, 500 + i*700); });
  setTimeout(function(){ show('gate'); }, 500 + chks.length*700 + 550);
}

function computeScores(){
  const buckets={};
  QUESTIONS.forEach(function(q,idx){ const a=state.answers[idx]; if(!a)return; (buckets[q.dim]=buckets[q.dim]||[]).push(a.v); });
  const scores={};
  Object.keys(DIMS).forEach(function(d){ const arr=buckets[d]||[]; scores[d]=arr.length?Math.round(arr.reduce(function(x,y){return x+y},0)/arr.length):0; });
  const W={proteccion:1.2,salud:1.1,retiro:1.2,liquidez:1,patrimonio:1,fiscal:.9};
  let num=0,den=0; Object.keys(scores).forEach(function(d){ num+=scores[d]*W[d]; den+=100*W[d]; });
  state.scores=scores; state.overall=Math.round(num/den*100);
}

function err(id,on){ $(id).classList.toggle('err',on); return !on; }
function sendLeadToCRM(lead){
  var hostedPayload = Object.assign({}, lead, { nombre: (lead.nombre+' '+lead.apellido).trim(), consentimiento_fecha: lead.fecha });
  fetch('/api/public/mini-apps/'+DIAGNOSTICO_SOLIDEZ_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
  if(!BRAND_CONFIG.webhookURL) return;
  try{ fetch(BRAND_CONFIG.webhookURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead),keepalive:true}); }catch(e){}
}
function revealResult(){
  const nombre=$("nombre").value.trim(), apellido=$("apellido").value.trim();
  const wa=$("wa").value.replace(/\\D/g,''), email=$("email").value.trim(), consent=$("consent").checked;
  let ok=true;
  ok=err('f_nombre',nombre.length<2)&&ok;
  ok=err('f_apellido',apellido.length<2)&&ok;
  ok=err('f_wa',wa.length<10)&&ok;
  ok=err('f_email',email.length>0&&!/^[^@]+@[^@]+\\.[^@]+$/.test(email))&&ok;
  if(!ok)return;
  if(!consent){ const b=$("revealBtn"),t=b.textContent; b.textContent="Marca la casilla para continuar"; setTimeout(function(){b.textContent=t},1800); return; }
  const ranking=Object.keys(state.scores).sort(function(a,b){return state.scores[a]-state.scores[b]});
  const lead={ advisorID:BRAND_CONFIG.advisorID, nombre:nombre, apellido:apellido, email:email, whatsapp:wa, profesion:"", empresa:"",
    resultado:state.overall, scores:state.scores, areasAtencion:ranking.slice(0,2), fortalezaPrincipal:ranking[ranking.length-1],
    contexto:state.ctx, respuestas:state.answers.map(function(a){return {dim:a.dim,respuesta:a.t}}), consentimiento:true,
    referidoPor:window._referidoPor||null, fecha:new Date().toISOString(), recurso:"diagnostico-solidez-financiera-v2" };
  sendLeadToCRM(lead); window._lead=lead;
  paintResult(nombre); buildCTAs(nombre); show('result'); requestAnimationFrame(animateResult);
}

function tierFor(s){ return TIERS.filter(function(t){return s>=t.min})[0]; }
function level(s){ return s>=70?"hi":(s>=50?"mid":"lo"); }
function paintResult(nombre){
  const primer=nombre.split(" ")[0], tier=tierFor(state.overall);
  $("scoreNum").textContent=state.overall; $("tierName").textContent=tier.name; $("tierDesc").textContent=tier.desc;
  $("bkGreeting").textContent=primer+", esta es tu puntuación por área";
  const order=Object.keys(state.scores).sort(function(a,b){return state.scores[b]-state.scores[a]});
  const dims=$("dims"); dims.innerHTML="";
  order.forEach(function(d){ const s=state.scores[d]; const row=document.createElement("div"); row.className="dimrow";
    row.innerHTML='<div class="top"><b>'+DIMS[d]+'</b><span>'+s+'/100</span></div><div class="track"><div class="fill '+level(s)+'" data-w="'+s+'"></div></div>';
    dims.appendChild(row); });
  const topDim=order[0], weak=order.slice().reverse().slice(0,2);
  const interp=$("interp"); interp.innerHTML="";
  interp.appendChild(ibox("win","Tu fortaleza",DIM_TEXT[topDim].strong,0));
  const weakList=weak.map(function(d){return "<b>"+DIMS[d]+"</b> ("+state.scores[d]+"/100)"}).join(" y ");
  interp.appendChild(ibox("watch","Áreas para revisar","Tus dos áreas con mayor oportunidad de mejora son "+weakList+". "+DIM_TEXT[weak[0]].weak,.1));
  const oppText=state.scores.fiscal<60
    ? DIM_TEXT.fiscal.weak+" Suele ser una de las palancas menos aprovechadas y más fáciles de activar."
    : "Con tus fortalezas actuales, el mayor valor está en ordenar las piezas para que trabajen juntas: protección, retiro y eficiencia fiscal dentro de una misma estrategia.";
  interp.appendChild(ibox("opp","Oportunidad detectada",oppText,.2));
  $("ctaPersonal").innerHTML="En tu caso, "+BRAND_CONFIG.advisorName+" puede interpretar contigo por qué <b>"+DIMS[weak[0]]+"</b> y <b>"+DIMS[weak[1]]+"</b> salieron como tus áreas de atención, y qué mantendría, qué reforzaría y qué oportunidades existen en tu estructura actual.";
  $("disclaimer").innerHTML="Este diagnóstico es una herramienta informativa y orientativa. Los resultados <b>no constituyen asesoramiento financiero, fiscal, legal ni una recomendación específica</b> de inversión o contratación. Para una evaluación completa es necesario analizar cada situación de manera individual.";
}
function ibox(kind,title,text,delay){
  const el=document.createElement("div"); el.className="ibox "+kind; el.style.animationDelay=(delay||0)+"s";
  const icon=kind==="win"?"✓":(kind==="watch"?"⚠":"✨");
  el.innerHTML='<div class="h">'+icon+' '+title+'</div><p>'+text+'</p>'; return el;
}
function animateResult(){
  const r=90, circ=2*Math.PI*r, arc=$("gaugeArc");
  arc.style.strokeDasharray=circ; arc.style.strokeDashoffset=circ;
  requestAnimationFrame(function(){ arc.style.transition="stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)"; arc.style.strokeDashoffset=circ*(1-state.overall/100); });
  let t0=performance.now(); const target=state.overall;
  (function tick(t){ const p=Math.min(1,(t-t0)/1100); $("scoreNum").textContent=Math.round(target*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(tick); })(t0);
  requestAnimationFrame(function(){ document.querySelectorAll('.fill').forEach(function(f){ f.style.width=f.dataset.w+"%"; }); });
}
function buildCTAs(nombre){
  $("calendlyBtn").href=BRAND_CONFIG.calendly||"#";
  const primer=nombre.split(" ")[0], ranking=Object.keys(state.scores).sort(function(a,b){return state.scores[a]-state.scores[b]});
  const w1=DIMS[ranking[0]], w2=DIMS[ranking[1]];
  const msg=BRAND_CONFIG.waGreeting+"\\n\\n• Soy "+primer+"\\n• Mi Índice de Solidez: "+state.overall+"/100\\n• Áreas de atención: "+w1+" ("+state.scores[ranking[0]]+") y "+w2+" ("+state.scores[ranking[1]]+")";
  $("waBtn").href="https://wa.me/"+BRAND_CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
}
(function(){ const ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref; })();
track('app_started');

/* conecta los botones — addEventListener en vez de onclick="" inline para
   no depender de que estas funciones existan como propiedades de window
   (mismo motivo documentado en diagnosticoTemplate.ts: window.next puede
   quedar pisado por el propio runtime de Next.js). */
$('btnStart').addEventListener('click', startDiagnostic);
$('qBack').addEventListener('click', prevQuestion);
$('revealBtn').addEventListener('click', revealResult);
$('calendlyBtn').addEventListener('click', function(){ track('calendly_clicked'); });
$('waBtn').addEventListener('click', function(){ track('whatsapp_clicked'); });
$('btnRestart').addEventListener('click', function(){ location.reload(); });
$('fab').addEventListener('click', function(){ track('whatsapp_clicked'); });
})();
`;
