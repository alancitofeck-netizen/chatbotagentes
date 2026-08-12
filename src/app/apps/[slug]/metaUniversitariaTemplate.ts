/** Plantilla verbatim de "Calculadora de Meta Universitaria" — CSS, HTML y
 * JS copiados literal del archivo original que sirvió de base a este tipo de
 * Mini App (mismo diseño, tipografía Fraunces/Hanken Grotesk, flujo de 5
 * pasos + gate + resultado, y motor de cálculo, sin ningún rediseño). Las
 * ÚNICAS diferencias respecto del original, dentro de
 * META_UNIVERSITARIA_LOGIC_JS, son:
 *
 * 1. El objeto `CONFIG` (antes hardcodeado con los datos de ejemplo "Diego
 *    Tinoco") ahora lee de `window.__META_UNIVERSITARIA_DATA__`, inyectado
 *    por MetaUniversitariaApp.tsx a partir de la config guardada en el CRM.
 * 2. Dentro de `sendLeadToCRM(lead)`, además del `fetch` original a
 *    `CONFIG.webhookURL` (que se deja intacto — sigue disparando solo si el
 *    asesor configuró su propio webhook externo), se agrega un `fetch` a
 *    `/api/public/mini-apps/{slug}/hosted-lead` con el contrato que
 *    `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. La UI de resultado no cambia en nada.
 * 3. Se agrega un `fetch` fire-and-forget a
 *    `/api/public/mini-apps/{slug}/visit` al cargar, igual que los demás
 *    tipos de Mini App, para que el conteo de visitas de la pestaña
 *    Analíticas funcione también acá.
 * 4. Los 12 botones que en el HTML original llamaban a sus funciones vía
 *    atributos `onclick="..."` inline sin id (que dependen de que esas
 *    funciones existan como globals de `window`) pasan a conectarse con
 *    `addEventListener` al final del script — mismo motivo ya documentado
 *    en diagnosticoSolidezTemplate.ts: un global como `window.next` puede
 *    quedar pisado por el propio runtime de Next.js (commit 8b361bd). Se
 *    agregaron ids nuevos (btnStart/childBack/uniBack/durationBack/
 *    durationNext/savingsBack/savingsNext/wowBack/wowNext/skipLeadBtn/
 *    shareBtn/restartBtn) solo para poder engancharlos — ningún cambio
 *    visual. Los botones que ya tenían id (childNext/uniNext/
 *    hasSavingsYes/hasSavingsNo/revealBtn/waBtn/calendlyBtn/fab) se
 *    engancharon con el id existente.
 *
 * Todo el resto — CSS, HTML, y cada función de META_UNIVERSITARIA_LOGIC_JS —
 * es una copia literal del archivo original.
 */

export const META_UNIVERSITARIA_CSS = `

  :root{
    --ink:#241E33; --ink-soft:#4A4260;
    --accent:#6D4AA0; --accent-d:#553A81; --accent-2:#8B6BC2;   /* violeta cálido / aspiracional */
    --amber:#C98A3C; --amber-d:#A66E2A;
    --teal:#2E8B7F; --coral:#C56A57; --coral-soft:#F7ECE7;
    --paper:#FFFFFF; --bg-1:#F5F1F0; --bg-2:#EFE9EC; --cream:#FBF7F3;
    --muted:#837B90; --muted-2:#A69EB0; --line:#EAE4E6; --line-2:#F1ECEE;
    --danger:#C0432C;
    --shadow-card:0 22px 50px -28px rgba(36,30,51,.34);
    --shadow-soft:0 6px 18px -10px rgba(36,30,51,.22);
    --shadow-btn:0 14px 26px -12px rgba(109,74,160,.5);
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
      radial-gradient(820px 420px at 100% -6%, rgba(201,138,60,.09), transparent 55%),
      radial-gradient(760px 400px at 0% 8%, rgba(109,74,160,.09), transparent 52%),
      linear-gradient(168deg,var(--bg-1),var(--bg-2));
    background-attachment:fixed;
  }
  .topbar{position:sticky;top:0;z-index:30;background:rgba(245,241,240,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .topbar .in{max-width:560px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:12px}
  .agent{display:flex;align-items:center;gap:11px;min-width:0}
  .agent .ava{width:40px;height:40px;border-radius:12px;flex:0 0 auto;object-fit:cover;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-weight:600;font-size:15px;overflow:hidden}
  .agent .ava img{width:100%;height:100%;object-fit:cover}
  .agent .who{min-width:0;line-height:1.25}
  .agent .who b{font-size:13.5px;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent .who span{font-size:11.5px;color:var(--muted)}
  .kit-name{margin-left:auto;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber-d);font-weight:700;text-align:right;white-space:nowrap}

  .gprog{max-width:560px;margin:0 auto;padding:0 18px 11px}
  .gprog .track{height:6px;background:var(--line);border-radius:6px;overflow:hidden;margin-top:11px}
  .gprog .track>i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width .5s cubic-bezier(.22,1,.36,1)}

  .wrap{width:100%;max-width:560px;margin:0 auto;padding:22px 18px}

  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-d);font-weight:700;margin-bottom:14px;display:inline-flex;align-items:center;gap:8px}
  .eyebrow::before{content:"";width:20px;height:1.5px;background:var(--amber)}
  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(30px,7.6vw,40px);line-height:1.08;letter-spacing:-.015em;margin-bottom:15px}
  h1 em{font-style:italic;color:var(--accent-d)}
  h2{font-family:var(--f-d);font-weight:600;font-size:26px;line-height:1.16;letter-spacing:-.01em;margin-bottom:8px}
  .sec-sub{font-size:14.5px;color:var(--muted);margin-bottom:24px;line-height:1.55}
  .lede{font-size:16px;color:var(--muted);margin-bottom:26px}

  .btn{font-family:var(--f);font-size:16px;font-weight:700;width:100%;padding:17px 20px;border:none;border-radius:15px;cursor:pointer;
    background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;transition:transform .14s,box-shadow .25s,opacity .2s;
    display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:var(--shadow-btn)}
  .btn:hover{transform:translateY(-1px)}
  .btn:active{transform:scale(.986)}
  .btn.wide{max-width:360px;margin-left:auto;margin-right:auto}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:var(--bg-1)}
  .btn.wa{background:linear-gradient(145deg,#2BE06E,#1FB855);color:#08331A;box-shadow:0 14px 26px -12px rgba(37,211,102,.5)}
  .btn.amber{background:linear-gradient(145deg,#D69A4C,var(--amber-d));box-shadow:0 14px 26px -12px rgba(201,138,60,.5)}
  .btn.dark{background:linear-gradient(145deg,var(--ink),var(--ink-soft));box-shadow:0 14px 26px -12px rgba(36,30,51,.5)}
  .btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}
  .stepnav{display:flex;gap:12px;margin-top:22px}
  .stepnav .btn{flex:1}

  .benefit{display:flex;align-items:center;gap:13px;padding:14px 16px;background:var(--paper);border:1px solid var(--line);border-radius:15px;margin-bottom:11px;box-shadow:var(--shadow-soft)}
  .benefit .bi{width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:rgba(109,74,160,.1);display:grid;place-items:center;color:var(--accent)}
  .benefit b{font-size:15px;font-weight:700;display:block}
  .benefit span{font-size:13px;color:var(--muted)}
  .privacy-note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:13px 15px}
  .privacy-note svg{flex:0 0 auto;color:var(--accent);margin-top:1px}

  .card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-card)}
  .field{margin-bottom:16px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:7px}
  .field label .opt{font-weight:400;color:var(--muted-2);font-size:12px}
  .field input,.field select{width:100%;font-family:var(--f);font-size:16px;padding:14px 15px;border:1.5px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);transition:.16s}
  .field input:focus,.field select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(109,74,160,.12)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
  .inline-check{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--muted);margin-top:4px;cursor:pointer}
  .inline-check input{width:17px;height:17px;accent-color:var(--accent)}

  .money{position:relative}
  .money .cur{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;font-weight:700;color:var(--muted-2)}
  .money input{padding-left:34px}

  /* opciones tipo card */
  .opts{display:flex;flex-direction:column;gap:12px}
  .opt{display:flex;align-items:center;gap:15px;width:100%;text-align:left;cursor:pointer;background:var(--paper);border:2px solid transparent;border-radius:16px;padding:17px 18px;box-shadow:var(--shadow-soft);transition:.18s;font-family:var(--f)}
  .opt:hover{transform:translateY(-2px)}
  .opt.sel{border-color:var(--accent);box-shadow:0 12px 26px -12px rgba(109,74,160,.42)}
  .opt .ic{width:42px;height:42px;flex:0 0 auto;border-radius:12px;background:rgba(109,74,160,.1);color:var(--accent);display:grid;place-items:center;transition:.18s}
  .opt.sel .ic{background:var(--accent);color:#fff}
  .opt .ox b{font-size:15.5px;font-weight:700;display:block}
  .opt .ox span{font-size:12.5px;color:var(--muted)}

  /* chips rápidos (años/duración) */
  .quick{display:flex;gap:10px;flex-wrap:wrap}
  .quick button{flex:1;min-width:64px;font-family:var(--f);font-size:15px;font-weight:700;padding:14px 8px;border:1.5px solid var(--line);border-radius:13px;background:var(--paper);color:var(--ink);cursor:pointer;transition:.16s;box-shadow:var(--shadow-soft)}
  .quick button:hover{transform:translateY(-1px)}
  .quick button.sel{background:var(--accent);border-color:var(--accent);color:#fff}

  /* chips checkbox gastos */
  .chips{display:flex;flex-wrap:wrap;gap:9px}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid var(--line);border-radius:30px;background:var(--paper);cursor:pointer;font-size:13.5px;font-weight:600;color:var(--ink-soft);transition:.16s}
  .chip.on{border-color:var(--accent);background:rgba(109,74,160,.08);color:var(--accent-d)}

  .tip{font-size:12.5px;color:var(--muted);background:var(--cream);border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-top:8px;line-height:1.5;display:flex;gap:9px}
  .tip svg{flex:0 0 auto;color:var(--amber-d);margin-top:1px}

  .liveband{background:linear-gradient(135deg,rgba(109,74,160,.1),rgba(201,138,60,.08));border:1px solid var(--line);border-radius:15px;padding:15px 17px;margin-top:16px;text-align:center;font-size:15px;font-weight:600;color:var(--accent-d)}
  .liveband b{font-family:var(--f-d);font-weight:700}

  /* línea de tiempo */
  .timeline{margin:18px 0 4px}
  .tl-track{position:relative;height:4px;background:var(--line);border-radius:4px;margin:26px 6px 8px}
  .tl-fill{position:absolute;left:0;top:0;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width 1s cubic-bezier(.22,1,.36,1)}
  .tl-dot{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(109,74,160,.18)}
  .tl-dot.end{background:var(--amber);box-shadow:0 0 0 4px rgba(201,138,60,.2)}
  .tl-labels{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
  .tl-labels b{color:var(--ink);font-weight:700;display:block;font-size:13px}

  /* WOW costo futuro */
  .wow{text-align:center;padding:14px 4px}
  .wow .wlabel{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .wow .wnum{font-family:var(--f-d);font-weight:700;font-size:clamp(34px,9vw,48px);line-height:1.05;letter-spacing:-.02em;margin:4px 0}
  .wow .wnum.future{color:var(--accent-d)}
  .wow .warrow{width:44px;height:44px;margin:14px auto;border-radius:50%;background:rgba(109,74,160,.1);display:grid;place-items:center;color:var(--accent)}
  .wow .wsub{font-size:12.5px;color:var(--muted-2)}
  .wow-quote{font-family:var(--f-d);font-size:18px;font-style:italic;color:var(--ink-soft);line-height:1.45;max-width:400px;margin:24px auto 0}

  /* consent */
  .consent{display:flex;gap:11px;align-items:flex-start;margin:6px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.5}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
  .consent a{color:var(--ink);text-decoration:underline}

  /* resultado */
  .res-hero{text-align:center;padding:6px 4px 0}
  .res-stats{display:flex;justify-content:center;gap:10px;margin:18px 0 4px}
  .res-stat{flex:1;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:13px 8px;box-shadow:var(--shadow-soft)}
  .res-stat b{font-family:var(--f-d);font-size:22px;font-weight:600;display:block;line-height:1}
  .res-stat span{font-size:11.5px;color:var(--muted);display:block;margin-top:4px}

  .costflow{display:flex;align-items:center;gap:12px;justify-content:center;margin:22px 0}
  .costflow .cf{flex:1;text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 10px;box-shadow:var(--shadow-soft)}
  .costflow .cf .l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .costflow .cf .v{font-family:var(--f-d);font-size:clamp(19px,5vw,24px);font-weight:700;margin-top:5px}
  .costflow .cf.future .v{color:var(--accent-d)}
  .costflow .ar{color:var(--muted-2);flex:0 0 auto}

  /* barra brecha */
  .gapviz{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:20px 0;box-shadow:var(--shadow-soft)}
  .gapviz .row{margin-bottom:15px}
  .gapviz .row:last-child{margin-bottom:0}
  .gapviz .rl{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}
  .gapviz .rl span{color:var(--muted);font-weight:600}
  .gapviz .rl b{font-family:var(--f-d);font-weight:700}
  .gapviz .bar{height:12px;background:var(--bg-1);border-radius:8px;overflow:hidden}
  .gapviz .bfill{height:100%;width:0;border-radius:8px;transition:width 1.1s cubic-bezier(.22,1,.36,1)}
  .bfill.goal{background:linear-gradient(90deg,var(--accent-2),var(--accent))}
  .bfill.have{background:linear-gradient(90deg,#3FA595,var(--teal))}
  .bfill.gap{background:linear-gradient(90deg,#D98A6E,var(--coral))}

  .goal-card{background:linear-gradient(150deg,var(--accent),var(--accent-d));color:#fff;border-radius:20px;padding:24px;text-align:center;margin:20px 0;box-shadow:0 20px 44px -22px rgba(109,74,160,.7)}
  .goal-card .gl{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;font-weight:700}
  .goal-card .gv{font-family:var(--f-d);font-size:clamp(38px,10vw,52px);font-weight:700;line-height:1;margin:6px 0}
  .goal-card .gu{font-size:14px;opacity:.9}
  .goal-quote{font-size:14px;color:var(--ink-soft);text-align:center;line-height:1.55;max-width:420px;margin:0 auto}

  /* hoy vs esperar */
  .waitbox{margin:26px 0}
  .waitbox h3{font-family:var(--f-d);font-size:21px;font-weight:600;text-align:center;margin-bottom:6px}
  .waitbox .wq{font-size:13.5px;color:var(--muted);text-align:center;margin-bottom:18px}
  .scen{display:flex;align-items:center;gap:13px;background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:15px 17px;margin-bottom:11px;box-shadow:var(--shadow-soft);position:relative;overflow:hidden}
  .scen.now{border-color:var(--teal)}
  .scen .sd{flex:1}
  .scen .st{font-size:13.5px;font-weight:700;color:var(--ink)}
  .scen .ss{font-size:12px;color:var(--muted)}
  .scen .sv{font-family:var(--f-d);font-size:22px;font-weight:700;text-align:right}
  .scen.now .sv{color:var(--teal)}
  .scen .tag{position:absolute;top:0;right:0;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#fff;background:var(--teal);padding:3px 10px;border-bottom-left-radius:10px}
  .wait-quote{font-family:var(--f-d);font-size:17px;font-style:italic;color:var(--ink-soft);text-align:center;line-height:1.45;max-width:400px;margin:18px auto 0}

  /* simulador */
  .simbox{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:22px 20px;margin:26px 0;box-shadow:var(--shadow-card)}
  .simbox h3{font-family:var(--f-d);font-size:19px;font-weight:600;margin-bottom:4px}
  .simbox .simsub{font-size:13px;color:var(--muted);margin-bottom:20px}
  .simval{text-align:center;margin-bottom:6px}
  .simval b{font-family:var(--f-d);font-size:32px;font-weight:700;color:var(--accent-d)}
  .simval span{font-size:13px;color:var(--muted)}
  input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:6px;background:var(--line);outline:none;margin:14px 0}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--accent);cursor:pointer;box-shadow:0 4px 10px -3px rgba(109,74,160,.5);transition:.15s}
  input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.1)}
  input[type=range]::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--accent);cursor:pointer}
  .simends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted-2);margin-bottom:18px}
  .simcover{text-align:center}
  .simcover .cbar{height:14px;background:var(--bg-1);border-radius:8px;overflow:hidden;margin:12px 0 8px}
  .simcover .cbfill{height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width .25s}
  .simcover .cpct{font-family:var(--f-d);font-size:26px;font-weight:700}
  .simcover .cnote{font-size:12.5px;color:var(--muted)}

  .review-card{background:linear-gradient(150deg,var(--cream),var(--bg-2));border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:22px 0 14px;display:flex;gap:13px;align-items:center}
  .review-card .rc{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;flex:0 0 auto;font-family:var(--f-d);font-weight:600;overflow:hidden}
  .review-card .rc img{width:100%;height:100%;object-fit:cover}
  .review-card b{display:block;font-size:14.5px}
  .review-card small{font-size:12.5px;color:var(--muted)}
  .cta-head{text-align:center;margin:26px 0 4px}
  .cta-head h3{font-family:var(--f-d);font-size:22px;font-weight:600;line-height:1.2;margin-bottom:8px}
  .cta-head p{font-size:14px;color:var(--muted);line-height:1.55;max-width:420px;margin:0 auto}

  .share-band{text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px 20px;margin:22px 0}
  .share-band h3{font-family:var(--f-d);font-size:18px;font-weight:600;margin-bottom:6px}
  .share-band p{font-size:13.5px;color:var(--muted);margin-bottom:16px}

  .restart{background:none;border:none;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;margin:8px auto 0;display:block;font-family:var(--f)}
  .restart:hover{color:var(--ink)}
  .disclaimer{font-size:11px;color:var(--muted-2);line-height:1.55;padding:20px 4px 4px;text-align:center;max-width:470px;margin:0 auto}
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

export const META_UNIVERSITARIA_BODY_HTML = `
<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">DT</div>
      <div class="who"><b id="agentName">Diego Tinoco</b><span id="agentTitle">Asesor financiero</span></div>
    </div>
    <div class="kit-name">Meta Universitaria</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none">
  <div class="track"><i id="gpbar"></i></div>
</div>

<div class="wrap">

  <!-- STEP 0 · INTRO -->
  <div class="step on" data-step="intro">
    <div class="eyebrow">Planificación educativa · 2 min</div>
    <h1>¿Cuánto necesitarás para <em>la universidad de tu hijo</em>?</h1>
    <p class="lede">Descubre cuánto podría costar su educación cuando llegue el momento y qué necesitarías preparar desde hoy.</p>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div><div><b>Costo futuro</b><span>Cuánto podría costar cuando llegue el momento</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></div><div><b>Brecha estimada</b><span>Lo que faltaría por construir</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></div><div><b>Meta mensual</b><span>Cuánto preparar cada mes desde hoy</span></div></div>
    <div style="margin-top:24px"><button class="btn wide" id="btnStart">Calcular su meta universitaria →</button></div>
    <div class="privacy-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Estimación gratuita. No necesitas ingresar información bancaria.</span></div>
  </div>

  <!-- STEP 1 · HIJO -->
  <div class="step" data-step="child">
    <div class="eyebrow">Paso 1 de 5</div>
    <h2>¿Para quién estamos construyendo esta meta?</h2>
    <p class="sec-sub">Solo necesitamos su nombre (o apodo) y su edad.</p>
    <div class="card" style="padding:22px">
      <div class="field"><label>Nombre del hijo/a <span class="opt">(opcional)</span></label>
        <input type="text" id="childName" placeholder="Ej. Sofía" oninput="updateChildLive()">
        <label class="inline-check"><input type="checkbox" id="noName" onchange="toggleNoName()"> Prefiero no poner su nombre</label>
      </div>
      <div class="grid2">
        <div class="field"><label>Edad actual</label><input type="number" id="childAge" min="0" max="17" placeholder="Ej. 7" oninput="updateChildLive()"></div>
        <div class="field"><label>Inicio de universidad</label><input type="number" id="uniAge" min="15" max="25" value="18" oninput="updateChildLive()"></div>
      </div>
      <div class="liveband" id="childLive" style="display:none"></div>
    </div>
    <div class="stepnav"><button class="btn ghost" id="childBack">← Atrás</button><button class="btn" id="childNext" disabled>Continuar →</button></div>
  </div>

  <!-- STEP 2 · UNIVERSIDAD -->
  <div class="step" data-step="uni">
    <div class="eyebrow">Paso 2 de 5</div>
    <h2 id="uniTitle">¿Qué tipo de universidad imaginas?</h2>
    <p class="sec-sub">Elige una opción y estima el costo actual. No usamos precios oficiales de instituciones.</p>
    <div class="opts" id="uniOpts"></div>

    <div id="uniDetail" style="display:none;margin-top:18px">
      <div class="card" style="padding:20px">
        <div class="field" id="uniNameField" style="display:none"><label>Nombre de la universidad <span class="opt">(opcional)</span></label><input type="text" id="uniName" placeholder="Ej. Universidad ..."></div>
        <div class="grid2">
          <div class="field"><label>Costo aproximado hoy</label><div class="money"><span class="cur" id="curSign">$</span><input type="number" id="uniCost" min="0" placeholder="Ej. 200000" oninput="saveLocal()"></div></div>
          <div class="field"><label>Moneda</label><select id="uniCurrency" onchange="changeCurrency()"><option value="MXN">MXN</option><option value="USD">USD</option></select></div>
        </div>
        <div class="field" style="margin-bottom:0"><label>Ese costo corresponde a…</label>
          <select id="costUnit" onchange="saveLocal()"><option value="year">Un año</option><option value="semester">Un semestre</option><option value="month">Un mes</option><option value="career">Toda la carrera</option></select>
        </div>
      </div>
    </div>
    <div class="stepnav"><button class="btn ghost" id="uniBack">← Atrás</button><button class="btn" id="uniNext" disabled>Continuar →</button></div>
  </div>

  <!-- STEP 3 · DURACIÓN + GASTOS -->
  <div class="step" data-step="duration">
    <div class="eyebrow">Paso 3 de 5</div>
    <h2>¿Cuánto durará la carrera?</h2>
    <p class="sec-sub">Y, si quieres, incluye otros gastos anuales estimados.</p>
    <div class="quick" id="durQuick" style="margin-bottom:22px"></div>

    <div class="field"><label>Inflación educativa anual estimada</label>
      <div class="money"><input type="number" id="inflRate" step="0.5" style="padding-left:15px" oninput="saveLocal()"><span class="cur" style="left:auto;right:14px">%</span></div>
      <div class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Es una hipótesis para proyectar, no una predicción garantizada. Puedes ajustarla.</span></div>
    </div>

    <div class="field" style="margin-top:18px"><label>Gastos adicionales por año <span class="opt">(opcional)</span></label>
      <div class="chips" id="expChips" style="margin-bottom:12px"></div>
      <div class="money"><span class="cur" id="curSign2">$</span><input type="number" id="extraCost" min="0" placeholder="Ej. 30000 (libros, transporte, etc.)" oninput="saveLocal()"></div>
    </div>
    <div class="stepnav"><button class="btn ghost" id="durationBack">← Atrás</button><button class="btn" id="durationNext">Continuar →</button></div>
  </div>

  <!-- STEP 4 · AHORRO ACTUAL -->
  <div class="step" data-step="savings">
    <div class="eyebrow">Paso 4 de 5</div>
    <h2>¿Ya tienes algo destinado a esta meta?</h2>
    <p class="sec-sub">Cuenta tanto si empiezas desde cero como si ya llevas camino recorrido.</p>
    <div class="opts" style="margin-bottom:16px">
      <button class="opt" id="hasSavingsYes"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="ox"><b>Sí, ya tengo algo ahorrado</b><span>Para la educación de mi hijo/a</span></div></button>
      <button class="opt" id="hasSavingsNo"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="ox"><b>Todavía no / desde cero</b><span>Estoy empezando a planear</span></div></button>
    </div>
    <div id="savingsDetail" style="display:none">
      <div class="card" style="padding:20px">
        <div class="field"><label>¿Cuánto tienes actualmente?</label><div class="money"><span class="cur" id="curSign3">$</span><input type="number" id="capitalNow" min="0" placeholder="Ej. 50000" oninput="saveLocal()"></div></div>
        <div class="field" style="margin-bottom:0"><label>¿Aportas algo cada mes? <span class="opt">(puede ser 0)</span></label><div class="money"><span class="cur" id="curSign4">$</span><input type="number" id="monthlyNow" min="0" placeholder="Ej. 2000" oninput="saveLocal()"></div></div>
      </div>
    </div>
    <div class="tip" style="margin-top:16px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Para proyectar usamos una tasa hipotética de crecimiento (<b id="rendLabel">6%</b> anual). Los rendimientos reales pueden variar; no es una garantía.</span></div>
    <div class="stepnav"><button class="btn ghost" id="savingsBack">← Atrás</button><button class="btn amber" id="savingsNext">Ver el costo futuro →</button></div>
  </div>

  <!-- STEP 5 · WOW COSTO FUTURO -->
  <div class="step" data-step="wow">
    <div class="wow">
      <div class="eyebrow" style="justify-content:center">El tiempo cambia el costo</div>
      <div style="margin:8px 0"><div class="wlabel">Hoy · <span id="wowUniName">universidad estimada</span></div><div class="wnum" id="wowToday">$0</div></div>
      <div class="warrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>
      <div><div class="wlabel">En <span id="wowYears">0</span> años · costo total proyectado</div><div class="wnum future" id="wowFuture">$0</div><div class="wsub">Suma estimada de todos los años de carrera con inflación educativa.</div></div>
      <p class="wow-quote">El tiempo cambia el costo… pero también te da años para prepararte.</p>
    </div>
    <div class="stepnav"><button class="btn ghost" id="wowBack">← Atrás</button><button class="btn" id="wowNext">Ver mi plan →</button></div>
  </div>

  <!-- GATE -->
  <div class="step" data-step="gate">
    <div class="card" style="padding:30px 24px">
      <div class="eyebrow">Tu plan universitario está listo</div>
      <h2 id="gateTitle">¿A dónde enviamos tu resultado?</h2>
      <p class="sec-sub">Déjanos dónde enviártelo para que puedas revisarlo con tu asesor. Compartimos solo tu contacto.</p>
      <div class="field"><label>Nombre del padre / madre</label><input type="text" id="leadName" placeholder="Tu nombre"></div>
      <div class="field"><label>WhatsApp <span class="opt">(10 dígitos)</span></label><input type="tel" id="leadWa" inputmode="tel" placeholder="Ej. 5512345678"></div>
      <div class="field"><label>Correo <span class="opt">(opcional)</span></label><input type="email" id="leadEmail" placeholder="tucorreo@ejemplo.com"></div>
      <label class="consent"><input type="checkbox" id="leadConsent"><span>Acepto recibir mi resultado y contacto de seguimiento de <b id="cName">Diego Tinoco</b>, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label>
      <button class="btn" id="revealBtn">Ver mi plan completo →</button>
      <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:14px">También puedes <button class="restart" id="skipLeadBtn" style="display:inline;color:var(--accent-d)">continuar sin dejar datos</button></p>
    </div>
  </div>

  <!-- RESULTADO -->
  <div class="step" data-step="result">
    <div class="res-hero">
      <div class="eyebrow" style="justify-content:center">Meta universitaria<span id="resHeroName"></span></div>
      <div class="res-stats">
        <div class="res-stat"><b id="rsAge">7</b><span>años hoy</span></div>
        <div class="res-stat"><b id="rsUni">18</b><span>inicia a los</span></div>
        <div class="res-stat"><b id="rsYears">11</b><span>años disponibles</span></div>
      </div>
    </div>

    <div class="timeline">
      <div class="tl-track"><div class="tl-fill" id="tlFill"></div><div class="tl-dot" style="left:0"></div><div class="tl-dot end" style="left:100%"></div></div>
      <div class="tl-labels"><div><b id="tlNow">Hoy</b><span id="tlNowYr"></span></div><div style="text-align:right"><b>Universidad</b><span id="tlEndYr"></span></div></div>
    </div>

    <div class="costflow">
      <div class="cf"><div class="l">Costo hoy</div><div class="v" id="cfToday">$0</div></div>
      <div class="ar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="cf future"><div class="l">Costo proyectado</div><div class="v" id="cfFuture">$0</div></div>
    </div>

    <div class="gapviz">
      <div class="row"><div class="rl"><span>Meta universitaria</span><b id="gvGoal">$0</b></div><div class="bar"><div class="bfill goal" style="width:100%"></div></div></div>
      <div class="row"><div class="rl"><span>Ya tienes (proyectado)</span><b id="gvHave">$0</b></div><div class="bar"><div class="bfill have" id="gvHaveBar"></div></div></div>
      <div class="row"><div class="rl"><span>Te faltaría construir</span><b id="gvGap">$0</b></div><div class="bar"><div class="bfill gap" id="gvGapBar"></div></div></div>
    </div>

    <div class="goal-card">
      <div class="gl">Tu meta mensual</div>
      <div class="gv" id="goalMonthly">$0</div>
      <div class="gu" id="goalUnit">por mes · MXN</div>
    </div>
    <p class="goal-quote" id="goalQuote"></p>

    <!-- HOY VS ESPERAR -->
    <div class="waitbox">
      <h3>¿Qué pasa si esperas?</h3>
      <div class="wq">No se trata solo de cuánto ahorras, también de cuánto tiempo le das a tu dinero.</div>
      <div id="scenarios"></div>
      <p class="wait-quote" id="waitQuote"></p>
    </div>

    <!-- SIMULADOR -->
    <div class="simbox">
      <h3>Prueba diferentes escenarios</h3>
      <div class="simsub">Mueve el control y mira cuánto de la meta podrías cubrir.</div>
      <div class="simval"><b id="simAmount">$0</b> <span>/ mes</span></div>
      <input type="range" id="simSlider" min="500" max="30000" step="250" value="5000" oninput="onSim()">
      <div class="simends"><span id="simMin">$500</span><span id="simMax">$30,000</span></div>
      <div class="simcover">
        <div class="cbar"><div class="cbfill" id="simBar"></div></div>
        <div class="cpct" id="simPct">0%</div>
        <div class="cnote">de la meta cubierta con este aporte · <span id="simProj">$0</span> proyectados</div>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-head">
      <h3>Ya sabes cuánto necesitas.<br>Ahora puedes construir el camino.</h3>
      <p>Tu asesor puede ayudarte a revisar estrategias para preparar esta meta sin descuidar las demás prioridades de tu familia.</p>
    </div>
    <div class="review-card">
      <div class="rc" id="revAva">DT</div>
      <div><b>Revisa tu estrategia con <span id="ctaAgent">Diego</span></b><small id="ctaAgentRole">Asesor financiero · sin costo</small></div>
    </div>
    <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener">Revisar mi estrategia por WhatsApp</a>
    <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none">Agendar una revisión →</a>

    <div class="share-band">
      <h3>Hay metas que vale la pena empezar a planear antes.</h3>
      <p>¿Conoces a otra familia a la que le serviría calcular cuánto necesitará para la universidad de sus hijos?</p>
      <button class="btn amber wide" id="shareBtn">Compartir calculadora</button>
    </div>

    <button class="restart" id="restartBtn">↺ Crear otra meta (para otro hijo)</button>
    <div class="disclaimer">Los resultados son estimaciones con fines educativos y de planificación. Los costos universitarios, la inflación y los rendimientos futuros pueden variar. Esta herramienta no constituye una garantía de rendimiento, cotización oficial ni recomendación financiera personalizada.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Diego Tinoco</b> · Growth Link</div>
</div>

<div class="toast" id="toast">Guardado</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesor</span>
</a>
`;

export const META_UNIVERSITARIA_LOGIC_JS = `

/* ==================================================================
   ▓▓  CONFIG DEL AGENTE  ▓▓  ← Editá solo esto para replicar.
   ================================================================== */
const META_UNI_DATA = window.__META_UNIVERSITARIA_DATA__ || {};
const META_UNI_BRAND = META_UNI_DATA.brand || {};
const META_UNI_SLUG = META_UNI_DATA.slug || "";
fetch('/api/public/mini-apps/'+META_UNI_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  agente:      META_UNI_BRAND.advisorName || "Tu asesor",
  titulo:      META_UNI_BRAND.title || "Asesor financiero",
  whatsapp:    META_UNI_BRAND.whatsapp || "",
  email:       META_UNI_BRAND.email || "",
  fotoURL:     META_UNI_BRAND.photoURL || "",
  logoURL:     META_UNI_BRAND.logoURL || "",
  agenteID:    META_UNI_SLUG,
  calendlyURL: META_UNI_BRAND.calendlyURL || "",
  webhookURL:  META_UNI_BRAND.webhookURL || "",
  avisoPrivacidadURL: META_UNI_BRAND.avisoPrivacidadURL || "",
  colorMarca:  META_UNI_BRAND.colorMarca || "",
  monedaDefault: META_UNI_BRAND.monedaDefault || "MXN",
  inflacionEducativaDefault: typeof META_UNI_BRAND.inflacionEducativaDefault === "number" ? META_UNI_BRAND.inflacionEducativaDefault : 0.06,
  rendimientoAnualDefault: typeof META_UNI_BRAND.rendimientoAnualDefault === "number" ? META_UNI_BRAND.rendimientoAnualDefault : 0.06
};

/* ==================== Estado + persistencia ==================== */
const LS_KEY = "gl_meta_uni_" + CONFIG.agenteID;
var S = {
  childName:"", noName:false, childAge:"", uniAge:18,
  uniType:"", uniName:"", uniCost:"", currency:CONFIG.monedaDefault, costUnit:"year",
  duration:4, inflPct:CONFIG.inflacionEducativaDefault*100, extraCost:"", expenses:[],
  hasSavings:null, capitalNow:"", monthlyNow:"",
  lead:null
};
function saveLocal(){ try{ syncInputs(); localStorage.setItem(LS_KEY, JSON.stringify(S)); toast(); }catch(e){} }
function loadLocal(){ try{ var s=localStorage.getItem(LS_KEY); if(s){ S=Object.assign(S, JSON.parse(s)); } }catch(e){} }
var toastT; function toast(){ var el=$("toast"); el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1200); }

function $(id){ return document.getElementById(id); }
function track(ev,data){ try{ console.log("[track]",ev,data||""); }catch(e){} }
function num(v){ v=parseFloat(v); return isFinite(v)?v:0; }

/* ==================== Catálogos ==================== */
var UNI_TYPES = [
  {id:"publica", t:"Universidad pública", s:"Colegiaturas más accesibles", hint:20000},
  {id:"privada", t:"Universidad privada", s:"Costo medio", hint:180000},
  {id:"premium", t:"Privada premium", s:"Alto nivel / reconocida", hint:350000},
  {id:"extranjero", t:"En el extranjero", s:"Estudios fuera del país", hint:600000},
  {id:"mente", t:"Ya tengo una en mente", s:"Ingresarás el costo", hint:0}
];
var EXPENSES = ["Inscripción","Materiales / libros","Laptop / tecnología","Transporte","Vivienda","Alimentación","Intercambio","Otros"];

/* ==================== Init ==================== */
(function init(){
  if(CONFIG.colorMarca){ document.documentElement.style.setProperty('--accent',CONFIG.colorMarca); }
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente; $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente; $("footAgent").textContent=CONFIG.agente;
  $("ctaAgent").textContent=CONFIG.agente.split(" ")[0]; $("ctaAgentRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.avisoPrivacidadURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){ var src=CONFIG.fotoURL||CONFIG.logoURL;
    $("agentAva").innerHTML='<img src="'+src+'" alt="">'; $("revAva").innerHTML='<img src="'+src+'" alt="">';
  } else { $("agentAva").textContent=initials; $("revAva").textContent=initials; }
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre la Calculadora de Meta Universitaria.");
  if(CONFIG.calendlyURL){ $("calendlyBtn").href=CONFIG.calendlyURL; }
  $("rendLabel").textContent=Math.round(CONFIG.rendimientoAnualDefault*100)+"%";
  $("inflRate").value=S.inflPct;
  renderUniOpts(); renderDurQuick(); renderExpChips();
  loadLocal(); hydrate();
  var ref=new URLSearchParams(location.search).get('ref'); if(ref)window._referidoPor=ref;
  track('calculator_started');
})();

function hydrate(){
  if(S.childName)$("childName").value=S.childName;
  if(S.noName){ $("noName").checked=true; toggleNoName(); }
  if(S.childAge)$("childAge").value=S.childAge;
  if(S.uniAge)$("uniAge").value=S.uniAge;
  $("uniCurrency").value=S.currency; changeCurrency();
  if(S.uniCost)$("uniCost").value=S.uniCost;
  $("costUnit").value=S.costUnit;
  $("inflRate").value=S.inflPct;
  if(S.extraCost)$("extraCost").value=S.extraCost;
  if(S.capitalNow)$("capitalNow").value=S.capitalNow;
  if(S.monthlyNow)$("monthlyNow").value=S.monthlyNow;
  if(S.uniType){ selectUni(S.uniType,true); }
  selectDur(S.duration,true);
  if(S.hasSavings!==null) setHasSavings(S.hasSavings,true);
  S.expenses.forEach(function(e){ var c=document.querySelector('.chip[data-exp="'+CSS.escape(e)+'"]'); if(c)c.classList.add('on'); });
  updateChildLive();
}

function syncInputs(){
  S.childName=$("childName").value.trim();
  S.noName=$("noName").checked;
  S.childAge=$("childAge").value;
  S.uniAge=num($("uniAge").value)||18;
  S.currency=$("uniCurrency").value;
  S.uniCost=$("uniCost").value;
  S.costUnit=$("costUnit").value;
  S.inflPct=num($("inflRate").value);
  S.extraCost=$("extraCost").value;
  if($("uniName"))S.uniName=$("uniName").value;
  S.capitalNow=$("capitalNow")?$("capitalNow").value:S.capitalNow;
  S.monthlyNow=$("monthlyNow")?$("monthlyNow").value:S.monthlyNow;
}

/* ==================== Navegación ==================== */
var STEPS=["child","uni","duration","savings","wow"];
function go(step){
  syncInputs(); saveLocal();
  if(step==="wow"){ paintWow(); }
  if(step==="gate"){ $("gateTitle").textContent="¿A dónde enviamos "+ (childRef()==="tu hijo/a"?"tu resultado":("el plan de "+childRef()))+"?"; }
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  var idx=STEPS.indexOf(step);
  $("gprogWrap").style.display = idx>=0 ? "block":"none";
  if(idx>=0){ $("gpbar").style.width=Math.round((idx+1)/STEPS.length*100)+"%"; }
  window.scrollTo({top:0,behavior:'smooth'});
  track('section_view',{step:step});
}
function startCalc(){ track('calculator_started'); go('child'); }

/* ==================== Helpers de dominio ==================== */
function childRef(){ if(S.noName||!S.childName) return "tu hijo/a"; return S.childName; }
function yearsLeft(){ var a=num($("childAge").value), u=num($("uniAge").value)||18; return Math.max(0, u-a); }
function fmt(v){ v=Math.round(v); return (S.currency==="USD"?"$":"$")+v.toLocaleString('es-MX'); }

/* ==================== STEP 1 ==================== */
function toggleNoName(){ var on=$("noName").checked; $("childName").disabled=on; if(on)$("childName").value=""; updateChildLive(); saveLocal(); }
function updateChildLive(){
  var a=num($("childAge").value), u=num($("uniAge").value)||18, left=Math.max(0,u-a);
  var lb=$("childLive");
  if($("childAge").value!==""){ lb.style.display="block"; lb.innerHTML=cap(childRef())+' tiene <b>'+left+' año'+(left===1?'':'s')+'</b> para construir esta meta.'; }
  else lb.style.display="none";
  $("childNext").disabled = ($("childAge").value==="" || a<0 || a>17);
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

/* ==================== STEP 2 ==================== */
function renderUniOpts(){
  var w=$("uniOpts"); w.innerHTML="";
  UNI_TYPES.forEach(function(o){
    var b=document.createElement("button"); b.className="opt"; b.id="uni_"+o.id;
    b.innerHTML='<div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></svg></div><div class="ox"><b>'+o.t+'</b><span>'+o.s+'</span></div>';
    b.onclick=function(){ selectUni(o.id); };
    w.appendChild(b);
  });
}
function selectUni(id,silent){
  S.uniType=id;
  document.querySelectorAll('#uniOpts .opt').forEach(function(x){ x.classList.remove('sel'); });
  var el=$("uni_"+id); if(el)el.classList.add('sel');
  $("uniDetail").style.display="block";
  var isMente = id==="mente";
  $("uniNameField").style.display=isMente?"block":"none";
  $("uniTitle").textContent = "¿Qué tipo de universidad imaginas"+(childRef()==="tu hijo/a"?"?":(" para "+childRef()+"?"));
  var t=UNI_TYPES.find(function(x){return x.id===id});
  if(!silent && t && t.hint && !$("uniCost").value){ $("uniCost").value=t.hint; }
  $("uniNext").disabled = !( num($("uniCost").value)>0 );
  if(!silent){ track('university_data_completed',{type:id}); saveLocal(); }
}
document.addEventListener('input',function(e){ if(e.target&&e.target.id==='uniCost'){ $("uniNext").disabled=!(num($("uniCost").value)>0); } });

function changeCurrency(){
  S.currency=$("uniCurrency").value;
  var sign="$";
  ["curSign","curSign2","curSign3","curSign4"].forEach(function(id){ if($(id))$(id).textContent=sign; });
  saveLocal&&0;
}

/* ==================== STEP 3 ==================== */
function renderDurQuick(){
  var w=$("durQuick"); w.innerHTML="";
  [3,4,5,6].forEach(function(n){ var b=document.createElement("button"); b.textContent=n+" años"; b.id="dur_"+n; b.onclick=function(){ selectDur(n); }; w.appendChild(b); });
}
function selectDur(n,silent){ S.duration=n; document.querySelectorAll('#durQuick button').forEach(function(x){x.classList.remove('sel')}); var el=$("dur_"+n); if(el)el.classList.add('sel'); if(!silent)saveLocal(); }
function renderExpChips(){
  var w=$("expChips"); w.innerHTML="";
  EXPENSES.forEach(function(e){ var b=document.createElement("button"); b.className="chip"; b.setAttribute("data-exp",e); b.textContent=e;
    b.onclick=function(){ b.classList.toggle('on'); S.expenses=Array.prototype.slice.call(document.querySelectorAll('.chip.on')).map(function(x){return x.getAttribute('data-exp')}); saveLocal(); };
    w.appendChild(b); });
}

/* ==================== STEP 4 ==================== */
function setHasSavings(v,silent){
  S.hasSavings=v;
  $("hasSavingsYes").classList.toggle('sel',v===true);
  $("hasSavingsNo").classList.toggle('sel',v===false);
  $("savingsDetail").style.display = v===true?"block":"none";
  if(v===false){ S.capitalNow=""; S.monthlyNow=""; if($("capitalNow"))$("capitalNow").value=""; if($("monthlyNow"))$("monthlyNow").value=""; }
  if(!silent)saveLocal();
}

/* ==================== MOTOR DE CÁLCULO ==================== */
function normalizedAnnualCost(){
  var c=num($("uniCost")?$("uniCost").value:S.uniCost), unit=$("costUnit")?$("costUnit").value:S.costUnit, dur=S.duration||4;
  if(unit==="year")   return c;
  if(unit==="semester")return c*2;
  if(unit==="month")  return c*10;               // año lectivo ~10 meses
  if(unit==="career") return dur>0? c/dur : c;   // convertir total → anual
  return c;
}
function calc(){
  var n = yearsLeft();
  var dur = S.duration||4;
  var infl = (num($("inflRate")?$("inflRate").value:S.inflPct))/100;
  var r = CONFIG.rendimientoAnualDefault;
  var annualToday = normalizedAnnualCost();
  var extra = num($("extraCost")?$("extraCost").value:S.extraCost);
  var annualTodayFull = annualToday + extra;

  // A) costo total hoy
  var totalToday = annualTodayFull * dur;

  // B) costo futuro: cada año de carrera inflado según su año calendario
  var totalFuture = 0;
  for(var k=0;k<dur;k++){ totalFuture += annualTodayFull * Math.pow(1+infl, n + k); }

  // C) capital proyectado (capital actual + aporte mensual actual como anualidad)
  var capNow = num($("capitalNow")?$("capitalNow").value:S.capitalNow);
  var mNow = num($("monthlyNow")?$("monthlyNow").value:S.monthlyNow);
  var capProjected = fvLump(capNow, r, n) + fvAnnuity(mNow, r, n);

  // D) brecha
  var gap = Math.max(0, totalFuture - capProjected);

  // E) meta mensual para cerrar la brecha
  var monthly = pmtForFV(gap, r, n);

  return {n:n, dur:dur, infl:infl, r:r, annualToday:annualTodayFull, totalToday:totalToday,
          totalFuture:totalFuture, capNow:capNow, mNow:mNow, capProjected:capProjected, gap:gap, monthly:monthly};
}
// Valor futuro de un monto único
function fvLump(pv, r, years){ return pv * Math.pow(1+r, years); }
// Valor futuro de una anualidad mensual (aporte al final de cada mes)
function fvAnnuity(pmt, r, years){
  if(pmt<=0||years<=0) return 0;
  var i=r/12, n=years*12;
  if(i===0) return pmt*n;
  return pmt * (Math.pow(1+i,n)-1)/i;
}
// Aporte mensual necesario para alcanzar un FV objetivo
function pmtForFV(fv, r, years){
  if(fv<=0) return 0;
  if(years<=0) return fv; // sin tiempo: la "meta mensual" pierde sentido; devolvemos el total
  var i=r/12, n=years*12;
  if(i===0) return fv/n;
  return fv * i / (Math.pow(1+i,n)-1);
}
// Cobertura: qué FV alcanza un aporte mensual dado (para simulador y escenarios)
function fvOfMonthly(pmt, r, years){ return fvAnnuity(pmt, r, years) ; }

/* ==================== WOW COSTO FUTURO ==================== */
function paintWow(){
  var c=calc();
  $("wowYears").textContent=c.n;
  $("wowUniName").textContent = (S.uniType==="mente" && S.uniName)? S.uniName : "universidad estimada";
  animateNumber($("wowToday"), 0, c.totalToday, 900);
  setTimeout(function(){ animateNumber($("wowFuture"), c.totalToday, c.totalFuture, 1400); }, 700);
  track('future_cost_viewed',{future:Math.round(c.totalFuture)});
}

/* ==================== GATE + LEAD ==================== */
function buildLead(){
  var c=calc();
  return {
    agenteID:CONFIG.agenteID, recurso:"calculadora-meta-universitaria",
    nombrePadre:(S.lead&&S.lead.nombre)||"", whatsapp:(S.lead&&S.lead.whatsapp)||"", email:(S.lead&&S.lead.email)||"",
    consentimiento:!!(S.lead&&S.lead.consent), timestamp:new Date().toISOString(), referidoPor:window._referidoPor||null,
    // variables útiles para el asesor (no bancarias)
    nombreHijo:(S.noName?"":S.childName)||"", edadHijo:num($("childAge").value), edadUniversidad:num($("uniAge").value)||18,
    anosRestantes:c.n, tipoUniversidad:S.uniType, duracionCarrera:c.dur, inflacionEducativa:c.infl,
    costoActualEstimado:Math.round(c.totalToday), costoFuturoEstimado:Math.round(c.totalFuture),
    capitalActual:Math.round(c.capNow), aportacionActual:Math.round(c.mNow),
    brechaEstimada:Math.round(c.gap), metaMensualEstimada:Math.round(c.monthly), moneda:S.currency
  };
}
function sendLeadToCRM(lead){
  var hostedPayload = Object.assign({}, lead, { nombre: lead.nombrePadre || "Padre/Madre", fecha: lead.timestamp, consentimiento_fecha: lead.timestamp });
  fetch('/api/public/mini-apps/'+META_UNI_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
  if(!CONFIG.webhookURL)return;
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
    S.lead={nombre:nombre,whatsapp:wa,email:email,consent:true}; saveLocal();
    var lead=buildLead(); window._lead=lead; sendLeadToCRM(lead); track('lead_captured');
  }
  paintResult(); go2result();
}
function go2result(){
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  $("gprogWrap").style.display="none";
  document.querySelector('.step[data-step="result"]').classList.add('on');
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(animateResult);
  track('result_viewed');
}

/* ==================== RESULTADO ==================== */
var _calc=null;
function paintResult(){
  var c=calc(); _calc=c;
  var nm = (S.noName||!S.childName)? "" : (" de "+S.childName);
  $("resHeroName").textContent=nm;
  $("rsAge").textContent=num($("childAge").value);
  $("rsUni").textContent=num($("uniAge").value)||18;
  $("rsYears").textContent=c.n;

  var yearNow=new Date().getFullYear();
  $("tlNowYr").textContent=yearNow;
  $("tlEndYr").textContent=yearNow+c.n;

  // costflow
  $("cfToday").dataset.to=c.totalToday; $("cfFuture").dataset.to=c.totalFuture;

  // gap viz (barras relativas a la meta)
  var goal=c.totalFuture;
  $("gvGoal").textContent=fmt(goal);
  $("gvHave").textContent=fmt(c.capProjected);
  $("gvGap").textContent=fmt(c.gap);
  var haveW = goal>0? Math.min(100, c.capProjected/goal*100):0;
  var gapW = goal>0? Math.min(100, c.gap/goal*100):0;
  $("gvHaveBar").dataset.w=haveW; $("gvGapBar").dataset.w=gapW;

  // meta mensual
  $("goalUnit").textContent="por mes · "+S.currency;
  if(c.n<=0){
    $("goalMonthly").textContent=fmt(c.gap);
    $("goalUnit").textContent="necesario ahora · "+S.currency;
    $("goalQuote").textContent = cap(childRef())+" está en edad universitaria: la conversación ahora es cómo cubrir el costo con las opciones disponibles.";
  } else {
    $("goalMonthly").dataset.to=c.monthly;
    $("goalQuote").innerHTML = "Con <b>"+c.n+" años</b> por delante, la meta deja de ser "+fmt(c.gap)+" de golpe y se convierte en un plan mensual.";
  }

  buildScenarios(c);
  buildSimulator(c);

  // WhatsApp sin cifras sensibles
  var primer=(S.lead&&S.lead.nombre?S.lead.nombre.split(" ")[0]:"[tu nombre]");
  var hijoTxt = (S.noName||!S.childName)? "mi hijo/a" : S.childName;
  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+primer+".\\n\\nAcabo de hacer la Calculadora de Meta Universitaria para "+hijoTxt+".\\nFaltan aproximadamente "+c.n+" años para la universidad y me gustaría revisar contigo cómo podríamos prepararnos para esa meta.\\n\\n¿Podemos verlo?";
  $("waBtn").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
  if(CONFIG.calendlyURL) $("calendlyBtn").style.display="flex";
}
function animateResult(){
  animateNumber($("cfToday"), 0, num($("cfToday").dataset.to), 900);
  animateNumber($("cfFuture"), 0, num($("cfFuture").dataset.to), 1200);
  if($("goalMonthly").dataset.to) animateNumber($("goalMonthly"), 0, num($("goalMonthly").dataset.to), 1100);
  var yl=_calc?_calc.n:0; $("tlFill").style.width="100%";
  requestAnimationFrame(function(){
    if($("gvHaveBar").dataset.w)$("gvHaveBar").style.width=$("gvHaveBar").dataset.w+"%";
    if($("gvGapBar").dataset.w)$("gvGapBar").style.width=$("gvGapBar").dataset.w+"%";
  });
}

/* ---- Hoy vs esperar ---- */
function buildScenarios(c){
  var w=$("scenarios"); w.innerHTML="";
  if(c.n<=0){ w.innerHTML='<div class="scen"><div class="sd"><div class="st">Sin tiempo de espera</div><div class="ss">La universidad ya está por comenzar</div></div></div>'; $("waitQuote").textContent=""; return; }
  var waits=[0]; if(c.n-3>=1)waits.push(3); if(c.n-5>=1)waits.push(5);
  waits.forEach(function(wy){
    var yearsThen=c.n-wy;
    var m = pmtForFV(c.gap, c.r, yearsThen);
    var scen=document.createElement("div"); scen.className="scen"+(wy===0?" now":"");
    var label = wy===0? "Empezando hoy" : ("Si esperas "+wy+" año"+(wy>1?"s":""));
    var sub = wy===0? (c.n+" años para la meta") : (yearsThen+" años restantes");
    scen.innerHTML=(wy===0?'<span class="tag">Recomendado</span>':'')+'<div class="sd"><div class="st">'+label+'</div><div class="ss">'+sub+'</div></div><div class="sv">'+fmt(m)+'<span style="font-size:12px;color:var(--muted);font-weight:400"> /mes</span></div>';
    w.appendChild(scen);
  });
  if(waits.length>1){
    var mNow=pmtForFV(c.gap,c.r,c.n), mLast=pmtForFV(c.gap,c.r,c.n-waits[waits.length-1]);
    var factor = mNow>0? (mLast/mNow):1;
    $("waitQuote").innerHTML="Esperar puede casi <b>"+(factor>=1.9?"duplicar":"aumentar")+"</b> el esfuerzo mensual. El tiempo es la parte del plan que no se recupera.";
  } else $("waitQuote").textContent="";
}

/* ---- Simulador ---- */
function buildSimulator(c){
  var suggested = Math.max(500, Math.round((c.monthly||3000)/250)*250);
  var max = Math.max(20000, Math.ceil(suggested*2/1000)*1000);
  var sl=$("simSlider"); sl.min=500; sl.max=max; sl.step=250; sl.value=Math.min(max,suggested);
  $("simMin").textContent=fmt(500); $("simMax").textContent=fmt(max);
  onSim();
}
function onSim(){
  if(!_calc) _calc=calc();
  var m=num($("simSlider").value);
  var proj = fvLump(_calc.capNow,_calc.r,_calc.n) + fvAnnuity(m,_calc.r,_calc.n);
  var pct = _calc.totalFuture>0? Math.min(100, proj/_calc.totalFuture*100):0;
  $("simAmount").textContent=fmt(m);
  $("simProj").textContent=fmt(proj);
  $("simBar").style.width=pct+"%";
  $("simPct").textContent=Math.round(pct)+"%";
  track('scenario_changed',{monthly:m});
}

/* ---- Contador animado (respeta moneda) ---- */
function animateNumber(elm, from, to, dur){
  var t0=performance.now();
  (function tick(t){
    var p=Math.min(1,(t-t0)/dur), v=from+(to-from)*(1-Math.pow(1-p,3));
    elm.textContent=fmt(v); if(p<1)requestAnimationFrame(tick);
  })(t0);
}

/* ==================== Compartir / reiniciar ==================== */
function shareCalc(){
  track('resource_shared');
  var url=location.origin+location.pathname+"?ref="+encodeURIComponent(CONFIG.agenteID);
  var data={title:"Calculadora de Meta Universitaria", text:"Calcula cuánto necesitarás para la universidad de tus hijos y qué preparar desde hoy:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard && navigator.clipboard.writeText(url); toast(); }
}
function restart(){
  if(!confirm("¿Crear una meta nueva para otro hijo? Se limpiarán los datos actuales de este dispositivo.")) return;
  try{ localStorage.removeItem(LS_KEY); }catch(e){}
  location.href=location.origin+location.pathname+(window._referidoPor?("?ref="+encodeURIComponent(window._referidoPor)):"");
}


/* ==================== Wiring de botones (ids agregados en integración) ==================== */
document.getElementById('btnStart').addEventListener('click', startCalc);
document.getElementById('childBack').addEventListener('click', function(){ go('intro'); });
document.getElementById('childNext').addEventListener('click', function(){ go('uni'); });
document.getElementById('uniBack').addEventListener('click', function(){ go('child'); });
document.getElementById('uniNext').addEventListener('click', function(){ go('duration'); });
document.getElementById('durationBack').addEventListener('click', function(){ go('uni'); });
document.getElementById('durationNext').addEventListener('click', function(){ go('savings'); });
document.getElementById('hasSavingsYes').addEventListener('click', function(){ setHasSavings(true); });
document.getElementById('hasSavingsNo').addEventListener('click', function(){ setHasSavings(false); });
document.getElementById('savingsBack').addEventListener('click', function(){ go('duration'); });
document.getElementById('savingsNext').addEventListener('click', function(){ go('wow'); });
document.getElementById('wowBack').addEventListener('click', function(){ go('savings'); });
document.getElementById('wowNext').addEventListener('click', function(){ go('gate'); });
document.getElementById('revealBtn').addEventListener('click', function(){ revealResult(); });
document.getElementById('skipLeadBtn').addEventListener('click', function(){ revealResult(true); });
document.getElementById('waBtn').addEventListener('click', function(){ track('whatsapp_clicked'); });
document.getElementById('calendlyBtn').addEventListener('click', function(){ track('calendly_clicked'); });
document.getElementById('shareBtn').addEventListener('click', shareCalc);
document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('fab').addEventListener('click', function(){ track('whatsapp_clicked'); });

`;
