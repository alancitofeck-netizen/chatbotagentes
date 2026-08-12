/** Plantilla verbatim de "Test de Preparación para Emergencias Financieras"
 * (Emergency Readiness Score) — CSS, HTML y JS copiados literal del archivo
 * original que sirvió de base a este tipo de Mini App (mismo diseño,
 * tipografía Fraunces/Hanken Grotesk, flujo de 10 preguntas dinámicas +
 * análisis + gate + resultado con 4 dimensiones/escenarios/fortalezas/
 * vulnerabilidades/acciones/recomendación, sin ningún rediseño).
 *
 * Las ÚNICAS diferencias respecto del original, dentro de
 * TEST_EMERGENCIA_LOGIC_JS, son:
 *
 * 1. El objeto `CONFIG` (antes hardcodeado con los datos de ejemplo "Diego
 *    Tinoco") ahora lee de `window.__TEST_EMERGENCIA_DATA__`, inyectado por
 *    TestEmergenciaApp.tsx a partir de la config guardada en el CRM.
 * 2. Dentro de `sendLeadToCRM(lead)`, además del `fetch` original a
 *    `CONFIG.webhookURL` (que se deja intacto), se agrega un `fetch` a
 *    `/api/public/mini-apps/{slug}/hosted-lead` con el contrato que
 *    `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. `buildLead()` manda `timestamp` (no `fecha`) y
 *    no manda `consentimiento`/`consentimiento_fecha`, así que se agregan
 *    recién acá, al construir el payload hacia el CRM (`fecha`/
 *    `consentimiento_fecha` tomados de `lead.timestamp`,
 *    `consentimiento:true` porque `revealResult()` ya validó el checkbox
 *    antes de llegar a este punto).
 * 3. Se agrega un `fetch` fire-and-forget a
 *    `/api/public/mini-apps/{slug}/visit` al cargar, igual que los demás
 *    tipos de Mini App.
 * 4. Los 10 botones de navegación/acción de nivel superior que en el HTML
 *    original llamaban a sus funciones vía atributos `onclick="..."` inline
 *    pasan a conectarse con `addEventListener` al final del script — mismo
 *    motivo ya documentado en metaUniversitariaTemplate.ts/
 *    kitEmergenciaTemplate.ts (un global como `window.next` puede quedar
 *    pisado por el runtime de Next.js, commit 8b361bd). 4 de esos botones no
 *    tenían `id` en el original (el CTA de intro, el link "continuar sin
 *    dejar datos", "Compartir test" y "Volver a empezar") y lo reciben acá
 *    (`btnStart`/`skipLeadBtn`/`shareTestBtn`/`restartBtn`); los otros 6 ya
 *    tenían `id` propio. El único `onclick` que el archivo genera
 *    dinámicamente (`b.onclick=function(){ selectOpt(q,i,o); }`, dentro de
 *    `renderQuestion()`, uno por cada opción de respuesta) se deja intacto:
 *    es una asignación de propiedad JS resuelta por closure al definirse, no
 *    un atributo `onclick="nombreGlobal()"` resuelto en window al hacer
 *    click — no sufre el bug de `window.next`, y "arreglarlo" exigiría
 *    reescribir la lógica de renderizado de preguntas en sí.
 *
 * SEND_DETAILED_RESPONSES sigue en `false`, igual que en el archivo
 * original — no es parte del objeto CONFIG que esta integración personaliza
 * (ver testEmergenciaDefaults.ts para el porqué y su efecto en el
 * saneamiento server-side). Todo el resto — CSS, HTML, y cada función de
 * TEST_EMERGENCIA_LOGIC_JS — es una copia literal del archivo original.
 */

export const TEST_EMERGENCIA_CSS = `

  :root{
    --ink:#122019; --ink-soft:#334339;
    --accent:#2F7A63; --accent-d:#215B49; --accent-2:#4EA184;   /* verde salvia sereno */
    --sky:#3E6E86; --gold:#B0894C; --warn:#B5763C;
    --paper:#FFFFFF; --bg-1:#F1F0EA; --bg-2:#E8E9E1; --bone:#FBFAF5;
    --muted:#6E7A72; --muted-2:#9AA49C; --line:#E6E5DC; --line-2:#F0EFE7;
    --danger:#B4472F;
    /* niveles del semáforo — sin rojo agresivo */
    --lvl-1:#B5763C; --lvl-2:#C39A54; --lvl-3:#4EA184; --lvl-4:#2F7A63;
    --shadow-card:0 22px 50px -28px rgba(18,32,25,.34);
    --shadow-soft:0 6px 18px -10px rgba(18,32,25,.20);
    --shadow-btn:0 14px 26px -12px rgba(47,122,99,.5);
    --f:'Hanken Grotesk',system-ui,-apple-system,sans-serif;
    --f-d:'Fraunces',Georgia,serif;
    --r:22px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font-family:var(--f);color:var(--ink);line-height:1.55;min-height:100vh;
    padding:0 0 calc(30px + env(safe-area-inset-bottom));
    background:
      radial-gradient(800px 420px at 100% -6%, rgba(176,137,76,.07), transparent 55%),
      radial-gradient(760px 400px at 0% 8%, rgba(47,122,99,.09), transparent 52%),
      linear-gradient(168deg,var(--bg-1),var(--bg-2));
    background-attachment:fixed;
  }
  .topbar{position:sticky;top:0;z-index:30;background:rgba(241,240,234,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .topbar .in{max-width:520px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:12px}
  .agent{display:flex;align-items:center;gap:11px;min-width:0}
  .agent .ava{width:40px;height:40px;border-radius:12px;flex:0 0 auto;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-weight:600;font-size:15px;overflow:hidden}
  .agent .ava img{width:100%;height:100%;object-fit:cover}
  .agent .who{min-width:0;line-height:1.25}
  .agent .who b{font-size:13.5px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent .who span{font-size:11.5px;color:var(--muted)}
  .kit-name{margin-left:auto;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700;text-align:right;white-space:nowrap}

  .gprog{max-width:520px;margin:0 auto;padding:0 18px 11px}
  .gprog .track{height:6px;background:var(--line);border-radius:6px;overflow:hidden;margin-top:11px}
  .gprog .track>i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width .5s cubic-bezier(.22,1,.36,1)}

  .wrap{width:100%;max-width:520px;margin:0 auto;padding:22px 18px}

  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-d);font-weight:700;margin-bottom:14px;display:inline-flex;align-items:center;gap:8px}
  .eyebrow::before{content:"";width:20px;height:1.5px;background:var(--gold)}
  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(29px,7.4vw,39px);line-height:1.08;letter-spacing:-.015em;margin-bottom:15px}
  h1 em{font-style:italic;color:var(--accent-d)}
  h2{font-family:var(--f-d);font-weight:600;font-size:26px;line-height:1.16;letter-spacing:-.01em;margin-bottom:8px}
  .sec-sub{font-size:14.5px;color:var(--muted);margin-bottom:22px;line-height:1.55}
  .lede{font-size:16px;color:var(--muted);margin-bottom:24px}

  .btn{font-family:var(--f);font-size:16px;font-weight:700;width:100%;padding:17px 20px;border:none;border-radius:15px;cursor:pointer;
    background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;transition:transform .14s,box-shadow .25s,opacity .2s;
    display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:var(--shadow-btn)}
  .btn:hover{transform:translateY(-1px)} .btn:active{transform:scale(.986)}
  .btn.wide{max-width:360px;margin-left:auto;margin-right:auto}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:var(--bg-1)}
  .btn.wa{background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;box-shadow:0 14px 26px -12px rgba(37,211,102,.5)}
  .btn.gold{background:linear-gradient(145deg,#C6A05E,#9E7A38);box-shadow:0 14px 26px -12px rgba(176,137,76,.5)}
  .btn.dark{background:linear-gradient(145deg,var(--ink),var(--ink-soft));box-shadow:0 14px 26px -12px rgba(18,32,25,.5)}
  .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}
  .stepnav{display:flex;gap:12px;margin-top:22px}

  .concept-row{display:flex;justify-content:center;gap:10px;margin:22px 0 26px;flex-wrap:wrap}
  .concept{display:inline-flex;align-items:center;gap:8px;padding:10px 15px;background:var(--paper);border:1px solid var(--line);border-radius:30px;font-size:12.5px;font-weight:700;color:var(--ink-soft);box-shadow:var(--shadow-soft)}
  .concept svg{color:var(--accent)}

  .privacy-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:13px 15px}
  .privacy-note svg{flex:0 0 auto;color:var(--accent);margin-top:1px}

  /* pregunta */
  .qmeta{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--muted);margin-bottom:16px}
  .qmeta b{color:var(--accent-d);font-weight:700}
  .qtitle{font-family:var(--f-d);font-size:clamp(23px,5.8vw,29px);font-weight:600;line-height:1.18;letter-spacing:-.01em;margin-bottom:8px}
  .qhelp{font-size:13px;color:var(--muted);background:var(--bone);border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:18px;display:flex;gap:9px;line-height:1.5}
  .qhelp svg{flex:0 0 auto;color:var(--accent);margin-top:1px}
  .opts{display:flex;flex-direction:column;gap:11px;margin-bottom:8px}
  .opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;cursor:pointer;background:var(--paper);border:2px solid transparent;border-radius:15px;padding:16px 17px;box-shadow:var(--shadow-soft);transition:.16s;font-family:var(--f)}
  .opt:hover{transform:translateX(3px)}
  .opt.sel{border-color:var(--accent);box-shadow:0 12px 26px -12px rgba(47,122,99,.42)}
  .opt .mk{width:22px;height:22px;flex:0 0 auto;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;transition:.16s}
  .opt.sel .mk{border-color:var(--accent);background:var(--accent)}
  .opt.sel .mk::after{content:"";width:8px;height:8px;border-radius:50%;background:#fff}
  .opt .otxt{font-size:15px;font-weight:600;color:var(--ink)}
  .nav-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px}
  .nav-back{background:none;border:none;font-family:var(--f);font-size:14.5px;font-weight:600;color:var(--muted);cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:8px 2px}
  .nav-back:hover{color:var(--ink)}

  /* análisis */
  .analyze{text-align:center;padding:40px 10px}
  .net{width:120px;height:90px;margin:0 auto 28px;position:relative}
  .net svg{width:100%;height:100%}
  .net .drop{position:absolute;left:50%;top:-6px;width:12px;height:12px;border-radius:50%;background:var(--accent);transform:translateX(-50%);animation:drop 1.4s ease-in-out infinite}
  @keyframes drop{0%{top:-6px;opacity:0}30%{opacity:1}70%{top:40px;opacity:1}100%{top:52px;opacity:0}}
  .analyze h2{margin-bottom:24px}
  .achecks{display:flex;flex-direction:column;gap:11px;max-width:270px;margin:0 auto;text-align:left}
  .ac{display:flex;align-items:center;gap:12px;font-size:14.5px;color:var(--muted-2);font-weight:500;opacity:.4;transform:translateY(5px);transition:.4s}
  .ac.on{opacity:1;transform:none;color:var(--ink);font-weight:600}
  .ac .cb{width:24px;height:24px;flex:0 0 auto;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;transition:.3s}
  .ac.on .cb{background:var(--accent);border-color:var(--accent)}
  .ac .cb svg{opacity:0} .ac.on .cb svg{opacity:1}

  /* teaser / gate */
  .teaser{position:relative;border-radius:20px;overflow:hidden;margin-bottom:22px;box-shadow:var(--shadow-soft)}
  .teaser .blur{filter:blur(7px);opacity:.9;pointer-events:none;user-select:none;padding:26px;background:linear-gradient(160deg,var(--ink),var(--ink-soft));text-align:center;color:#fff}
  .teaser .blur .tl{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-weight:700}
  .teaser .blur .tn{font-family:var(--f-d);font-size:58px;font-weight:700;line-height:1;margin:6px 0}
  .teaser .lock{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(251,250,245,.12),rgba(251,250,245,.72))}
  .teaser .lock span{background:var(--paper);border:1px solid var(--line);padding:10px 16px;border-radius:22px;font-size:13px;font-weight:700;box-shadow:var(--shadow-soft)}
  .gate-note{font-size:13.5px;color:var(--ink-soft);text-align:center;margin-bottom:20px;font-weight:600}
  .field{margin-bottom:15px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:7px}
  .field label .opt{font-weight:400;color:var(--muted-2);font-size:12px}
  .field input{width:100%;font-family:var(--f);font-size:16px;padding:14px 15px;border:1.5px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(47,122,99,.12)}
  .consent{display:flex;gap:11px;align-items:flex-start;margin:6px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.5}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
  .consent a{color:var(--ink);text-decoration:underline}

  /* score */
  .score-hero{text-align:center;padding:6px 4px 0}
  .ring-wrap{position:relative;width:214px;height:214px;margin:8px auto 4px}
  .ring-wrap svg{transform:rotate(-90deg);overflow:visible}
  .ring-wrap .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ring-wrap .c b{font-family:var(--f-d);font-size:64px;font-weight:700;line-height:1;letter-spacing:-.02em;color:var(--ink)}
  .ring-wrap .c i{font-style:normal;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-2);margin-top:2px}
  .band-pill{display:inline-block;font-size:14px;font-weight:700;padding:8px 20px;border-radius:24px;margin:14px 0 8px;letter-spacing:.02em}
  .score-desc{font-size:15px;color:var(--ink-soft);max-width:430px;margin:6px auto 0;line-height:1.55}

  /* semáforo lineal */
  .meter{margin:24px 0 6px}
  .meter .mtrack{position:relative;height:12px;border-radius:8px;overflow:hidden;background:linear-gradient(90deg,var(--lvl-1),var(--lvl-2) 33%,var(--lvl-3) 66%,var(--lvl-4))}
  .meter .mmark{position:absolute;top:50%;width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--ink);transform:translate(-50%,-50%);box-shadow:0 4px 10px -3px rgba(0,0,0,.35);transition:left 1.1s cubic-bezier(.22,1,.36,1);left:0}
  .meter .mends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:9px;font-weight:600}
  .meter .mticks{display:flex;justify-content:space-between;margin-top:12px;gap:6px}
  .meter .mtick{flex:1;text-align:center;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);padding:6px 2px;border-radius:8px;border:1px solid transparent}
  .meter .mtick.on{color:#fff}
  .meter .mtick.on.t1{background:var(--lvl-1)} .meter .mtick.on.t2{background:var(--lvl-2);color:#3a2c12}
  .meter .mtick.on.t3{background:var(--lvl-3)} .meter .mtick.on.t4{background:var(--lvl-4)}

  .section-title{font-family:var(--f-d);font-size:21px;font-weight:600;margin:30px 0 4px}
  .section-sub{font-size:13px;color:var(--muted);margin-bottom:18px}

  /* dimensiones */
  .dbar{margin-bottom:15px}
  .dbar .dt{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
  .dbar .dt b{font-size:14px;font-weight:700}
  .dbar .dt .v{font-family:var(--f-d);font-size:14.5px;font-weight:700;color:var(--muted)}
  .dbar .track{height:10px;background:var(--bg-1);border-radius:7px;overflow:hidden;border:1px solid var(--line)}
  .dbar .fill{height:100%;width:0;border-radius:7px;transition:width 1s cubic-bezier(.22,1,.36,1)}
  .fill.s-hi{background:linear-gradient(90deg,var(--accent-2),var(--accent))}
  .fill.s-mid{background:linear-gradient(90deg,var(--sky),#33607A)}
  .fill.s-lo{background:linear-gradient(90deg,#C79A6A,var(--gold))}

  /* pista de aterrizaje */
  .runway{background:linear-gradient(150deg,var(--ink),var(--ink-soft));color:#fff;border-radius:20px;padding:24px;margin:24px 0;box-shadow:0 20px 44px -22px rgba(18,32,25,.7)}
  .runway .rl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-weight:700;margin-bottom:4px}
  .runway h3{font-family:var(--f-d);font-size:22px;font-weight:600;margin-bottom:12px}
  .runway .rtrack{position:relative;height:16px;background:rgba(255,255,255,.14);border-radius:9px;overflow:hidden;margin:16px 0 8px}
  .runway .rfill{height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width 1.1s cubic-bezier(.22,1,.36,1)}
  .runway .rends{display:flex;justify-content:space-between;font-size:11.5px;opacity:.75;font-weight:600}
  .runway .rcap{font-size:13.5px;opacity:.92;line-height:1.55;margin-top:14px}
  .runway .rcap b{color:#fff}

  /* escenarios */
  .scen{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:17px 18px;margin-bottom:12px;box-shadow:var(--shadow-soft)}
  .scen .sh{display:flex;align-items:center;gap:12px;margin-bottom:9px}
  .scen .sic{width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:rgba(47,122,99,.1);color:var(--accent);display:grid;place-items:center}
  .scen .st{font-size:15px;font-weight:800;letter-spacing:.01em}
  .scen .sq{font-size:12.5px;color:var(--muted)}
  .scen .verdict{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;padding:8px 13px;border-radius:11px;margin-top:2px}
  .verdict.ok{background:rgba(47,122,99,.12);color:var(--accent-d)}
  .verdict.mid{background:rgba(62,110,134,.12);color:var(--sky)}
  .verdict.low{background:rgba(176,118,60,.12);color:var(--warn)}
  .scen p.sr{font-size:13px;color:var(--ink-soft);line-height:1.55;margin-top:9px}

  /* fortalezas */
  .strength{display:flex;gap:11px;align-items:flex-start;background:rgba(47,122,99,.06);border:1px solid rgba(47,122,99,.2);border-radius:13px;padding:13px 15px;margin-bottom:10px}
  .strength .si{width:26px;height:26px;flex:0 0 auto;border-radius:8px;background:rgba(47,122,99,.16);color:var(--accent-d);display:grid;place-items:center}
  .strength p{font-size:13.5px;color:var(--ink-soft);line-height:1.5;font-weight:600}

  /* vulnerabilidades / prioridades */
  .vuln{display:flex;gap:15px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:var(--shadow-soft)}
  .vuln .vn{font-family:var(--f-d);font-size:26px;font-weight:700;color:var(--gold);line-height:1;flex:0 0 auto;width:34px}
  .vuln .vc b{font-size:14px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;display:block;margin-bottom:4px}
  .vuln .vc p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}

  .action{display:flex;gap:14px;background:var(--bone);border:1px solid var(--line);border-radius:15px;padding:16px 17px;margin-bottom:11px;animation:rise .5s both}
  .action .an{width:32px;height:32px;flex:0 0 auto;border-radius:9px;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-weight:700;font-size:15px}
  .action .ac2 b{font-size:14.5px;font-weight:800;display:block;margin-bottom:3px}
  .action .ac2 p{font-size:13px;color:var(--ink-soft);line-height:1.55}

  .insight{display:flex;gap:12px;align-items:flex-start;background:rgba(62,110,134,.07);border:1px solid rgba(62,110,134,.2);border-radius:13px;padding:14px 16px;margin:16px 0}
  .insight .ii{width:30px;height:30px;flex:0 0 auto;border-radius:9px;background:rgba(62,110,134,.14);color:var(--sky);display:grid;place-items:center}
  .insight p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}
  .insight p b{color:var(--ink)}

  /* reco / cta / share */
  .reco{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:20px;margin:22px 0;box-shadow:var(--shadow-soft);text-align:center}
  .reco .rl{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px}
  .reco h3{font-family:var(--f-d);font-size:19px;font-weight:600;margin-bottom:6px}
  .reco p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .review-card{background:linear-gradient(150deg,var(--bone),var(--bg-2));border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:22px 0 14px;display:flex;gap:13px;align-items:center}
  .review-card .rc{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;flex:0 0 auto;font-family:var(--f-d);font-weight:600;overflow:hidden}
  .review-card .rc img{width:100%;height:100%;object-fit:cover}
  .review-card b{display:block;font-size:14.5px}
  .review-card small{font-size:12.5px;color:var(--muted)}
  .cta-head{text-align:center;margin:26px 0 4px}
  .cta-head h3{font-family:var(--f-d);font-size:22px;font-weight:600;line-height:1.2;margin-bottom:8px}
  .cta-head p{font-size:14px;color:var(--muted);line-height:1.55;max-width:420px;margin:0 auto}

  .sharecard{background:linear-gradient(160deg,var(--ink),var(--ink-soft));color:#fff;border-radius:18px;padding:22px;text-align:center;margin:20px 0}
  .sharecard .sl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-weight:700}
  .sharecard .sv{font-family:var(--f-d);font-size:46px;font-weight:700;line-height:1;margin:4px 0}
  .sharecard .sb{font-size:14px;opacity:.9;margin-bottom:3px}
  .sharecard .sm{font-size:12px;opacity:.6}
  .share-band{text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px 20px;margin:20px 0}
  .share-band h3{font-family:var(--f-d);font-size:18px;font-weight:600;margin-bottom:6px}
  .share-band p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .restart{background:none;border:none;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;margin:8px auto 0;display:block;font-family:var(--f)}
  .restart:hover{color:var(--ink)}
  .disclaimer{font-size:11px;color:var(--muted-2);line-height:1.55;padding:20px 4px 4px;text-align:center;max-width:460px;margin:0 auto}
  .foot{text-align:center;font-size:11.5px;color:var(--muted-2);margin-top:22px}
  .foot b{color:var(--muted);font-weight:700}

  .toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;font-size:13px;font-weight:600;padding:11px 20px;border-radius:30px;box-shadow:0 12px 30px -8px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:.3s;z-index:60}
  .toast.on{opacity:1;transform:translateX(-50%) translateY(0)}

  .fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:50;display:flex;align-items:center;background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;border-radius:30px;box-shadow:0 12px 30px -8px rgba(37,211,102,.55);text-decoration:none;overflow:hidden;transition:.28s}
  .fab .ic{width:54px;height:54px;display:grid;place-items:center;flex:0 0 auto}
  .fab .lbl{max-width:0;opacity:0;white-space:nowrap;font-size:13.5px;font-weight:700;transition:.28s;overflow:hidden}
  .fab:hover .lbl{max-width:230px;opacity:1;padding-right:20px}
  @media (hover:none){ .fab .lbl{display:none} }

  .step{display:none}
  .step.on{display:block;animation:rise .42s cubic-bezier(.22,1,.36,1)}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }

`;

export const TEST_EMERGENCIA_BODY_HTML = `
<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">DT</div>
      <div class="who"><b id="agentName">Diego Tinoco</b><span id="agentTitle">Asesor financiero</span></div>
    </div>
    <div class="kit-name">Red de Seguridad</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none"><div class="track"><i id="gpbar"></i></div></div>

<div class="wrap">

  <!-- INTRO -->
  <div class="step on" data-step="intro">
    <div class="eyebrow">Test de preparación · 2 min</div>
    <h1>Si mañana ocurre un imprevisto, ¿cuánto tiempo podrían resistir <em>tus finanzas</em>?</h1>
    <p class="lede">Responde 10 preguntas y descubre qué tan preparado estás para enfrentar una pérdida de ingresos, un gasto inesperado o una emergencia familiar.</p>
    <div class="concept-row">
      <div class="concept"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l2 5 4-10 2 5h6"/></svg> Liquidez</div>
      <div class="concept"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Protección</div>
      <div class="concept"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg> Capacidad de respuesta</div>
    </div>
    <button class="btn wide" id="btnStart">Evaluar mi preparación →</button>
    <div class="privacy-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Gratis y privado. No necesitas conectar tus cuentas bancarias.</span></div>
  </div>

  <!-- PREGUNTA (dinámica) -->
  <div class="step" data-step="question">
    <div class="qmeta"><span id="qCount">Pregunta 1 de 10</span><b id="qPct">10%</b></div>
    <div class="qtitle" id="qTitle">…</div>
    <div class="qhelp" id="qHelp" style="display:none"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span id="qHelpTxt"></span></div>
    <div class="opts" id="qOpts"></div>
    <div class="nav-row"><button class="nav-back" id="qBack">← Atrás</button><span></span></div>
  </div>

  <!-- ANÁLISIS -->
  <div class="step analyze" data-step="analyze">
    <div class="net">
      <svg viewBox="0 0 120 90" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.55"><path d="M10 30h100M10 50h100M10 70h100M30 20v55M60 20v55M90 20v55"/></svg>
      <div class="drop"></div>
    </div>
    <h2>Analizando tu capacidad de respuesta…</h2>
    <div class="achecks" id="achecks"></div>
  </div>

  <!-- GATE -->
  <div class="step" data-step="gate">
    <div style="text-align:center">
      <div class="eyebrow" style="justify-content:center">Tu resultado está listo</div>
      <h2 style="margin-bottom:9px">Tu nivel de preparación está listo</h2>
    </div>
    <div class="teaser">
      <div class="blur"><div class="tl">Emergency Readiness Score</div><div class="tn" id="teaserNum">6X</div><div style="font-size:13px;opacity:.7">sobre 100</div></div>
      <div class="lock"><span>🔒 Desbloquea tu diagnóstico completo</span></div>
    </div>
    <p class="gate-note" id="gateNote">Detectamos algunos puntos importantes en tu estructura financiera.</p>
    <div class="field"><label>Nombre</label><input type="text" id="leadName" placeholder="Tu nombre"></div>
    <div class="field"><label>WhatsApp <span class="opt">(10 dígitos)</span></label><input type="tel" id="leadWa" inputmode="tel" placeholder="Ej. 5512345678"></div>
    <div class="field"><label>Correo <span class="opt">(opcional)</span></label><input type="email" id="leadEmail" placeholder="tucorreo@ejemplo.com"></div>
    <label class="consent"><input type="checkbox" id="leadConsent"><span>Acepto que <b id="cName">Diego Tinoco</b> utilice mis datos para contactarme respecto de este diagnóstico, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label>
    <button class="btn" id="revealBtn">Ver mi diagnóstico completo →</button>
    <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:14px">También puedes <button class="restart" style="display:inline;color:var(--accent-d)" id="skipLeadBtn">continuar sin dejar datos</button></p>
  </div>

  <!-- RESULTADO -->
  <div class="step" data-step="result">
    <div class="score-hero">
      <div class="eyebrow" style="justify-content:center">Emergency Readiness Score</div>
      <div class="ring-wrap">
        <svg width="214" height="214" viewBox="0 0 214 214">
          <circle cx="107" cy="107" r="90" fill="none" stroke="var(--line)" stroke-width="14"/>
          <circle id="ringArc" cx="107" cy="107" r="90" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="565.5"/>
        </svg>
        <div class="c"><b id="scoreNum">0</b><i>de 100</i></div>
      </div>
      <div><span class="band-pill" id="bandPill">—</span></div>
      <p class="score-desc" id="scoreDesc"></p>
    </div>

    <div class="meter">
      <div class="mtrack"><div class="mmark" id="meterMark"></div></div>
      <div class="mends"><span>Vulnerable</span><span>Preparado</span></div>
      <div class="mticks">
        <div class="mtick t1" id="tk1">Crítico</div>
        <div class="mtick t2" id="tk2">En construcción</div>
        <div class="mtick t3" id="tk3">Preparado</div>
        <div class="mtick t4" id="tk4">Muy preparado</div>
      </div>
    </div>

    <div class="section-title">Tus 4 dimensiones</div>
    <div class="section-sub">Cómo se reparte tu capacidad de respuesta.</div>
    <div id="dims"></div>

    <div class="runway">
      <div class="rl">Momento clave</div>
      <h3>Tu pista de aterrizaje financiera</h3>
      <div class="rtrack"><div class="rfill" id="runwayFill"></div></div>
      <div class="rends"><span>0 meses</span><span>12+ meses</span></div>
      <div class="rcap" id="runwayCap"></div>
    </div>

    <div class="section-title">¿Qué emergencia resistirían hoy tus finanzas?</div>
    <div class="section-sub">Según tus respuestas, cómo se verían tres situaciones.</div>
    <div id="scenarios"></div>

    <div id="insightBox"></div>

    <div class="section-title">Tus fortalezas</div>
    <div class="section-sub">Lo que ya juega a tu favor.</div>
    <div id="strengths"></div>

    <div class="section-title">Tres puntos que conviene fortalecer</div>
    <div class="section-sub">Tus áreas de mayor impacto ahora.</div>
    <div id="vulns"></div>

    <div class="section-title">Tus 3 próximas acciones</div>
    <div class="section-sub">Pasos concretos para ganar preparación.</div>
    <div id="actions"></div>

    <div class="reco" id="recoBox" style="display:none">
      <div class="rl" id="recoLabel">Recurso complementario</div>
      <h3 id="recoTitle"></h3>
      <p id="recoText"></p>
      <a class="btn gold wide" id="recoBtn" href="#" target="_blank" rel="noopener"></a>
    </div>

    <div class="cta-head">
      <h3>¿Quieres revisar tus puntos de mayor impacto?</h3>
      <p>Tu asesor puede ayudarte a revisar las áreas que aparecieron en tu diagnóstico y definir qué conviene priorizar.</p>
    </div>
    <div class="review-card">
      <div class="rc" id="revAva">DT</div>
      <div><b>Revisa tu preparación con <span id="ctaAgent">Diego</span></b><small id="ctaAgentRole">Asesor financiero · sin costo</small></div>
    </div>
    <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener">Revisar mi preparación por WhatsApp</a>
    <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none">Agendar una revisión →</a>

    <div class="sharecard">
      <div class="sl">Mi Emergency Readiness Score</div>
      <div class="sv" id="shareScore">68</div>
      <div class="sb" id="shareBand">Buena capacidad</div>
      <div class="sm">Red de seguridad financiera · Growth Link</div>
    </div>
    <div class="share-band">
      <h3>¿Hay alguien a quien le serviría hacer este test?</h3>
      <p>Compartirlo puede ayudar a otra persona a detectar brechas que normalmente pasan desapercibidas.</p>
      <button class="btn gold wide" id="shareTestBtn">Compartir test</button>
    </div>

    <button class="restart" id="restartBtn">↺ Volver a empezar</button>
    <div class="disclaimer">Este test es una herramienta educativa basada únicamente en tus respuestas. El resultado no constituye una evaluación crediticia, recomendación financiera personalizada ni garantía sobre tu capacidad para enfrentar una emergencia. Cada situación requiere un análisis individual.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Diego Tinoco</b> · Growth Link</div>
</div>

<div class="toast" id="toast">Copiado</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesor</span>
</a>
`;

export const TEST_EMERGENCIA_LOGIC_JS = `

/* ==================================================================
   ▓▓  CONFIG DEL AGENTE  ▓▓  ← Editá solo esto para replicar.
   ================================================================== */
const TEST_DATA = window.__TEST_EMERGENCIA_DATA__ || {};
const TEST_BRAND = TEST_DATA.brand || {};
const TEST_SLUG = TEST_DATA.slug || "";
fetch('/api/public/mini-apps/'+TEST_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  agente:      TEST_BRAND.advisorName || "Tu asesor",
  titulo:      TEST_BRAND.title || "Asesor financiero",
  whatsapp:    TEST_BRAND.whatsapp || "",
  email:       TEST_BRAND.email || "",
  fotoURL:     TEST_BRAND.photoURL || "",
  logoURL:     TEST_BRAND.logoURL || "",
  agenteID:    TEST_SLUG,
  colorMarca:  TEST_BRAND.colorMarca || "",
  calendlyURL: TEST_BRAND.calendlyURL || "",
  avisoPrivacidadURL: TEST_BRAND.privacyURL || "",
  webhookURL:  TEST_BRAND.webhookURL || "",
  urlKitEmergencia:  TEST_BRAND.kitEmergenciaURL || "",
  urlFondoEmergencia:TEST_BRAND.fondoEmergenciaURL || "",
  nombreSeguroSalud: TEST_BRAND.seguroSaludNombre || "Seguro de Gastos Médicos Mayores"
};
const SEND_DETAILED_RESPONSES = false;

/* ==================================================================
   PONDERACIONES (suman 1). Dependientes NO resta: actúa como
   multiplicador contextual (ver applyContext()).
   ================================================================== */
const WEIGHTS = {
  q1_meses:0.18, q2_fondo:0.10, q3_gasto:0.12, q4_dependencia:0.08,
  q5_dependientes:0.04, q6_deuda:0.10, q7_medico:0.10, q8_proteccion:0.12,
  q9_liquidez:0.10, q10_plan:0.06
};

/* ==================================================================
   PREGUNTAS · 10. v = aporte 0..100. P5 y P8 son especiales.
   ================================================================== */
function QUESTIONS(){ return [
  { id:"q1_meses", q:"Si mañana dejaras de recibir ingresos, ¿cuánto tiempo podrías cubrir tus gastos habituales?",
    opts:[{t:"Menos de 1 mes",v:12,m:0.5},{t:"1–2 meses",v:35,m:1.5},{t:"3–5 meses",v:65,m:4},{t:"6–12 meses",v:88,m:9},{t:"Más de 12 meses",v:100,m:12},{t:"No estoy seguro",v:30,m:1}]},
  { id:"q2_fondo", q:"¿Tienes dinero reservado específicamente para emergencias?",
    opts:[{t:"No",v:12},{t:"Uso mis ahorros generales si ocurre algo",v:40},{t:"Estoy construyendo un fondo",v:60},{t:"Sí, tengo un fondo separado",v:88},{t:"Sí, y conozco exactamente cuánto cubre",v:100}]},
  { id:"q3_gasto", q:"Si mañana apareciera un gasto equivalente a un mes de tus ingresos, ¿cómo lo pagarías?",
    opts:[{t:"Tendría que pedir dinero prestado",v:15},{t:"Utilizaría tarjeta de crédito",v:38},{t:"Combinaría crédito y ahorros",v:58},{t:"Utilizaría mis ahorros",v:82},{t:"Usaría mi fondo de emergencia sin endeudarme",v:100}]},
  { id:"q4_dependencia", q:"¿Qué tan dependiente es tu hogar de tu ingreso mensual?",
    opts:[{t:"Mi ingreso es prácticamente el único",v:35},{t:"Aporto la mayor parte",v:55},{t:"Compartimos ingresos de forma similar",v:78},{t:"Existen otras fuentes suficientes",v:100},{t:"No tengo dependientes económicos",v:90,noDeps:true}]},
  { id:"q5_dependientes", q:"¿Cuántas personas dependen económicamente de ti?",
    opts:[{t:"Ninguna",v:100,deps:0},{t:"1 persona",v:80,deps:1},{t:"2 personas",v:70,deps:2},{t:"3 personas",v:62,deps:3},{t:"4 o más",v:55,deps:4}]},
  { id:"q6_deuda", q:"Si tus ingresos disminuyeran durante algunos meses, ¿qué tan difícil sería seguir pagando tus deudas?",
    opts:[{t:"No tengo deudas",v:92,noDebt:true},{t:"Podría seguir pagando sin problemas",v:100},{t:"Tendría que ajustar algunos gastos",v:72},{t:"Probablemente tendría dificultades",v:40},{t:"No podría mantener los pagos",v:15},{t:"No estoy seguro",v:35}]},
  { id:"q7_medico", q:"Si mañana surgiera una emergencia médica importante, ¿cómo enfrentarías el gasto?",
    opts:[{t:"No tengo una estrategia clara",v:15},{t:"Dependería de mis ahorros",v:45},{t:"Tengo cobertura pública únicamente",v:58},{t:"Tengo __SALUD__",v:85},{t:"Tengo cobertura y conozco bien sus alcances",v:100}]},
  { id:"q8_proteccion", q:"__DYNAMIC__",
    optsDeps:[{t:"No",v:15},{t:"Probablemente por pocos meses",v:40},{t:"Tengo algunos ahorros",v:60},{t:"Tengo protección, pero no sé si sería suficiente",v:78},{t:"Sí, tengo una estrategia de protección definida",v:100}],
    optsNoDeps:[{t:"No tengo una estrategia",v:15},{t:"Dependería de familiares",v:40},{t:"Utilizaría mis ahorros",v:62},{t:"Tengo suficiente reserva",v:82},{t:"Tengo una estrategia específica de protección",v:100}]},
  { id:"q9_liquidez", q:"¿Qué porcentaje de tus recursos podrías utilizar rápidamente si ocurre una emergencia?",
    help:"Por liquidez entendemos dinero al que puedes acceder sin vender apresuradamente una propiedad, vehículo u otro activo.",
    opts:[{t:"No tengo recursos disponibles",v:12},{t:"Muy poco",v:35},{t:"Una parte",v:60},{t:"La mayoría",v:85},{t:"Tengo suficiente liquidez reservada",v:100},{t:"No estoy seguro",v:30}]},
  { id:"q10_plan", q:"Si mañana ocurriera una emergencia financiera importante, ¿sabrías exactamente qué hacer primero?",
    opts:[{t:"No",v:15},{t:"Probablemente improvisaría",v:38},{t:"Tengo una idea general",v:60},{t:"Tengo algunos pasos definidos",v:82},{t:"Sí, tengo un plan y mi familia lo conoce",v:100}]}
]; }

const BANDS = [
  { min:80, name:"Alta preparación", lvl:4, desc:"Tu estructura actual tiene una buena capacidad para absorber imprevistos. El foco ahora es mantenerla y afinar detalles." },
  { min:60, name:"Buena capacidad de respuesta", lvl:3, desc:"Tienes varias defensas financieras construidas, aunque todavía existen puntos que conviene revisar." },
  { min:40, name:"Preparación inicial", lvl:2, desc:"Ya tienes algunas bases, pero existen brechas importantes que pueden fortalecerse." },
  { min:0,  name:"Vulnerabilidad alta", lvl:1, desc:"Un imprevisto importante podría generar una presión significativa sobre tus finanzas. La buena noticia: con pasos claros esto cambia." }
];

const DIM_TEXT = {
  reserva:{ weak:"Tu reserva cubriría poco tiempo; construir tu primer mes de gastos esenciales es la base que da margen ante cualquier imprevisto." },
  liquidez:{ weak:"Tu acceso rápido a recursos es limitado; tener liquidez disponible evita decisiones apresuradas en una emergencia." },
  resiliencia:{ weak:"Tu ingreso o tus obligaciones dejan poco margen si algo cambia; ordenar esto te da más capacidad de resistir." },
  proteccion:{ weak:"Todavía no hay una estrategia clara de continuidad si no pudieras generar ingresos; vale la pena revisarlo con calma." }
};

/* ========================= Motor ========================= */
function $(id){ return document.getElementById(id); }
function num(v){ v=parseFloat(v); return isFinite(v)?v:0; }
function track(ev,data){ try{ console.log("[track]",ev,data||""); }catch(e){} }

var Q = QUESTIONS();
var state = { ans:{}, idx:0, lead:null, scores:{}, overall:0, dims:{}, deps:0, meses:1 };

(function init(){
  if(CONFIG.colorMarca){ document.documentElement.style.setProperty('--accent',CONFIG.colorMarca); }
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente; $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente; $("footAgent").textContent=CONFIG.agente;
  $("ctaAgent").textContent=CONFIG.agente.split(" ")[0]; $("ctaAgentRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.avisoPrivacidadURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){ var src=CONFIG.fotoURL||CONFIG.logoURL; $("agentAva").innerHTML='<img src="'+src+'" alt="">'; $("revAva").innerHTML='<img src="'+src+'" alt="">'; }
  else { $("agentAva").textContent=initials; $("revAva").textContent=initials; }
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre el Test de Preparación para Emergencias.");
  if(CONFIG.calendlyURL) $("calendlyBtn").href=CONFIG.calendlyURL;
  // insertar nombre de seguro localizado en P7
  Q[6].opts[3].t = Q[6].opts[3].t.replace("__SALUD__", CONFIG.nombreSeguroSalud);
  // achecks
  var labels=["Liquidez","Fondo de emergencia","Deuda","Protección","Dependientes","Plan de respuesta"];
  var ac=$("achecks");
  labels.forEach(function(l){ var d=document.createElement("div"); d.className="ac";
    d.innerHTML='<span class="cb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span> '+l; ac.appendChild(d); });
  var ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref;
  track('emergency_test_started');
})();

function show(step){
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function startTest(){ state.idx=0; renderQuestion(); show('question'); $("gprogWrap").style.display="block"; }

/* P8 depende de si tiene dependientes (P4/P5) */
function hasDeps(){
  var q4=state.ans.q4_dependencia, q5=state.ans.q5_dependientes;
  if(q4 && q4.noDeps) return false;
  if(q5 && q5.deps===0) return false;
  return true;
}
function q8Question(){
  return hasDeps()
    ? "Si tú faltaras, ¿tu familia tendría recursos para continuar cubriendo sus gastos?"
    : "Si una enfermedad o accidente te impidiera trabajar durante varios meses, ¿cómo cubrirías tus gastos?";
}
function q8Opts(){ return hasDeps()? Q[7].optsDeps : Q[7].optsNoDeps; }

function renderQuestion(){
  var q=Q[state.idx];
  $("qCount").textContent="Pregunta "+(state.idx+1)+" de 10";
  $("qPct").textContent=Math.round((state.idx+1)/10*100)+"%";
  $("gpbar").style.width=Math.round((state.idx)/10*100)+"%";
  $("qBack").style.visibility=state.idx===0?"hidden":"visible";

  var title = q.q, opts = q.opts;
  if(q.id==="q8_proteccion"){ title=q8Question(); opts=q8Opts(); }
  $("qTitle").textContent=title;
  if(q.help){ $("qHelp").style.display="flex"; $("qHelpTxt").textContent=q.help; } else $("qHelp").style.display="none";

  var w=$("qOpts"); w.innerHTML=""; var cur=state.ans[q.id];
  opts.forEach(function(o,i){
    var b=document.createElement("button"); b.className="opt"; if(cur&&cur.i===i)b.classList.add("sel");
    b.innerHTML='<span class="mk"></span><span class="otxt">'+o.t+'</span>';
    b.onclick=function(){ selectOpt(q,i,o); };
    w.appendChild(b);
  });
}
function selectOpt(q,i,o){
  state.ans[q.id]={i:i,v:o.v,t:o.t,m:o.m,deps:o.deps,noDeps:!!o.noDeps,noDebt:!!o.noDebt};
  document.querySelectorAll('#qOpts .opt').forEach(function(x){ x.classList.remove('sel'); });
  document.querySelectorAll('#qOpts .opt')[i].classList.add('sel');
  track('question_answered',{q:q.id});
  setTimeout(nextQuestion, 240);
}
function nextQuestion(){
  if(!state.ans[Q[state.idx].id]) return;
  if(state.idx+1<10){ state.idx++; renderQuestion(); }
  else finishTest();
}
function prevQuestion(){ if(state.idx>0){ state.idx--; renderQuestion(); } }

/* ===================== SCORING ===================== */
function applyContext(weights){
  // Dependientes como multiplicador contextual: más dependientes →
  // sube el peso relativo de reserva (q1), fondo (q2) y protección (q8).
  var deps = (state.ans.q5_dependientes && state.ans.q5_dependientes.deps) || 0;
  if(state.ans.q4_dependencia && state.ans.q4_dependencia.noDeps) deps=0;
  state.deps=deps;
  var w=Object.assign({},weights);
  if(deps===0){
    // sin dependientes: la "protección familiar" pesa menos; se mueve a reserva/médico/liquidez
    var move=w.q8_proteccion*0.5; w.q8_proteccion-=move;
    w.q1_meses+=move*0.4; w.q7_medico+=move*0.3; w.q9_liquidez+=move*0.3;
  } else {
    // con dependientes: reforzar reserva, fondo y protección proporcional a #deps
    var f=Math.min(0.6, deps*0.12);
    var boost=(w.q1_meses+w.q2_fondo+w.q8_proteccion)*f;
    // tomar ese boost de las de menor peso contextual (plan, dependencia, gasto)
    var pool=w.q10_plan+w.q4_dependencia+w.q3_gasto;
    var take=Math.min(boost, pool*0.5);
    w.q10_plan-=take*(w.q10_plan/pool); w.q4_dependencia-=take*(w.q4_dependencia/pool); w.q3_gasto-=take*(w.q3_gasto/pool);
    w.q1_meses+=take*0.4; w.q2_fondo+=take*0.3; w.q8_proteccion+=take*0.3;
  }
  // re-normalizar a 1
  var sum=0; Object.keys(w).forEach(function(k){ sum+=w[k]; });
  Object.keys(w).forEach(function(k){ w[k]=w[k]/sum; });
  return w;
}
function computeScores(){
  var w=applyContext(WEIGHTS);
  var overall=0;
  Object.keys(w).forEach(function(k){ var a=state.ans[k]; if(a) overall+=a.v*w[k]; });
  state.overall=Math.round(overall);
  state.weightsUsed=w;
  state.meses = (state.ans.q1_meses && state.ans.q1_meses.m!==undefined)? state.ans.q1_meses.m : 1;

  // 4 dimensiones (promedio simple de sus componentes)
  var A=state.ans;
  state.dims={
    reserva: avg([A.q1_meses, A.q2_fondo]),
    liquidez: avg([A.q3_gasto, A.q9_liquidez]),
    resiliencia: avg([A.q6_deuda, A.q4_dependencia]),
    proteccion: avg([A.q7_medico, A.q8_proteccion, A.q10_plan])
  };
}
function avg(arr){ var vals=arr.filter(function(a){return a&&a.v!==undefined}).map(function(a){return a.v}); return vals.length? Math.round(vals.reduce(function(x,y){return x+y},0)/vals.length):0; }

/* ===================== ANÁLISIS + GATE ===================== */
function finishTest(){
  computeScores();
  track('test_completed',{score:state.overall});
  show('analyze'); $("gprogWrap").style.display="none";
  var acs=document.querySelectorAll('.ac');
  acs.forEach(function(c,i){ setTimeout(function(){ c.classList.add('on'); }, 140+i*150); });
  setTimeout(function(){ $("teaserNum").textContent=Math.floor(state.overall/10)+"X"; show('gate'); }, 140+acs.length*150+450);
}

/* ===================== LEAD / CRM ===================== */
function mesesCategoria(){
  var m=state.meses;
  if(m<1)return "menos de 1 mes"; if(m<3)return "1–2 meses"; if(m<6)return "3–5 meses"; if(m<12)return "6–12 meses"; return "más de 12 meses";
}
function orderedDims(){ return Object.keys(state.dims).sort(function(a,b){ return state.dims[a]-state.dims[b]; }); }
function buildLead(){
  var pr=orderedDims();
  var lead={
    agenteID:CONFIG.agenteID, resource:"test-emergencia-financiera-v1",
    nombre:(state.lead&&state.lead.nombre)||"", whatsapp:(state.lead&&state.lead.whatsapp)||"", email:(state.lead&&state.lead.email)||"",
    consentimiento:!!(state.lead&&state.lead.consent), timestamp:new Date().toISOString(), referidoPor:window._referidoPor||null,
    emergencyScore:state.overall,
    scoreReserva:state.dims.reserva, scoreLiquidez:state.dims.liquidez, scoreResiliencia:state.dims.resiliencia, scoreProteccion:state.dims.proteccion,
    mesesRespaldoCategoria:mesesCategoria(), numeroDependientes:state.deps,
    prioridad1:pr[0]||null, prioridad2:pr[1]||null, prioridad3:pr[2]||null
  };
  if(SEND_DETAILED_RESPONSES){ lead.respuestas=state.ans; }
  return lead;
}
function sendLeadToCRM(lead){
  var hostedPayload = Object.assign({}, lead, { fecha: lead.timestamp, consentimiento: true, consentimiento_fecha: lead.timestamp });
  fetch('/api/public/mini-apps/'+TEST_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
  if(!CONFIG.webhookURL) return;
  try{ fetch(CONFIG.webhookURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead),keepalive:true}); }catch(e){}
}
function revealResult(skip){
  if(!skip){
    var nombre=$("leadName").value.trim(), wa=$("leadWa").value.replace(/\\D/g,''), email=$("leadEmail").value.trim();
    if(nombre.length<2||wa.length<10||!$("leadConsent").checked){
      if(nombre.length<2)$("leadName").style.borderColor="var(--danger)";
      if(wa.length<10)$("leadWa").style.borderColor="var(--danger)";
      if(!$("leadConsent").checked){ var b=$("revealBtn"),t=b.textContent; b.textContent="Completa tus datos y acepta para continuar"; setTimeout(function(){b.textContent=t},1900); }
      return;
    }
    state.lead={nombre:nombre,whatsapp:wa,email:email,consent:true};
    var lead=buildLead(); window._lead=lead; sendLeadToCRM(lead); track('lead_captured',{score:state.overall});
  }
  paintResult(); show('result'); requestAnimationFrame(animateResult);
  track('score_viewed'); track('scenario_viewed');
}

/* ===================== RESULTADO ===================== */
function bandFor(s){ return BANDS.filter(function(b){return s>=b.min})[0]; }
function level(s){ return s>=70?"s-hi":(s>=45?"s-mid":"s-lo"); }
var _ringTarget=0;
function paintResult(){
  var band=bandFor(state.overall);
  var pill=$("bandPill");
  var lvlColor={1:"var(--lvl-1)",2:"var(--lvl-2)",3:"var(--lvl-3)",4:"var(--lvl-4)"}[band.lvl];
  pill.textContent=band.name;
  pill.style.background = band.lvl>=3 ? "rgba(47,122,99,.14)" : (band.lvl===2?"rgba(176,137,76,.16)":"rgba(181,118,60,.14)");
  pill.style.color = band.lvl>=3 ? "var(--accent-d)" : (band.lvl===2?"#8a6a20":"var(--warn)");
  $("scoreDesc").textContent=band.desc;
  $("shareScore").textContent=state.overall; $("shareBand").textContent=band.name;
  _ringTarget=state.overall;
  $("ringArc").setAttribute("stroke", lvlColor);

  // semáforo: marcador + tick activo
  $("meterMark").dataset.left=state.overall;
  ["tk1","tk2","tk3","tk4"].forEach(function(id,i){ $(id).classList.toggle('on', (i+1)===band.lvl); });

  // dimensiones
  var order=[["reserva","Reserva"],["liquidez","Liquidez"],["resiliencia","Resiliencia"],["proteccion","Protección"]];
  var dc=$("dims"); dc.innerHTML="";
  order.forEach(function(p){ var s=state.dims[p[0]];
    var row=document.createElement("div"); row.className="dbar";
    row.innerHTML='<div class="dt"><b>'+p[1]+'</b><span class="v">'+s+'/100</span></div><div class="track"><div class="fill '+level(s)+'" data-w="'+s+'"></div></div>';
    dc.appendChild(row);
  });

  paintRunway();
  paintScenarios();
  paintInsightD();
  paintStrengths();
  paintVulns();
  paintActions();
  paintReco(band);

  var primer=(state.lead&&state.lead.nombre?state.lead.nombre.split(" ")[0]:"[tu nombre]");
  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+primer+".\\n\\nAcabo de completar el Test de Preparación para Emergencias Financieras.\\nMi resultado fue "+state.overall+"/100 y aparecieron algunos puntos que me gustaría revisar contigo.\\n\\n¿Podemos verlo?";
  $("waBtn").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
  if(CONFIG.calendlyURL)$("calendlyBtn").style.display="flex";
}

function paintRunway(){
  var m=state.meses, pct=Math.min(100, m/12*100);
  $("runwayFill").dataset.w=pct;
  var cat=mesesCategoria();
  $("runwayCap").innerHTML="Según tu respuesta, hoy tendrías alrededor de <b>"+cat+"</b> de pista. Cuanto mayor sea, más tiempo tienes para reorganizarte y tomar decisiones sin presión si tus ingresos se interrumpen.";
}

function paintScenarios(){
  var A=state.ans, d=state.dims, w=$("scenarios"); w.innerHTML="";
  // 1. gasto inesperado ← q3 + liquidez
  var s1=Math.round((A.q3_gasto.v*0.6 + d.liquidez*0.4));
  addScenario(w,'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',"Un gasto inesperado","Surge un gasto equivalente a 1 mes de tus ingresos.",
    s1>=65?["ok","Probablemente podrías absorberlo","Según tus respuestas, cuentas con recursos o fondo para cubrirlo sin recurrir a deuda."]
    : s1>=40?["mid","Podrías cubrirlo con algo de esfuerzo","Según tus respuestas, lo cubrirías combinando ahorros y algo de crédito."]
    : ["low","Podría generar presión financiera","Según tus respuestas, hoy probablemente tendrías que endeudarte para cubrirlo."]);
  // 2. 3 meses sin ingresos ← reserva + resiliencia
  var s2=Math.round((d.reserva*0.6 + d.resiliencia*0.4));
  addScenario(w,'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/',"3 meses sin ingresos","Tu fuente principal de ingresos se detiene por un trimestre.",
    s2>=65?["ok","Tu estructura podría sostenerlo","Según tus respuestas, tu reserva y tu margen de deuda te darían aire durante ese periodo."]
    : s2>=40?["mid","Sería sostenible con ajustes","Según tus respuestas, podrías resistir recortando gastos, aunque el margen sería ajustado."]
    : ["low","Sería un periodo exigente","Según tus respuestas, tres meses sin ingresos pondrían tu economía bajo presión importante."]);
  // 3. emergencia médica/familiar ← q7 + proteccion + liquidez
  var s3=Math.round((A.q7_medico.v*0.45 + d.proteccion*0.35 + d.liquidez*0.2));
  addScenario(w,'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v6M9 11h6" stroke-width="1.6"/',"Una emergencia médica o familiar","Ocurre un evento médico importante en tu hogar.",
    s3>=65?["ok","Estarías razonablemente cubierto","Según tus respuestas, tu cobertura y tus recursos amortiguarían buena parte del impacto."]
    : s3>=40?["mid","Habría cobertura parcial","Según tus respuestas, cubrirías parte, pero podrían quedar gastos a cargo de tus ahorros."]
    : ["low","Podría ser un golpe fuerte","Según tus respuestas, hoy dependerías sobre todo de tus ahorros para afrontarlo."]);
}
function addScenario(w,icon,title,quote,verdict){
  var d=document.createElement("div"); d.className="scen";
  d.innerHTML='<div class="sh"><div class="sic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon+'</svg></div><div><div class="st">'+title+'</div><div class="sq">'+quote+'</div></div></div>'+
    '<div class="verdict '+verdict[0]+'">'+verdict[1]+'</div><p class="sr">'+verdict[2]+'</p>';
  w.appendChild(d);
}

/* Insight caso D: patrimonio con poca liquidez (o cruces útiles) */
function paintInsightD(){
  var A=state.ans, d=state.dims, box=$("insightBox"); box.innerHTML="";
  var txt=null;
  // señal: reserva razonable pero liquidez baja
  if(d.reserva>=60 && d.liquidez<45)
    txt="Tener respaldo no siempre significa tener <b>liquidez inmediata</b>. Ante una emergencia, el acceso rápido a recursos —sin vender algo con prisa— es tan importante como el monto total.";
  else if(A.q4_dependencia && !A.q4_dependencia.noDeps && A.q4_dependencia.v<=40 && d.proteccion<55)
    txt="Tu hogar depende en gran medida de tu ingreso y todavía no hay una <b>estrategia de continuidad</b> clara: es una de las brechas con mayor impacto potencial.";
  else if(A.q6_deuda && A.q6_deuda.noDebt && d.reserva<50)
    txt="No tener deudas es una buena base, aunque tu <b>reserva</b> todavía es ajustada: liberar presión de deuda y construir fondo suelen ir de la mano.";
  if(txt){ box.innerHTML='<div class="insight"><span class="ii"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span><p>'+txt+'</p></div>'; }
}

function paintStrengths(){
  var A=state.ans, d=state.dims, out=[];
  if(A.q1_meses && A.q1_meses.v>=88) out.push("Tienes al menos 6 meses de gastos disponibles: una base de tranquilidad poco común.");
  if(A.q6_deuda && (A.q6_deuda.noDebt || A.q6_deuda.v>=90)) out.push("Tus obligaciones financieras parecen controladas y no comprometerían tu estabilidad.");
  if(A.q7_medico && A.q7_medico.v>=85) out.push("Cuentas con una estrategia para afrontar gastos médicos importantes.");
  if(A.q4_dependencia && A.q4_dependencia.v>=78 && !A.q4_dependencia.noDeps) out.push("Tu hogar no depende únicamente de una sola fuente de ingresos.");
  if(A.q2_fondo && A.q2_fondo.v>=88) out.push("Tienes un fondo de emergencia separado, lo que protege tu liquidez del día a día.");
  if(d.proteccion>=75) out.push("Tu frente de protección y plan está bien resuelto en comparación con el promedio.");
  if(!out.length) out.push("Diste el paso de medir tu preparación: ese es el punto de partida de toda buena estrategia.");
  var w=$("strengths"); w.innerHTML="";
  out.slice(0,3).forEach(function(t){ var d2=document.createElement("div"); d2.className="strength";
    d2.innerHTML='<span class="si"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>'+t+'</p>'; w.appendChild(d2); });
}

var VULN_TEXT={
  reserva:{name:"Fondo de emergencia", low:"Actualmente tu reserva cubriría poco tiempo de gastos.", mid:"Tu reserva es un punto de partida, pero aún tiene espacio para crecer."},
  liquidez:{name:"Liquidez", low:"Tu acceso rápido a recursos hoy es limitado.", mid:"Tienes algo de liquidez, aunque podría ampliarse."},
  resiliencia:{name:"Resiliencia", low:"Tu ingreso o tus deudas dejan poco margen si algo cambia.", mid:"Tu margen ante cambios en el ingreso es moderado."},
  proteccion:{name:"Protección", low:"Todavía no existe una estrategia clara de continuidad ante un imprevisto.", mid:"Tu protección está iniciada, pero conviene confirmar si sería suficiente."}
};
function paintVulns(){
  var order=orderedDims().slice(0,3), w=$("vulns"); w.innerHTML="";
  order.forEach(function(k,i){ var s=state.dims[k], vt=VULN_TEXT[k];
    var txt = s<45? vt.low : vt.mid;
    var d=document.createElement("div"); d.className="vuln";
    d.innerHTML='<div class="vn">0'+(i+1)+'</div><div class="vc"><b>'+vt.name+'</b><p>'+txt+'</p></div>';
    w.appendChild(d);
  });
}

var ACTIONS={
  reserva:{b:"Construye tu primer mes de reserva", p:"Antes de pensar en una gran cifra, trabaja hacia un mes completo de gastos esenciales; es el escalón que más tranquilidad da."},
  liquidez:{b:"Separa una parte líquida y accesible", p:"Define qué porción de tus recursos podrías usar de inmediato sin vender nada con prisa, y mantenla aparte."},
  resiliencia:{b:"Revisa tu dependencia del ingreso y tus deudas", p:"Identifica qué gastos deberían continuar aunque bajaran tus ingresos, y qué obligaciones conviene aligerar primero."},
  proteccion:{b:"Documenta tu plan y tu estrategia de continuidad", p:"Define dónde están tus recursos, a quién contactar y qué haría tu familia si no pudieras generar ingresos por un tiempo."}
};
function paintActions(){
  var order=orderedDims().slice(0,3), w=$("actions"); w.innerHTML="";
  order.forEach(function(k,i){ var a=ACTIONS[k];
    var d=document.createElement("div"); d.className="action"; d.style.animationDelay=(i*.08)+"s";
    d.innerHTML='<div class="an">'+(i+1)+'</div><div class="ac2"><b>'+a.b+'</b><p>'+a.p+'</p></div>';
    w.appendChild(d);
  });
}

function paintReco(band){
  // Caso: capacidad buena pero plan bajo → Kit de Emergencia
  var planLow = state.dims.proteccion<60 && (state.ans.q10_plan && state.ans.q10_plan.v<60);
  var goodCapacity = state.overall>=55;
  if(goodCapacity && planLow && CONFIG.urlKitEmergencia){
    $("recoLabel").textContent="Tu siguiente paso natural";
    $("recoTitle").textContent="Organiza qué haría tu familia ante una emergencia";
    $("recoText").textContent="Tu capacidad financiera es buena, pero todavía falta dejar por escrito qué hacer, dónde están los recursos y a quién contactar.";
    $("recoBtn").textContent="Crear mi Kit de Emergencia Familiar →"; $("recoBtn").href=CONFIG.urlKitEmergencia;
    $("recoBox").style.display="block"; return;
  }
  // Si reserva/liquidez es la mayor brecha → calculadora de fondo (si existe)
  var worst=orderedDims()[0];
  if((worst==="reserva"||worst==="liquidez") && CONFIG.urlFondoEmergencia){
    $("recoLabel").textContent="Tu principal oportunidad";
    $("recoTitle").textContent="Define el fondo de emergencia que te daría tranquilidad";
    $("recoText").textContent="Tu mayor brecha está en la reserva disponible; una calculadora dedicada te ayuda a ponerle un número y un plan.";
    $("recoBtn").textContent="Calcular mi Fondo de Emergencia →"; $("recoBtn").href=CONFIG.urlFondoEmergencia;
    $("recoBox").style.display="block"; return;
  }
  if(CONFIG.urlKitEmergencia){
    $("recoLabel").textContent="Recurso complementario";
    $("recoTitle").textContent="Deja listo tu Kit de Emergencia Familiar";
    $("recoText").textContent="Un mapa de tus recursos, contactos clave y pasos a seguir para que tu familia sepa qué hacer.";
    $("recoBtn").textContent="Crear mi Kit de Emergencia Familiar →"; $("recoBtn").href=CONFIG.urlKitEmergencia;
    $("recoBox").style.display="block"; return;
  }
  $("recoBox").style.display="none";
}

function animateResult(){
  var r=90, circ=2*Math.PI*r, arc=$("ringArc");
  arc.style.strokeDasharray=circ; arc.style.strokeDashoffset=circ;
  requestAnimationFrame(function(){ arc.style.transition="stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)"; arc.style.strokeDashoffset=circ*(1-_ringTarget/100); });
  var t0=performance.now();
  (function tick(t){ var p=Math.min(1,(t-t0)/1200); $("scoreNum").textContent=Math.round(_ringTarget*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(tick); })(t0);
  requestAnimationFrame(function(){
    document.querySelectorAll('#dims .fill').forEach(function(f){ f.style.width=f.dataset.w+"%"; });
    $("meterMark").style.left=$("meterMark").dataset.left+"%";
    $("runwayFill").style.width=$("runwayFill").dataset.w+"%";
  });
}

/* ===================== Compartir / reiniciar ===================== */
function shareTest(){
  track('resource_shared');
  var url=location.origin+location.pathname+"?ref="+encodeURIComponent(CONFIG.agenteID);
  var data={title:"Test de Preparación para Emergencias Financieras", text:"Medí en 2 minutos qué tan preparadas están mis finanzas ante un imprevisto. Mira el tuyo:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard && navigator.clipboard.writeText(url); toast(); }
}
var toastT; function toast(){ var el=$("toast"); el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1300); }
function restart(){
  state={ ans:{}, idx:0, lead:null, scores:{}, overall:0, dims:{}, deps:0, meses:1 };
  document.querySelectorAll('.ac').forEach(function(c){ c.classList.remove('on'); });
  show('intro'); $("gprogWrap").style.display="none";
  location.href=location.origin+location.pathname+(window._referidoPor?("?ref="+encodeURIComponent(window._referidoPor)):"");
}

document.getElementById('btnStart').addEventListener('click', startTest);
document.getElementById('qBack').addEventListener('click', prevQuestion);
document.getElementById('revealBtn').addEventListener('click', function(){ revealResult(); });
document.getElementById('skipLeadBtn').addEventListener('click', function(){ revealResult(true); });
document.getElementById('recoBtn').addEventListener('click', function(){ track('kit_clicked'); });
document.getElementById('waBtn').addEventListener('click', function(){ track('whatsapp_clicked'); });
document.getElementById('calendlyBtn').addEventListener('click', function(){ track('calendly_clicked'); });
document.getElementById('shareTestBtn').addEventListener('click', shareTest);
document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('fab').addEventListener('click', function(){ track('whatsapp_clicked'); });
`;
