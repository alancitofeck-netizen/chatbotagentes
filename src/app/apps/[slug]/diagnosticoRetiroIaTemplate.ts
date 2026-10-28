/** Plantilla verbatim de "Diagnóstico de Retiro con IA" (archivo original
 * del usuario, diagnostico-retiro-sujey.html) partida en 3 constantes
 * exportadas, mismo patrón que ahorroFiscalTemplate.ts/metaUniversitariaTemplate.ts.
 * Únicas diferencias respecto del original, dentro de DIAGNOSTICO_RETIRO_IA_LOGIC_JS:
 * 1. `CONFIG` ya no es un objeto hardcodeado con la foto embebida en base64
 *    — se reconstruye desde `window.__DIAGNOSTICO_RETIRO_IA_DATA__`, inyectado
 *    por DiagnosticoRetiroIaApp.tsx a partir de `config.brand` (mismo patrón
 *    que AhorroFiscalApp/MetaUniversitariaApp). La foto se sube a Storage
 *    aparte y se referencia por URL, no inline.
 * 2. Se agrega un fetch fire-and-forget a `/api/public/mini-apps/{slug}/visit`
 *    al cargar, igual que el resto de las plantillas, para que el conteo de
 *    visitas de Analíticas funcione también acá.
 * 3. `revealResult()` gana un POST a `/api/public/mini-apps/{slug}/hosted-lead`
 *    (además del `sendLeadToCRM`/webhookURL original, que se deja intacto)
 *    con todos los campos de `buildLead()` ya armados — así el lead queda
 *    registrado en el CRM de Growth Link. Sin recómputo autoritativo
 *    server-side (ingest.ts no tiene un branch para este template_key):
 *    se confió en el score/respuestas que ya arma el motor cliente, mismo
 *    criterio que Kit Emergencia/Test de Emergencia para mantener esta
 *    plantilla como una copia aislada y rápida, sin tocar el motor
 *    compartido de "Diagnóstico Financiero - Retiro". */
export const DIAGNOSTICO_RETIRO_IA_CSS = `
  :root{
    --ink:#F5EFE1; --ink-soft:#D7CBAE;
    --accent:#C9A864; --accent-d:#8F6F39; --accent-2:#E7D29B;   /* dorado premium (configurable) */
    --gold:#C2825A; --pos:#5FB08D; --warn:#CC7A3D;
    --paper:#15304F; --bg-1:#0B2544; --bg-2:#071B32; --bone:#102A49;
    --muted:#AAB9CE; --muted-2:#7C90A8; --line:rgba(231,210,155,.16); --line-2:rgba(231,210,155,.09);
    --danger:#E2805C;
    --shadow-card:0 24px 54px -26px rgba(0,0,0,.6);
    --shadow-soft:0 10px 26px -12px rgba(0,0,0,.5);
    --shadow-btn:0 16px 30px -12px rgba(201,168,100,.45);
    --f:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
    --f-d:'Fraunces',Georgia,serif;
    --f-m:'IBM Plex Mono','SFMono-Regular',Consolas,monospace;
    --r:14px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{
    font-family:var(--f);color:var(--ink);line-height:1.6;min-height:100vh;
    padding:0 0 calc(30px + env(safe-area-inset-bottom));
    background:
      radial-gradient(820px 420px at 100% -6%, rgba(201,168,100,.16), transparent 55%),
      radial-gradient(760px 400px at 0% 10%, rgba(194,130,90,.13), transparent 52%),
      linear-gradient(168deg,var(--bg-1),var(--bg-2));
    background-attachment:fixed;
  }
  .topbar{position:sticky;top:0;z-index:30;background:rgba(7,27,50,.84);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .topbar .in{max-width:520px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:12px}
  .agent{display:flex;align-items:center;gap:11px;min-width:0}
  .agent .ava{width:40px;height:40px;border-radius:9px;flex:0 0 auto;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:var(--bg-2);display:grid;place-items:center;font-family:var(--f-d);font-weight:600;font-size:15px;overflow:hidden}
  .agent .ava img{width:100%;height:100%;object-fit:cover}
  .agent .who{min-width:0;line-height:1.25}
  .agent .who b{font-size:13.5px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent .who span{font-size:11.5px;color:var(--muted)}
  .kit-name{margin-left:auto;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:600;text-align:right;white-space:nowrap}

  .gprog{max-width:520px;margin:0 auto;padding:0 18px 11px}
  .gprog .track{height:3px;background:var(--line);border-radius:2px;overflow:hidden;margin-top:11px}
  .gprog .track>i{display:block;height:100%;width:0;border-radius:2px;background:linear-gradient(90deg,var(--accent-d),var(--accent));transition:width .5s cubic-bezier(.22,1,.36,1)}

  .wrap{width:100%;max-width:520px;margin:0 auto;padding:22px 18px}

  .eyebrow{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-2);font-weight:600;margin-bottom:14px;display:inline-flex;align-items:center;gap:8px;font-family:var(--f-m)}
  .eyebrow::before{content:"";width:20px;height:1px;background:var(--gold)}
  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(28px,7.2vw,38px);line-height:1.12;letter-spacing:-.01em;margin-bottom:15px}
  h1 em{font-style:italic;color:var(--accent-2)}
  h2{font-family:var(--f-d);font-weight:600;font-size:25px;line-height:1.18;letter-spacing:-.005em;margin-bottom:8px}
  .sec-sub{font-size:14.5px;color:var(--muted);margin-bottom:22px;line-height:1.55}
  .lede{font-size:15.5px;color:var(--muted);margin-bottom:24px}

  .btn{font-family:var(--f);font-size:15px;font-weight:600;width:100%;padding:16px 20px;border:none;border-radius:var(--r);cursor:pointer;
    background:linear-gradient(145deg,var(--accent),var(--accent-d));color:var(--bg-2);transition:transform .14s,box-shadow .25s,opacity .2s;
    display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:var(--shadow-btn);letter-spacing:.01em}
  .btn:hover{transform:translateY(-1px)} .btn:active{transform:scale(.986)}
  .btn.wide{max-width:360px;margin-left:auto;margin-right:auto}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:rgba(255,255,255,.04)}
  .btn.wa{background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;box-shadow:0 14px 26px -12px rgba(37,211,102,.5)}
  .btn.gold{background:linear-gradient(145deg,var(--gold),#9A5E3C);color:#fff;box-shadow:0 14px 26px -12px rgba(194,130,90,.5)}
  .btn.dark{background:linear-gradient(145deg,#0A1A2E,#050D18);color:var(--ink);box-shadow:0 14px 26px -12px rgba(0,0,0,.6);border:1px solid var(--line)}
  .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}
  .stepnav{display:flex;gap:12px;margin-top:22px}
  .stepnav .btn{flex:1}

  .pillars-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0 26px}
  .pgi{display:flex;align-items:center;gap:11px;padding:13px 14px;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-soft)}
  .pgi .pgc{width:32px;height:32px;flex:0 0 auto;border-radius:8px;background:rgba(201,168,100,.14);color:var(--accent);display:grid;place-items:center}
  .pgi b{font-size:13.5px;font-weight:700}

  .privacy-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
  .privacy-note svg{flex:0 0 auto;color:var(--accent);margin-top:1px}

  /* cabecera de pregunta */
  .pill-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .pill-head .pnum{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-family:var(--f-m)}
  .pill-head .pname{font-family:var(--f-d);font-size:20px;font-weight:600}
  .pill-dots{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;max-width:160px;justify-content:flex-end}
  .pill-dots i{width:6px;height:6px;border-radius:50%;background:var(--line)}
  .pill-dots i.on{background:var(--accent)}

  .qtitle{font-family:var(--f-d);font-size:clamp(20px,5.2vw,25px);font-weight:600;line-height:1.24;letter-spacing:-.005em;margin-bottom:6px}
  .qsub{font-size:13px;color:var(--muted);margin-bottom:20px}

  .opts{display:flex;flex-direction:column;gap:10px;margin-bottom:8px}
  .opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;cursor:pointer;background:var(--paper);border:1.5px solid var(--line);border-radius:12px;padding:15px 16px;box-shadow:var(--shadow-soft);transition:.16s;font-family:var(--f)}
  .opt:hover{border-color:rgba(201,168,100,.4)}
  .opt.sel{border-color:var(--accent);box-shadow:0 12px 26px -12px rgba(201,168,100,.35)}
  .opt .mk{width:20px;height:20px;flex:0 0 auto;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;transition:.16s}
  .opt.sel .mk{border-color:var(--accent);background:var(--accent)}
  .opt.sel .mk::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--bg-2)}
  .opt .otxt{font-size:14.5px;font-weight:500;color:var(--ink)}

  .multi-hint{font-size:12px;color:var(--muted-2);margin-bottom:14px}
  .nav-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px}
  .nav-back{background:none;border:none;font-family:var(--f);font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:8px 2px}
  .nav-back:hover{color:var(--ink)}
  .nav-next{font-family:var(--f);font-size:14.5px;font-weight:600;color:var(--bg-2);border:none;cursor:pointer;background:linear-gradient(145deg,var(--accent),var(--accent-d));padding:13px 24px;border-radius:11px;box-shadow:var(--shadow-btn);transition:.15s;display:inline-flex;gap:7px;align-items:center}
  .nav-next:hover{transform:translateY(-1px)}
  .nav-next[disabled]{background:rgba(255,255,255,.07);color:var(--muted-2);box-shadow:none;cursor:not-allowed;transform:none}

  /* análisis */
  .analyze{text-align:center;padding:40px 10px}
  .orb{width:84px;height:84px;margin:0 auto 28px;position:relative}
  .orb .ring{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:var(--accent);border-right-color:var(--accent-2);animation:spin 1s linear infinite}
  .orb .core{position:absolute;inset:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--accent-2),var(--accent-d));box-shadow:0 0 34px rgba(201,168,100,.4)}
  @keyframes spin{to{transform:rotate(360deg)}}
  .analyze h2{margin-bottom:24px}
  .achecks{display:flex;flex-direction:column;gap:12px;max-width:260px;margin:0 auto;text-align:left}
  .ac{display:flex;align-items:center;gap:12px;font-size:14px;color:var(--muted-2);font-weight:500;opacity:.4;transform:translateY(5px);transition:.4s}
  .ac.on{opacity:1;transform:none;color:var(--ink);font-weight:600}
  .ac .cb{width:22px;height:22px;flex:0 0 auto;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;transition:.3s}
  .ac.on .cb{background:var(--pos);border-color:var(--pos)}
  .ac .cb svg{opacity:0} .ac.on .cb svg{opacity:1}

  /* teaser / gate */
  .teaser{position:relative;border-radius:16px;overflow:hidden;margin-bottom:22px;box-shadow:var(--shadow-soft)}
  .teaser .blur{filter:blur(7px);opacity:.95;pointer-events:none;user-select:none;padding:26px;background:linear-gradient(160deg,var(--accent),var(--accent-d));text-align:center;color:var(--bg-2)}
  .teaser .blur .tl{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(7,27,50,.65);font-weight:700;font-family:var(--f-m)}
  .teaser .blur .tn{font-family:var(--f-m);font-size:54px;font-weight:700;line-height:1;margin:6px 0}
  .teaser .lock{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(11,37,68,.18),rgba(7,27,50,.86))}
  .teaser .lock span{background:var(--paper);border:1px solid var(--line);padding:10px 16px;border-radius:20px;font-size:13px;font-weight:700;box-shadow:var(--shadow-soft)}
  .field{margin-bottom:15px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:7px}
  .field label .opt{font-weight:400;color:var(--muted-2);font-size:12px}
  .field input{width:100%;font-family:var(--f);font-size:16px;padding:14px 15px;border:1.5px solid var(--line);border-radius:11px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input::placeholder{color:var(--muted-2)}
  .field input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(201,168,100,.14)}
  .consent{display:flex;gap:11px;align-items:flex-start;margin:6px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.5}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
  .consent a{color:var(--accent-2);text-decoration:underline}

  /* score */
  .score-hero{text-align:center;padding:6px 4px 0}
  .ring-wrap{position:relative;width:208px;height:208px;margin:8px auto 4px}
  .ring-wrap svg{transform:rotate(-90deg);overflow:visible}
  .ring-wrap .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ring-wrap .c b{font-family:var(--f-m);font-size:56px;font-weight:700;line-height:1;letter-spacing:-.01em;color:var(--ink)}
  .ring-wrap .c i{font-style:normal;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted-2);margin-top:4px;font-family:var(--f-m)}
  .band-pill{display:inline-block;font-size:14px;font-weight:600;padding:8px 22px;border-radius:20px;margin:14px 0 8px;background:rgba(201,168,100,.14);color:var(--accent-2);border:1px solid rgba(201,168,100,.3)}
  .score-desc{font-size:15px;color:var(--ink-soft);max-width:420px;margin:6px auto 0;line-height:1.55}

  .section-title{font-family:var(--f-d);font-size:20px;font-weight:600;margin:30px 0 4px}
  .section-sub{font-size:13px;color:var(--muted);margin-bottom:18px}

  /* barras áreas */
  .pbar{margin-bottom:15px}
  .pbar .pt{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
  .pbar .pt b{font-size:14px;font-weight:700}
  .pbar .pt .v{font-family:var(--f-m);font-size:13.5px;font-weight:600;color:var(--muted)}
  .pbar .pt .na{font-size:11px;color:var(--muted-2);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .pbar .track{height:8px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden;border:1px solid var(--line)}
  .pbar .fill{height:100%;width:0;border-radius:5px;transition:width 1s cubic-bezier(.22,1,.36,1)}
  .fill.s-hi{background:linear-gradient(90deg,#3D8A6E,var(--pos))}
  .fill.s-mid{background:linear-gradient(90deg,var(--accent-d),var(--accent))}
  .fill.s-lo{background:linear-gradient(90deg,#A8563A,var(--danger))}

  /* números concretos ($) */
  .numbers{display:flex;flex-direction:column;gap:12px;margin-top:6px}
  .numrow{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:17px 18px;box-shadow:var(--shadow-soft);display:flex;gap:14px;align-items:flex-start}
  .numrow .nic{width:34px;height:34px;flex:0 0 auto;border-radius:9px;background:rgba(201,168,100,.14);color:var(--accent);display:grid;place-items:center}
  .numrow .nt b{font-size:13.5px;font-weight:700;display:block;margin-bottom:5px}
  .numrow .nt .nv{font-family:var(--f-m);font-size:20px;font-weight:700;color:var(--accent-2);margin-bottom:5px;letter-spacing:-.01em}
  .numrow .nt p{font-size:13px;color:var(--muted);line-height:1.5}
  .numbers-note{font-size:11.5px;color:var(--muted-2);line-height:1.5;margin-top:10px;padding:0 2px}

  /* escenarios */
  .scen{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:17px 18px;margin-bottom:12px;box-shadow:var(--shadow-soft)}
  .scen .sh{display:flex;align-items:center;gap:12px;margin-bottom:9px}
  .scen .sic{width:36px;height:36px;flex:0 0 auto;border-radius:9px;background:rgba(201,168,100,.14);color:var(--accent);display:grid;place-items:center}
  .scen .st{font-size:14.5px;font-weight:700;letter-spacing:.01em}
  .scen .sq{font-size:12.5px;color:var(--muted)}
  .scen .verdict{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;padding:7px 13px;border-radius:9px;margin-top:2px}
  .verdict.ok{background:rgba(95,176,141,.16);color:var(--pos)}
  .verdict.mid{background:rgba(201,168,100,.18);color:var(--accent-2)}
  .verdict.low{background:rgba(226,128,92,.16);color:var(--danger)}
  .scen p.sr{font-size:13px;color:var(--ink-soft);line-height:1.55;margin-top:9px}

  /* mapa */
  .mapcols{display:flex;flex-direction:column;gap:14px;margin-top:6px}
  .mapcol{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow-soft)}
  .mapcol h4{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .mapcol.f h4{color:var(--pos)} .mapcol.w h4{color:var(--gold)} .mapcol.p h4{color:var(--danger)}
  .maprow{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;padding:5px 0}
  .maprow .mi{width:20px;height:20px;flex:0 0 auto;border-radius:6px;display:grid;place-items:center}
  .mapcol.f .mi{background:rgba(95,176,141,.16);color:var(--pos)}
  .mapcol.w .mi{background:rgba(194,130,90,.18);color:var(--gold)}
  .mapcol.p .mi{background:rgba(226,128,92,.16);color:var(--danger)}
  .maprow small{margin-left:auto;font-family:var(--f-m);font-weight:600;color:var(--muted);font-size:12.5px}

  /* prioridades */
  .prio{display:flex;gap:15px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:var(--shadow-soft)}
  .prio .pn{font-family:var(--f-m);font-size:24px;font-weight:700;color:var(--accent-2);line-height:1;flex:0 0 auto;width:34px}
  .prio .pc b{font-size:14px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;display:block;margin-bottom:4px}
  .prio .pc p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}

  /* insights */
  .insight{display:flex;gap:12px;align-items:flex-start;background:var(--bone);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:11px;animation:rise .5s both}
  .insight .ii{width:28px;height:28px;flex:0 0 auto;border-radius:8px;background:rgba(201,168,100,.14);color:var(--accent);display:grid;place-items:center}
  .insight p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}
  .insight p b{color:var(--accent-2);font-weight:700}

  /* wow siguiente nivel */
  .nextlvl{background:linear-gradient(150deg,var(--accent),var(--accent-d));color:var(--bg-2);border-radius:16px;padding:24px;text-align:center;margin:26px 0;box-shadow:0 20px 44px -22px rgba(201,168,100,.6)}
  .nextlvl .nl-row{display:flex;align-items:center;justify-content:center;gap:20px;margin:4px 0 12px}
  .nextlvl .nl-b{text-align:center}
  .nextlvl .nl-b .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;font-weight:700}
  .nextlvl .nl-b .v{font-family:var(--f-m);font-size:40px;font-weight:700;line-height:1}
  .nextlvl .nl-ar{opacity:.65}
  .nextlvl p{font-size:13.5px;opacity:.92;line-height:1.55;max-width:400px;margin:0 auto}

  /* recomendada / share / cta */
  .reco{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:20px;margin:22px 0;box-shadow:var(--shadow-soft);text-align:center}
  .reco .rl{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px}
  .reco h3{font-family:var(--f-d);font-size:19px;font-weight:600;margin-bottom:6px}
  .reco p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .review-card{background:linear-gradient(150deg,var(--bone),var(--bg-2));border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:22px 0 14px;display:flex;gap:13px;align-items:center}
  .review-card .rc{width:42px;height:42px;border-radius:10px;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:var(--bg-2);display:grid;place-items:center;flex:0 0 auto;font-family:var(--f-d);font-weight:600;overflow:hidden}
  .review-card .rc img{width:100%;height:100%;object-fit:cover}
  .review-card b{display:block;font-size:14.5px}
  .review-card small{font-size:12.5px;color:var(--muted)}
  .cta-head{text-align:center;margin:26px 0 4px}
  .cta-head h3{font-family:var(--f-d);font-size:21px;font-weight:600;line-height:1.2;margin-bottom:8px}
  .cta-head p{font-size:14px;color:var(--muted);line-height:1.55;max-width:420px;margin:0 auto}

  .sharecard{background:linear-gradient(160deg,#081A30,#050E1A);border:1px solid rgba(201,168,100,.22);color:var(--ink);border-radius:16px;padding:22px;text-align:center;margin:20px 0}
  .sharecard .sl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);font-weight:700;font-family:var(--f-m)}
  .sharecard .sv{font-family:var(--f-m);font-size:42px;font-weight:700;line-height:1;margin:6px 0}
  .sharecard .sb{font-size:14px;opacity:.9;margin-bottom:3px}
  .sharecard .sm{font-size:12px;opacity:.55}

  .share-band{text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 20px;margin:20px 0}
  .share-band h3{font-family:var(--f-d);font-size:18px;font-weight:600;margin-bottom:6px}
  .share-band p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .restart{background:none;border:none;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;margin:8px auto 0;display:block;font-family:var(--f)}
  .restart:hover{color:var(--ink)}
  .disclaimer{font-size:11px;color:var(--muted-2);line-height:1.55;padding:20px 4px 4px;text-align:center;max-width:460px;margin:0 auto}
  .foot{text-align:center;font-size:11.5px;color:var(--muted-2);margin-top:22px}
  .foot b{color:var(--muted);font-weight:700}

  .toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);background:var(--accent);color:var(--bg-2);font-size:13px;font-weight:700;padding:11px 20px;border-radius:30px;box-shadow:0 12px 30px -8px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:.3s;z-index:60}
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

export const DIAGNOSTICO_RETIRO_IA_BODY_HTML = `
<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">SU</div>
      <div class="who"><b id="agentName">Sujey Urías</b><span id="agentTitle">Asesora Patrimonial</span></div>
    </div>
    <div class="kit-name">Diagnóstico de Retiro</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none"><div class="track"><i id="gpbar"></i></div></div>

<div class="wrap">

  <!-- INTRO -->
  <div class="step on" data-step="intro">
    <div class="eyebrow">Diagnóstico de Retiro con IA · 3 min</div>
    <h1>¿Tu dinero de hoy te alcanzará <em>cuando dejes de trabajar</em>?</h1>
    <p class="lede">Nuestra IA analiza tus respuestas en 4 áreas clave de tu plan de retiro y te muestra, con números reales, qué tan preparado estás — y qué necesitarías hacer para llegar a tu meta.</p>
    <div class="pillars-grid" id="pillarsGrid"></div>
    <button class="btn wide" onclick="startDiagnostic()">Descubrir si me alcanza →</button>
    <div class="privacy-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Gratis, privado y sin necesidad de conectar tus cuentas bancarias.</span></div>
  </div>

  <!-- PREGUNTA (dinámica, flujo plano — cada pregunta puede aportar a varias áreas) -->
  <div class="step" data-step="question">
    <div class="pill-head">
      <div><div class="pnum" id="qPnum">Pregunta 1 de 8</div></div>
      <div class="pill-dots" id="qDots"></div>
    </div>
    <div class="qtitle" id="qTitle">…</div>
    <div class="qsub" id="qSub"></div>
    <div class="opts" id="qOpts"></div>
    <div class="nav-row">
      <button class="nav-back" id="qBack" onclick="prevQuestion()">← Atrás</button>
      <button class="nav-next" id="qNext" onclick="nextQuestion()" disabled>Siguiente →</button>
    </div>
  </div>

  <!-- ANÁLISIS -->
  <div class="step analyze" data-step="analyze">
    <div class="orb"><div class="ring"></div><div class="core"></div></div>
    <h2>Nuestra IA está analizando tu plan de retiro…</h2>
    <div class="achecks" id="achecks"></div>
  </div>

  <!-- GATE -->
  <div class="step" data-step="gate">
    <div style="text-align:center">
      <div class="eyebrow" style="justify-content:center">Tu Score de Retiro está listo</div>
      <h2 style="margin-bottom:9px">¿A dónde te lo enviamos?</h2>
      <p class="sec-sub" style="max-width:400px;margin:0 auto 22px">Déjanos dónde enviarte tu diagnóstico completo y poder revisarlo con tu asesora.</p>
    </div>
    <div class="teaser">
      <div class="blur"><div class="tl">Score de Retiro</div><div class="tn" id="teaserNum">7X</div><div style="font-size:13px;opacity:.7">4 áreas analizadas</div></div>
      <div class="lock"><span>🔒 Desbloquea tu diagnóstico completo</span></div>
    </div>
    <div class="field"><label>Nombre</label><input type="text" id="leadName" placeholder="Tu nombre"></div>
    <div class="field"><label>WhatsApp <span class="opt">(10 dígitos)</span></label><input type="tel" id="leadWa" inputmode="tel" placeholder="Ej. 5512345678"></div>
    <div class="field"><label>Correo <span class="opt">(opcional)</span></label><input type="email" id="leadEmail" placeholder="tucorreo@ejemplo.com"></div>
    <label class="consent"><input type="checkbox" id="leadConsent"><span>Acepto que <b id="cName">Sujey Urías</b> utilice mis datos para contactarme respecto de este diagnóstico, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label>
    <button class="btn" id="revealBtn" onclick="revealResult()">Ver mi diagnóstico completo →</button>
    <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:14px">También puedes <button class="restart" style="display:inline;color:var(--accent-d)" onclick="revealResult(true)">continuar sin dejar datos</button></p>
  </div>

  <!-- RESULTADO -->
  <div class="step" data-step="result">
    <div class="score-hero">
      <div class="eyebrow" style="justify-content:center">Tu Score de Retiro</div>
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

    <div class="section-title">Tus 4 áreas</div>
    <div class="section-sub">Cada área sobre 100, según tus respuestas.</div>
    <div id="pbars"></div>

    <div class="section-title">Tus números</div>
    <div class="section-sub">Tu diagnóstico, traducido a montos concretos.</div>
    <div class="numbers" id="numbers"></div>
    <div class="numbers-note" id="numbersNote"></div>

    <div class="section-title">Tu mapa de retiro</div>
    <div class="section-sub">Cómo se distribuyen tus áreas hoy.</div>
    <div class="mapcols" id="mapcols"></div>

    <div class="section-title">¿Cómo te iría ante estos 3 escenarios?</div>
    <div class="section-sub">Una forma concreta de ver lo que hoy significa tu puntaje.</div>
    <div id="scenarios"></div>

    <div class="section-title">Si mejoraras solamente 3 cosas…</div>
    <div class="section-sub">Tus áreas de mayor impacto ahora mismo.</div>
    <div id="prios"></div>

    <div class="section-title">Lo que notamos en tus respuestas</div>
    <div class="section-sub">Observaciones personalizadas de tu diagnóstico.</div>
    <div id="insights"></div>

    <div class="nextlvl">
      <div class="eyebrow" style="justify-content:center;color:rgba(7,27,50,.7)">Tu siguiente nivel de preparación</div>
      <div class="nl-row">
        <div class="nl-b"><div class="l">Hoy</div><div class="v" id="nlNow">72</div></div>
        <div class="nl-ar"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
        <div class="nl-b"><div class="l">Próximo objetivo</div><div class="v" id="nlNext">80+</div></div>
      </div>
      <p>No necesitas resolver todo al mismo tiempo. Cerrar primero tu brecha de mayor impacto puede cambiar significativamente tu punto de llegada.</p>
    </div>

    <div class="reco" id="recoBox" style="display:none">
      <div class="rl">Tu principal oportunidad</div>
      <h3 id="recoTitle"></h3>
      <p id="recoText"></p>
      <a class="btn gold wide" id="recoBtn" href="#" target="_blank" rel="noopener" onclick="track('related_tool_clicked')"></a>
    </div>

    <div class="cta-head">
      <h3>¿Quieres entender cómo cerrar esta brecha?</h3>
      <p>Tu asesora puede ayudarte a revisar tus prioridades y construir un plan concreto — con tu beneficio fiscal incluido.</p>
    </div>
    <div class="review-card">
      <div class="rc" id="revAva">SU</div>
      <div><b>Revisa tu diagnóstico con <span id="ctaAgent">Sujey</span></b><small id="ctaAgentRole">Asesora Patrimonial · sin costo</small></div>
    </div>
    <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener" onclick="track('whatsapp_clicked')">Revisar mi diagnóstico por WhatsApp</a>
    <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none" onclick="track('calendly_clicked')">Agendar una revisión →</a>

    <div class="sharecard">
      <div class="sl">Mi Score de Retiro</div>
      <div class="sv" id="shareScore">72</div>
      <div class="sb" id="shareBand">En camino</div>
      <div class="sm">4 áreas analizadas · Growth Link</div>
    </div>
    <div class="share-band">
      <h3>¿A quién más le serviría este diagnóstico de retiro?</h3>
      <p>Comparte este diagnóstico con alguien que también se pregunte si le alcanzará para retirarse.</p>
      <button class="btn gold wide" onclick="shareDiagnostic()">Compartir diagnóstico</button>
    </div>

    <button class="restart" onclick="restart()">↺ Volver a empezar</button>
    <div class="disclaimer">Este diagnóstico tiene fines educativos y se basa exclusivamente en las respuestas e ingreso aproximado proporcionados. No es una proyección actuarial ni una recomendación financiera, legal o fiscal personalizada: los montos asumen un gasto estimado del 70% de tu ingreso, la regla del 4% y un rendimiento real del 6% anual, y no consideran tu pensión IMSS/ISSSTE ni tu situación fiscal particular. Para una proyección y estrategia precisas, consulta con tu asesora.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Sujey Urías</b> · Growth Link</div>
</div>

<div class="toast" id="toast">Copiado</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener" onclick="track('whatsapp_clicked')">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesora</span>
</a>
`;

export const DIAGNOSTICO_RETIRO_IA_LOGIC_JS = `
/* ==================================================================
   ▓▓  CONFIG DEL AGENTE  ▓▓  ← Editá solo esto para replicar.
   ================================================================== */
var DRI_DATA = window.__DIAGNOSTICO_RETIRO_IA_DATA__ || {};
var DRI_SLUG = DRI_DATA.slug || '';
var DRI_BRAND = DRI_DATA.brand || {};
const CONFIG = {
  agente:      DRI_BRAND.agente || 'Asesor financiero',
  titulo:      DRI_BRAND.titulo || '',
  whatsapp:    DRI_BRAND.whatsapp || '',
  fotoURL:     DRI_BRAND.photoURL || '',
  agenteID:    DRI_BRAND.agenteID || '',
  colorMarca:  DRI_BRAND.colorMarca || '#0B2544',
  calendlyURL: DRI_BRAND.calendlyURL || '',
  avisoPrivacidadURL: DRI_BRAND.avisoPrivacidadURL || '',
  webhookURL:  DRI_BRAND.webhookURL || '',
  urlCalculadoraRetiro: DRI_BRAND.urlCalculadoraRetiro || '',
  urlSaludFinanciera:   DRI_BRAND.urlSaludFinanciera || ''
};

/* ==================================================================
   ÁREAS · topes de puntos por área (igual que en la plantilla de
   referencia: suma de puntos de cada pregunta / tope del área × 100)
   ================================================================== */
const AREA_MAX = { retiro:75, ahorro:75, fiscal:50, proteccion:50 };
const AREA_META = {
  retiro:     { name:"Retiro",           icon:'<path d="M12 2a5 5 0 015 5c0 2-1 3-1 5h-8c0-2-1-3-1-5a5 5 0 015-5zM8 17h8M9 21h6"/>' },
  ahorro:     { name:"Ahorro",           icon:'<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>' },
  proteccion: { name:"Protección",       icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  fiscal:     { name:"Beneficio Fiscal", icon:'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M17 7L7 17"/>' }
};

/* ==================================================================
   PREGUNTAS · flujo plano (no agrupado por área, porque cada
   pregunta puede aportar puntos a más de un área a la vez — igual
   que en la plantilla de referencia). "points" sube el score del
   área; campos extra (mid/monto/years) alimentan los cálculos en $.
   ================================================================== */
const QUESTIONS = [
  { id:"q_edad", q:"¿En qué rango de edad estás?",
    opts:[
      {t:"18 a 30 años", points:{retiro:25}},
      {t:"31 a 40 años", points:{retiro:19}},
      {t:"41 a 50 años", points:{retiro:11}},
      {t:"51 años o más", points:{retiro:4}}
    ]},
  { id:"q_ingreso", q:"¿Cuál es tu ingreso mensual aproximado?",
    sub:"Solo por rangos, nunca pedimos datos bancarios. Nos sirve para traducir tu diagnóstico a montos concretos en pesos.",
    opts:[
      {t:"Menos de $30,000", points:{ahorro:5,fiscal:5}, mid:22000},
      {t:"$30,000 – $60,000", points:{ahorro:12,fiscal:12}, mid:45000},
      {t:"$60,000 – $120,000", points:{ahorro:19,fiscal:19}, mid:90000},
      {t:"$120,000 – $250,000", points:{ahorro:23,fiscal:23}, mid:185000},
      {t:"Más de $250,000", points:{ahorro:25,fiscal:25}, mid:300000}
    ]},
  { id:"q_plan", q:"Además de tu AFORE obligatoria, ¿ya tienes un plan de retiro propio?",
    opts:[
      {t:"No, solo tengo lo que aporta mi patrón al IMSS/ISSSTE", points:{retiro:2,fiscal:2,proteccion:2}},
      {t:"Ahorro por mi cuenta de vez en cuando, sin un plan fijo", points:{retiro:10,fiscal:8,proteccion:8}},
      {t:"Tengo un plan privado, pero no sé si es suficiente", points:{retiro:17,fiscal:16,proteccion:16}},
      {t:"Tengo un plan privado sólido y lo reviso cada año", points:{retiro:25,fiscal:25,proteccion:25}}
    ]},
  { id:"q_aportacion", q:"¿Cuánto puedes destinar hoy a tu retiro cada mes?",
    opts:[
      {t:"Nada, mis gastos absorben todo mi ingreso", points:{ahorro:2}, monto:0},
      {t:"Entre $500 y $2,000 pesos al mes", points:{ahorro:10}, monto:1250},
      {t:"Entre $2,000 y $8,000 pesos al mes", points:{ahorro:18}, monto:5000},
      {t:"Más de $8,000 pesos al mes", points:{ahorro:25}, monto:10000}
    ]},
  { id:"q_anios", q:"¿Cuántos años te faltan para retirarte?",
    opts:[
      {t:"Menos de 10 años", points:{retiro:6}, years:7},
      {t:"Entre 10 y 20 años", points:{retiro:14}, years:15},
      {t:"Entre 20 y 30 años", points:{retiro:21}, years:25},
      {t:"Más de 30 años", points:{retiro:25}, years:35}
    ]},
  { id:"q_proteccion", q:"Si algo imprevisto pasara (enfermedad grave, invalidez, fallecimiento), ¿qué tan protegido está hoy tu plan de retiro?",
    opts:[
      {t:"Nada protegido, no tengo ningún seguro", points:{proteccion:2}},
      {t:"Tengo alguna cobertura básica, por ejemplo del trabajo", points:{proteccion:11}},
      {t:"Tengo un seguro propio, pero no lo he revisado en años", points:{proteccion:18}},
      {t:"Tengo cobertura sólida y actualizada", points:{proteccion:25}}
    ]},
  { id:"q_riesgo", q:"Si tu ahorro pudiera crecer más a cambio de fluctuar en el corto plazo, ¿qué tan cómodo te sentirías?",
    opts:[
      {t:"Nada cómodo, prefiero certeza total aunque rinda menos", points:{ahorro:12}},
      {t:"Algo incómodo, prefiero un balance entre seguridad y crecimiento", points:{ahorro:19}},
      {t:"Cómodo, priorizo el crecimiento a largo plazo", points:{ahorro:25}},
      {t:"No estoy seguro, necesito que me orienten", points:{ahorro:14}}
    ]},
  { id:"q_objetivo", q:"¿Cuál es tu objetivo principal con tu retiro?",
    sub:"Esta pregunta no suma puntos — solo personaliza tus observaciones.",
    opts:[
      {t:"Mantener mi nivel de vida cuando deje de trabajar", points:{}, theme:"mantener"},
      {t:"Dejar un patrimonio protegido para mi familia", points:{}, theme:"patrimonio"},
      {t:"Pagar menos impuestos aprovechando las deducciones fiscales", points:{}, theme:"fiscal"},
      {t:"Tener liquidez disponible para proyectos personales", points:{}, theme:"liquidez"}
    ]}
];

const BANDS = [
  { min:70, name:"Optimizable",       desc:"Tu situación es sólida. En esta etapa, cada ajuste fino —fiscal, de protección, de eficiencia— tiene un impacto real en el resultado final." },
  { min:40, name:"En camino",         desc:"Ya tienes bases, pero todavía hay espacio para fortalecer tu plan antes de que el tiempo juegue en tu contra." },
  { min:0,  name:"Constructor inicial", desc:"Es un buen momento para empezar: mientras antes arranques, más tiempo tiene tu dinero para crecer." }
];

/* Textos por área y nivel (low <45 · mid <75 · high ≥75) */
const AREA_TEXT = {
  retiro:{
    low:"Hoy tu plan de retiro depende casi completamente de tu AFORE obligatoria. Empezar hoy con un Plan Personal de Retiro, aunque sea con una aportación modesta, le da a tu dinero años extra para crecer.",
    mid:"Ya diste el primer paso, pero conviene confirmar si tu plan actual realmente alcanza para el estilo de vida que quieres al retirarte. Vale la pena hacer una proyección con números reales.",
    high:"Tu plan de retiro está bien encaminado. En esta etapa, el foco pasa de “empezar” a “optimizar”: revisar rendimiento, comisiones y que sigas aprovechando el tiempo que te queda."
  },
  ahorro:{
    low:"Hoy es difícil destinar dinero al retiro porque el ingreso se va en el día a día. Antes de pensar en el monto ideal, conviene encontrar un margen —aunque sea pequeño— y volverlo constante.",
    mid:"Tienes capacidad de ahorro, pero probablemente no está sistematizada. Automatizar una aportación fija mensual evita que ese margen se diluya en gastos imprevistos.",
    high:"Tu capacidad de ahorro es sólida. El siguiente paso es asegurarte de que esté en el vehículo correcto: no solo guardado, sino creciendo con eficiencia fiscal."
  },
  fiscal:{
    low:"Probablemente no estás aprovechando la deducción fiscal del Art. 151 de la LISR para planes de retiro personales. Es un beneficio que hoy se está quedando sobre la mesa.",
    mid:"Ya aprovechas algo del beneficio fiscal disponible, pero probablemente no el máximo. Revisar tu aportación anual contra el tope deducible puede representarte ahorro fiscal adicional.",
    high:"Ya tienes instrumentos que generan beneficio fiscal. Vale la pena confirmar que aportas el máximo deducible cada año para no dejar beneficio sin usar."
  },
  proteccion:{
    low:"Hoy tu plan de retiro no está protegido: si algo imprevisto pasara, ese plan podría quedar interrumpido. Un plan con componente de protección blinda tu meta incluso si tú no puedes seguir aportando.",
    mid:"Tienes algo de cobertura, pero conviene revisar si sigue vigente y si realmente protege tu plan de retiro, no solo tu ingreso del día a día.",
    high:"Tu cobertura de protección está sólida. Solo confirma que esté alineada con tu plan de retiro actual, no con tu situación de hace unos años."
  }
};
function tier(score){ return score<45?"low":(score<75?"mid":"high"); }

const THEME_TEXT = {
  mantener:"Como tu prioridad es <b>mantener tu nivel de vida</b> al retirarte, el número que más importa no es cuánto ahorras, sino cuánto necesitarías recibir cada mes. Vale la pena calcular esa cifra en concreto.",
  patrimonio:"Como tu objetivo es <b>dejar un patrimonio protegido</b> para tu familia, un plan con componente de seguro de vida es especialmente relevante: además de crecer, protege ese patrimonio desde el primer día.",
  fiscal:"Como tu prioridad es <b>pagar menos impuestos</b>, el Art. 151 LISR es tu mejor aliado: cada peso que aportas a un plan de retiro personal certificado se puede deducir de tu declaración anual.",
  liquidez:"Como buscas <b>mantener liquidez</b> para proyectos personales, conviene estructurar tu plan en más de un instrumento: uno con disponibilidad y otro enfocado 100% al largo plazo."
};

/* ========================= Motor / estado ========================= */
function $(id){ return document.getElementById(id); }
function track(ev,data){ try{ console.log("[track]",ev,data||""); }catch(e){} }
function mxn(n){ return "$"+Math.round(n).toLocaleString("es-MX"); }

var state = { ans:{}, pos:0, lead:null, scores:{}, overall:0, theme:"mantener",
  ctx:{ ingresoMid:0, ingresoLabel:"", aportacionActual:0, years:20 } };

(function init(){
  /* Nota: en el tema oscuro navy+dorado de este diagnóstico, el dorado (--accent)
     es parte fija del diseño y ya NO se sobreescribe con CONFIG.colorMarca (que aquí
     representa el navy de marca, no el acento) — a diferencia del motor claro
     compartido con el Diagnóstico Financiero, donde colorMarca sí es el acento. */
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente; $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente; $("footAgent").textContent=CONFIG.agente;
  $("ctaAgent").textContent=CONFIG.agente.split(" ")[0]; $("ctaAgentRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.avisoPrivacidadURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){ var src=CONFIG.fotoURL||CONFIG.logoURL; $("agentAva").innerHTML='<img src="'+src+'" alt="">'; $("revAva").innerHTML='<img src="'+src+'" alt="">'; }
  else { $("agentAva").textContent=initials; $("revAva").textContent=initials; }
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre mi Diagnóstico de Retiro con IA.");
  if(CONFIG.calendlyURL) $("calendlyBtn").href=CONFIG.calendlyURL;
  // grid de áreas en portada
  var g=$("pillarsGrid");
  Object.keys(AREA_META).forEach(function(k){ var p=AREA_META[k]; var d=document.createElement("div"); d.className="pgi";
    d.innerHTML='<div class="pgc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+p.icon+'</svg></div><b>'+p.name+'</b>'; g.appendChild(d); });
  // achecks
  var ac=$("achecks");
  Object.keys(AREA_META).forEach(function(k){ var p=AREA_META[k]; var d=document.createElement("div"); d.className="ac";
    d.innerHTML='<span class="cb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span> '+p.name; ac.appendChild(d); });
  var ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref;
  track('diagnostic_started');
  fetch('/api/public/mini-apps/' + DRI_SLUG + '/visit', { method: 'POST', keepalive: true }).catch(function(){});
})();

function show(step){
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
}
function startDiagnostic(){ state.pos=0; renderQuestion(); show('question'); $("gprogWrap").style.display="block"; }

function progressPct(){ return Math.round((state.pos)/QUESTIONS.length*100); }

function renderQuestion(){
  var i=state.pos, q=QUESTIONS[i], total=QUESTIONS.length;
  $("qPnum").textContent="Pregunta "+(i+1)+" de "+total;
  $("qTitle").textContent=q.q;
  $("qSub").textContent=q.sub||"";
  $("qBack").style.visibility=(i===0)?"hidden":"visible";

  var dots=$("qDots"); dots.innerHTML="";
  for(var d=0; d<total; d++){ var el=document.createElement("i"); if(d<=i)el.className="on"; dots.appendChild(el); }

  var w=$("qOpts"); w.innerHTML="";
  var cur=state.ans[q.id];
  q.opts.forEach(function(o,oi){
    var b=document.createElement("button"); b.className="opt"+(cur&&cur.i===oi?" sel":"");
    b.innerHTML='<span class="mk"></span><span class="otxt">'+o.t+'</span>';
    b.onclick=function(){ selectOption(q,oi,o); };
    w.appendChild(b);
  });
  updateNext(q);
  $("gpbar").style.width=progressPct()+"%";
}
function selectOption(q,i,o){
  state.ans[q.id]={i:i,points:o.points||{},t:o.t,mid:o.mid,monto:o.monto,years:o.years,theme:o.theme};
  document.querySelectorAll('#qOpts .opt').forEach(function(x,idx){ x.classList.toggle('sel', idx===i); });
  updateNext(q);
  setTimeout(function(){ nextQuestion(); }, 240);
}
function updateNext(q){ var cur=state.ans[q.id]; $("qNext").disabled=!(cur&&cur.i!==undefined); }
function nextQuestion(){
  if($("qNext").disabled) return;
  if(state.pos<QUESTIONS.length-1){ state.pos++; renderQuestion(); }
  else { finishDiagnostic(); }
}
function prevQuestion(){ if(state.pos>0){ state.pos--; renderQuestion(); } }

/* ===================== SCORING ===================== */
function computeScores(){
  var sums={retiro:0,ahorro:0,fiscal:0,proteccion:0};
  var theme="mantener", ingresoMid=0, ingresoLabel="", aportacionActual=0, years=20;
  QUESTIONS.forEach(function(q){
    var a=state.ans[q.id]; if(!a) return;
    Object.keys(a.points||{}).forEach(function(k){ sums[k]+=a.points[k]; });
    if(a.theme) theme=a.theme;
    if(typeof a.mid==="number"){ ingresoMid=a.mid; ingresoLabel=a.t; }
    if(typeof a.monto==="number") aportacionActual=a.monto;
    if(typeof a.years==="number") years=a.years;
  });
  var scores={};
  Object.keys(AREA_MAX).forEach(function(k){ scores[k]=Math.max(0,Math.min(100,Math.round(sums[k]/AREA_MAX[k]*100))); });
  state.scores=scores;
  state.overall=Math.round((scores.retiro+scores.ahorro+scores.fiscal+scores.proteccion)/4);
  state.theme=theme;
  state.ctx={ ingresoMid:ingresoMid, ingresoLabel:ingresoLabel, aportacionActual:aportacionActual, years:years };
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
  return Object.keys(state.scores).sort(function(a,b){ return state.scores[a]-state.scores[b]; });
}
function buildLead(){
  var pr=orderedPriorities();
  var lead={
    agenteID:CONFIG.agenteID, recurso:"diagnostico-retiro-ia",
    nombre:(state.lead&&state.lead.nombre)||"", whatsapp:(state.lead&&state.lead.whatsapp)||"", email:(state.lead&&state.lead.email)||"",
    consentimiento:!!(state.lead&&state.lead.consent), timestamp:new Date().toISOString(), referidoPor:window._referidoPor||null,
    scoreRetiro:state.overall, perfil:bandFor(state.overall).name,
    scoreAreaRetiro:state.scores.retiro, scoreAreaAhorro:state.scores.ahorro,
    scoreAreaProteccion:state.scores.proteccion, scoreAreaFiscal:state.scores.fiscal,
    prioridad1:pr[0]||null, prioridad2:pr[1]||null, prioridad3:pr[2]||null,
    objetivoPrincipal:state.theme, ingresoRango:state.ctx.ingresoLabel||null, ingresoMid:state.ctx.ingresoMid||null,
    aniosParaRetiro:state.ctx.years||null, aportacionActualEstimada:state.ctx.aportacionActual||null
  };
  if(SEND_DETAILED_RESPONSES){ lead.respuestas = state.ans; }
  return lead;
}
var SEND_DETAILED_RESPONSES = true;
function sendLeadToCRM(lead){ if(!CONFIG.webhookURL)return; try{ fetch(CONFIG.webhookURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead),keepalive:true}); }catch(e){} }
function submitLeadToGrowthLink(lead){
  var nowIso = new Date().toISOString();
  var payload = {};
  for (var k in lead) { if (Object.prototype.hasOwnProperty.call(lead, k)) payload[k] = lead[k]; }
  payload.consentimiento = true;
  payload.consentimiento_fecha = nowIso;
  payload.fecha = nowIso;
  fetch('/api/public/mini-apps/' + DRI_SLUG + '/hosted-lead', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), keepalive:true }).catch(function(){});
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
    var lead=buildLead(); window._lead=lead; sendLeadToCRM(lead); submitLeadToGrowthLink(lead); track('lead_captured',{score:state.overall});
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
  var nextGoal = band.min>=90? 100 : (BANDS.filter(function(b){return b.min>state.overall}).slice(-1)[0]||{min:Math.min(100,state.overall+8)}).min;
  $("nlNow").textContent=state.overall; $("nlNext").textContent=(nextGoal>=100?"95+":nextGoal+"+");

  // barras por área
  var pb=$("pbars"); pb.innerHTML="";
  Object.keys(AREA_META).forEach(function(k){
    var p=AREA_META[k], s=state.scores[k];
    var row=document.createElement("div"); row.className="pbar";
    row.innerHTML='<div class="pt"><b>'+p.name+'</b><span class="v">'+s+'/100</span></div><div class="track"><div class="fill '+level(s)+'" data-w="'+s+'"></div></div>';
    pb.appendChild(row);
  });

  // tus números ($)
  computeNumbers();

  // mapa: fortalezas (>=70), fortalecer (45-69), prioridad (<45)
  var strong=[],mid=[],low=[];
  Object.keys(state.scores).forEach(function(k){ var s=state.scores[k];
    var nm=AREA_META[k].name;
    if(s>=70)strong.push({k:k,nm:nm,s:s}); else if(s>=45)mid.push({k:k,nm:nm,s:s}); else low.push({k:k,nm:nm,s:s});
  });
  var mc=$("mapcols"); mc.innerHTML="";
  mc.appendChild(mapCol("f","Fortalezas","M20 6L9 17l-5-5",strong,"Aún no hay un área en este nivel — es hacia dónde puedes crecer."));
  mc.appendChild(mapCol("w","Áreas a fortalecer","M12 2v20",mid,"Sin áreas intermedias por ahora."));
  mc.appendChild(mapCol("p","Prioridad","M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z",low,"Sin áreas críticas — muy bien."));

  // escenarios concretos
  paintScenarios();

  // 3 prioridades (menor score), con texto por tier
  var pr=orderedPriorities().slice(0,3);
  var pw=$("prios"); pw.innerHTML="";
  pr.forEach(function(k,i){ var nm=AREA_META[k].name, txt=AREA_TEXT[k][tier(state.scores[k])];
    var d=document.createElement("div"); d.className="prio";
    d.innerHTML='<div class="pn">0'+(i+1)+'</div><div class="pc"><b>'+nm+'</b><p>'+txt+'</p></div>';
    pw.appendChild(d);
  });

  // insights cruzados
  paintInsights();

  // recomendación de mini app / herramienta hermana
  paintReco(pr[0]);

  // WhatsApp (sin cifras)
  var primer=(state.lead&&state.lead.nombre?state.lead.nombre.split(" ")[0]:"[tu nombre]");
  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+primer+".\\n\\nAcabo de completar el Diagnóstico de Retiro con IA.\\nMi Score de Retiro fue "+state.overall+"/100 y me gustaría revisar contigo mi plan y la brecha que me mostró.\\n\\n¿Podemos verlo?";
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

/* ===================== Tus números ($) =====================
   Supuestos estándar de planeación (no son fórmulas de Sujey):
   - gasto mensual estimado al retiro ≈ 70% del ingreso actual
   - capital objetivo = regla del 4% → 25× el gasto anual
   - aportación mensual necesaria = anualidad para llegar a ese
     capital en los años que faltan, con 6% de rendimiento real anual
   - beneficio fiscal potencial (Art. 151 LISR fracción V) = el menor
     entre 10% del ingreso anual y 5 UMAs anuales (tope 2026, UMA
     oficial $117.31 diarios desde feb-2026 → ≈$213,973 anuales) */
function computeNumbers(){
  var w=$("numbers"); w.innerHTML="";
  var ingreso=state.ctx.ingresoMid;
  if(!ingreso){
    w.innerHTML='<div style="font-size:13px;color:var(--muted-2)">No pudimos estimar montos sin un rango de ingreso.</div>';
    $("numbersNote").textContent="";
    return;
  }
  var TOPE_UMA_ANUAL = 213973; // 5 UMAs anuales, valor UMA 2026 (vigente desde feb-2026)
  var gastoMensual = ingreso*0.70;
  var capitalObjetivo = gastoMensual*300; // ×12 meses ÷ 4% (regla del 4%)
  var years = state.ctx.years||20;
  var nMeses = Math.max(12, years*12);
  var rMensual = 0.06/12;
  var aportNecesaria = capitalObjetivo * rMensual / (Math.pow(1+rMensual, nMeses) - 1);
  var aportActual = state.ctx.aportacionActual||0;
  var topeFiscal = Math.min(ingreso*12*0.10, TOPE_UMA_ANUAL);

  addNumRow(w,'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',"Capital objetivo para tu retiro",
    mxn(capitalObjetivo),
    "Para sostener un gasto estimado de "+mxn(gastoMensual)+" al mes sin trabajar (regla del 4%, retiro autofinanciado — no incluye tu pensión IMSS/ISSSTE).");

  addNumRow(w,'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',"Aportación mensual necesaria",
    mxn(aportNecesaria),
    "Para llegar a esa meta en los próximos "+years+" años, asumiendo un rendimiento real de 6% anual.");

  var brecha = aportNecesaria - aportActual;
  addNumRow(w,'<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/>',"Tu aportación actual, estimada",
    mxn(aportActual),
    brecha>0 ? ("Según tu respuesta, te faltarían aproximadamente "+mxn(brecha)+" al mes para llegar a la aportación necesaria.") : "Según tu respuesta, tu aportación actual ya está en línea con la meta calculada.");

  addNumRow(w,'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M17 7L7 17"/>',"Beneficio fiscal potencial (Art. 151 LISR)",
    mxn(topeFiscal)+" al año",
    "Lo menor entre 10% de tu ingreso anual o el tope de 5 UMAs ("+mxn(TOPE_UMA_ANUAL)+" en 2026) — deducible de tu declaración anual si aportas a un plan personal de retiro certificado.");

  $("numbersNote").textContent="Estimaciones educativas con supuestos estándar de planeación (gasto ≈70% del ingreso, regla del 4%, rendimiento real 6% anual). No son una proyección actuarial ni consideran tu pensión IMSS/ISSSTE ni tu situación fiscal particular — confírmalas con tu asesora.";
}
function addNumRow(w,icon,title,value,desc){
  var d=document.createElement("div"); d.className="numrow";
  d.innerHTML='<div class="nic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon+'</svg></div><div class="nt"><b>'+title+'</b><div class="nv">'+value+'</div><p>'+desc+'</p></div>';
  w.appendChild(d);
}

/* ===================== Escenarios concretos ===================== */
function paintScenarios(){
  var s=state.scores, w=$("scenarios");
  w.innerHTML="";

  var s1=s.retiro;
  addScenario(w,'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',"Retirarte solo con tu AFORE","Sin un plan complementario, dependiendo únicamente de tu pensión obligatoria.",
    s1>=65 ? ["ok","Vas en buen camino para complementarla","Según tus respuestas, ya tienes una estrategia adicional que reduce tu dependencia de la pensión obligatoria."]
    : s1>=40 ? ["mid","Tendrías una base, pero probablemente no sería suficiente","Para la mayoría de los trabajadores en México, la pensión del IMSS/ISSSTE cubre solo una parte del último sueldo — hoy tienes algo construido, pero vale la pena reforzarlo."]
    : ["low","Dependerías casi completamente de ella","Según tus respuestas, hoy no tienes un plan complementario — y la pensión obligatoria rara vez alcanza para mantener el mismo nivel de vida."]);

  var s2=s.ahorro;
  addScenario(w,'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',"Mantener tu ritmo actual de ahorro","Si sigues aportando exactamente como hoy, sin ajustes.",
    s2>=65 ? ["ok","Tu ritmo actual te acerca a tu meta","Según tus respuestas, tu aportación actual está relativamente alineada con lo que necesitarías."]
    : s2>=40 ? ["mid","Tu ritmo actual te dejaría a medio camino","Según tus respuestas, seguir así construye algo, pero probablemente no alcance la meta que calculamos arriba."]
    : ["low","Tu ritmo actual difícilmente alcanzaría la meta","Según tus respuestas, al ritmo de hoy el capital objetivo quedaría lejos de tu alcance — pequeños ajustes ahora tienen un efecto grande."]);

  var s3=s.fiscal;
  addScenario(w,'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M17 7L7 17"/>',"Aprovechar el beneficio fiscal cada año","Usar al máximo la deducción del Art. 151 LISR en tu declaración anual.",
    s3>=65 ? ["ok","Ya lo estás aprovechando bien","Según tus respuestas, ya tienes instrumentos que te dan beneficio fiscal — solo confirma que aportas el máximo deducible cada año."]
    : s3>=40 ? ["mid","Lo aprovechas parcialmente","Según tus respuestas, ya tienes algo de beneficio fiscal, pero probablemente no el máximo disponible."]
    : ["low","Hoy no lo estás aprovechando","Según tus respuestas, este beneficio fiscal está disponible y hoy se está quedando sobre la mesa."]);
}
function addScenario(w,icon,title,quote,verdict){
  var d=document.createElement("div"); d.className="scen";
  d.innerHTML='<div class="sh"><div class="sic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+icon+'</svg></div><div><div class="st">'+title+'</div><div class="sq">'+quote+'</div></div></div>'+
    '<div class="verdict '+verdict[0]+'">'+verdict[1]+'</div><p class="sr">'+verdict[2]+'</p>';
  w.appendChild(d);
}

/* ===================== Insights que cruzan áreas ===================== */
function paintInsights(){
  var out=[], a=state.ans, s=state.scores;
  // 1. siempre: insight de objetivo/tema
  out.push(THEME_TEXT[state.theme]);
  // 2. pocos años + score de retiro bajo → urgencia
  if(a.q_anios && a.q_anios.i<=1 && s.retiro<45)
    out.push("Te faltan pocos años para retirarte y tu puntaje de <b>Retiro</b> aún es bajo — este es el momento de tomar decisiones, no de esperar más.");
  // 3. ahorra bien pero no aprovecha lo fiscal
  if(s.ahorro>=70 && s.fiscal<50)
    out.push("Tu capacidad de ahorro es buena, pero probablemente <b>no estás aprovechando el beneficio fiscal</b> disponible por esas mismas aportaciones.");
  // 4. construye retiro pero sin protegerlo
  if(s.retiro>=60 && s.proteccion<45)
    out.push("Ya construyes tu plan de retiro, pero hoy <b>no está protegido</b> ante un imprevisto — eso podría interrumpir años de esfuerzo.");
  // 5. incertidumbre sobre el riesgo
  if(a.q_riesgo && a.q_riesgo.i===3)
    out.push("No estás seguro de cuánto riesgo tomar con tu ahorro — <b>definir esto con tu asesora</b> suele ser el primer paso antes de elegir instrumento.");
  // 6. las 4 áreas sólidas
  if(s.retiro>=70 && s.ahorro>=70 && s.proteccion>=70 && s.fiscal>=70)
    out.push("Tus 4 áreas están en un nivel sólido — en esta etapa, cada ajuste fino tiene un impacto real en el resultado final.");
  // fallback
  if(out.length<2) out.push("Construir un plan de retiro es más sobre consistencia que sobre el monto exacto — empezar hoy, aunque sea con poco, cambia el resultado final.");

  var w=$("insights"); w.innerHTML="";
  out.slice(0,5).forEach(function(t,i){ var d=document.createElement("div"); d.className="insight"; d.style.animationDelay=(i*.08)+"s";
    d.innerHTML='<span class="ii"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span><p>'+t+'</p>'; w.appendChild(d); });
}

/* Recomendación de herramienta hermana según la principal brecha */
function paintReco(worstKey){
  var map={
    retiro:     {url:CONFIG.urlCalculadoraRetiro, title:"Profundiza tu plan de retiro", text:"Calcula una proyección completa de tu retiro, con tu beneficio fiscal incluido.", cta:"Ir a la Calculadora de Retiro →"},
    ahorro:     {url:CONFIG.urlSaludFinanciera, title:"Tu principal oportunidad está en Ahorro", text:"Revisa tu salud financiera completa, no solo tu retiro.", cta:"Hacer mi Diagnóstico Financiero →"},
    proteccion: {url:CONFIG.urlSaludFinanciera, title:"Tu principal oportunidad está en Protección", text:"Revisa qué tan preparada está tu familia ante un imprevisto.", cta:"Hacer mi Diagnóstico Financiero →"},
    fiscal:     {url:CONFIG.urlCalculadoraRetiro, title:"Aprovecha mejor tu beneficio fiscal", text:"Calcula exactamente cuánto podrías deducir y cómo estructurarlo.", cta:"Ir a la Calculadora de Retiro →"}
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
  var data={title:"¿Te alcanzará para retirarte? · Diagnóstico de Retiro con IA", text:"Descubrí qué tan preparado estoy para mi retiro en 3 minutos, con IA. Mira el tuyo:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard && navigator.clipboard.writeText(url); toast(); }
}
var toastT; function toast(){ var el=$("toast"); el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1300); }
function restart(){
  state={ ans:{}, pos:0, lead:null, scores:{}, overall:0, theme:"mantener",
    ctx:{ ingresoMid:0, ingresoLabel:"", aportacionActual:0, years:20 } };
  document.querySelectorAll('.ac').forEach(function(c){ c.classList.remove('on'); });
  show('intro'); $("gprogWrap").style.display="none";
  location.href=location.origin+location.pathname+(window._referidoPor?("?ref="+encodeURIComponent(window._referidoPor)):"");
}
`;
