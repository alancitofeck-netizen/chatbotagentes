/** Plantilla verbatim de "Kit de Emergencia Financiera Familiar" — CSS,
 * HTML y JS copiados literal del archivo original que sirvió de base a este
 * tipo de Mini App (mismo diseño, tipografía Fraunces/Hanken Grotesk, flujo
 * de 7 secciones + gate + resultado + impresión/PDF, sin ningún rediseño).
 * Privacidad por diseño del propio archivo original (no se toca): el
 * detalle financiero de la familia (familiares, seguros, activos, deudas,
 * documentos, contactos) vive SOLO en localStorage del navegador — nunca
 * viaja al servidor. Al CRM solo llega el lead mínimo que ya arma
 * `buildLead()` (nombre/whatsapp/email + `scorePreparacion` +
 * `categoriasCompletadas` + `conteos` agregados, nunca el contenido).
 *
 * Las ÚNICAS diferencias respecto del original, dentro de
 * KIT_EMERGENCIA_LOGIC_JS, son:
 *
 * 1. El objeto `CONFIG` (antes hardcodeado con los datos de ejemplo "Diego
 *    Tinoco") ahora lee de `window.__KIT_EMERGENCIA_DATA__`, inyectado por
 *    KitEmergenciaApp.tsx a partir de la config guardada en el CRM.
 * 2. Dentro de `sendLeadToCRM(lead)`, además del `fetch` original a
 *    `CONFIG.webhookURL` (que se deja intacto), se agrega un `fetch` a
 *    `/api/public/mini-apps/{slug}/hosted-lead` con el contrato que
 *    `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. `buildLead()` no manda `consentimiento`/
 *    `consentimiento_fecha` (no le hacen falta al archivo original), así
 *    que se agregan recién acá, al construir el payload hacia el CRM
 *    (`consentimiento:true` porque `revealResult()` ya validó el checkbox
 *    antes de llegar a este punto).
 * 3. Se agrega un `fetch` fire-and-forget a
 *    `/api/public/mini-apps/{slug}/visit` al cargar, igual que los demás
 *    tipos de Mini App.
 * 4. Los 24 botones de navegación/acción de nivel superior que en el HTML
 *    original llamaban a sus funciones vía atributos `onclick="..."`
 *    inline sin id pasan a conectarse con `addEventListener` al final del
 *    script — mismo motivo ya documentado en diagnosticoSolidezTemplate.ts/
 *    metaUniversitariaTemplate.ts (un global como `window.next` puede
 *    quedar pisado por el runtime de Next.js, commit 8b361bd). Los ~15
 *    `onclick="..."` que el propio archivo genera dinámicamente dentro de
 *    sus funciones de renderizado (agregar/quitar familiar, activo, deuda,
 *    contacto, instrucción del plan, editar un campo) se dejan intactos —
 *    convertir esos exigiría reescribir la lógica de renderizado de listas
 *    en sí, cruzando de "integración" a modificar la lógica interna, que es
 *    justo lo que no se debe tocar.
 *
 * Todo el resto — CSS, HTML, y cada función de KIT_EMERGENCIA_LOGIC_JS —
 * es una copia literal del archivo original.
 */

export const KIT_EMERGENCIA_CSS = `

  :root{
    --ink:#1A2420; --ink-soft:#3B4741;
    --accent:#2E6E5B; --accent-d:#215544; --accent-2:#4C9179;
    --gold:#B0894C; --alert:#C06A48; --alert-soft:#F7ECE6;
    --paper:#FFFFFF; --bg-1:#F4F2EC; --bg-2:#ECEAE2;
    --muted:#77837C; --muted-2:#9AA49E; --line:#E6E4DB; --line-2:#EFEDE5;
    --danger:#C0432C;
    --shadow-card:0 20px 48px -26px rgba(26,36,32,.32);
    --shadow-soft:0 6px 18px -10px rgba(26,36,32,.20);
    --shadow-btn:0 14px 26px -12px rgba(46,110,91,.5);
    --f:'Hanken Grotesk',system-ui,-apple-system,sans-serif;
    --f-d:'Fraunces',Georgia,serif;
    --r:20px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font-family:var(--f);color:var(--ink);line-height:1.55;min-height:100vh;
    padding:0 0 calc(96px + env(safe-area-inset-bottom));
    background:
      radial-gradient(900px 460px at 100% -5%, rgba(176,137,76,.07), transparent 55%),
      radial-gradient(800px 420px at 0% 10%, rgba(46,110,91,.06), transparent 52%),
      linear-gradient(165deg,var(--bg-1),var(--bg-2));
    background-attachment:fixed;
  }
  .wrap{width:100%;max-width:560px;margin:0 auto;padding:20px 18px}

  /* ---------- Top bar ---------- */
  .topbar{position:sticky;top:0;z-index:30;background:rgba(244,242,236,.82);backdrop-filter:blur(14px);
    border-bottom:1px solid var(--line)}
  .topbar .in{max-width:560px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:12px}
  .agent{display:flex;align-items:center;gap:11px;min-width:0}
  .agent .ava{width:40px;height:40px;border-radius:12px;flex:0 0 auto;object-fit:cover;
    background:linear-gradient(145deg,var(--ink),var(--ink-soft));color:#fff;display:grid;place-items:center;
    font-family:var(--f-d);font-weight:600;font-size:15px}
  .agent .who{min-width:0;line-height:1.25}
  .agent .who b{font-size:13.5px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent .who span{font-size:11.5px;color:var(--muted)}
  .kit-name{margin-left:auto;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700;text-align:right;white-space:nowrap}

  /* progreso global */
  .gprog{max-width:560px;margin:0 auto;padding:0 18px 11px}
  .gprog .lab{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:6px}
  .gprog .lab b{color:var(--accent-d);font-weight:700}
  .gprog .track{height:7px;background:var(--line);border-radius:6px;overflow:hidden}
  .gprog .track>i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width .6s cubic-bezier(.22,1,.36,1)}

  /* ---------- Tipografía ---------- */
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-d);font-weight:700;margin-bottom:14px;display:inline-flex;align-items:center;gap:8px}
  .eyebrow::before{content:"";width:20px;height:1.5px;background:var(--gold)}
  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(28px,7.2vw,38px);line-height:1.1;letter-spacing:-.015em;margin-bottom:15px}
  h2{font-family:var(--f-d);font-weight:600;font-size:26px;line-height:1.16;letter-spacing:-.01em;margin-bottom:8px}
  .sec-h{margin-bottom:6px}
  .sec-sub{font-size:14.5px;color:var(--muted);margin-bottom:22px;line-height:1.55}
  .lede{font-size:16px;color:var(--muted);margin-bottom:26px}

  /* ---------- Botones ---------- */
  .btn{font-family:var(--f);font-size:16px;font-weight:700;width:100%;padding:17px 20px;border:none;border-radius:15px;cursor:pointer;
    background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;transition:transform .14s,box-shadow .25s,opacity .2s;
    display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:var(--shadow-btn)}
  .btn:hover{transform:translateY(-1px)}
  .btn:active{transform:scale(.986)}
  .btn.wide{max-width:360px;margin-left:auto;margin-right:auto}
  .btn.dark{background:linear-gradient(145deg,var(--ink),var(--ink-soft));box-shadow:0 14px 26px -12px rgba(26,36,32,.5)}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:var(--bg-1)}
  .btn.wa{background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;box-shadow:0 14px 26px -12px rgba(37,211,102,.5)}
  .btn.gold{background:linear-gradient(145deg,#C6A05E,#A07C3C);box-shadow:0 14px 26px -12px rgba(176,137,76,.5)}
  .btn.sm{width:auto;padding:12px 18px;font-size:14.5px;border-radius:12px}
  .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}

  /* ---------- Bienvenida ---------- */
  .benefit{display:flex;align-items:center;gap:13px;padding:15px 17px;background:var(--paper);border:1px solid var(--line);
    border-radius:15px;margin-bottom:11px;box-shadow:var(--shadow-soft)}
  .benefit .bi{width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:rgba(46,110,91,.1);display:grid;place-items:center;color:var(--accent)}
  .benefit b{font-size:15px;font-weight:700;display:block}
  .benefit span{font-size:13px;color:var(--muted)}
  .privacy-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;
    background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:13px 15px}
  .privacy-note svg{flex:0 0 auto;color:var(--accent);margin-top:1px}

  /* ---------- Cards / campos ---------- */
  .card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-card)}
  .field{margin-bottom:15px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:7px}
  .field label .opt{font-weight:400;color:var(--muted-2);font-size:12px}
  .field input,.field select,.field textarea{width:100%;font-family:var(--f);font-size:15.5px;padding:13px 14px;border:1.5px solid var(--line);
    border-radius:12px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(46,110,91,.12)}
  .field textarea{resize:vertical;min-height:64px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media (max-width:420px){ .grid2{grid-template-columns:1fr} }

  /* chips seleccionables */
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border:1.5px solid var(--line);border-radius:30px;
    background:var(--paper);cursor:pointer;font-size:14px;font-weight:600;color:var(--ink-soft);transition:.16s;box-shadow:var(--shadow-soft)}
  .chip:hover{border-color:var(--accent-2);transform:translateY(-1px)}
  .chip.on{border-color:var(--accent);background:rgba(46,110,91,.08);color:var(--accent-d)}
  .chip .tick{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;transition:.16s}
  .chip.on .tick{background:var(--accent);border-color:var(--accent)}
  .chip .tick svg{opacity:0;transition:.15s}
  .chip.on .tick svg{opacity:1}

  /* item cards (agregados) */
  .item{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:15px 16px;margin-bottom:12px;position:relative;box-shadow:var(--shadow-soft)}
  .item .it-top{display:flex;align-items:center;gap:11px;margin-bottom:4px}
  .item .it-ic{width:34px;height:34px;border-radius:10px;background:rgba(46,110,91,.1);color:var(--accent);display:grid;place-items:center;flex:0 0 auto}
  .item .it-title{font-size:15px;font-weight:700}
  .item .it-sub{font-size:12.5px;color:var(--muted)}
  .item .it-body{font-size:13px;color:var(--ink-soft);line-height:1.6;margin-top:8px}
  .item .it-body .kv{color:var(--muted)}
  .item .del{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);
    background:var(--paper);color:var(--muted);cursor:pointer;display:grid;place-items:center;transition:.15s}
  .item .del:hover{color:var(--danger);border-color:var(--danger)}

  .addbtn{display:inline-flex;align-items:center;gap:8px;font-family:var(--f);font-size:14.5px;font-weight:700;color:var(--accent-d);
    background:rgba(46,110,91,.08);border:1.5px dashed var(--accent-2);border-radius:13px;padding:13px 18px;cursor:pointer;width:100%;justify-content:center;transition:.16s}
  .addbtn:hover{background:rgba(46,110,91,.13)}

  .warn{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--alert);background:var(--alert-soft);
    border:1px solid rgba(192,106,72,.25);border-radius:12px;padding:12px 14px;margin:6px 0 18px;line-height:1.5}
  .warn svg{flex:0 0 auto;margin-top:1px}

  .empty{font-size:13.5px;color:var(--muted-2);text-align:center;padding:14px;border:1px dashed var(--line);border-radius:13px;margin-bottom:14px}

  /* checklist docs */
  .checkrow{display:flex;align-items:center;gap:12px;padding:13px 15px;background:var(--paper);border:1px solid var(--line);
    border-radius:13px;margin-bottom:10px;cursor:pointer;transition:.15s;box-shadow:var(--shadow-soft)}
  .checkrow:hover{border-color:var(--accent-2)}
  .checkrow.on{border-color:var(--accent);background:rgba(46,110,91,.05)}
  .checkrow .cb{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);flex:0 0 auto;display:grid;place-items:center;transition:.15s}
  .checkrow.on .cb{background:var(--accent);border-color:var(--accent)}
  .checkrow .cb svg{opacity:0}
  .checkrow.on .cb svg{opacity:1}
  .checkrow .cx{flex:1;min-width:0}
  .checkrow .cx b{font-size:14.5px;font-weight:600;display:block}
  .checkrow .cx input{margin-top:8px;width:100%;font-family:var(--f);font-size:13px;padding:9px 11px;border:1.5px solid var(--line);border-radius:9px;background:var(--bg-1)}
  .checkrow.on .cx input{display:block}
  .checkrow .cx input{display:none}

  /* plan de acción */
  .planitem{display:flex;gap:13px;align-items:flex-start;padding:13px 0;border-bottom:1px solid var(--line-2)}
  .planitem:last-child{border-bottom:none}
  .planitem .num{width:28px;height:28px;flex:0 0 auto;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:700;font-family:var(--f-d)}
  .planitem.custom .num{background:var(--gold)}
  .planitem p{font-size:14.5px;line-height:1.5;padding-top:3px}
  .planitem .del2{margin-left:auto;color:var(--muted);cursor:pointer;font-size:18px;padding-top:2px}
  .planitem .del2:hover{color:var(--danger)}

  /* nav secciones */
  .stepnav{display:flex;gap:12px;margin-top:8px}
  .stepnav .btn{flex:1}

  /* mini sumario familia */
  .famtree{background:var(--bg-1);border:1px solid var(--line);border-radius:15px;padding:16px 18px;margin-bottom:16px}
  .famtree .root{font-size:15px;font-weight:800;color:var(--ink)}
  .famtree .root span{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-left:8px}
  .famtree .branch{font-size:14px;color:var(--ink-soft);padding:5px 0 5px 18px;position:relative}
  .famtree .branch::before{content:"├─";position:absolute;left:0;color:var(--accent-2)}
  .famtree .branch:last-child::before{content:"└─"}
  .famtree .branch b{font-weight:700;color:var(--ink)}

  /* ---------- Gate ---------- */
  .consent{display:flex;gap:11px;align-items:flex-start;margin:6px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.5}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
  .consent a{color:var(--ink);text-decoration:underline}

  /* ---------- Resultado ---------- */
  .res-hero{text-align:center;padding:8px 4px 0}
  .gauge{position:relative;width:206px;height:206px;margin:6px auto 4px}
  .gauge svg{transform:rotate(-90deg);overflow:visible}
  .gauge .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .gauge .c b{font-family:var(--f-d);font-size:60px;font-weight:700;line-height:1;letter-spacing:-.02em}
  .gauge .c i{font-style:normal;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-2);margin-top:2px}
  .lvl-pill{display:inline-block;font-size:14.5px;font-weight:700;padding:8px 20px;border-radius:24px;margin:14px 0 8px}
  .lvl-pill.hi{color:var(--accent-d);background:rgba(46,110,91,.14)}
  .lvl-pill.mid{color:#9A6B1E;background:rgba(176,137,76,.16)}
  .lvl-pill.lo{color:var(--alert);background:var(--alert-soft)}

  .summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}
  .sumcard{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:15px 16px;box-shadow:var(--shadow-soft)}
  .sumcard .sc-ic{width:34px;height:34px;border-radius:10px;background:rgba(46,110,91,.1);color:var(--accent);display:grid;place-items:center;margin-bottom:10px}
  .sumcard b{font-family:var(--f-d);font-size:22px;font-weight:600;display:block;line-height:1}
  .sumcard span{font-size:12.5px;color:var(--muted);display:block;margin-top:3px}
  .sumcard.miss .sc-ic{background:var(--alert-soft);color:var(--alert)}

  .gaps{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:20px;margin:20px 0}
  .gaps h3{font-family:var(--f-d);font-size:19px;font-weight:600;margin-bottom:5px}
  .gaps .gsub{font-size:13px;color:var(--muted);margin-bottom:16px}
  .gap{display:flex;gap:11px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line-2);font-size:14px;line-height:1.45}
  .gap:last-child{border-bottom:none}
  .gap .gi{color:var(--alert);flex:0 0 auto;margin-top:1px}
  .gaps .disc{font-size:12.5px;color:var(--muted);margin-top:15px;line-height:1.5;font-style:italic}
  .allgood{display:flex;gap:11px;align-items:center;font-size:14px;color:var(--accent-d);background:rgba(46,110,91,.08);border-radius:12px;padding:14px 16px}

  .review-card{background:linear-gradient(150deg,var(--bg-1),var(--bg-2));border:1px solid var(--line);border-radius:16px;
    padding:16px 18px;margin:20px 0;display:flex;gap:13px;align-items:center}
  .review-card .rc{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,var(--ink),var(--ink-soft));color:var(--gold);
    display:grid;place-items:center;flex:0 0 auto;font-family:var(--f-d);font-weight:600;overflow:hidden}
  .review-card .rc img{width:100%;height:100%;object-fit:cover}
  .review-card b{display:block;font-size:14.5px}
  .review-card small{font-size:12.5px;color:var(--muted)}

  .share-band{text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px 20px;margin:20px 0}
  .share-band h3{font-family:var(--f-d);font-size:18px;font-weight:600;margin-bottom:6px}
  .share-band p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .datamgmt{text-align:center;margin:24px 0 6px}
  .linkbtn{background:none;border:none;font-family:var(--f);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;text-decoration:underline;padding:6px}
  .linkbtn:hover{color:var(--danger)}

  .disclaimer{font-size:11px;color:var(--muted-2);line-height:1.55;padding:16px 4px 4px;text-align:center;max-width:470px;margin:0 auto}
  .foot{text-align:center;font-size:11.5px;color:var(--muted-2);margin-top:22px}
  .foot b{color:var(--muted);font-weight:700}

  /* toast autoguardado */
  .toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);
    background:var(--ink);color:#fff;font-size:13px;font-weight:600;padding:11px 20px;border-radius:30px;box-shadow:0 12px 30px -8px rgba(0,0,0,.4);
    opacity:0;pointer-events:none;transition:.3s;z-index:60;display:flex;align-items:center;gap:8px}
  .toast.on{opacity:1;transform:translateX(-50%) translateY(0)}

  /* FAB whatsapp */
  .fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:50;display:flex;align-items:center;
    background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;border-radius:30px;box-shadow:0 12px 30px -8px rgba(37,211,102,.55);
    text-decoration:none;overflow:hidden;transition:.28s}
  .fab .ic{width:54px;height:54px;display:grid;place-items:center;flex:0 0 auto}
  .fab .lbl{max-width:0;opacity:0;white-space:nowrap;font-size:13.5px;font-weight:700;transition:.28s;overflow:hidden}
  .fab:hover .lbl{max-width:230px;opacity:1;padding-right:20px}
  @media (hover:none){ .fab .lbl{display:none} }

  .step{display:none}
  .step.on{display:block;animation:rise .4s cubic-bezier(.22,1,.36,1)}
  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }

  /* ================= IMPRESIÓN / PDF ================= */
  .printdoc{display:none}
  @media print{
    body{background:#fff;padding:0}
    .topbar,.gprog,.fab,.toast,.no-print{display:none!important}
    .wrap{max-width:none;padding:0}
    .step{display:none!important}
    .printdoc{display:block!important;padding:34px 40px;color:#111;font-family:var(--f)}
    .printdoc h1{font-family:var(--f-d);font-size:30px;margin-bottom:2px}
    .printdoc .pmeta{color:#666;font-size:12px;margin-bottom:4px}
    .printdoc .psec{margin-top:22px;page-break-inside:avoid}
    .printdoc .psec h2{font-family:var(--f-d);font-size:17px;border-bottom:2px solid #2E6E5B;padding-bottom:5px;margin-bottom:10px;color:#1A2420}
    .printdoc .pnum{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#2E6E5B;font-weight:700}
    .printdoc .prow{font-size:13px;padding:5px 0;border-bottom:1px solid #eee;line-height:1.5}
    .printdoc .prow b{font-weight:700}
    .printdoc .prow .k{color:#666}
    .printdoc .pnote{margin-top:26px;font-size:11px;color:#666;border-top:1px solid #ccc;padding-top:12px;font-style:italic}
    .printdoc .pgap{font-size:12.5px;padding:3px 0;color:#8a4b30}
  }

`;

export const KIT_EMERGENCIA_BODY_HTML = `
<!-- ================= TOP BAR ================= -->
<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">DT</div>
      <div class="who"><b id="agentName">Diego Tinoco</b><span id="agentTitle">Asesor financiero</span></div>
    </div>
    <div class="kit-name">Kit de Emergencia</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none">
  <div class="lab"><span>Tu Kit de Emergencia</span><b id="gpctText">0%</b></div>
  <div class="track"><i id="gpbar"></i></div>
</div>

<div class="wrap">

  <!-- ================= BIENVENIDA ================= -->
  <div class="step on" data-step="welcome">
    <div class="eyebrow">Recurso familiar privado</div>
    <h1>Si mañana no pudieras encargarte de tus finanzas… ¿tu familia sabría qué hacer?</h1>
    <p class="lede">Organiza en pocos minutos la información que tu familia necesitaría ante una emergencia. Al terminar tendrás un mapa claro de qué existe, dónde está y a quién acudir.</p>

    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9M14 17H5M17 3l3 4-3 4M7 21l-3-4 3-4"/></svg></div><div><b>Qué tienes</b><span>Seguros, cuentas, activos y obligaciones</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div><b>Dónde encontrarlo</b><span>Un mapa de documentos y pólizas</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg></div><div><b>A quién contactar</b><span>Asesor, contador, notario y familia</span></div></div>

    <div style="margin-top:24px"><button id="btnStart" class="btn wide">Crear mi Kit Familiar →</button></div>

    <div class="privacy-note">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Tu información es privada y permanece en <b>este dispositivo</b>. Nunca te pediremos contraseñas, PIN ni claves bancarias.</span>
    </div>
  </div>

  <!-- ================= 1. FAMILIA ================= -->
  <div class="step" data-step="familia">
    <div class="eyebrow">Sección 1 de 7 · Mi familia</div>
    <h2 class="sec-h">¿Quiénes necesitan estar protegidos?</h2>
    <p class="sec-sub">Registra al titular y a las personas que dependen o comparten el patrimonio.</p>

    <div class="card" style="padding:20px;margin-bottom:16px">
      <div class="field"><label>Nombre del titular</label><input type="text" id="fam_titular" placeholder="Ej. Diego Tinoco" oninput="renderFamTree()"></div>
      <div id="famTreeWrap"></div>
    </div>

    <div id="famList"></div>
    <button id="addFamiliarBtn" class="addbtn">+ Agregar familiar / dependiente</button>

    <div class="stepnav">
      <button id="familiaBack" class="btn ghost">← Atrás</button>
      <button id="familiaNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 2. SEGUROS ================= -->
  <div class="step" data-step="seguros">
    <div class="eyebrow">Sección 2 de 7 · Protección</div>
    <h2 class="sec-h">¿Qué protección tiene hoy tu familia?</h2>
    <p class="sec-sub">Selecciona los tipos de seguro que existen y registra dónde encontrarlos.</p>

    <div class="chips" id="seguroChips"></div>
    <div id="seguroList" style="margin-top:16px"></div>

    <div class="stepnav">
      <button id="segurosBack" class="btn ghost">← Atrás</button>
      <button id="segurosNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 3. PATRIMONIO ================= -->
  <div class="step" data-step="patrimonio">
    <div class="eyebrow">Sección 3 de 7 · Patrimonio</div>
    <h2 class="sec-h">¿Dónde está distribuido el patrimonio familiar?</h2>
    <p class="sec-sub">Registra dónde existe cada activo y dónde encontrar su documentación.</p>

    <div class="warn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      <span>Por seguridad, registra únicamente <b>dónde existe</b> el activo y dónde encontrar la documentación. Nunca guardes números de cuenta completos, claves ni PIN aquí.</span>
    </div>

    <div id="activoList"></div>
    <button id="addActivoBtn" class="addbtn">+ Agregar cuenta / inversión / inmueble</button>

    <div class="stepnav">
      <button id="patrimonioBack" class="btn ghost">← Atrás</button>
      <button id="patrimonioNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 4. DEUDAS ================= -->
  <div class="step" data-step="deudas">
    <div class="eyebrow">Sección 4 de 7 · Obligaciones</div>
    <h2 class="sec-h">¿Qué obligaciones debería conocer tu familia?</h2>
    <p class="sec-sub">Conocer las obligaciones evita que tu familia descubra deudas importantes en medio de una emergencia.</p>

    <div id="deudaList"></div>
    <button id="addDeudaBtn" class="addbtn">+ Agregar deuda u obligación</button>

    <div class="stepnav">
      <button id="deudasBack" class="btn ghost">← Atrás</button>
      <button id="deudasNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 5. DOCUMENTOS ================= -->
  <div class="step" data-step="documentos">
    <div class="eyebrow">Sección 5 de 7 · Documentos</div>
    <h2 class="sec-h">¿Dónde puede encontrarlos tu familia?</h2>
    <p class="sec-sub">Marca los documentos que existen e indica su ubicación. No necesitas subirlos: el objetivo es crear un mapa para encontrarlos.</p>

    <div id="docList"></div>

    <div class="stepnav">
      <button id="documentosBack" class="btn ghost">← Atrás</button>
      <button id="documentosNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 6. CONTACTOS ================= -->
  <div class="step" data-step="contactos">
    <div class="eyebrow">Sección 6 de 7 · Contactos</div>
    <h2 class="sec-h">¿A quién debería llamar tu familia?</h2>
    <p class="sec-sub">Las personas clave a las que tu familia podría acudir. Tu asesor ya está incluido.</p>

    <div id="contactoList"></div>
    <button id="addContactoBtn" class="addbtn">+ Agregar contacto clave</button>

    <div class="stepnav">
      <button id="contactosBack" class="btn ghost">← Atrás</button>
      <button id="contactosNext" class="btn">Continuar →</button>
    </div>
  </div>

  <!-- ================= 7. PLAN ================= -->
  <div class="step" data-step="plan">
    <div class="eyebrow">Sección 7 de 7 · Plan de acción</div>
    <h2 class="sec-h">Si ocurre una emergencia, este es el orden.</h2>
    <p class="sec-sub">Un plan claro para que tu familia sepa por dónde empezar. Puedes añadir instrucciones propias.</p>

    <div class="card" style="padding:18px 20px;margin-bottom:16px" id="planBase"></div>

    <div class="field"><label>Agregar instrucción propia <span class="opt">(opcional)</span></label>
      <div style="display:flex;gap:10px">
        <input type="text" id="planInput" placeholder="Ej. Contactar primero a Carlos, mi hermano">
        <button id="addPlanBtn" class="btn sm" style="flex:0 0 auto">Añadir</button>
      </div>
    </div>
    <div id="planCustomList"></div>

    <div class="stepnav">
      <button id="planBack" class="btn ghost">← Atrás</button>
      <button id="planNext" class="btn gold">Ver mi preparación →</button>
    </div>
  </div>

  <!-- ================= GATE ================= -->
  <div class="step" data-step="gate">
    <div class="card" style="padding:30px 24px">
      <div class="eyebrow">Casi listo</div>
      <h2 class="sec-h">¿Quieres recibir tu Kit y revisarlo con tu asesor?</h2>
      <p class="sec-sub">Déjanos tus datos para guardar tu resultado y que puedas retomarlo. Solo compartimos tu <b>contacto</b> — nunca el detalle financiero de tu familia.</p>

      <div class="field"><label>Nombre</label><input type="text" id="lead_nombre" placeholder="Tu nombre"><div class="field-msg"></div></div>
      <div class="field"><label>WhatsApp <span class="opt">(10 dígitos)</span></label><input type="tel" id="lead_wa" inputmode="tel" placeholder="Ej. 5512345678"></div>
      <div class="field"><label>Correo <span class="opt">(opcional)</span></label><input type="email" id="lead_email" placeholder="tucorreo@ejemplo.com"></div>

      <label class="consent"><input type="checkbox" id="lead_consent"><span>Acepto recibir mi Kit y contacto de seguimiento de <b id="cName">Diego Tinoco</b>, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>. Entiendo que el detalle de mi Kit permanece solo en mi dispositivo.</span></label>

      <button class="btn" id="revealBtn">Ver mi Kit completo →</button>
      <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:14px">También puedes <button id="skipLeadBtn" class="linkbtn" style="color:var(--accent-d)">continuar sin dejar datos</button></p>
    </div>
  </div>

  <!-- ================= RESULTADO ================= -->
  <div class="step" data-step="result">
    <div class="res-hero">
      <div class="eyebrow" style="justify-content:center">Tu familia ya tiene un mapa</div>
      <h2 style="text-align:center">Nivel de preparación familiar</h2>
      <div class="gauge">
        <svg width="206" height="206" viewBox="0 0 206 206">
          <circle cx="103" cy="103" r="86" fill="none" stroke="var(--line)" stroke-width="14"/>
          <circle id="gaugeArc" cx="103" cy="103" r="86" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="540.35" stroke-dashoffset="540.35"/>
        </svg>
        <div class="c"><b id="scoreNum">0</b><i>de 100</i></div>
      </div>
      <div><span class="lvl-pill" id="lvlPill">—</span></div>
      <p class="sec-sub" style="text-align:center;max-width:420px;margin:8px auto 0" id="resDesc"></p>
    </div>

    <div class="summary" id="summary"></div>

    <div class="gaps" id="gapsBox"></div>

    <div class="review-card">
      <div class="rc" id="revAva">DT</div>
      <div><b>Revisa tu protección con <span id="ctaAgent">Diego</span></b><small id="ctaAgentRole">Asesor financiero · sin costo</small></div>
    </div>
    <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener">Revisar mi protección por WhatsApp</a>
    <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none">Agendar una sesión →</a>

    <div style="margin-top:14px"><button id="printBtn" class="btn ghost wide">📄 Generar mi Kit (PDF / imprimir)</button></div>

    <div class="share-band">
      <h3>¿Conoces a alguien que también debería tener esto organizado?</h3>
      <p>Compártelo con tu hermano, socio o un amigo. Toma unos minutos y puede marcar la diferencia.</p>
      <button id="shareBtn" class="btn gold wide">Compartir Kit de Emergencia</button>
    </div>

    <div class="datamgmt">
      <button id="wipeBtn" class="linkbtn">Borrar información de este dispositivo</button>
    </div>

    <div class="disclaimer">Este Kit es una herramienta de organización personal e informativa. El nivel de preparación no constituye un diagnóstico financiero, legal ni fiscal, ni una recomendación específica. Para una evaluación completa, revisa tu situación con un profesional de confianza.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Diego Tinoco</b> · Growth Link</div>
</div>

<!-- ============ Vista de impresión (se llena por JS) ============ -->
<div class="printdoc" id="printdoc"></div>

<!-- ============ Toast ============ -->
<div class="toast" id="toast"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4FBE86" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg> Guardado</div>

<!-- ============ FAB WhatsApp ============ -->
<a class="fab no-print" id="fab" href="#" target="_blank" rel="noopener">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesor</span>
</a>
`;

export const KIT_EMERGENCIA_LOGIC_JS = `

/* ==================================================================
   ▓▓  CONFIG DEL AGENTE  ▓▓  ← Editá solo esto para replicar.
   ================================================================== */
const KIT_DATA = window.__KIT_EMERGENCIA_DATA__ || {};
const KIT_BRAND = KIT_DATA.brand || {};
const KIT_SLUG = KIT_DATA.slug || "";
fetch('/api/public/mini-apps/'+KIT_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  agente:      KIT_BRAND.advisorName || "Tu asesor",
  titulo:      KIT_BRAND.title || "Asesor financiero",
  whatsapp:    KIT_BRAND.whatsapp || "",
  email:       KIT_BRAND.email || "",
  fotoURL:     KIT_BRAND.photoURL || "",
  logoURL:     KIT_BRAND.logoURL || "",
  agenteID:    KIT_SLUG,
  colorMarca:  KIT_BRAND.colorMarca || "",
  calendlyURL: KIT_BRAND.calendlyURL || "",
  privacyURL:  KIT_BRAND.privacyURL || "",
  webhookURL:  KIT_BRAND.webhookURL || ""
};

/* ================= Estado + persistencia local ================= */
const LS_KEY = "gl_kit_emergencia_" + CONFIG.agenteID;
var K = {
  titular:"", familiares:[], seguros:[], activos:[], deudas:[], docs:{}, docLoc:{}, contactos:[], planCustom:[],
  lead:null
};
function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(K)); toast(); }catch(e){} }
function loadLocal(){ try{ var s=localStorage.getItem(LS_KEY); if(s){ K=Object.assign(K, JSON.parse(s)); } }catch(e){} }

var toastT;
function toast(msg){ var el=$("toast"); if(msg) el.lastChild.textContent=" "+msg; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1400); }

/* ================= Helpers ================= */
function $(id){ return document.getElementById(id); }
function el(tag,cls,html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function esc(s){ return (s||"").replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function track(ev,data){ try{ console.log("[track]",ev,data||""); }catch(e){} }

/* ================= Catálogos ================= */
var SEGURO_TIPOS = ["Seguro de vida","Gastos médicos","Seguro de hogar","Seguro de auto","Seguro educativo","Seguro de retiro","Otro"];
var ACTIVO_TIPOS = ["Cuenta bancaria","Inversión","AFORE","Plan personal de retiro","Inmueble","Empresa / negocio","Vehículo","Otro activo"];
var DEUDA_TIPOS  = ["Hipoteca","Crédito automotriz","Tarjeta de crédito","Préstamo personal","Crédito empresarial","Otra deuda"];
var DOC_LIST = ["Identificaciones","Actas de nacimiento","Acta de matrimonio","Testamento","Escrituras","Pólizas de seguro","Contratos","Documentos bancarios","Documentos fiscales","Documentación empresarial","Documentos médicos relevantes","Otro"];
var CONTACTO_ROLES = ["Asesor de seguros","Contador","Abogado / Notario","Asesor financiero","Médico","Socio / persona clave","Familiar de confianza","Otro"];
var PLAN_BASE = [
  "Contactar al familiar responsable.",
  "Contactar al asesor de seguros.",
  "Localizar las pólizas vigentes.",
  "Revisar seguros de vida y gastos médicos.",
  "Localizar los documentos legales.",
  "Revisar cuentas y activos registrados.",
  "Revisar las obligaciones financieras.",
  "Contactar al contador o notario si corresponde."
];

/* ================= Init ================= */
(function init(){
  if(CONFIG.colorMarca){
    document.documentElement.style.setProperty('--accent', CONFIG.colorMarca);
  }
  var initials = CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente;
  $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente;
  $("footAgent").textContent=CONFIG.agente;
  $("ctaAgent").textContent=CONFIG.agente.split(" ")[0];
  $("ctaAgentRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.privacyURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){
    var src=CONFIG.fotoURL||CONFIG.logoURL;
    $("agentAva").innerHTML='<img src="'+src+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    $("revAva").innerHTML='<img src="'+src+'" alt="">';
  } else { $("agentAva").textContent=initials; $("revAva").textContent=initials; }
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre el Kit de Emergencia Financiera Familiar.");
  if(CONFIG.calendlyURL){ $("calendlyBtn").href=CONFIG.calendlyURL; $("calendlyBtn").style.display="flex"; }

  loadLocal();
  hydrate();
  var ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref;
  track('app_started');
})();

/* Rellenar UI con datos guardados */
function hydrate(){
  if(K.titular) $("fam_titular").value=K.titular;
  renderFamTree(); renderFamList();
  renderSeguroChips(); renderSeguroList();
  renderActivos(); renderDeudas(); renderDocs(); renderContactos(); renderPlan(); renderPlanCustom();
}

/* ================= Navegación ================= */
var SECTIONS=["familia","seguros","patrimonio","deudas","documentos","contactos","plan"];
function go(step, first){
  if(first){ ensureAgentContact(); }
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  var showProg = SECTIONS.indexOf(step)>=0;
  $("gprogWrap").style.display = showProg ? "block" : "none";
  updateProgress();
  window.scrollTo({top:0,behavior:'smooth'});
  track('section_view',{step:step});
}
function updateProgress(){
  // progreso = % de secciones con al menos un dato
  var done=0;
  if(K.titular || K.familiares.length) done++;
  if(K.seguros.length) done++;
  if(K.activos.length) done++;
  if(K.deudas.length) done++;
  if(Object.keys(K.docs).filter(function(k){return K.docs[k]}).length) done++;
  if(K.contactos.length) done++;
  if(true) done++; // plan siempre tiene base
  var pct=Math.round(done/7*100);
  $("gpbar").style.width=pct+"%"; $("gpctText").textContent=pct+"%";
}

/* ================= 1. FAMILIA ================= */
function renderFamTree(){
  K.titular=$("fam_titular").value.trim();
  var w=$("famTreeWrap");
  if(!K.titular && !K.familiares.length){ w.innerHTML=""; return; }
  var h='<div class="famtree"><div class="root">'+(esc(K.titular)||"Titular")+' <span>Titular</span></div>';
  K.familiares.forEach(function(f){ h+='<div class="branch"><b>'+esc(f.nombre||"—")+'</b> — '+esc(f.relacion||"Familiar")+(f.edad?(" · "+esc(f.edad)+" años"):"")+'</div>'; });
  h+='</div>'; w.innerHTML=h;
}
function renderFamList(){
  var w=$("famList"); w.innerHTML="";
  K.familiares.forEach(function(f){
    var it=el("div","item");
    it.innerHTML='<button class="del" onclick="delFamiliar(\\''+f.id+'\\')">✕</button>'+
      '<div class="grid2">'+
      '<div class="field" style="margin-bottom:8px"><label>Nombre</label><input type="text" value="'+esc(f.nombre)+'" oninput="updFam(\\''+f.id+'\\',\\'nombre\\',this.value)"></div>'+
      '<div class="field" style="margin-bottom:8px"><label>Relación</label><input type="text" placeholder="Pareja, hija, hijo…" value="'+esc(f.relacion)+'" oninput="updFam(\\''+f.id+'\\',\\'relacion\\',this.value)"></div>'+
      '</div>'+
      '<div class="field" style="margin-bottom:0"><label>Edad <span class="opt">(opcional)</span></label><input type="number" style="max-width:120px" value="'+esc(f.edad)+'" oninput="updFam(\\''+f.id+'\\',\\'edad\\',this.value)"></div>';
    w.appendChild(it);
  });
}
function addFamiliar(){ K.familiares.push({id:uid(),nombre:"",relacion:"",edad:""}); renderFamList(); renderFamTree(); saveLocal(); }
function updFam(id,k,v){ var f=K.familiares.find(function(x){return x.id===id}); if(f){ f[k]=v; renderFamTree(); saveLocal(); } }
function delFamiliar(id){ K.familiares=K.familiares.filter(function(x){return x.id!==id}); renderFamList(); renderFamTree(); saveLocal(); }

/* ================= 2. SEGUROS ================= */
function renderSeguroChips(){
  var w=$("seguroChips"); w.innerHTML="";
  SEGURO_TIPOS.forEach(function(t){
    var on=K.seguros.some(function(s){return s.tipo===t});
    var c=el("button","chip"+(on?" on":""),'<span class="tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'+t);
    c.onclick=function(){ toggleSeguro(t); };
    w.appendChild(c);
  });
}
function toggleSeguro(t){
  var idx=K.seguros.findIndex(function(s){return s.tipo===t});
  if(idx>=0){ K.seguros.splice(idx,1); }
  else { K.seguros.push({id:uid(),tipo:t,aseguradora:"",titular:"",beneficiarios:"",ref:"",renov:"",asesor:"",asesorTel:"",ubic:""}); }
  renderSeguroChips(); renderSeguroList(); saveLocal();
}
function renderSeguroList(){
  var w=$("seguroList"); w.innerHTML="";
  if(!K.seguros.length){ w.appendChild(el("div","empty","Selecciona arriba los seguros que existen para registrar sus datos.")); return; }
  K.seguros.forEach(function(s){
    var it=el("div","item");
    it.innerHTML='<div class="it-top"><div class="it-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><div class="it-title">'+esc(s.tipo)+'</div><div class="it-sub">Protección registrada</div></div></div>'+
      '<div class="grid2" style="margin-top:12px">'+
      fInput('Aseguradora',s.aseguradora,"seguro",s.id,"aseguradora","Ej. MetLife")+
      fInput('Titular',s.titular,"seguro",s.id,"titular","")+
      '</div>'+
      '<div class="grid2">'+
      fInput('Beneficiarios',s.beneficiarios,"seguro",s.id,"beneficiarios","")+
      fInput('N° / referencia (opcional)',s.ref,"seguro",s.id,"ref","")+
      '</div>'+
      '<div class="grid2">'+
      fInput('Nombre del asesor',s.asesor,"seguro",s.id,"asesor","")+
      fInput('Teléfono del asesor',s.asesorTel,"seguro",s.id,"asesorTel","")+
      '</div>'+
      fInput('¿Dónde encontrar la póliza?',s.ubic,"seguro",s.id,"ubic","Ej. Carpeta azul del estudio / Drive familiar",true);
    w.appendChild(it);
  });
}

/* ================= 3. PATRIMONIO ================= */
function renderActivos(){
  var w=$("activoList"); w.innerHTML="";
  if(!K.activos.length){ w.appendChild(el("div","empty","Aún no agregas activos. Empieza por una cuenta, inversión o propiedad.")); }
  K.activos.forEach(function(a){
    var it=el("div","item");
    it.innerHTML='<button class="del" onclick="delActivo(\\''+a.id+'\\')">✕</button>'+
      '<div class="field" style="margin-bottom:10px"><label>Tipo de activo</label>'+selectHTML(ACTIVO_TIPOS,a.tipo,"activo",a.id,"tipo")+'</div>'+
      '<div class="grid2">'+
      fInput('Institución / ubicación',a.institucion,"activo",a.id,"institucion","Ej. BBVA, Notaría 5…")+
      fInput('Titular',a.titular,"activo",a.id,"titular","")+
      '</div>'+
      '<div class="grid2">'+
      fInput('Beneficiario (si aplica)',a.beneficiario,"activo",a.id,"beneficiario","")+
      fInput('¿Dónde está la documentación?',a.ubic,"activo",a.id,"ubic","Ej. Caja fuerte")+
      '</div>';
    w.appendChild(it);
  });
}
function addActivo(){ K.activos.push({id:uid(),tipo:ACTIVO_TIPOS[0],institucion:"",titular:"",beneficiario:"",ubic:""}); renderActivos(); saveLocal(); }
function delActivo(id){ K.activos=K.activos.filter(function(x){return x.id!==id}); renderActivos(); saveLocal(); }

/* ================= 4. DEUDAS ================= */
function renderDeudas(){
  var w=$("deudaList"); w.innerHTML="";
  if(!K.deudas.length){ w.appendChild(el("div","empty","Si no hay obligaciones, puedes continuar. Si existen, regístralas para que tu familia las conozca.")); }
  K.deudas.forEach(function(d){
    var it=el("div","item");
    it.innerHTML='<button class="del" onclick="delDeuda(\\''+d.id+'\\')">✕</button>'+
      '<div class="field" style="margin-bottom:10px"><label>Tipo de obligación</label>'+selectHTML(DEUDA_TIPOS,d.tipo,"deuda",d.id,"tipo")+'</div>'+
      '<div class="grid2">'+
      fInput('Institución',d.institucion,"deuda",d.id,"institucion","")+
      fInput('Saldo aproximado (opcional)',d.saldo,"deuda",d.id,"saldo","")+
      '</div>'+
      '<div class="grid2">'+
      fInput('Pago mensual (opcional)',d.pago,"deuda",d.id,"pago","")+
      '<div class="field"><label>¿Tiene seguro asociado?</label>'+selectHTML(["No lo sé","Sí","No"],d.seguro,"deuda",d.id,"seguro")+'</div>'+
      '</div>'+
      fInput('¿Dónde encontrar la documentación?',d.ubic,"deuda",d.id,"ubic","",true);
    w.appendChild(it);
  });
}
function addDeuda(){ K.deudas.push({id:uid(),tipo:DEUDA_TIPOS[0],institucion:"",saldo:"",pago:"",seguro:"No lo sé",ubic:""}); renderDeudas(); saveLocal(); }
function delDeuda(id){ K.deudas=K.deudas.filter(function(x){return x.id!==id}); renderDeudas(); saveLocal(); }

/* ================= 5. DOCUMENTOS ================= */
function renderDocs(){
  var w=$("docList"); w.innerHTML="";
  DOC_LIST.forEach(function(d){
    var on=!!K.docs[d];
    var row=el("div","checkrow"+(on?" on":""));
    row.innerHTML='<div class="cb"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+
      '<div class="cx"><b>'+d+'</b><input type="text" placeholder="¿Dónde puede encontrarlo tu familia?" value="'+esc(K.docLoc[d]||"")+'" onclick="event.stopPropagation()" oninput="setDocLoc(\\''+esc(d)+'\\',this.value)"></div>';
    row.onclick=function(){ toggleDoc(d); };
    w.appendChild(row);
  });
}
function toggleDoc(d){ K.docs[d]=!K.docs[d]; renderDocs(); saveLocal(); }
function setDocLoc(d,v){ K.docLoc[d]=v; saveLocal(); }

/* ================= 6. CONTACTOS ================= */
function ensureAgentContact(){
  if(!K.contactos.some(function(c){return c.isAgent})){
    K.contactos.unshift({id:uid(),isAgent:true,nombre:CONFIG.agente,rol:"Tu asesor de seguros",tel:CONFIG.whatsapp,email:CONFIG.email||""});
  }
}
function renderContactos(){
  var w=$("contactoList"); w.innerHTML="";
  K.contactos.forEach(function(c){
    var it=el("div","item");
    var delBtn = c.isAgent ? "" : '<button class="del" onclick="delContacto(\\''+c.id+'\\')">✕</button>';
    var lock = c.isAgent ? ' <span class="it-sub" style="color:var(--accent-d)">· incluido automáticamente</span>' : '';
    it.innerHTML=delBtn+
      '<div class="it-top"><div class="it-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div><div class="it-title">'+esc(c.nombre||"Contacto")+lock+'</div><div class="it-sub">'+esc(c.rol||"")+'</div></div></div>'+
      '<div class="grid2" style="margin-top:12px">'+
      fInput('Nombre',c.nombre,"contacto",c.id,"nombre","")+
      '<div class="field"><label>Rol</label>'+selectHTML(CONTACTO_ROLES,c.rol,"contacto",c.id,"rol")+'</div>'+
      '</div>'+
      '<div class="grid2">'+
      fInput('Teléfono',c.tel,"contacto",c.id,"tel","")+
      fInput('Email (opcional)',c.email,"contacto",c.id,"email","")+
      '</div>';
    w.appendChild(it);
  });
}
function addContacto(){ K.contactos.push({id:uid(),nombre:"",rol:CONTACTO_ROLES[6],tel:"",email:""}); renderContactos(); saveLocal(); }
function delContacto(id){ K.contactos=K.contactos.filter(function(x){return x.id!==id}); renderContactos(); saveLocal(); }

/* ================= 7. PLAN ================= */
function renderPlan(){
  var w=$("planBase"); w.innerHTML="";
  PLAN_BASE.forEach(function(p,i){
    w.appendChild(el("div","planitem",'<div class="num">'+(i+1)+'</div><p>'+p+'</p>'));
  });
}
function renderPlanCustom(){
  var w=$("planCustomList"); w.innerHTML="";
  K.planCustom.forEach(function(p){
    var it=el("div","planitem custom",'<div class="num">+</div><p>'+esc(p.txt)+'</p><span class="del2" onclick="delPlan(\\''+p.id+'\\')">✕</span>');
    w.appendChild(it);
  });
}
function addPlanCustom(){ var v=$("planInput").value.trim(); if(!v)return; K.planCustom.push({id:uid(),txt:v}); $("planInput").value=""; renderPlanCustom(); saveLocal(); }
function delPlan(id){ K.planCustom=K.planCustom.filter(function(x){return x.id!==id}); renderPlanCustom(); saveLocal(); }

/* ================= Inputs genéricos ================= */
function fInput(label,val,coll,id,key,ph,full){
  return '<div class="field"'+(full?' style="margin-top:2px"':'')+'><label>'+label+'</label>'+
    '<input type="text" value="'+esc(val)+'" placeholder="'+esc(ph||"")+'" oninput="updItem(\\''+coll+'\\',\\''+id+'\\',\\''+key+'\\',this.value)"></div>';
}
function selectHTML(opts,val,coll,id,key){
  var h='<select onchange="updItem(\\''+coll+'\\',\\''+id+'\\',\\''+key+'\\',this.value)">';
  opts.forEach(function(o){ h+='<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>'; });
  return h+'</select>';
}
function collArr(coll){ return {seguro:K.seguros,activo:K.activos,deuda:K.deudas,contacto:K.contactos}[coll]; }
function updItem(coll,id,key,val){
  var arr=collArr(coll); var o=arr.find(function(x){return x.id===id}); if(o){ o[key]=val; saveLocal();
    if(coll==="contacto"){ /* refrescar título en vivo sin perder foco: solo guardamos */ }
  }
}

/* ================= GATE + LEAD ================= */
function buildLead(){
  // SOLO datos mínimos de contacto + métricas. NUNCA detalle financiero.
  var cats = {
    familia: (K.titular?1:0)+K.familiares.length>0,
    seguros: K.seguros.length>0,
    patrimonio: K.activos.length>0,
    deudas: K.deudas.length>0,
    documentos: Object.keys(K.docs).filter(function(k){return K.docs[k]}).length>0,
    contactos: K.contactos.filter(function(c){return !c.isAgent}).length>0
  };
  return {
    agenteID: CONFIG.agenteID,
    recurso: "kit-emergencia-financiera-familiar",
    nombre: (K.lead&&K.lead.nombre)||"",
    whatsapp: (K.lead&&K.lead.whatsapp)||"",
    email: (K.lead&&K.lead.email)||"",
    scorePreparacion: computeScore(),
    categoriasCompletadas: Object.keys(cats).filter(function(k){return cats[k]}),
    conteos: { familiares:K.familiares.length, seguros:K.seguros.length, activos:K.activos.length, deudas:K.deudas.length,
               documentos:Object.keys(K.docs).filter(function(k){return K.docs[k]}).length, contactos:K.contactos.filter(function(c){return !c.isAgent}).length },
    referidoPor: window._referidoPor||null,
    fecha: new Date().toISOString()
  };
}
function sendLeadToCRM(lead){
  var hostedPayload = Object.assign({}, lead, { consentimiento: true, consentimiento_fecha: lead.fecha });
  fetch('/api/public/mini-apps/'+KIT_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
  if(!CONFIG.webhookURL) return;
  try{ fetch(CONFIG.webhookURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead),keepalive:true}); }catch(e){}
}
function revealResult(skip){
  if(!skip){
    var nombre=$("lead_nombre").value.trim(), wa=$("lead_wa").value.replace(/\\D/g,''), email=$("lead_email").value.trim();
    if(nombre.length<2 || wa.length<10 || !$("lead_consent").checked){
      if(nombre.length<2) $("lead_nombre").style.borderColor="var(--danger)";
      if(wa.length<10) $("lead_wa").style.borderColor="var(--danger)";
      if(!$("lead_consent").checked){ var b=$("revealBtn"),t=b.textContent; b.textContent="Completa tus datos y acepta para continuar"; setTimeout(function(){b.textContent=t},1900); }
      return;
    }
    K.lead={nombre:nombre,whatsapp:wa,email:email,consent:true};
    saveLocal();
    var lead=buildLead(); window._lead=lead;
    sendLeadToCRM(lead);
    track('lead_captured',{score:lead.scorePreparacion});
  }
  paintResult(); go('result'); $("gprogWrap").style.display="none"; requestAnimationFrame(animateResult);
}

/* ================= SCORE + RESULTADO ================= */
function computeScore(){
  // % de "casillas" de preparación completadas (no es diagnóstico oficial)
  var pts=0, max=0;
  // Familia (titular + al menos 1 dependiente si aplica) — 15
  max+=15; if(K.titular)pts+=8; if(K.familiares.length)pts+=7;
  // Seguros — 25 (vida y GMM pesan)
  max+=25;
  if(K.seguros.some(function(s){return s.tipo==="Seguro de vida"}))pts+=10;
  if(K.seguros.some(function(s){return s.tipo==="Gastos médicos"}))pts+=8;
  if(K.seguros.length>=1)pts+=4; if(K.seguros.length>=3)pts+=3;
  // Patrimonio — 15
  max+=15; if(K.activos.length>=1)pts+=8; if(K.activos.length>=3)pts+=7;
  // Deudas — 10 (registrar aporta claridad; 0 deudas también cuenta como conocido)
  max+=10; pts+=10; // conocer/registrar obligaciones se considera cubierto al pasar la sección
  // Documentos — 20
  max+=20; var dcount=Object.keys(K.docs).filter(function(k){return K.docs[k]}).length; pts+=Math.min(20, dcount*3);
  // Contactos — 15
  max+=15; var ccount=K.contactos.filter(function(c){return !c.isAgent}).length; pts+=Math.min(15, 5+ccount*4);
  return Math.max(0, Math.min(100, Math.round(pts/max*100)));
}
function levelFor(score){
  if(score>=80) return {name:"Muy buena preparación",lvl:"hi",desc:"Tu familia tendría un mapa claro de qué hacer y a quién acudir. El siguiente paso es mantenerlo al día."};
  if(score>=60) return {name:"Buena preparación",lvl:"hi",desc:"Tienes lo esencial organizado. Hay algunos puntos que vale la pena completar para dejarlo redondo."};
  if(score>=40) return {name:"Preparación en desarrollo",lvl:"mid",desc:"Buen comienzo. Aún faltan piezas importantes para que tu familia sepa exactamente qué hacer."};
  return {name:"Preparación inicial",lvl:"lo",desc:"Diste el primer paso. Completar las áreas faltantes marcará una gran diferencia para tu familia."};
}
function detectGaps(){
  var g=[];
  if(!K.seguros.some(function(s){return s.tipo==="Seguro de vida"})) g.push("No registraste un seguro de vida.");
  if(!K.seguros.some(function(s){return s.tipo==="Gastos médicos"})) g.push("No registraste un seguro de gastos médicos.");
  if(!K.docs["Testamento"]) g.push("No indicaste dónde se encuentra tu testamento.");
  if(!K.activos.length) g.push("No registraste cuentas ni activos del patrimonio familiar.");
  if(K.contactos.filter(function(c){return !c.isAgent}).length===0) g.push("No agregaste contactos clave además de tu asesor.");
  var dcount=Object.keys(K.docs).filter(function(k){return K.docs[k]}).length;
  if(dcount<4) g.push("Tienes pocos documentos localizados; conviene mapear dónde están.");
  return g.slice(0,4);
}
function paintResult(){
  var score=computeScore(), lv=levelFor(score);
  $("scoreNum").textContent=score;
  var pill=$("lvlPill"); pill.textContent=lv.name; pill.className="lvl-pill "+lv.lvl;
  $("resDesc").textContent=lv.desc;
  var arcColor = lv.lvl==="lo" ? "var(--alert)" : (lv.lvl==="mid" ? "var(--gold)" : "var(--accent)");
  $("gaugeArc").setAttribute("stroke",arcColor);

  // resumen
  var dcount=Object.keys(K.docs).filter(function(k){return K.docs[k]}).length;
  var ccount=K.contactos.filter(function(c){return !c.isAgent}).length;
  var cards=[
    {ic:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/>', n:(K.familiares.length+(K.titular?1:0)), t:"personas registradas", miss:!(K.familiares.length||K.titular)},
    {ic:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', n:K.seguros.length, t:"seguros registrados", miss:K.seguros.length===0},
    {ic:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>', n:K.activos.length, t:"activos identificados", miss:K.activos.length===0},
    {ic:'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>', n:K.deudas.length, t:"obligaciones", miss:false},
    {ic:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>', n:dcount, t:"documentos localizados", miss:dcount<4},
    {ic:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>', n:ccount, t:"contactos clave", miss:ccount===0}
  ];
  var sw=$("summary"); sw.innerHTML="";
  cards.forEach(function(c){
    var d=el("div","sumcard"+(c.miss?" miss":""));
    d.innerHTML='<div class="sc-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+c.ic+'</svg></div><b>'+c.n+'</b><span>'+c.t+'</span>';
    sw.appendChild(d);
  });

  // brechas
  var gaps=detectGaps(), gb=$("gapsBox");
  if(gaps.length){
    var h='<h3>Detectamos '+gaps.length+' punto'+(gaps.length>1?'s':'')+' para revisar</h3><div class="gsub">No significa que exista un problema. Son puntos que vale la pena revisar con tu asesor.</div>';
    gaps.forEach(function(g){ h+='<div class="gap"><span class="gi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg></span><span>'+g+'</span></div>'; });
    h+='<div class="disc">Estos puntos son orientativos. Tu asesor puede ayudarte a revisarlos con calma.</div>';
    gb.innerHTML=h; gb.style.display="block";
  } else {
    gb.innerHTML='<div class="allgood"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2E6E5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Tu Kit está muy completo. Un buen momento para revisarlo con tu asesor y mantenerlo al día.</div>';
    gb.style.display="block";
  }

  // WhatsApp (sin datos sensibles)
  var primer=(K.lead&&K.lead.nombre?K.lead.nombre.split(" ")[0]:"");
  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+(primer||"[tu nombre]")+".\\n\\nAcabo de completar mi Kit de Emergencia Financiera Familiar.\\nMi nivel de preparación fue: "+score+"/100.\\n\\nMe aparecieron algunos puntos que quisiera revisar contigo. ¿Podemos verlo?";
  $("waBtn").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);

  track('kit_completed',{score:score});
}
function animateResult(){
  var r=86, circ=2*Math.PI*r, arc=$("gaugeArc"), score=computeScore();
  arc.style.strokeDasharray=circ; arc.style.strokeDashoffset=circ;
  requestAnimationFrame(function(){ arc.style.transition="stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)"; arc.style.strokeDashoffset=circ*(1-score/100); });
  var t0=performance.now();
  (function tick(t){ var p=Math.min(1,(t-t0)/1100); $("scoreNum").textContent=Math.round(score*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(tick); })(t0);
}

/* ================= COMPARTIR ================= */
function shareKit(){
  track('share_clicked');
  var url=location.origin+location.pathname+"?ref="+encodeURIComponent(CONFIG.agenteID);
  var data={title:"Kit de Emergencia Financiera Familiar", text:"Organiza en minutos la información que tu familia necesitaría ante una emergencia. Me pareció muy útil:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else {
    navigator.clipboard && navigator.clipboard.writeText(url);
    toast("Enlace copiado");
  }
}

/* ================= IMPRIMIR / PDF ================= */
function printKit(){
  track('kit_printed');
  buildPrintDoc();
  window.print();
}
function buildPrintDoc(){
  var d=new Date();
  var fecha=d.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
  var apellido = (K.titular||"").split(" ").slice(-1)[0] || "";
  var score=computeScore();
  var h='<h1>Kit de Emergencia Financiera</h1>';
  h+='<div class="pmeta">'+(K.titular?("Familia "+esc(apellido)+" · "):"")+'Preparado el '+fecha+' · Nivel de preparación: '+score+'/100</div>';

  h+=psec("1","Familia", (function(){
    var r=''; if(K.titular) r+=prow("<b>"+esc(K.titular)+"</b> — Titular");
    K.familiares.forEach(function(f){ r+=prow("<b>"+esc(f.nombre||"—")+"</b> — "+esc(f.relacion||"Familiar")+(f.edad?(" ("+esc(f.edad)+" años)"):"")); });
    return r||prow("<span class='k'>Sin registros.</span>");
  })());

  h+=psec("2","Seguros y protección", K.seguros.length? K.seguros.map(function(s){
    return prow("<b>"+esc(s.tipo)+"</b>"+kv("Aseguradora",s.aseguradora)+kv("Titular",s.titular)+kv("Beneficiarios",s.beneficiarios)+kv("Asesor",s.asesor)+kv("Tel. asesor",s.asesorTel)+kv("Ubicación",s.ubic));
  }).join("") : prow("<span class='k'>Sin registros.</span>"));

  h+=psec("3","Patrimonio", K.activos.length? K.activos.map(function(a){
    return prow("<b>"+esc(a.tipo)+"</b>"+kv("Institución",a.institucion)+kv("Titular",a.titular)+kv("Beneficiario",a.beneficiario)+kv("Documentación",a.ubic));
  }).join("") : prow("<span class='k'>Sin registros.</span>"));

  h+=psec("4","Obligaciones", K.deudas.length? K.deudas.map(function(x){
    return prow("<b>"+esc(x.tipo)+"</b>"+kv("Institución",x.institucion)+kv("Saldo aprox.",x.saldo)+kv("Pago mensual",x.pago)+kv("Seguro asociado",x.seguro)+kv("Documentación",x.ubic));
  }).join("") : prow("<span class='k'>Sin registros.</span>"));

  h+=psec("5","Documentos importantes", (function(){
    var keys=Object.keys(K.docs).filter(function(k){return K.docs[k]});
    return keys.length? keys.map(function(k){ return prow("<b>"+esc(k)+"</b>"+kv("Ubicación",K.docLoc[k]||"—")); }).join("") : prow("<span class='k'>Sin registros.</span>");
  })());

  h+=psec("6","Contactos de emergencia", K.contactos.length? K.contactos.map(function(c){
    return prow("<b>"+esc(c.nombre||"—")+"</b> — "+esc(c.rol||"")+kv("Teléfono",c.tel)+kv("Email",c.email));
  }).join("") : prow("<span class='k'>Sin registros.</span>"));

  h+=psec("7","Qué hacer ante una emergencia", PLAN_BASE.map(function(p,i){ return prow((i+1)+". "+p); }).join("")+
    K.planCustom.map(function(p){ return prow("+ "+esc(p.txt)); }).join(""));

  h+='<div class="pnote">Este documento contiene información privada. Guárdalo en un lugar seguro y compártelo únicamente con personas de confianza. No incluye contraseñas ni claves bancarias por diseño.</div>';
  $("printdoc").innerHTML=h;
}
function psec(n,t,body){ return '<div class="psec"><div class="pnum">Sección '+n+'</div><h2>'+t+'</h2>'+body+'</div>'; }
function prow(html){ return '<div class="prow">'+html+'</div>'; }
function kv(k,v){ if(!v)return ""; return ' &nbsp; <span class="k">'+esc(k)+':</span> '+esc(v); }

/* ================= BORRAR DATOS ================= */
function wipeData(){
  if(!confirm("¿Borrar toda la información de tu Kit en este dispositivo? Esta acción no se puede deshacer.")) return;
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
  track('data_wiped');
  location.reload();
}


/* ==================== Wiring de botones (ids agregados en integración) ==================== */
document.getElementById('btnStart').addEventListener('click', function(){ go('familia', true); });
document.getElementById('addFamiliarBtn').addEventListener('click', addFamiliar);
document.getElementById('familiaBack').addEventListener('click', function(){ go('welcome'); });
document.getElementById('familiaNext').addEventListener('click', function(){ go('seguros'); });
document.getElementById('segurosBack').addEventListener('click', function(){ go('familia'); });
document.getElementById('segurosNext').addEventListener('click', function(){ go('patrimonio'); });
document.getElementById('addActivoBtn').addEventListener('click', addActivo);
document.getElementById('patrimonioBack').addEventListener('click', function(){ go('seguros'); });
document.getElementById('patrimonioNext').addEventListener('click', function(){ go('deudas'); });
document.getElementById('addDeudaBtn').addEventListener('click', addDeuda);
document.getElementById('deudasBack').addEventListener('click', function(){ go('patrimonio'); });
document.getElementById('deudasNext').addEventListener('click', function(){ go('documentos'); });
document.getElementById('documentosBack').addEventListener('click', function(){ go('deudas'); });
document.getElementById('documentosNext').addEventListener('click', function(){ go('contactos'); });
document.getElementById('addContactoBtn').addEventListener('click', addContacto);
document.getElementById('contactosBack').addEventListener('click', function(){ go('documentos'); });
document.getElementById('contactosNext').addEventListener('click', function(){ go('plan'); });
document.getElementById('addPlanBtn').addEventListener('click', addPlanCustom);
document.getElementById('planBack').addEventListener('click', function(){ go('contactos'); });
document.getElementById('planNext').addEventListener('click', function(){ go('gate'); });
document.getElementById('revealBtn').addEventListener('click', function(){ revealResult(); });
document.getElementById('skipLeadBtn').addEventListener('click', function(){ revealResult(true); });
document.getElementById('waBtn').addEventListener('click', function(){ track('whatsapp_clicked'); });
document.getElementById('calendlyBtn').addEventListener('click', function(){ track('calendly_clicked'); });
document.getElementById('printBtn').addEventListener('click', printKit);
document.getElementById('shareBtn').addEventListener('click', shareKit);
document.getElementById('wipeBtn').addEventListener('click', wipeData);
document.getElementById('fab').addEventListener('click', function(){ track('whatsapp_clicked'); });

`;
