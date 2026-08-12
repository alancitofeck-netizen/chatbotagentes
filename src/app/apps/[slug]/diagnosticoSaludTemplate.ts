/** Plantilla verbatim de "Diagnóstico de Salud Financiera" (Financial
 * Score) — CSS, HTML y JS copiados literal del archivo original que sirvió
 * de base a este tipo de Mini App (mismo diseño, tipografía Fraunces/
 * Hanken Grotesk, flujo de 6 pilares con preguntas dinámicas que se saltan
 * cuando no aplican + análisis + gate + resultado con 6 barras de pilar/
 * mapa financiero/3 prioridades/insights cruzados/siguiente nivel/
 * recomendación, sin ningún rediseño).
 *
 * Las ÚNICAS diferencias respecto del original, dentro de
 * DIAGNOSTICO_SALUD_LOGIC_JS, son:
 *
 * 1. El objeto `CONFIG` (antes hardcodeado con los datos de ejemplo "Diego
 *    Tinoco") ahora lee de `window.__DIAGNOSTICO_SALUD_DATA__`, inyectado
 *    por DiagnosticoSaludApp.tsx a partir de la config guardada en el CRM.
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
 * 4. Los 11 botones de navegación/acción de nivel superior que en el HTML
 *    original llamaban a sus funciones vía atributos `onclick="..."` inline
 *    pasan a conectarse con `addEventListener` al final del script — mismo
 *    motivo ya documentado en testEmergenciaTemplate.ts/
 *    kitEmergenciaTemplate.ts (un global como `window.next` puede quedar
 *    pisado por el runtime de Next.js, commit 8b361bd). 4 de esos botones no
 *    tenían `id` en el original (el CTA de intro, el link "continuar sin
 *    dejar datos", "Compartir diagnóstico" y "Volver a empezar") y lo
 *    reciben acá (`btnStart`/`skipLeadBtn`/`shareBtn`/`restartBtn`); los
 *    otros 7 ya tenían `id` propio. El único `onclick` que el archivo
 *    genera dinámicamente (`b.onclick=function(){ isMulti? toggleMulti(...)
 *    : selectSingle(...); }`, dentro de `renderQuestion()`, uno por cada
 *    opción de respuesta) se deja intacto: es una asignación de propiedad JS
 *    resuelta por closure al definirse, no un atributo
 *    `onclick="nombreGlobal()"` resuelto en window al hacer click — no
 *    sufre el bug de `window.next`, y "arreglarlo" exigiría reescribir la
 *    lógica de renderizado de preguntas en sí.
 *
 * SEND_DETAILED_RESPONSES sigue en `false`, igual que en el archivo
 * original — no es parte del objeto CONFIG que esta integración personaliza
 * (ver diagnosticoSaludDefaults.ts para el porqué y su efecto en el
 * saneamiento server-side). Todo el resto — CSS, HTML, y cada función de
 * DIAGNOSTICO_SALUD_LOGIC_JS — es una copia literal del archivo original.
 */

export const DIAGNOSTICO_SALUD_CSS = `

  :root{
    --ink:#101826; --ink-soft:#33415A;
    --accent:#2C5F8A; --accent-d:#1E4666; --accent-2:#4E85B4;   /* azul profundo (configurable) */
    --gold:#B08A4C; --pos:#3E7C69; --warn:#B5763C;
    --paper:#FFFFFF; --bg-1:#F1EFE9; --bg-2:#E9E6DD; --bone:#FBF9F4;
    --muted:#6D7686; --muted-2:#9AA1AD; --line:#E7E3DA; --line-2:#F0EDE5;
    --danger:#B4472F;
    --shadow-card:0 22px 50px -28px rgba(16,24,38,.34);
    --shadow-soft:0 6px 18px -10px rgba(16,24,38,.20);
    --shadow-btn:0 14px 26px -12px rgba(44,95,138,.5);
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
      radial-gradient(820px 420px at 100% -6%, rgba(176,138,76,.08), transparent 55%),
      radial-gradient(760px 400px at 0% 8%, rgba(44,95,138,.09), transparent 52%),
      linear-gradient(168deg,var(--bg-1),var(--bg-2));
    background-attachment:fixed;
  }
  .topbar{position:sticky;top:0;z-index:30;background:rgba(241,239,233,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
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
  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(30px,7.6vw,40px);line-height:1.08;letter-spacing:-.015em;margin-bottom:15px}
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
  .btn.gold{background:linear-gradient(145deg,#C6A05E,#9E7A38);box-shadow:0 14px 26px -12px rgba(176,138,76,.5)}
  .btn.dark{background:linear-gradient(145deg,var(--ink),var(--ink-soft));box-shadow:0 14px 26px -12px rgba(16,24,38,.5)}
  .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}
  .stepnav{display:flex;gap:12px;margin-top:22px}
  .stepnav .btn{flex:1}

  .pillars-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0 26px}
  .pgi{display:flex;align-items:center;gap:11px;padding:13px 14px;background:var(--paper);border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow-soft)}
  .pgi .pgc{width:34px;height:34px;flex:0 0 auto;border-radius:10px;background:rgba(44,95,138,.1);color:var(--accent);display:grid;place-items:center}
  .pgi b{font-size:13.5px;font-weight:700}

  .privacy-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:13px 15px}
  .privacy-note svg{flex:0 0 auto;color:var(--accent);margin-top:1px}

  /* pilar header */
  .pill-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .pill-head .pnum{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-d)}
  .pill-head .pname{font-family:var(--f-d);font-size:20px;font-weight:600}
  .pill-dots{display:flex;gap:6px;margin-left:auto}
  .pill-dots i{width:7px;height:7px;border-radius:50%;background:var(--line)}
  .pill-dots i.on{background:var(--accent)}

  .qtitle{font-family:var(--f-d);font-size:clamp(21px,5.4vw,26px);font-weight:600;line-height:1.2;letter-spacing:-.01em;margin-bottom:6px}
  .qsub{font-size:13px;color:var(--muted);margin-bottom:20px}

  .opts{display:flex;flex-direction:column;gap:11px;margin-bottom:8px}
  .opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;cursor:pointer;background:var(--paper);border:2px solid transparent;border-radius:15px;padding:16px 17px;box-shadow:var(--shadow-soft);transition:.16s;font-family:var(--f)}
  .opt:hover{transform:translateX(3px)}
  .opt.sel{border-color:var(--accent);box-shadow:0 12px 26px -12px rgba(44,95,138,.42)}
  .opt .mk{width:22px;height:22px;flex:0 0 auto;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;transition:.16s}
  .opt.sel .mk{border-color:var(--accent);background:var(--accent)}
  .opt.sel .mk::after{content:"";width:8px;height:8px;border-radius:50%;background:#fff}
  .opt.multi .mk{border-radius:7px}
  .opt.multi.sel .mk::after{width:11px;height:11px;border-radius:2px}
  .opt .otxt{font-size:15px;font-weight:600;color:var(--ink)}

  .multi-hint{font-size:12px;color:var(--muted-2);margin-bottom:14px}
  .nav-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px}
  .nav-back{background:none;border:none;font-family:var(--f);font-size:14.5px;font-weight:600;color:var(--muted);cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:8px 2px}
  .nav-back:hover{color:var(--ink)}
  .nav-next{font-family:var(--f);font-size:15px;font-weight:700;color:#fff;border:none;cursor:pointer;background:linear-gradient(145deg,var(--accent),var(--accent-d));padding:13px 24px;border-radius:13px;box-shadow:var(--shadow-btn);transition:.15s;display:inline-flex;gap:7px;align-items:center}
  .nav-next:hover{transform:translateY(-1px)}
  .nav-next[disabled]{background:var(--line);color:var(--muted-2);box-shadow:none;cursor:not-allowed;transform:none}

  /* análisis */
  .analyze{text-align:center;padding:40px 10px}
  .orb{width:88px;height:88px;margin:0 auto 28px;position:relative}
  .orb .ring{position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:var(--accent);border-right-color:var(--accent-2);animation:spin 1s linear infinite}
  .orb .core{position:absolute;inset:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--accent-2),var(--accent-d));box-shadow:0 0 34px rgba(44,95,138,.4)}
  @keyframes spin{to{transform:rotate(360deg)}}
  .analyze h2{margin-bottom:24px}
  .achecks{display:flex;flex-direction:column;gap:12px;max-width:260px;margin:0 auto;text-align:left}
  .ac{display:flex;align-items:center;gap:12px;font-size:14.5px;color:var(--muted-2);font-weight:500;opacity:.4;transform:translateY(5px);transition:.4s}
  .ac.on{opacity:1;transform:none;color:var(--ink);font-weight:600}
  .ac .cb{width:24px;height:24px;flex:0 0 auto;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;transition:.3s}
  .ac.on .cb{background:var(--pos);border-color:var(--pos)}
  .ac .cb svg{opacity:0} .ac.on .cb svg{opacity:1}

  /* teaser / gate */
  .teaser{position:relative;border-radius:20px;overflow:hidden;margin-bottom:22px;box-shadow:var(--shadow-soft)}
  .teaser .blur{filter:blur(7px);opacity:.9;pointer-events:none;user-select:none;padding:26px;background:linear-gradient(160deg,var(--ink),var(--ink-soft));text-align:center;color:#fff}
  .teaser .blur .tl{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-weight:700}
  .teaser .blur .tn{font-family:var(--f-d);font-size:58px;font-weight:700;line-height:1;margin:6px 0}
  .teaser .lock{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(251,249,244,.12),rgba(251,249,244,.72))}
  .teaser .lock span{background:var(--paper);border:1px solid var(--line);padding:10px 16px;border-radius:22px;font-size:13px;font-weight:700;box-shadow:var(--shadow-soft)}
  .field{margin-bottom:15px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:7px}
  .field label .opt{font-weight:400;color:var(--muted-2);font-size:12px}
  .field input{width:100%;font-family:var(--f);font-size:16px;padding:14px 15px;border:1.5px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(44,95,138,.12)}
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
  .band-pill{display:inline-block;font-size:15px;font-weight:700;padding:8px 22px;border-radius:24px;margin:14px 0 8px;background:rgba(44,95,138,.12);color:var(--accent-d)}
  .score-desc{font-size:15px;color:var(--ink-soft);max-width:420px;margin:6px auto 0;line-height:1.55}

  .section-title{font-family:var(--f-d);font-size:21px;font-weight:600;margin:30px 0 4px}
  .section-sub{font-size:13px;color:var(--muted);margin-bottom:18px}

  /* barras pilares */
  .pbar{margin-bottom:15px}
  .pbar .pt{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
  .pbar .pt b{font-size:14px;font-weight:700}
  .pbar .pt .v{font-family:var(--f-d);font-size:14.5px;font-weight:700;color:var(--muted)}
  .pbar .pt .na{font-size:11px;color:var(--muted-2);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .pbar .track{height:10px;background:var(--bg-1);border-radius:7px;overflow:hidden;border:1px solid var(--line)}
  .pbar .fill{height:100%;width:0;border-radius:7px;transition:width 1s cubic-bezier(.22,1,.36,1)}
  .fill.s-hi{background:linear-gradient(90deg,#4C9A82,var(--pos))}
  .fill.s-mid{background:linear-gradient(90deg,var(--accent-2),var(--accent))}
  .fill.s-lo{background:linear-gradient(90deg,#C79A6A,var(--gold))}

  /* mapa */
  .mapcols{display:flex;flex-direction:column;gap:14px;margin-top:6px}
  .mapcol{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow-soft)}
  .mapcol h4{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .mapcol.f h4{color:var(--pos)} .mapcol.w h4{color:var(--gold)} .mapcol.p h4{color:var(--accent-d)}
  .maprow{display:flex;align-items:center;gap:10px;font-size:14.5px;font-weight:600;padding:5px 0}
  .maprow .mi{width:22px;height:22px;flex:0 0 auto;border-radius:6px;display:grid;place-items:center}
  .mapcol.f .mi{background:rgba(62,124,105,.14);color:var(--pos)}
  .mapcol.w .mi{background:rgba(176,138,76,.16);color:var(--gold)}
  .mapcol.p .mi{background:rgba(44,95,138,.14);color:var(--accent-d)}
  .maprow small{margin-left:auto;font-family:var(--f-d);font-weight:700;color:var(--muted);font-size:13px}

  /* prioridades */
  .prio{display:flex;gap:15px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:var(--shadow-soft)}
  .prio .pn{font-family:var(--f-d);font-size:28px;font-weight:700;color:var(--accent-2);line-height:1;flex:0 0 auto;width:34px}
  .prio .pc b{font-size:15px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;display:block;margin-bottom:4px}
  .prio .pc p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}

  /* insights */
  .insight{display:flex;gap:12px;align-items:flex-start;background:var(--bone);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:11px;animation:rise .5s both}
  .insight .ii{width:30px;height:30px;flex:0 0 auto;border-radius:9px;background:rgba(44,95,138,.1);color:var(--accent);display:grid;place-items:center}
  .insight p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}
  .insight p b{color:var(--ink);font-weight:700}

  /* wow siguiente nivel */
  .nextlvl{background:linear-gradient(150deg,var(--accent),var(--accent-d));color:#fff;border-radius:20px;padding:24px;text-align:center;margin:26px 0;box-shadow:0 20px 44px -22px rgba(44,95,138,.7)}
  .nextlvl .nl-row{display:flex;align-items:center;justify-content:center;gap:20px;margin:4px 0 12px}
  .nextlvl .nl-b{text-align:center}
  .nextlvl .nl-b .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;font-weight:700}
  .nextlvl .nl-b .v{font-family:var(--f-d);font-size:44px;font-weight:700;line-height:1}
  .nextlvl .nl-ar{opacity:.7}
  .nextlvl p{font-size:13.5px;opacity:.94;line-height:1.55;max-width:400px;margin:0 auto}

  /* recomendada / share / cta */
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

export const DIAGNOSTICO_SALUD_BODY_HTML = `
<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">DT</div>
      <div class="who"><b id="agentName">Diego Tinoco</b><span id="agentTitle">Asesor financiero</span></div>
    </div>
    <div class="kit-name">Financial Score</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none"><div class="track"><i id="gpbar"></i></div></div>

<div class="wrap">

  <!-- INTRO -->
  <div class="step on" data-step="intro">
    <div class="eyebrow">Diagnóstico financiero · 3 min</div>
    <h1>¿Qué tan saludables están realmente <em>tus finanzas</em>?</h1>
    <p class="lede">Evalúa 6 áreas clave de tu vida financiera y descubre cuáles tienes bajo control y cuáles conviene fortalecer.</p>
    <div class="pillars-grid" id="pillarsGrid"></div>
    <button class="btn wide" id="btnStart">Calcular mi Financial Score →</button>
    <div class="privacy-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Gratis, privado y sin necesidad de conectar tus cuentas bancarias.</span></div>
  </div>

  <!-- PREGUNTA (dinámica) -->
  <div class="step" data-step="question">
    <div class="pill-head">
      <div><div class="pnum" id="qPnum">Pilar 1 de 6</div><div class="pname" id="qPname">Liquidez</div></div>
      <div class="pill-dots" id="qDots"></div>
    </div>
    <div class="qtitle" id="qTitle">…</div>
    <div class="qsub" id="qSub"></div>
    <div class="multi-hint" id="qMulti" style="display:none">Puedes elegir varias · toca Continuar al terminar.</div>
    <div class="opts" id="qOpts"></div>
    <div class="nav-row">
      <button class="nav-back" id="qBack">← Atrás</button>
      <button class="nav-next" id="qNext" disabled>Siguiente →</button>
    </div>
  </div>

  <!-- ANÁLISIS -->
  <div class="step analyze" data-step="analyze">
    <div class="orb"><div class="ring"></div><div class="core"></div></div>
    <h2>Analizando tus 6 pilares financieros…</h2>
    <div class="achecks" id="achecks"></div>
  </div>

  <!-- GATE -->
  <div class="step" data-step="gate">
    <div style="text-align:center">
      <div class="eyebrow" style="justify-content:center">Tu Financial Score está listo</div>
      <h2 style="margin-bottom:9px">¿A dónde te lo enviamos?</h2>
      <p class="sec-sub" style="max-width:400px;margin:0 auto 22px">Déjanos dónde enviarte tu diagnóstico completo y poder revisarlo con tu asesor.</p>
    </div>
    <div class="teaser">
      <div class="blur"><div class="tl">Financial Score</div><div class="tn" id="teaserNum">7X</div><div style="font-size:13px;opacity:.7">6 pilares analizados</div></div>
      <div class="lock"><span>🔒 Desbloquea tu diagnóstico completo</span></div>
    </div>
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
      <div class="eyebrow" style="justify-content:center">Tu Financial Score</div>
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

    <div class="section-title">Tus 6 pilares</div>
    <div class="section-sub">Cada área sobre 100, según tus respuestas.</div>
    <div id="pbars"></div>

    <div class="section-title">Tu mapa financiero</div>
    <div class="section-sub">Cómo se distribuyen tus áreas hoy.</div>
    <div class="mapcols" id="mapcols"></div>

    <div class="section-title">Si mejoraras solamente 3 cosas…</div>
    <div class="section-sub">Tus áreas de mayor impacto ahora mismo.</div>
    <div id="prios"></div>

    <div class="section-title">Lo que notamos en tus respuestas</div>
    <div class="section-sub">Observaciones personalizadas de tu diagnóstico.</div>
    <div id="insights"></div>

    <div class="nextlvl">
      <div class="eyebrow" style="justify-content:center;color:rgba(255,255,255,.75)">Tu siguiente nivel financiero</div>
      <div class="nl-row">
        <div class="nl-b"><div class="l">Hoy</div><div class="v" id="nlNow">72</div></div>
        <div class="nl-ar"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
        <div class="nl-b"><div class="l">Próximo objetivo</div><div class="v" id="nlNext">80+</div></div>
      </div>
      <p>No necesitas mejorar todo al mismo tiempo. Trabajar primero tus áreas de mayor impacto puede cambiar significativamente tu posición financiera.</p>
    </div>

    <div class="reco" id="recoBox" style="display:none">
      <div class="rl">Tu principal oportunidad</div>
      <h3 id="recoTitle"></h3>
      <p id="recoText"></p>
      <a class="btn gold wide" id="recoBtn" href="#" target="_blank" rel="noopener"></a>
    </div>

    <div class="cta-head">
      <h3>¿Quieres entender cómo mejorar tu score?</h3>
      <p>Tu asesor puede ayudarte a revisar tus prioridades y construir un plan para fortalecer las áreas que hoy tienen mayor impacto.</p>
    </div>
    <div class="review-card">
      <div class="rc" id="revAva">DT</div>
      <div><b>Revisa tu diagnóstico con <span id="ctaAgent">Diego</span></b><small id="ctaAgentRole">Asesor financiero · sin costo</small></div>
    </div>
    <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener">Revisar mi diagnóstico por WhatsApp</a>
    <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none">Agendar una revisión →</a>

    <div class="sharecard">
      <div class="sl">Mi Financial Score</div>
      <div class="sv" id="shareScore">72</div>
      <div class="sb" id="shareBand">Buena base</div>
      <div class="sm">6 pilares analizados · Growth Link</div>
    </div>
    <div class="share-band">
      <h3>¿A quién más le serviría conocer su Financial Score?</h3>
      <p>Comparte este diagnóstico con alguien que también quiera poner sus finanzas en orden.</p>
      <button class="btn gold wide" id="shareBtn">Compartir diagnóstico</button>
    </div>

    <button class="restart" id="restartBtn">↺ Volver a empezar</button>
    <div class="disclaimer">Este diagnóstico tiene fines educativos y se basa exclusivamente en las respuestas proporcionadas. El Financial Score no es una calificación crediticia, evaluación bancaria ni recomendación financiera personalizada. La situación y objetivos de cada persona requieren un análisis individual.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Diego Tinoco</b> · Growth Link</div>
</div>

<div class="toast" id="toast">Copiado</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesor</span>
</a>
`;

export const DIAGNOSTICO_SALUD_LOGIC_JS = `

/* ==================================================================
   ▓▓  CONFIG DEL AGENTE  ▓▓  ← Editá solo esto para replicar.
   ================================================================== */
const DIAG_DATA = window.__DIAGNOSTICO_SALUD_DATA__ || {};
const DIAG_BRAND = DIAG_DATA.brand || {};
const DIAG_SLUG = DIAG_DATA.slug || "";
fetch('/api/public/mini-apps/'+DIAG_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  agente:      DIAG_BRAND.advisorName || "Tu asesor",
  titulo:      DIAG_BRAND.title || "Asesor financiero",
  whatsapp:    DIAG_BRAND.whatsapp || "",
  fotoURL:     DIAG_BRAND.photoURL || "",
  logoURL:     DIAG_BRAND.logoURL || "",
  agenteID:    DIAG_SLUG,
  colorMarca:  DIAG_BRAND.colorMarca || "",
  calendlyURL: DIAG_BRAND.calendlyURL || "",
  avisoPrivacidadURL: DIAG_BRAND.privacyURL || "",
  webhookURL:  DIAG_BRAND.webhookURL || "",
  urlRetiro:      DIAG_BRAND.urlRetiro || "",
  urlEmergencia:  DIAG_BRAND.urlEmergencia || "",
  urlUniversidad: DIAG_BRAND.urlUniversidad || "",
  urlProteccion:  DIAG_BRAND.urlProteccion || ""
};

/* Enviar respuestas detalladas al CRM (por defecto NO) */
const SEND_DETAILED_RESPONSES = false;

/* ==================================================================
   PONDERACIONES (0..1, suman 1)
   Nota de diseño: Protección y Retiro llevan algo más de peso por su
   impacto de largo plazo. Si el usuario NO tiene dependientes ni
   patrimonio, el peso de Protección se redistribuye (ver scoring).
   ================================================================== */
const WEIGHTS = { liquidez:0.18, ahorro:0.16, deuda:0.16, proteccion:0.18, retiro:0.18, patrimonio:0.14 };

/* ==================================================================
   PILARES · preguntas y valores (v = aporte 0..100 a ese pilar)
   type: "single" | "multi"
   na(state): devuelve true si la pregunta NO aplica → se excluye.
   ================================================================== */
const PILLARS = [
  { key:"liquidez", name:"Liquidez", icon:'<path d="M3 12h4l2 5 4-10 2 5h6"/>',
    intro:"Tu capacidad para enfrentar imprevistos.",
    qs:[
      { id:"liq_meses", q:"Si tus ingresos se detuvieran mañana, ¿cuántos meses podrías mantener tus gastos actuales?",
        opts:[{t:"Menos de 1 mes",v:10},{t:"1–2 meses",v:35},{t:"3–5 meses",v:65},{t:"6–12 meses",v:88},{t:"Más de 12 meses",v:100}]},
      { id:"liq_fondo", q:"¿Tienes un fondo específicamente reservado para emergencias?",
        opts:[{t:"No",v:15},{t:"Estoy construyéndolo",v:55},{t:"Sí",v:100}]},
      { id:"liq_gasto", q:"Si apareciera un gasto inesperado de un mes de tus ingresos, ¿cómo lo pagarías?",
        opts:[{t:"Tendría que endeudarme",v:15},{t:"Usaría tarjeta/crédito parcialmente",v:40},{t:"Usaría mis ahorros",v:75},{t:"Tengo un fondo específico para eso",v:100}]}
    ]},
  { key:"ahorro", name:"Ahorro", icon:'<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>',
    intro:"Tu disciplina y capacidad de ahorro.",
    qs:[
      { id:"aho_pct", q:"¿Qué porcentaje aproximado de tus ingresos logras ahorrar cada mes?",
        opts:[{t:"0%",v:5},{t:"Menos del 5%",v:35},{t:"5–10%",v:60},{t:"10–20%",v:85},{t:"Más del 20%",v:100}]},
      { id:"aho_auto", q:"¿Tu ahorro ocurre automáticamente o solo cuando sobra dinero?",
        opts:[{t:"Normalmente no ahorro",v:10},{t:"Cuando sobra",v:40},{t:"Tengo una meta pero varía",v:70},{t:"Está automatizado cada mes",v:100}]},
      { id:"aho_obj", q:"¿Tienes objetivos financieros definidos para los próximos 3–5 años?",
        opts:[{t:"No",v:15},{t:"Tengo algunas ideas",v:45},{t:"Sí, pero sin números",v:70},{t:"Sí, con monto y fecha",v:100}]}
    ]},
  { key:"deuda", name:"Deuda", icon:'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    intro:"No toda deuda es mala; lo que importa es el control.",
    qs:[
      { id:"deu_pct", q:"¿Qué porcentaje aproximado de tus ingresos usas para pagar deudas?",
        opts:[{t:"No tengo deudas",v:90,noDebt:true},{t:"Menos del 15%",v:100},{t:"15–30%",v:70},{t:"30–45%",v:40},{t:"Más del 45%",v:15},{t:"No lo sé",v:30}]},
      { id:"deu_tarjeta", q:"¿Mantienes saldos pendientes en tarjetas de crédito mes a mes?",
        na:function(s){ return s.deu_pct && s.deu_pct.noDebt; },
        opts:[{t:"Frecuentemente",v:20},{t:"Algunas veces",v:50},{t:"Rara vez",v:80},{t:"Nunca",v:100}]},
      { id:"deu_total", q:"¿Conoces aproximadamente cuánto debes en total?",
        na:function(s){ return s.deu_pct && s.deu_pct.noDebt; },
        opts:[{t:"No",v:25},{t:"Aproximadamente",v:65},{t:"Sí, lo tengo claro",v:100}]}
    ]},
  { key:"proteccion", name:"Protección", icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    intro:"Qué tan resguardado está lo que has construido.",
    qs:[
      { id:"pro_deps", q:"Si tú faltaras mañana, ¿por cuánto tiempo podría tu familia mantener su estilo de vida?",
        opts:[{t:"No tengo dependientes económicos",v:100,noDeps:true},{t:"Menos de 6 meses",v:20},{t:"6–12 meses",v:45},{t:"1–3 años",v:75},{t:"Más de 3 años",v:100},{t:"No lo sé",v:30}]},
      { id:"pro_cob", q:"¿Actualmente cuentas con alguna protección financiera?", type:"multi",
        opts:[{t:"Seguro de vida",v:0},{t:"Gastos médicos",v:0},{t:"Protección por incapacidad",v:0},{t:"Seguro de hogar",v:0},{t:"Seguro de auto",v:0},{t:"Otro",v:0},{t:"Ninguno",v:0,exclusive:true}]},
      { id:"pro_monto", q:"¿Sabes aproximadamente qué cantidad recibiría tu familia si algo te ocurriera?",
        na:function(s){ return s.pro_deps && s.pro_deps.noDeps; },
        opts:[{t:"No",v:25},{t:"Tengo una idea",v:65},{t:"Sí",v:100}]},
      { id:"pro_benef", q:"¿Tus beneficiarios y pólizas están actualizados?",
        opts:[{t:"No tengo pólizas",v:20},{t:"No estoy seguro",v:45},{t:"Algunas",v:75},{t:"Sí",v:100}]}
    ]},
  { key:"retiro", name:"Retiro", icon:'<path d="M12 2a5 5 0 015 5c0 2-1 3-1 5h-8c0-2-1-3-1-5a5 5 0 015-5zM8 17h8M9 21h6"/>',
    intro:"Cómo estás preparando tu futuro.",
    qs:[
      { id:"ret_prep", q:"¿Actualmente estás preparando capital específicamente para tu retiro?",
        opts:[{t:"No",v:15},{t:"Dependo de mi pensión/AFORE",v:40},{t:"Aporto ocasionalmente",v:60},{t:"Aporto todos los meses",v:85},{t:"Tengo una estrategia definida",v:100}]},
      { id:"ret_mensual", q:"¿Sabes cuánto necesitarías mensualmente para mantener tu estilo de vida al retirarte?",
        opts:[{t:"No",v:25},{t:"Tengo una idea",v:65},{t:"Sí, ya lo calculé",v:100}]},
      { id:"ret_capital", q:"¿Sabes cuánto patrimonio necesitas acumular para retirarte?",
        opts:[{t:"No",v:25},{t:"Aproximadamente",v:65},{t:"Sí",v:100}]}
    ]},
  { key:"patrimonio", name:"Patrimonio", icon:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
    intro:"Cómo crece y se organiza tu patrimonio.",
    qs:[
      { id:"pat_inv", q:"Además de tu vivienda, ¿actualmente tienes dinero invertido?",
        opts:[{t:"No",v:20,noInv:true},{t:"Estoy comenzando",v:55},{t:"Sí",v:100}]},
      { id:"pat_div", q:"¿Tu patrimonio está distribuido entre diferentes tipos de activos?",
        na:function(s){ return s.pat_inv && s.pat_inv.noInv; },
        opts:[{t:"No",v:30},{t:"Parcialmente",v:65},{t:"Sí",v:100}]},
      { id:"pat_obj", q:"¿Tus inversiones están relacionadas con objetivos concretos?",
        opts:[{t:"No invierto",v:25},{t:"No",v:45},{t:"Algunas",v:75},{t:"Sí",v:100}]},
      { id:"pat_rev", q:"¿Revisas periódicamente cómo está distribuido tu patrimonio?",
        opts:[{t:"Nunca",v:20},{t:"Rara vez",v:45},{t:"Una vez al año",v:75},{t:"Periódicamente",v:100}]}
    ]}
];

const BANDS = [
  { min:90, name:"Alta preparación", desc:"Tus finanzas muestran una estructura muy sólida en casi todas las áreas. El foco ahora es optimizar y sostener." },
  { min:75, name:"Finanzas sólidas", desc:"Tienes bases firmes y hábitos consistentes. Con ajustes puntuales puedes llegar al siguiente nivel." },
  { min:60, name:"Buena base financiera", desc:"Hay una estructura positiva, con algunas áreas importantes que todavía puedes fortalecer." },
  { min:40, name:"En construcción", desc:"Vas tomando decisiones en la dirección correcta; varias áreas clave aún tienen espacio de mejora." },
  { min:0,  name:"Base por construir", desc:"Es un buen momento para ordenar tus prioridades. Pequeños cambios en las áreas correctas hacen una gran diferencia." }
];

const PRIO_TEXT = {
  liquidez:"Tener una reserva accesible es la base que sostiene todo lo demás; te da margen para no improvisar ante imprevistos.",
  ahorro:"Crear un sistema de ahorro automático ayuda a convertir la intención en patrimonio, sin depender de la fuerza de voluntad.",
  deuda:"Ordenar y conocer tus obligaciones te devuelve control: saber cuánto, a quién y a qué costo cambia las decisiones.",
  proteccion:"Lo que has construido puede protegerse; revisar tu cobertura evita que un imprevisto ponga en riesgo a tu familia.",
  retiro:"Definir una meta clara de retiro convierte un tema abstracto en un plan con números y fecha, y el tiempo juega a tu favor.",
  patrimonio:"Darle estructura y objetivos a tu patrimonio ayuda a que crezca con propósito, no solo por acumulación."
};

/* ========================= Motor / estado ========================= */
function $(id){ return document.getElementById(id); }
function num(v){ v=parseFloat(v); return isFinite(v)?v:0; }
function track(ev,data){ try{ console.log("[track]",ev,data||""); }catch(e){} }

var FLOW=[]; // secuencia lineal de {pillarIndex, qIndex}
PILLARS.forEach(function(p,pi){ p.qs.forEach(function(q,qi){ FLOW.push({pi:pi,qi:qi}); }); });

var state = { ans:{}, pos:0, lead:null, scores:{}, overall:0 };

(function init(){
  if(CONFIG.colorMarca){ document.documentElement.style.setProperty('--accent',CONFIG.colorMarca); }
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente; $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente; $("footAgent").textContent=CONFIG.agente;
  $("ctaAgent").textContent=CONFIG.agente.split(" ")[0]; $("ctaAgentRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.avisoPrivacidadURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){ var src=CONFIG.fotoURL||CONFIG.logoURL; $("agentAva").innerHTML='<img src="'+src+'" alt="">'; $("revAva").innerHTML='<img src="'+src+'" alt="">'; }
  else { $("agentAva").textContent=initials; $("revAva").textContent=initials; }
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre el Diagnóstico de Salud Financiera.");
  if(CONFIG.calendlyURL) $("calendlyBtn").href=CONFIG.calendlyURL;
  // grid de pilares en portada
  var g=$("pillarsGrid");
  PILLARS.forEach(function(p){ var d=document.createElement("div"); d.className="pgi";
    d.innerHTML='<div class="pgc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+p.icon+'</svg></div><b>'+p.name+'</b>'; g.appendChild(d); });
  // achecks
  var ac=$("achecks");
  PILLARS.forEach(function(p){ var d=document.createElement("div"); d.className="ac";
    d.innerHTML='<span class="cb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span> '+p.name; ac.appendChild(d); });
  var ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref;
  track('diagnostic_started');
})();

function show(step){
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function startDiagnostic(){ state.pos=0; goToPos(); show('question'); $("gprogWrap").style.display="block"; }

/* saltar preguntas no aplicables al avanzar/retroceder */
function isNA(flow){ var q=PILLARS[flow.pi].qs[flow.qi]; return q.na? q.na(state.ans) : false; }
function nextApplicable(from,dir){
  var i=from;
  while(i>=0 && i<FLOW.length){ if(!isNA(FLOW[i])) return i; i+=dir; }
  return -1;
}
function goToPos(){
  // asegurar que la posición actual sea aplicable
  if(isNA(FLOW[state.pos])){ var np=nextApplicable(state.pos,1); if(np<0){ finishDiagnostic(); return; } state.pos=np; }
  renderQuestion();
}
function progressPct(){
  // % según preguntas aplicables respondidas
  var total=0,done=0;
  FLOW.forEach(function(f,idx){ if(!isNA(f)){ total++; var q=PILLARS[f.pi].qs[f.qi]; if(state.ans[q.id]!==undefined) done++; } });
  return total? Math.round(done/total*100):0;
}
function renderQuestion(){
  var f=FLOW[state.pos], p=PILLARS[f.pi], q=p.qs[f.qi];
  $("qPnum").textContent="Pilar "+(f.pi+1)+" de 6";
  $("qPname").textContent=p.name;
  // dots del pilar (solo preguntas aplicables del pilar)
  var appl=p.qs.filter(function(qq){ return !(qq.na && qq.na(state.ans)); });
  var curIdx=appl.indexOf(q);
  var dots=$("qDots"); dots.innerHTML="";
  appl.forEach(function(_,i){ var d=document.createElement("i"); if(i<=curIdx)d.className="on"; dots.appendChild(d); });

  $("qTitle").textContent=q.q;
  $("qSub").textContent=p.intro;
  var isMulti=q.type==="multi";
  $("qMulti").style.display=isMulti?"block":"none";
  $("qBack").style.visibility=(state.pos===0)?"hidden":"visible";

  var w=$("qOpts"); w.innerHTML="";
  var cur=state.ans[q.id];
  q.opts.forEach(function(o,i){
    var b=document.createElement("button"); b.className="opt"+(isMulti?" multi":"");
    var selected = isMulti ? (cur && cur.sel && cur.sel.indexOf(i)>=0) : (cur && cur.i===i);
    if(selected)b.classList.add("sel");
    b.innerHTML='<span class="mk"></span><span class="otxt">'+o.t+'</span>';
    b.onclick=function(){ isMulti? toggleMulti(q,i,o) : selectSingle(q,i,o); };
    w.appendChild(b);
  });
  updateNext(q);
  $("gpbar").style.width=progressPct()+"%";
}
function selectSingle(q,i,o){
  state.ans[q.id]={i:i,v:o.v,noDebt:!!o.noDebt,noDeps:!!o.noDeps,noInv:!!o.noInv,t:o.t};
  document.querySelectorAll('#qOpts .opt').forEach(function(x){ x.classList.remove('sel'); });
  document.querySelectorAll('#qOpts .opt')[i].classList.add('sel');
  updateNext(q);
  setTimeout(function(){ nextQuestion(); }, 240);
}
function toggleMulti(q,i,o){
  var cur=state.ans[q.id]||{sel:[],labels:[]};
  var pos=cur.sel.indexOf(i);
  // opción excluyente ("Ninguno")
  var exclusiveIdx = q.opts.findIndex(function(x){return x.exclusive});
  if(o.exclusive){ cur.sel=[i]; }
  else { if(pos>=0)cur.sel.splice(pos,1); else cur.sel.push(i);
    if(exclusiveIdx>=0){ var ep=cur.sel.indexOf(exclusiveIdx); if(ep>=0)cur.sel.splice(ep,1); } }
  cur.labels=cur.sel.map(function(x){return q.opts[x].t});
  state.ans[q.id]=cur;
  document.querySelectorAll('#qOpts .opt').forEach(function(x,idx){ x.classList.toggle('sel', cur.sel.indexOf(idx)>=0); });
  updateNext(q);
}
function updateNext(q){
  var cur=state.ans[q.id], ok;
  if(q.type==="multi") ok = cur && cur.sel && cur.sel.length>0;
  else ok = cur && cur.i!==undefined;
  $("qNext").disabled=!ok;
}
function nextQuestion(){
  var f=FLOW[state.pos], q=PILLARS[f.pi].qs[f.qi];
  if($("qNext").disabled) return;
  // track fin de pilar si la siguiente aplicable cambia de pilar
  var np=nextApplicable(state.pos+1,1);
  var curPillar=PILLARS[f.pi].key;
  if(np<0 || FLOW[np].pi!==f.pi){ track('pillar_'+pillarEvent(curPillar)+'_completed'); }
  if(np<0){ finishDiagnostic(); return; }
  state.pos=np; renderQuestion();
}
function prevQuestion(){
  var pp=nextApplicable(state.pos-1,-1);
  if(pp>=0){ state.pos=pp; renderQuestion(); }
}
function pillarEvent(k){ return {liquidez:"liquidity",ahorro:"savings",deuda:"debt",proteccion:"protection",retiro:"retirement",patrimonio:"wealth"}[k]; }

/* ===================== SCORING ===================== */
function scorePillar(p){
  var vals=[];
  p.qs.forEach(function(q){
    if(q.na && q.na(state.ans)) return;          // no aplica → excluir
    var a=state.ans[q.id]; if(a===undefined) return;
    if(q.type==="multi"){
      vals.push(scoreProtectionCoverage(a));      // manejo especial cobertura
    } else {
      vals.push(a.v);
    }
  });
  if(!vals.length) return null;                   // pilar sin preguntas aplicables
  return Math.round(vals.reduce(function(x,y){return x+y},0)/vals.length);
}
// cobertura de protección (multi): mapear selección a 0..100
function scoreProtectionCoverage(a){
  var labels=a.labels||[];
  if(labels.indexOf("Ninguno")>=0 || labels.length===0) return 15;
  var core=0;
  if(labels.indexOf("Seguro de vida")>=0) core+=45;
  if(labels.indexOf("Gastos médicos")>=0) core+=30;
  if(labels.indexOf("Protección por incapacidad")>=0) core+=15;
  var other=0;
  ["Seguro de hogar","Seguro de auto","Otro"].forEach(function(l){ if(labels.indexOf(l)>=0)other+=6; });
  // sin dependientes: vida pesa menos, se valora tener cobertura general
  if(state.ans.pro_deps && state.ans.pro_deps.noDeps){
    var base=40; if(labels.indexOf("Gastos médicos")>=0)base+=30; if(labels.indexOf("Protección por incapacidad")>=0)base+=15; base+=other;
    return Math.min(100,base);
  }
  return Math.min(100, core+other);
}
function computeScores(){
  var scores={}, weights=Object.assign({},WEIGHTS);
  PILLARS.forEach(function(p){ scores[p.key]=scorePillar(p); });

  // Re-ponderación: si un pilar quedó null (sin preguntas aplicables),
  // repartir su peso proporcionalmente entre los demás.
  var active=Object.keys(weights).filter(function(k){ return scores[k]!==null; });
  var deadWeight=Object.keys(weights).reduce(function(s,k){ return s + (scores[k]===null? weights[k]:0); },0);
  if(deadWeight>0){
    var sumActive=active.reduce(function(s,k){ return s+weights[k]; },0);
    active.forEach(function(k){ weights[k]=weights[k]+ deadWeight*(weights[k]/sumActive); });
  }
  var overall=0; active.forEach(function(k){ overall += scores[k]*weights[k]; });
  state.scores=scores; state.weightsUsed=weights;
  state.overall=Math.round(overall);
}

/* ===================== ANÁLISIS + TEASER ===================== */
function finishDiagnostic(){
  computeScores();
  track('score_calculated',{score:state.overall});
  show('analyze');
  $("gprogWrap").style.display="none";
  var acs=document.querySelectorAll('.ac');
  acs.forEach(function(c,i){ setTimeout(function(){ c.classList.add('on'); }, 180+i*180); });
  setTimeout(function(){
    $("teaserNum").textContent = Math.floor(state.overall/10)+"X";
    show('gate');
  }, 180 + acs.length*180 + 500);
}

/* ===================== LEAD / CRM ===================== */
function orderedPriorities(){
  // pilares aplicables ordenados por score ascendente
  return Object.keys(state.scores).filter(function(k){return state.scores[k]!==null})
    .sort(function(a,b){ return state.scores[a]-state.scores[b]; });
}
function buildLead(){
  var pr=orderedPriorities();
  var lead={
    agenteID:CONFIG.agenteID, recurso:"diagnostico-salud-financiera",
    nombre:(state.lead&&state.lead.nombre)||"", whatsapp:(state.lead&&state.lead.whatsapp)||"", email:(state.lead&&state.lead.email)||"",
    consentimiento:!!(state.lead&&state.lead.consent), timestamp:new Date().toISOString(), referidoPor:window._referidoPor||null,
    financialScore:state.overall,
    scoreLiquidez:state.scores.liquidez, scoreAhorro:state.scores.ahorro, scoreDeuda:state.scores.deuda,
    scoreProteccion:state.scores.proteccion, scoreRetiro:state.scores.retiro, scorePatrimonio:state.scores.patrimonio,
    prioridad1:pr[0]||null, prioridad2:pr[1]||null, prioridad3:pr[2]||null
  };
  if(SEND_DETAILED_RESPONSES){ lead.respuestas = state.ans; }
  return lead;
}
function sendLeadToCRM(lead){
  var hostedPayload = Object.assign({}, lead, { fecha: lead.timestamp, consentimiento: true, consentimiento_fecha: lead.timestamp });
  fetch('/api/public/mini-apps/'+DIAG_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
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
  track('full_report_viewed');
}

/* ===================== RESULTADO ===================== */
function bandFor(s){ return BANDS.filter(function(b){return s>=b.min})[0]; }
function level(s){ return s>=70?"s-hi":(s>=45?"s-mid":"s-lo"); }
var _ringTarget=0;
function paintResult(){
  var band=bandFor(state.overall);
  $("bandPill").textContent=band.name; $("scoreDesc").textContent=band.desc;
  $("shareScore").textContent=state.overall; $("shareBand").textContent=band.name;
  _ringTarget=state.overall;
  var arcColor = state.overall>=60 ? "var(--accent)" : (state.overall>=40 ? "var(--gold)" : "var(--warn)");
  $("ringArc").setAttribute("stroke",arcColor);
  // próximo objetivo (siguiente banda o +8)
  var nextGoal = band.min>=90? 100 : (BANDS.filter(function(b){return b.min>state.overall}).slice(-1)[0]||{min:Math.min(100,state.overall+8)}).min;
  $("nlNow").textContent=state.overall; $("nlNext").textContent=(nextGoal>=100?"95+":nextGoal+"+");

  // barras por pilar
  var pb=$("pbars"); pb.innerHTML="";
  PILLARS.forEach(function(p){
    var s=state.scores[p.key];
    var row=document.createElement("div"); row.className="pbar";
    if(s===null){
      row.innerHTML='<div class="pt"><b>'+p.name+'</b><span class="na">No aplica</span></div><div class="track"></div>';
    } else {
      row.innerHTML='<div class="pt"><b>'+p.name+'</b><span class="v">'+s+'/100</span></div><div class="track"><div class="fill '+level(s)+'" data-w="'+s+'"></div></div>';
    }
    pb.appendChild(row);
  });

  // mapa: fortalezas (>=70), fortalecer (45-69), prioridad (<45)
  var strong=[],mid=[],low=[];
  Object.keys(state.scores).forEach(function(k){ var s=state.scores[k]; if(s===null)return;
    var nm=PILLARS.find(function(p){return p.key===k}).name;
    if(s>=70)strong.push({k:k,nm:nm,s:s}); else if(s>=45)mid.push({k:k,nm:nm,s:s}); else low.push({k:k,nm:nm,s:s});
  });
  var mc=$("mapcols"); mc.innerHTML="";
  mc.appendChild(mapCol("f","Fortalezas","M20 6L9 17l-5-5",strong,"Aún no hay un área en este nivel — es hacia dónde puedes crecer."));
  mc.appendChild(mapCol("w","Áreas a fortalecer","M12 2v20",mid,"Sin áreas intermedias por ahora."));
  mc.appendChild(mapCol("p","Prioridad","M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z",low,"Sin áreas críticas — muy bien."));

  // 3 prioridades (menor score)
  var pr=orderedPriorities().slice(0,3);
  var pw=$("prios"); pw.innerHTML="";
  pr.forEach(function(k,i){ var nm=PILLARS.find(function(p){return p.key===k}).name;
    var d=document.createElement("div"); d.className="prio";
    d.innerHTML='<div class="pn">0'+(i+1)+'</div><div class="pc"><b>'+nm+'</b><p>'+PRIO_TEXT[k]+'</p></div>';
    pw.appendChild(d);
  });

  // insights cruzados
  paintInsights();

  // recomendación de mini app
  paintReco(pr[0]);

  // WhatsApp (sin cifras)
  var primer=(state.lead&&state.lead.nombre?state.lead.nombre.split(" ")[0]:"[tu nombre]");
  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+primer+".\\n\\nAcabo de completar el Diagnóstico de Salud Financiera.\\nMi Financial Score fue "+state.overall+"/100 y me aparecieron algunas áreas que me gustaría revisar contigo.\\n\\n¿Podemos verlo?";
  $("waBtn").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
  if(CONFIG.calendlyURL)$("calendlyBtn").style.display="flex";
}
function mapCol(cls,title,iconPath,arr,emptyTxt){
  var el=document.createElement("div"); el.className="mapcol "+cls;
  var h='<h4><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'+iconPath+'</svg> '+title+'</h4>';
  if(arr.length){ arr.sort(function(a,b){return b.s-a.s}); arr.forEach(function(x){
    var ic = cls==="f"?'M20 6L9 17l-5-5' : (cls==="w"?'M12 5v14M5 12h14':'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z');
    h+='<div class="maprow"><span class="mi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">'+ic+'</svg></span>'+x.nm+'<small>'+x.s+'</small></div>';
  }); }
  else { h+='<div style="font-size:13px;color:var(--muted-2)">'+emptyTxt+'</div>'; }
  el.innerHTML=h; return el;
}

/* Insights que cruzan pilares */
function paintInsights(){
  var out=[], a=state.ans, s=state.scores;
  // 1. ahorro alto + liquidez baja
  if(s.ahorro!==null && s.liquidez!==null && s.ahorro>=70 && s.liquidez<50)
    out.push("Tu capacidad de ahorro es buena, aunque tu <b>reserva de emergencia</b> todavía parece limitada. Fortalecerla protege ese buen hábito.");
  // 2. fondo emergencia < 3 meses
  if(a.liq_meses && a.liq_meses.v<=35)
    out.push("Tu fondo de emergencia hoy cubriría <b>menos de 3 meses</b> de gastos; llevarlo a 3–6 meses te daría mucho margen.");
  // 3. ahorra pero sin objetivos con número
  if(a.aho_pct && a.aho_pct.v>=60 && a.aho_obj && a.aho_obj.v<70)
    out.push("Ahorras de forma constante, pero <b>aún no tienes objetivos con fecha y monto</b>: ponerles número suele acelerar los resultados.");
  // 4. protección con póliza pero sin conocer monto
  if(a.pro_cob && a.pro_cob.labels && a.pro_cob.labels.indexOf("Seguro de vida")>=0 && a.pro_monto && a.pro_monto.v<65)
    out.push("Tienes cobertura de vida, pero <b>no sabes con precisión cuánto recibirían tus beneficiarios</b>. Vale la pena confirmarlo.");
  // 5. retiro aportando pero sin capital objetivo
  if(a.ret_prep && a.ret_prep.v>=60 && a.ret_capital && a.ret_capital.v<65)
    out.push("Ya estás preparando tu retiro, pero <b>todavía no conoces tu capital objetivo</b>; tenerlo claro te dice si vas al ritmo correcto.");
  // 6. deuda controlada
  if(s.deuda!==null && s.deuda>=75 && !(a.deu_pct&&a.deu_pct.noDebt))
    out.push("Tus deudas están dentro de un <b>rango controlado</b> y las conoces: esa es una base financiera saludable.");
  // 7. sin dependientes: no penalizar
  if(a.pro_deps && a.pro_deps.noDeps)
    out.push("Indicaste que no tienes dependientes económicos, así que tu diagnóstico <b>no penaliza</b> la falta de seguro de vida y ajusta la ponderación.");
  // 8. invierte pero sin revisar distribución
  if(a.pat_inv && a.pat_inv.v>=100 && a.pat_rev && a.pat_rev.v<50)
    out.push("Ya inviertes, pero <b>revisas poco cómo está distribuido</b> tu patrimonio; una revisión periódica ayuda a mantenerlo alineado.");
  // fallback si hay pocos
  if(out.length<3 && s.retiro!==null && s.retiro<60) out.push("Tu área de <b>Retiro</b> es de las que más se beneficia del tiempo: empezar a estructurarla hoy tiene un efecto grande a largo plazo.");
  if(out.length===0) out.push("Tus respuestas muestran un manejo financiero ordenado en general; el foco está en sostener y afinar detalles.");

  var w=$("insights"); w.innerHTML="";
  out.slice(0,5).forEach(function(t,i){ var d=document.createElement("div"); d.className="insight"; d.style.animationDelay=(i*.08)+"s";
    d.innerHTML='<span class="ii"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span><p>'+t+'</p>'; w.appendChild(d); });
}

/* Recomendación de mini app según la principal brecha */
function paintReco(worstKey){
  var map={
    retiro:{url:CONFIG.urlRetiro, title:"Tu principal oportunidad está en Retiro", text:"Calcula cuánto necesitarías acumular y a qué ritmo, con una herramienta dedicada.", cta:"Calcular mi Brecha de Retiro →"},
    liquidez:{url:CONFIG.urlEmergencia, title:"Tu principal oportunidad está en Liquidez", text:"Define de forma concreta el fondo de emergencia que te daría tranquilidad.", cta:"Calcular mi Fondo de Emergencia →"},
    proteccion:{url:CONFIG.urlProteccion, title:"Tu principal oportunidad está en Protección", text:"Revisa qué tan preparada está tu familia ante un imprevisto.", cta:"Diagnóstico de Protección Familiar →"},
    patrimonio:{url:CONFIG.urlUniversidad, title:"Una meta que vale la pena planear", text:"Si tienes hijos, calcula cuánto necesitarás para su universidad y qué preparar desde hoy.", cta:"Calcular una Meta Universitaria →"}
  };
  var r=map[worstKey];
  if(r && r.url){
    $("recoTitle").textContent=r.title; $("recoText").textContent=r.text;
    $("recoBtn").textContent=r.cta; $("recoBtn").href=r.url; $("recoBox").style.display="block";
  } else { $("recoBox").style.display="none"; }
}

function animateResult(){
  var r=90, circ=2*Math.PI*r, arc=$("ringArc");
  arc.style.strokeDasharray=circ; arc.style.strokeDashoffset=circ;
  requestAnimationFrame(function(){ arc.style.transition="stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)"; arc.style.strokeDashoffset=circ*(1-_ringTarget/100); });
  var t0=performance.now();
  (function tick(t){ var p=Math.min(1,(t-t0)/1200); $("scoreNum").textContent=Math.round(_ringTarget*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(tick); })(t0);
  requestAnimationFrame(function(){ document.querySelectorAll('#pbars .fill').forEach(function(f){ f.style.width=f.dataset.w+"%"; }); });
}

/* ===================== Compartir / reiniciar ===================== */
function shareDiagnostic(){
  track('diagnostic_shared');
  var url=location.origin+location.pathname+"?ref="+encodeURIComponent(CONFIG.agenteID);
  var data={title:"Diagnóstico de Salud Financiera", text:"Calculé mi Financial Score en 3 minutos. Mira el tuyo:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard && navigator.clipboard.writeText(url); toast(); }
}
var toastT; function toast(){ var el=$("toast"); el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1300); }
function restart(){
  state={ ans:{}, pos:0, lead:null, scores:{}, overall:0 };
  document.querySelectorAll('.ac').forEach(function(c){ c.classList.remove('on'); });
  show('intro'); $("gprogWrap").style.display="none";
  location.href=location.origin+location.pathname+(window._referidoPor?("?ref="+encodeURIComponent(window._referidoPor)):"");
}

document.getElementById('btnStart').addEventListener('click', startDiagnostic);
document.getElementById('qBack').addEventListener('click', prevQuestion);
document.getElementById('qNext').addEventListener('click', nextQuestion);
document.getElementById('revealBtn').addEventListener('click', function(){ revealResult(); });
document.getElementById('skipLeadBtn').addEventListener('click', function(){ revealResult(true); });
document.getElementById('recoBtn').addEventListener('click', function(){ track('related_tool_clicked'); });
document.getElementById('waBtn').addEventListener('click', function(){ track('whatsapp_clicked'); });
document.getElementById('calendlyBtn').addEventListener('click', function(){ track('calendly_clicked'); });
document.getElementById('shareBtn').addEventListener('click', shareDiagnostic);
document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('fab').addEventListener('click', function(){ track('whatsapp_clicked'); });
`;
