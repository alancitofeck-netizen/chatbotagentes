/**
 * Calculadora de Ahorro Fiscal — HTML/CSS/JS verbatim (archivo original del
 * usuario, "Ahorro fiscal FINAL.html") partido en 3 constantes exportadas,
 * mismo patrón que metaUniversitariaTemplate.ts/kitEmergenciaTemplate.ts:
 *
 * - Los Google Fonts <link> del <head> original (Fraunces + Hanken Grotesk)
 *   se movieron a AhorroFiscalApp.tsx — Next.js los auto-hoistea.
 * - CONFIG ya no es un objeto hardcodeado: se reconstruye desde
 *   `window.__AHORRO_FISCAL_DATA__`, inyectado por AhorroFiscalApp.tsx a
 *   partir del `config.brand` real del Mini App (mismo patrón que Meta
 *   Universitaria). Se agregó el beacon `/api/public/mini-apps/{slug}/visit`
 *   al cargar, igual que los demás templates.
 * - `sendLeadToCRM` gana un POST a `/api/public/mini-apps/{slug}/hosted-lead`
 *   con TODOS los inputs fiscales crudos tomados directo de `S` (no del
 *   objeto `lead` que arma `buildLead()`, que censura los montos si
 *   `SEND_FINANCIAL_DETAILS` es false) — el CRM propio de Growth Link
 *   siempre necesita los datos completos para el recómputo autoritativo en
 *   ingest.ts, independientemente de ese toggle de privacidad pensado solo
 *   para el webhook externo opcional.
 * - TAX_CONFIG (motor fiscal ISR/PPR/EFI/colegiaturas 2026) y el resto de la
 *   lógica (incluyendo las decenas de atributos `onclick="..."` inline)
 *   quedan intactos, sin envolver en un IIFE — mismo criterio que
 *   metaUniversitariaTemplate.ts: las funciones top-level SÍ deben colgar de
 *   `window` para que esos `onclick` inline las encuentren.
 */

export const AHORRO_FISCAL_CSS = `

  :root{
    --ink:#241E33; --ink-soft:#4A4260;
    --accent:#6D4AA0; --accent-d:#553A81; --accent-2:#8B6BC2;
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
  .btn.teal{background:linear-gradient(145deg,#3FA595,var(--teal));box-shadow:0 14px 26px -12px rgba(46,139,127,.5)}
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

  .opts{display:flex;flex-direction:column;gap:12px}
  .opt{display:flex;align-items:center;gap:15px;width:100%;text-align:left;cursor:pointer;background:var(--paper);border:2px solid transparent;border-radius:16px;padding:17px 18px;box-shadow:var(--shadow-soft);transition:.18s;font-family:var(--f)}
  .opt:hover{transform:translateY(-2px)}
  .opt.sel{border-color:var(--accent);box-shadow:0 12px 26px -12px rgba(109,74,160,.42)}
  .opt .ic{width:42px;height:42px;flex:0 0 auto;border-radius:12px;background:rgba(109,74,160,.1);color:var(--accent);display:grid;place-items:center;transition:.18s}
  .opt.sel .ic{background:var(--accent);color:#fff}
  .opt .ox b{font-size:15.5px;font-weight:700;display:block}
  .opt .ox span{font-size:12.5px;color:var(--muted)}

  .quick{display:flex;gap:10px;flex-wrap:wrap}
  .quick button{flex:1;min-width:64px;font-family:var(--f);font-size:15px;font-weight:700;padding:14px 8px;border:1.5px solid var(--line);border-radius:13px;background:var(--paper);color:var(--ink);cursor:pointer;transition:.16s;box-shadow:var(--shadow-soft)}
  .quick button:hover{transform:translateY(-1px)}
  .quick button.sel{background:var(--accent);border-color:var(--accent);color:#fff}

  .chips{display:flex;flex-wrap:wrap;gap:9px}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid var(--line);border-radius:30px;background:var(--paper);cursor:pointer;font-size:13.5px;font-weight:600;color:var(--ink-soft);transition:.16s}
  .chip.on{border-color:var(--accent);background:rgba(109,74,160,.08);color:var(--accent-d)}

  .tip{font-size:12.5px;color:var(--muted);background:var(--cream);border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-top:8px;line-height:1.5;display:flex;gap:9px}
  .tip svg{flex:0 0 auto;color:var(--amber-d);margin-top:1px}

  .liveband{background:linear-gradient(135deg,rgba(109,74,160,.1),rgba(201,138,60,.08));border:1px solid var(--line);border-radius:15px;padding:15px 17px;margin-top:16px;text-align:center;font-size:15px;font-weight:600;color:var(--accent-d)}
  .liveband b{font-family:var(--f-d);font-weight:700}

  .timeline{margin:18px 0 4px}
  .tl-track{position:relative;height:4px;background:var(--line);border-radius:4px;margin:26px 6px 8px}
  .tl-fill{position:absolute;left:0;top:0;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--accent-2),var(--accent));transition:width 1s cubic-bezier(.22,1,.36,1)}
  .tl-dot{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:var(--accent);transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(109,74,160,.18)}
  .tl-dot.end{background:var(--amber);box-shadow:0 0 0 4px rgba(201,138,60,.2)}
  .tl-labels{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
  .tl-labels b{color:var(--ink);font-weight:700;display:block;font-size:13px}

  .wow{text-align:center;padding:14px 4px}
  .wow .wlabel{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .wow .wnum{font-family:var(--f-d);font-weight:700;font-size:clamp(34px,9vw,48px);line-height:1.05;letter-spacing:-.02em;margin:4px 0}
  .wow .wnum.future{color:var(--accent-d)}
  .wow .warrow{width:44px;height:44px;margin:14px auto;border-radius:50%;background:rgba(109,74,160,.1);display:grid;place-items:center;color:var(--accent)}
  .wow .wsub{font-size:12.5px;color:var(--muted-2)}
  .wow-quote{font-family:var(--f-d);font-size:18px;font-style:italic;color:var(--ink-soft);line-height:1.45;max-width:400px;margin:24px auto 0}

  .consent{display:flex;gap:11px;align-items:flex-start;margin:6px 0 20px;font-size:12.5px;color:var(--muted);line-height:1.5}
  .consent input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
  .consent a{color:var(--ink);text-decoration:underline}

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

  /* ===== específico Calculadora de Ahorro Fiscal ===== */
  .split2{display:grid;grid-template-columns:1fr;gap:14px}
  @media (min-width:640px){ .split2{grid-template-columns:1fr 1fr} }
  .taxpanel{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px 20px 22px;box-shadow:var(--shadow-soft);position:relative}
  .taxpanel.before{border-top:3px solid var(--muted-2)}
  .taxpanel.after{border-top:3px solid var(--teal)}
  .taxpanel .tp-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--muted)}
  .taxpanel.after .tp-label{color:var(--teal)}
  .taxpanel .tp-row{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;font-size:13px;color:var(--muted)}
  .taxpanel .tp-row b{font-family:var(--f-d);font-size:15px;color:var(--ink);font-weight:600}
  .taxpanel .tp-isr{margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
  .taxpanel .tp-isr .l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .taxpanel .tp-isr .v{font-family:var(--f-d);font-weight:700;font-size:clamp(24px,6vw,30px);margin-top:4px}
  .taxpanel.after .tp-isr .v{color:var(--teal)}

  .vsdot{width:34px;height:34px;border-radius:50%;background:var(--paper);border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--f-d);font-weight:700;font-size:12px;color:var(--muted);margin:0 auto;flex:0 0 auto}

  .ahorro-hero{text-align:center;background:linear-gradient(150deg,var(--teal),#256F63);color:#fff;border-radius:20px;padding:26px 22px;margin:20px 0;box-shadow:0 20px 44px -22px rgba(46,139,127,.55)}
  .ahorro-hero .al{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.9;font-weight:700}
  .ahorro-hero .av{font-family:var(--f-d);font-size:clamp(38px,10vw,52px);font-weight:700;line-height:1;margin:6px 0}
  .ahorro-hero .au{font-size:13px;opacity:.92}

  .balance-box{display:flex;gap:12px;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:16px 0;box-shadow:var(--shadow-soft);align-items:flex-start}
  .balance-box .bi{width:36px;height:36px;border-radius:10px;background:rgba(46,139,127,.1);color:var(--teal);display:grid;place-items:center;flex:0 0 auto}
  .balance-box.warn .bi{background:rgba(197,106,87,.12);color:var(--coral)}
  .balance-box b{display:block;font-size:14.5px}
  .balance-box span{font-size:12.5px;color:var(--muted);line-height:1.5}

  .cascade{margin:22px 0}
  .cstep{background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:14px 16px;box-shadow:var(--shadow-soft);display:flex;justify-content:space-between;align-items:center}
  .cstep .cl{font-size:12px;color:var(--muted);font-weight:600}
  .cstep .cv{font-family:var(--f-d);font-size:18px;font-weight:700}
  .cstep.neg .cv{color:var(--coral)}
  .cstep.pos .cv{color:var(--teal)}
  .carrow{display:flex;justify-content:center;padding:6px 0;color:var(--muted-2)}

  .scenarios4{display:flex;flex-direction:column;gap:12px;margin:18px 0}
  .scard{background:var(--paper);border:1.5px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow-soft);position:relative;overflow:hidden}
  .scard.best{border-color:var(--teal)}
  .scard .stag{position:absolute;top:0;right:0;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#fff;background:var(--teal);padding:3px 10px;border-bottom-left-radius:10px}
  .scard .sname{font-size:13px;font-weight:700;color:var(--ink)}
  .scard .srow{display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;color:var(--muted)}
  .scard .srow b{font-family:var(--f-d);color:var(--ink);font-weight:700;font-size:14px}
  .scard .sahorro{margin-top:8px;font-size:12.5px;color:var(--teal);font-weight:700}

  .netcost{background:var(--cream);border:1px solid var(--line);border-radius:16px;padding:20px;margin:20px 0}
  .netcost .nrow{display:flex;justify-content:space-between;font-size:13.5px;color:var(--muted);margin-bottom:8px}
  .netcost .nrow b{color:var(--ink);font-family:var(--f-d);font-weight:700}
  .netcost .nfinal{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:baseline}
  .netcost .nfinal .l{font-size:13px;font-weight:700}
  .netcost .nfinal .v{font-family:var(--f-d);font-size:24px;font-weight:700;color:var(--accent-d)}

  .related{display:flex;flex-direction:column;gap:10px;margin:22px 0}
  .related a{display:flex;align-items:center;gap:13px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;box-shadow:var(--shadow-soft);transition:.16s}
  .related a:hover{transform:translateY(-1px)}
  .related .ri{width:36px;height:36px;border-radius:10px;background:rgba(109,74,160,.1);color:var(--accent);display:grid;place-items:center;flex:0 0 auto}
  .related b{display:block;font-size:14px}
  .related span{font-size:12px;color:var(--muted)}

  .print-only{display:none}
  @media print{
    .topbar,.fab,.toast,.gprog,.stepnav,.share-band,.restart,.privacy-note,#calendlyBtn,#waBtn,.cta-head,.related,.step:not([data-step="resultado"]){display:none !important}
    body{background:#fff !important}
    .print-only{display:block}
    .card,.taxpanel,.scard,.cascade .cstep,.netcost,.balance-box{box-shadow:none !important;break-inside:avoid}
  }

  /* ===== beneficios PPR (grid de 4) ===== */
  .benefits4{display:grid;grid-template-columns:1fr;gap:12px;margin:18px 0}
  @media (min-width:520px){ .benefits4{grid-template-columns:1fr 1fr} }
  .bcard{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow-soft)}
  .bcard .bi2{width:36px;height:36px;border-radius:10px;background:rgba(109,74,160,.1);color:var(--accent);display:grid;place-items:center;margin-bottom:10px}
  .bcard b{display:block;font-size:14.5px;margin-bottom:5px}
  .bcard span{font-size:12.5px;color:var(--muted);line-height:1.5}

  /* ===== tarjeta de asesor enriquecida ===== */
  .agentcard{background:var(--ink-deep,var(--ink));background:linear-gradient(150deg,var(--ink),var(--ink-soft));color:#fff;border-radius:20px;padding:26px 24px;margin:24px 0}
  .agentcard .ac-top{display:flex;gap:14px;align-items:center;margin-bottom:16px}
  .agentcard .ac-photo{width:56px;height:56px;border-radius:14px;background:linear-gradient(145deg,var(--accent-2),var(--accent));display:grid;place-items:center;font-family:var(--f-d);font-weight:600;font-size:18px;flex:0 0 auto;overflow:hidden}
  .agentcard .ac-photo img{width:100%;height:100%;object-fit:cover}
  .agentcard b{font-size:16px;display:block}
  .agentcard .ac-role{font-size:12.5px;color:var(--amber);font-weight:600}
  .agentcard .ac-cred{list-style:none;margin:0 0 18px;padding:0}
  .agentcard .ac-cred li{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:rgba(255,255,255,.82);margin-bottom:7px;line-height:1.4}
  .agentcard .ac-cred li svg{flex:0 0 auto;color:var(--lime,#2BE06E);margin-top:2px}

  /* ===== FAQ ===== */
  .faq{margin:20px 0}
  .faq-item{border-bottom:1px solid var(--line)}
  .faq-q{width:100%;text-align:left;background:none;border:none;padding:15px 4px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-family:var(--f);font-size:14.5px;font-weight:700;color:var(--ink);cursor:pointer}
  .faq-q svg{flex:0 0 auto;transition:transform .2s ease;color:var(--muted)}
  .faq-item.open .faq-q svg{transform:rotate(180deg)}
  .faq-a{max-height:0;overflow:hidden;transition:max-height .25s ease}
  .faq-item.open .faq-a{max-height:400px}
  .faq-a p{font-size:13.5px;color:var(--muted);line-height:1.6;padding:0 4px 16px}

  /* ===== proyección de retiro (opcional, hipotética) ===== */
  .proj-badge{display:inline-block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--amber-d);background:rgba(201,138,60,.12);padding:4px 10px;border-radius:20px;margin-bottom:10px}

`;

export const AHORRO_FISCAL_BODY_HTML = `

<div class="topbar">
  <div class="in">
    <div class="agent">
      <div class="ava" id="agentAva">AS</div>
      <div class="who"><b id="agentName">Nombre del Asesor</b><span id="agentTitle">Asesor financiero</span></div>
    </div>
    <div class="kit-name">Ahorro Fiscal</div>
  </div>
</div>
<div class="gprog" id="gprogWrap" style="display:none">
  <div class="track"><i id="gpbar"></i></div>
</div>

<div class="wrap">

  <!-- STEP 0 · INTRO -->
  <div class="step on" data-step="intro">
    <div class="eyebrow">Calculadora fiscal · México · 2026</div>
    <h1>¿Estás aprovechando <em>todas tus deducciones fiscales</em>?</h1>
    <p class="lede">Estima cuánto podría cambiar tu ISR utilizando las deducciones disponibles para tu situación.</p>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div><b>ISR estimado</b><span>Antes y después de tus deducciones</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div><div><b>Ahorro potencial</b><span>Qué tanto podría reducirse tu impuesto</span></div></div>
    <div class="benefit"><div class="bi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></div><div><b>Escenarios personalizados</b><span>Compara distintas estrategias</span></div></div>
    <div style="margin-top:24px"><button class="btn wide" onclick="startCalc()">Calcular mi ahorro fiscal →</button></div>
    <div class="privacy-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Cálculo estimativo con fines educativos. No sustituye asesoría fiscal. No te pediremos RFC, CURP ni contraseñas del SAT.</span></div>
  </div>

  <!-- STEP 1 · INGRESO -->
  <div class="step" data-step="ingreso">
    <div class="eyebrow">Paso 1 de 5</div>
    <h2>Empecemos por tus ingresos</h2>
    <p class="sec-sub">Usamos tu ingreso anual acumulable como base para la simulación.</p>
    <div class="card" style="padding:20px">
      <div class="field"><label>Ingreso anual acumulable</label><div class="money"><span class="cur">$</span><input type="number" id="ingresoAnual" min="0" placeholder="Ej. 800000" oninput="onIngresoAnualInput()"></div></div>
      <label class="inline-check"><input type="checkbox" id="noSeAnual" onchange="toggleIngresoMensual()"> No conozco mi ingreso anual, prefiero calcularlo desde mi ingreso mensual</label>
      <div id="ingresoMensualWrap" style="display:none;margin-top:14px">
        <div class="field" style="margin-bottom:0"><label>Ingreso mensual</label><div class="money"><span class="cur">$</span><input type="number" id="ingresoMensual" min="0" placeholder="Ej. 66667" oninput="onIngresoMensualInput()"></div></div>
      </div>
      <div class="liveband" id="ingresoLive" style="display:none"></div>
    </div>
    <div class="stepnav"><button class="btn ghost" onclick="go('intro')">← Atrás</button><button class="btn" id="ingresoNext" onclick="go('fiscal')" disabled>Continuar →</button></div>
  </div>

  <!-- STEP 2 · SITUACIÓN FISCAL + ISR RETENIDO -->
  <div class="step" data-step="fiscal">
    <div class="eyebrow">Paso 2 de 5</div>
    <h2>¿Cuál describe mejor tu situación fiscal?</h2>
    <p class="sec-sub">Esto nos ayuda a interpretar mejor tu resultado.</p>
    <div class="opts" id="fiscalOpts"></div>

    <div style="margin-top:22px">
      <div class="field"><label>¿Cuánto ISR ya te han retenido o pagado durante el año? <span class="opt">(opcional)</span></label>
        <div class="money"><span class="cur">$</span><input type="number" id="isrRetenido" min="0" placeholder="Ej. 130000" oninput="onIsrRetenidoInput()"></div>
        <p class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Si eres asalariado, normalmente puedes encontrarlo en tus recibos de nómina o tu constancia fiscal.</span></p>
        <label class="inline-check"><input type="checkbox" id="noSeISR" onchange="toggleNoSeISR()"> No lo sé</label>
      </div>
    </div>
    <div class="stepnav"><button class="btn ghost" onclick="go('ingreso')">← Atrás</button><button class="btn" id="fiscalNext" onclick="go('micro')" disabled>Continuar →</button></div>
  </div>

  <!-- STEP 2.5 · MICRORESULTADO -->
  <div class="step" data-step="micro">
    <div class="eyebrow">Tu escenario base</div>
    <h2>Ya podemos estimar tu escenario base</h2>
    <div class="card" style="padding:20px">
      <div class="gapviz" style="box-shadow:none;border:none;padding:0;margin:0">
        <div class="row"><div class="rl"><span>Ingreso anual</span><b id="microIngreso">$0</b></div></div>
        <div class="row"><div class="rl"><span>Situación fiscal</span><b id="microSituacion">—</b></div></div>
        <div class="row" style="margin-bottom:0"><div class="rl"><span>ISR retenido</span><b id="microISR">—</b></div></div>
      </div>
    </div>
    <p class="sec-sub" style="margin-top:18px;text-align:center">Ahora veamos qué deducciones ya estás aprovechando.</p>
    <div class="stepnav"><button class="btn ghost" onclick="go('fiscal')">← Atrás</button><button class="btn" onclick="go('deducciones')">Continuar →</button></div>
  </div>

  <!-- STEP 3 · DEDUCCIONES PERSONALES -->
  <div class="step" data-step="deducciones">
    <div class="eyebrow">Paso 3 de 5</div>
    <h2>¿Qué gastos deducibles realizas actualmente?</h2>
    <p class="sec-sub">Selecciona los que apliquen y registra el monto anual aproximado de cada uno.</p>
    <div class="chips" id="dedChips" style="margin-bottom:16px"></div>
    <div id="dedFields"></div>

    <div class="card" style="padding:18px 20px;margin-top:6px">
      <div class="field" style="margin-bottom:0"><label>¿Cursan colegiatura preescolar, primaria, secundaria, profesional técnico o bachillerato? <span class="opt">(opcional)</span></label>
        <select id="colNivel" onchange="onColegiaturaChange()">
          <option value="">No aplica</option>
          <option value="preescolar">Preescolar</option>
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
          <option value="profesionalTecnico">Profesional técnico</option>
          <option value="bachillerato">Bachillerato</option>
        </select>
      </div>
      <div id="colMontoWrap" style="display:none;margin-top:14px">
        <div class="field" style="margin-bottom:0"><label>Colegiatura anual pagada</label><div class="money"><span class="cur">$</span><input type="number" id="colMonto" min="0" placeholder="Ej. 30000" oninput="onColegiaturaChange()"></div></div>
        <p class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span id="colTopeTexto"></span></p>
      </div>
    </div>

    <div class="liveband" id="dedLive" style="margin-top:16px"></div>
    <div class="stepnav"><button class="btn ghost" onclick="go('micro')">← Atrás</button><button class="btn" onclick="go('ppr')">Continuar →</button></div>
  </div>

  <!-- STEP 4 · PPR -->
  <div class="step" data-step="ppr">
    <div class="eyebrow">Paso 4 de 5</div>
    <h2>¿Actualmente aportas a un Plan Personal de Retiro?</h2>
    <p class="sec-sub">Las aportaciones a un PPR tienen un tope de deducción propio, independiente de tus otras deducciones.</p>
    <div class="opts" style="margin-bottom:16px">
      <button class="opt" id="pprYes" onclick="setPprEstado('si')"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="ox"><b>Sí, ya aporto</b><span>Tengo un PPR activo</span></div></button>
      <button class="opt" id="pprNo" onclick="setPprEstado('no')"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="ox"><b>No, todavía no</b><span>Quiero simular una aportación</span></div></button>
      <button class="opt" id="pprEval" onclick="setPprEstado('evaluando')"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></div><div class="ox"><b>Lo estoy evaluando</b><span>Quiero ver el efecto antes de decidir</span></div></button>
    </div>

    <div id="pprActualWrap" style="display:none">
      <div class="field"><label>Monto anual aportado</label><div class="money"><span class="cur">$</span><input type="number" id="pprActual" min="0" placeholder="Ej. 80000" oninput="onPprSliderOrInput()"></div></div>
    </div>

    <div id="pprSimWrap" style="display:none">
      <div class="simbox" style="margin-top:6px">
        <h3>Simula una aportación anual</h3>
        <div class="simsub">Mueve el control para ver el efecto fiscal estimado.</div>
        <div class="simval"><b id="pprSimAmount">$0</b> <span>al año</span></div>
        <input type="range" id="pprSlider" min="0" max="200000" step="1000" value="0" oninput="onPprSliderOrInput()">
        <div class="simends"><span id="pprSimMin">$0</span><span id="pprSimMax">$200,000</span></div>
        <div class="gapviz" style="margin-top:4px">
          <div class="row"><div class="rl"><span>Monto deducible estimado</span><b id="pprDeducible">$0</b></div></div>
          <div class="row"><div class="rl"><span>Reducción estimada de base gravable</span><b id="pprReduccion">$0</b></div></div>
          <div class="row" style="margin-bottom:0"><div class="rl"><span>Impacto fiscal estimado</span><b id="pprImpacto">$0</b></div></div>
        </div>
        <p class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>El monto deducible nunca supera el <b>10% de tu ingreso anual</b> (<b id="pprTope10Label">$0</b>) ni el equivalente a <b>5 UMAs</b> (<b id="pprTopeUMALabel">$0</b>), lo que resulte menor. En tu caso, el tope aplicable es <b id="pprTopeLabel">$0</b>.</span></p>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-top:20px">
      <label class="inline-check" style="margin-bottom:12px"><input type="checkbox" id="efiCheck" onchange="onEfiToggle()"> También aporto (o quiero simular) una Cuenta Personal de Ahorro (Art. 185 LISR)</label>
      <div id="efiWrap" style="display:none">
        <div class="field" style="margin-bottom:0"><label>Depósito anual a la cuenta</label><div class="money"><span class="cur">$</span><input type="number" id="efiMonto" min="0" placeholder="Ej. 50000" oninput="onEfiToggle()"></div></div>
        <p class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Es un estímulo independiente del PPR y de tus deducciones generales (Art. 185 LISR), con un tope propio de <b>$152,000</b> anuales. A diferencia del PPR, todo lo que retires de esta cuenta (depósitos y rendimientos) se vuelve ingreso acumulable en el momento del retiro.</span></p>
      </div>
    </div>

    <div class="stepnav"><button class="btn ghost" onclick="go('deducciones')">← Atrás</button><button class="btn amber" onclick="go('gate')">Ver mi resultado →</button></div>
  </div>

  <!-- GATE -->
  <div class="step" data-step="gate">
    <div class="card" style="padding:30px 24px">
      <div class="eyebrow">Tu simulación fiscal está lista</div>
      <h2>Ingresa tus datos para ver la comparación completa</h2>
      <div class="ahorro-hero" style="margin:16px 0 22px">
        <div class="al">Ahorro fiscal estimado</div>
        <div class="av" id="gateTeaser">$0</div>
        <div class="au">Según los datos que ingresaste</div>
      </div>
      <div class="field"><label>Nombre completo</label><input type="text" id="leadName" placeholder="Tu nombre"></div>
      <div class="field"><label>WhatsApp <span class="opt">(10 dígitos)</span></label><input type="tel" id="leadWa" inputmode="tel" placeholder="Ej. 5512345678"></div>
      <div class="field"><label>Correo <span class="opt">(opcional)</span></label><input type="email" id="leadEmail" placeholder="tucorreo@ejemplo.com"></div>
      <label class="consent"><input type="checkbox" id="leadConsent"><span>Acepto recibir mi resultado y contacto de seguimiento de <b id="cName">Nombre del Asesor</b>, conforme al <a id="privacyLink" href="#" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label>
      <button class="btn" id="revealBtn" onclick="revealResult()">Ver mi resultado completo →</button>
      <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:14px">También puedes <button class="restart" style="display:inline;color:var(--accent-d)" onclick="revealResult(true)">continuar sin dejar datos</button></p>
    </div>
  </div>

  <!-- STEP WOW -->
  <div class="step" data-step="wow">
    <div class="eyebrow" style="justify-content:center">Tu simulación fiscal 2026</div>
    <h2 style="text-align:center">No se trata solo de pagar menos impuestos</h2>
    <div class="split2" style="margin-top:18px">
      <div class="taxpanel before">
        <div class="tp-label">Sin estrategia</div>
        <div class="tp-row"><span>Base gravable</span><b id="wowBaseSin">$0</b></div>
        <div class="tp-isr"><div class="l">ISR estimado</div><div class="v" id="wowIsrSin">$0</div></div>
      </div>
      <div class="taxpanel after">
        <div class="tp-label">Con tu escenario</div>
        <div class="tp-row"><span>Base gravable</span><b id="wowBaseCon">$0</b></div>
        <div class="tp-isr"><div class="l">ISR estimado</div><div class="v" id="wowIsrCon">$0</div></div>
      </div>
    </div>
    <div class="ahorro-hero">
      <div class="al">Ahorro fiscal potencial</div>
      <div class="av" id="wowAhorro">$0</div>
      <div class="au">Según los datos y supuestos utilizados en esta simulación</div>
    </div>
    <div class="stepnav"><button class="btn" onclick="go('resultado')" style="flex:1">Ver el detalle completo →</button></div>
  </div>

  <!-- RESULTADO COMPLETO -->
  <div class="step" data-step="resultado">
    <div class="res-hero">
      <div class="eyebrow" style="justify-content:center">Resultado completo · Ejercicio 2026</div>
    </div>

    <div id="balanceWrap"></div>

    <h3 style="font-family:var(--f-d);font-size:20px;font-weight:600;margin:26px 0 4px">A dónde se va tu dinero</h3>
    <p class="sec-sub" style="margin-bottom:16px">Del ingreso a la diferencia fiscal, paso a paso.</p>
    <div class="cascade" id="cascadeWrap"></div>

    <h3 style="font-family:var(--f-d);font-size:20px;font-weight:600;margin:30px 0 4px">Compara tus opciones</h3>
    <p class="sec-sub" style="margin-bottom:6px">Calculado dinámicamente a partir de tus propios datos.</p>
    <div class="scenarios4" id="scenariosWrap"></div>

    <!-- SLIDER PPR POST-RESULTADO -->
    <div class="simbox">
      <h3>Prueba diferentes aportaciones al PPR</h3>
      <div class="simsub">Ajusta el control y mira cómo cambia tu ISR estimado en tiempo real.</div>
      <div class="simval"><b id="postSimAmount">$0</b> <span>al año</span></div>
      <input type="range" id="postSlider" min="0" max="200000" step="1000" value="0" oninput="onPostSlider()">
      <div class="simends"><span id="postSimMin">$0</span><span id="postSimMax">$200,000</span></div>
      <div class="gapviz" style="margin-top:4px">
        <div class="row"><div class="rl"><span>Base gravable</span><b id="postBase">$0</b></div></div>
        <div class="row"><div class="rl"><span>ISR estimado</span><b id="postIsr">$0</b></div></div>
        <div class="row"><div class="rl"><span>Ahorro fiscal</span><b id="postAhorro">$0</b></div></div>
        <div class="row" style="margin-bottom:0"><div class="rl"><span>Tasa marginal estimada</span><b id="postTasa">0%</b></div></div>
      </div>
      <div class="netcost">
        <div class="nrow"><span>Aportación simulada</span><b id="netAportacion">$0</b></div>
        <div class="nrow"><span>Ahorro fiscal asociado a esta aportación</span><b id="netAhorro">$0</b></div>
        <div class="nfinal"><span class="l">Esfuerzo neto estimado</span><span class="v" id="netFinal">$0</span></div>
      </div>
      <p class="tip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>En este escenario, parte del efecto económico de tu aportación proviene de la reducción estimada de ISR. Esto no significa que el SAT pague tu retiro, ni que tu aportación "cueste" solamente el esfuerzo neto: es una lectura económica del escenario, no una promesa.</span></p>
    </div>

    <div class="cta-head">
      <h3>No solo se trata de pagar menos impuestos</h3>
      <p>Una estrategia fiscal puede permitir que parte de los recursos que de otra forma se destinarían al pago de impuestos permanezcan vinculados a objetivos financieros de largo plazo, siempre que la estrategia sea adecuada para tu situación.</p>
    </div>
    <div class="split2" style="margin:18px 0">
      <div class="benefit" style="margin-bottom:0"><div class="bi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><div><b>Retiro</b><span>Construir capital a largo plazo</span></div></div>
      <div class="benefit" style="margin-bottom:0"><div class="bi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg></div><div><b>Patrimonio</b><span>Fortalecer tu estructura financiera</span></div></div>
    </div>
    <div class="benefit"><div class="bi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><b>Protección</b><span>No todos los destinos aplican automáticamente a tu caso</span></div></div>

    <h3 style="font-family:var(--f-d);font-size:20px;font-weight:600;margin:30px 0 4px">Por qué vale la pena revisar esto con un asesor</h3>
    <div class="benefits4">
      <div class="bcard"><div class="bi2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><b>Reduces tu base gravable hoy</b><span>Cada peso deducido baja el ISR de este ejercicio, dentro de los topes que le apliquen a tu caso.</span></div>
      <div class="bcard"><div class="bi2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><b>El ISR se difiere, no desaparece</b><span>Los rendimientos de un PPR o una cuenta del Art. 185 no se acumulan año con año: el impuesto se paga hasta que retiras.</span></div>
      <div class="bcard"><div class="bi2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg></div><b>Construyes capital a largo plazo</b><span>El tiempo y el interés compuesto pueden ayudarte a construir un capital importante para el retiro — sin que esto sea un monto garantizado.</span></div>
      <div class="bcard"><div class="bi2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div><b>Respaldado por la Ley del ISR</b><span>El PPR (Art. 151-V) y las cuentas del Art. 185 son estímulos reconocidos por el SAT, no esquemas agresivos.</span></div>
    </div>

    <div class="agentcard">
      <div class="ac-top">
        <div class="ac-photo" id="acPhoto">AS</div>
        <div><b id="acName">Nombre del Asesor</b><div class="ac-role" id="acRole">Asesor financiero</div></div>
      </div>
      <ul class="ac-cred" id="acCred"></ul>
      <a class="btn wa wide" id="waBtn" href="#" target="_blank" rel="noopener" onclick="trackEvent('whatsapp_clicked')">Revisar mi estrategia por WhatsApp</a>
      <a class="btn wide dark" id="calendlyBtn" href="#" target="_blank" rel="noopener" style="margin-top:11px;display:none" onclick="trackEvent('calendly_clicked')">Agendar revisión →</a>
    </div>
    <button class="btn ghost wide" onclick="printReport()">Descargar / imprimir mi reporte fiscal</button>

    <div class="related" id="relatedWrap"></div>

    <h3 style="font-family:var(--f-d);font-size:20px;font-weight:600;margin:30px 0 4px">¿Tienes dudas sobre el PPR y el ISR?</h3>
    <p class="sec-sub">Resolvemos las preguntas más comunes sobre la declaración anual y el ahorro fiscal.</p>
    <div class="faq" id="faqWrap"></div>

    <div class="share-band">
      <h3>¿Conoces a alguien que también quiera saber si está aprovechando sus deducciones?</h3>
      <p>Comparte esta calculadora para que pueda hacer su propia simulación.</p>
      <button class="btn amber wide" onclick="shareCalc()">Compartir calculadora</button>
    </div>

    <button class="restart" onclick="restart()">↺ Empezar una nueva simulación</button>
    <div class="disclaimer">Esta calculadora proporciona estimaciones con fines educativos y de planeación. Los resultados dependen de la información ingresada, las reglas fiscales configuradas y las circunstancias particulares de cada contribuyente. No constituye asesoría fiscal, legal, contable ni una garantía de devolución. Antes de tomar decisiones fiscales o financieras, consulta a un profesional calificado.</div>
  </div>

  <div class="foot">Herramienta desarrollada por <b id="footAgent">Nombre del Asesor</b> · Growth Link</div>
</div>

<div class="toast" id="toast">Copiado</div>

<a class="fab" id="fab" href="#" target="_blank" rel="noopener" onclick="trackEvent('whatsapp_clicked')">
  <span class="ic"><svg width="27" height="27" viewBox="0 0 24 24" fill="#08331A"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg></span>
  <span class="lbl">¿Dudas? Habla con tu asesor</span>
</a>

`;

export const AHORRO_FISCAL_LOGIC_JS = `

/* ==================================================================
   CONFIG DEL AGENTE — Editá solo esto para replicar.
   ================================================================== */
const AF_DATA = window.__AHORRO_FISCAL_DATA__ || {};
const AF_BRAND = AF_DATA.brand || {};
const AF_SLUG = AF_DATA.slug || "";
fetch('/api/public/mini-apps/'+AF_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  agente:      AF_BRAND.advisorName || "Tu asesor",
  titulo:      AF_BRAND.title || "Asesor financiero",
  whatsapp:    AF_BRAND.whatsapp || "",
  email:       AF_BRAND.email || "",
  fotoURL:     AF_BRAND.photoURL || "",
  logoURL:     AF_BRAND.logoURL || "",
  agenteID:    AF_SLUG,
  calendlyURL: AF_BRAND.calendlyURL || "",
  webhookURL:  AF_BRAND.webhookURL || "",
  avisoPrivacidadURL: AF_BRAND.avisoPrivacidadURL || "",
  colorMarca:  AF_BRAND.colorMarca || "",
  urlRetiro:   AF_BRAND.urlRetiro || "",
  urlDiagnostico: AF_BRAND.urlDiagnostico || "",
  credenciales: Array.isArray(AF_BRAND.credenciales) && AF_BRAND.credenciales.length ? AF_BRAND.credenciales : [
    "Agente certificado",
    "Asesoría personalizada para tu perfil",
    "Vía WhatsApp o videollamada, a tu conveniencia"
  ],
  pais: "MX",
  moneda: "MXN",
  ejercicioFiscal: 2026
};

// Si es false, el webhook solo recibe contacto + categoría de oportunidad,
// sin montos fiscales detallados (ingreso, ISR, deducciones, PPR).
const SEND_FINANCIAL_DETAILS = true;

/* ==================================================================
   MOTOR FISCAL — TAX_CONFIG
   Parámetros verificados para el ejercicio 2026. Separado por completo
   de la interfaz: para actualizar a 2027, modificar solo este objeto.

   Fuentes:
   - Art. 152 LISR (tarifa anual) — RMF 2026, Anexo 8 (DOF 28/12/2025).
     Las tarifas 2026 son idénticas a 2024-2025 (sin actualización por
     inflación, no se alcanzó el umbral del 10% acumulado del último
     párrafo del Art. 152). Tabla validada por consistencia interna
     contra la tarifa mensual Art. 96 (mensual × 12 → anual en los 11
     tramos).
   - UMA 2026 — INEGI/DOF, publicado 08-09/01/2026, vigente desde el
     01/02/2026: $117.31 diaria / $3,566.22 mensual / $42,794.64 anual.
   - Límite deducciones personales generales — Art. 151, penúltimo
     párrafo LISR: menor entre 15% del ingreso o 5 UMAs anuales.
   - Límite PPR / CEA — Art. 151 fracción V LISR: menor entre 10% del
     ingreso o 5 UMAs anuales. Es un tope INDEPENDIENTE del de
     deducciones generales (no comparten bolsa).
   - Colegiaturas — Decreto presidencial (DOF, 2011), montos fijos NO
     indexados a UMA/inflación, vigentes para 2026: preescolar $14,200 ·
     primaria $12,900 · secundaria $19,900 · profesional técnico
     $17,100 · bachillerato $24,500. Tope independiente de la bolsa
     general de deducciones.

   NO VERIFICADO / fuera de alcance de este MVP (no se inventa, se deja
   fuera en vez de estimar):
   - Reglas específicas de RESICO (tasas fijas) y de arrendamiento
     (deducción ciega del 35%). Esta calculadora usa la tarifa general
     (Art. 152) para todas las situaciones fiscales, con una nota
     aclaratoria.
   - Transporte escolar obligatorio: se incluye dentro de la bolsa
     general de deducciones (no se encontró un tope propio verificable
     y separado).
   - Subsidio al empleo: solo aplica a ingresos muy bajos (~hasta
     $9,900/mes), fuera del perfil objetivo de esta herramienta.
   ================================================================== */
const TAX_CONFIG = {
  ejercicio: 2026,
  moneda: "MXN",
  uma: { diaria: 117.31, mensual: 3566.22, anual: 42794.64 },
  deduccionesPersonales: { limitePctIngreso: 0.15, limiteUMA: 5 },
  ppr: { limitePctIngreso: 0.10, limiteUMA: 5 },
  // Art. 185 LISR — Cuentas Personales del Ahorro (EFI). Tope FIJO en pesos
  // (no depende de UMA ni de %), independiente de las bolsas de PPR y de
  // deducciones generales. Fuente: Título VII Cap. I LISR; verificado por
  // múltiples fuentes coincidentes en $152,000 anuales.
  efi: { limiteMonto: 152000 },
  colegiaturas: {
    preescolar: 14200, primaria: 12900, secundaria: 19900,
    profesionalTecnico: 17100, bachillerato: 24500
  },
  tablaISRAnual: [
    {li:0.01,        ls:8952.49,       cf:0,          pct:0.0192},
    {li:8952.50,      ls:75984.55,      cf:171.88,     pct:0.0640},
    {li:75984.56,     ls:133536.07,     cf:4461.94,    pct:0.1088},
    {li:133536.08,    ls:155229.80,     cf:10723.55,   pct:0.1600},
    {li:155229.81,    ls:185852.57,     cf:14194.54,   pct:0.1792},
    {li:185852.58,    ls:374837.88,     cf:19682.13,   pct:0.2136},
    {li:374837.89,    ls:590795.99,     cf:60049.40,   pct:0.2352},
    {li:590796.00,    ls:1127926.84,    cf:110842.74,  pct:0.3000},
    {li:1127926.85,   ls:1503902.46,    cf:271981.99,  pct:0.3200},
    {li:1503902.47,   ls:4511707.37,    cf:392294.17,  pct:0.3400},
    {li:4511707.38,   ls:Infinity,      cf:1414947.85, pct:0.3500}
  ]
};

// Estrategias activables/desactivables (ver brief original, sección 10).
// Agregar una nueva estrategia acá no la habilita automáticamente en la UI:
// hay que sumarla también en computeAll() y en la interfaz correspondiente.
const TAX_STRATEGIES = {
  ppr: { enabled:true, limite: TAX_CONFIG.ppr },
  efi: { enabled:true, limite: TAX_CONFIG.efi }
};

function calculateEFIDeduction(monto){
  return { monto:monto||0, limite: TAX_CONFIG.efi.limiteMonto, aplicada: Math.min(monto||0, TAX_CONFIG.efi.limiteMonto) };
}

function validateTaxConfig(){
  const t = TAX_CONFIG.tablaISRAnual;
  if(!t || !t.length) throw new Error('TAX_CONFIG: falta la tabla ISR anual.');
  for(let i=0;i<t.length;i++){
    if(t[i].ls !== Infinity && t[i].ls <= t[i].li){
      console.error('TAX_CONFIG inválido: rango superpuesto en tramo', i, t[i]);
      return false;
    }
  }
  if(!TAX_CONFIG.uma || !TAX_CONFIG.uma.anual) { console.error('TAX_CONFIG: falta UMA anual.'); return false; }
  if(TAX_CONFIG.ejercicio !== CONFIG.ejercicioFiscal){
    console.warn('TAX_CONFIG.ejercicio no coincide con CONFIG.ejercicioFiscal');
  }
  return true;
}

/* ---- funciones puras del motor (testeables, sin DOM) ---- */
function calculateISR(base){
  if(base<=0) return 0;
  const tramo = TAX_CONFIG.tablaISRAnual.find(t => base>=t.li && base<=t.ls);
  if(!tramo) return 0;
  return tramo.cf + (base - tramo.li)*tramo.pct;
}
function tasaMarginal(base){
  const tramo = TAX_CONFIG.tablaISRAnual.find(t => base>=t.li && base<=t.ls);
  return tramo ? tramo.pct : 0;
}
function limiteDeduccionesGenerales(ingresoAnual){
  return Math.min(ingresoAnual*TAX_CONFIG.deduccionesPersonales.limitePctIngreso, TAX_CONFIG.deduccionesPersonales.limiteUMA*TAX_CONFIG.uma.anual);
}
function limitePPR(ingresoAnual){
  return Math.min(ingresoAnual*TAX_CONFIG.ppr.limitePctIngreso, TAX_CONFIG.ppr.limiteUMA*TAX_CONFIG.uma.anual);
}
function calculatePersonalDeductions(items, ingresoAnual){
  const suma = (items.medicos||0)+(items.dentales||0)+(items.hospitalarios||0)+(items.seguroGMM||0)+
               (items.interesesHipotecarios||0)+(items.donativos||0)+(items.transporteEscolar||0)+(items.otros||0);
  const limite = limiteDeduccionesGenerales(ingresoAnual);
  const generalAplicada = Math.min(suma, limite);
  const colegiaturasAplicada = Math.min(items.colegiaturasMonto||0, items.colegiaturasTope||0);
  return { sumaRegistrada:suma, limite, generalAplicada, colegiaturasAplicada, totalAplicado: generalAplicada+colegiaturasAplicada };
}
function calculatePPRDeduction(aportacion, ingresoAnual){
  const limite = limitePPR(ingresoAnual);
  return { aportacion:aportacion||0, limite, aplicada: Math.min(aportacion||0, limite) };
}
function calculateTaxableBase(ingresoAnual, totalDeducciones){ return Math.max(0, ingresoAnual - totalDeducciones); }
function calculateTaxSavings(isrSin, isrCon){ return Math.max(0, isrSin - isrCon); }
function calculateEstimatedBalance(isrRetenido, isrCon){ if(isrRetenido==null) return null; return isrRetenido - isrCon; }

/* ==================== Estado (en memoria, sin localStorage) ==================== */
var S = {
  ingresoAnual:"", situacionFiscal:"", isrRetenido:"", isrRetenidoConocido:true,
  ded:{ medicos:0,dentales:0,hospitalarios:0,seguroGMM:0,interesesHipotecarios:0,donativos:0,transporteEscolar:0,otros:0 },
  dedSel:[], colNivel:"", colMonto:0,
  pprEstado:"", pprActual:0, pprSim:0, efiMonto:0,
  lead:null
};
function $(id){ return document.getElementById(id); }
function num(v){ v=parseFloat(v); return isFinite(v)?v:0; }
function fmt(v){ v=Math.round(v); return "$"+v.toLocaleString('es-MX'); }
function trackEvent(ev,data){ try{ console.log("[trackEvent]",ev,data||""); }catch(e){} }
var toastT; function toast(msg){ var el=$("toast"); if(msg)el.textContent=msg; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1400); }

/* ==================== Catálogos ==================== */
var FAQS = [
  {q:"¿Qué es un Plan Personal de Retiro (PPR)?",
   a:"Es una cuenta o plan de inversión reconocido por el Artículo 151, fracción V de la LISR, pensado específicamente para el retiro. Tus aportaciones son deducibles de tu declaración anual, dentro de los topes que le apliquen a tu situación."},
  {q:"¿Cómo funciona la relación entre el PPR y mi ISR?",
   a:"Al aportar a tu PPR, reduces tu base gravable del ejercicio, lo que baja el ISR que causas. Esto no es automáticamente una \"devolución\": si ya tenías ISR retenido de más durante el año, ese exceso puede convertirse en saldo a favor; si no, simplemente pagas menos ISR del que hubieras pagado sin la aportación."},
  {q:"¿Cuál es el límite de deducción del PPR en 2026?",
   a:"El menor entre el 10% de tu ingreso anual acumulable y el equivalente a 5 UMAs anuales ($213,973.20 en 2026). Es un tope independiente de tus otras deducciones personales."},
  {q:"¿Qué son las deducciones personales del 15%?",
   a:"Son gastos como médicos, dentales, hospitalarios, primas de seguro de gastos médicos, intereses hipotecarios y donativos, entre otros (Art. 151 LISR). Su tope conjunto es el menor entre el 15% de tu ingreso anual o 5 UMAs. Las colegiaturas y las aportaciones a planes de retiro tienen topes propios, independientes de esta bolsa."},
  {q:"¿Puedo combinar el PPR con otras deducciones?",
   a:"Sí. El tope del PPR (Art. 151-V) y el de las deducciones generales (Art. 151, penúltimo párrafo) son independientes entre sí: no comparten la misma bolsa. Además existe un tercer tope independiente para las cuentas del Art. 185 (EFI)."},
  {q:"¿Necesito ser asalariado para aprovechar el PPR?",
   a:"No. Cualquier persona física con ingresos acumulables (sueldos, honorarios, actividad empresarial, arrendamiento) puede aportar a un PPR y deducirlo, dentro de los topes correspondientes."},
  {q:"¿Qué pasa con mi dinero en el PPR si lo quiero retirar antes del retiro?",
   a:"Un retiro anticipado (antes de los 65 años o de cumplir los requisitos de permanencia) suele generar una retención provisional de ISR, comúnmente del 20% sobre el interés real, según el instrumento y las condiciones del plan. Por eso este tipo de cuentas se piensan para el largo plazo."},
  {q:"¿Qué diferencia hay entre el PPR y una cuenta del Art. 185?",
   a:"Ambos son deducibles y tienen topes independientes entre sí, pero se gravan distinto al retirar: en el PPR ciertos retiros al llegar a la edad de retiro pueden tener un tratamiento preferencial, mientras que en las cuentas del Art. 185, todo lo retirado (depósito más rendimiento) se vuelve ingreso acumulable en ese momento. Tu asesor puede ayudarte a decidir cuál conviene más para tu caso."},
  {q:"¿Quién puede ayudarme a estructurar correctamente mi estrategia fiscal?",
   a:"Un asesor puede revisar tu situación particular, confirmar qué topes te aplican y ayudarte a decidir cómo distribuir tus aportaciones entre las distintas opciones disponibles."}
];

var SITUACIONES = [
  {id:"sueldos", t:"Sueldos y salarios", s:"Trabajo en relación de dependencia"},
  {id:"honorarios", t:"Servicios profesionales / honorarios", s:"Facturo por servicios independientes"},
  {id:"empresarial", t:"Actividad empresarial", s:"Tengo un negocio propio"},
  {id:"arrendamiento", t:"Arrendamiento", s:"Rento inmuebles"},
  {id:"mixtos", t:"Ingresos mixtos", s:"Combino dos o más regímenes"},
  {id:"otro", t:"Otro", s:"Mi situación es distinta"}
];
var DEDUCCIONES = [
  {id:"medicos", label:"Gastos médicos"},
  {id:"dentales", label:"Gastos dentales"},
  {id:"hospitalarios", label:"Hospitalarios"},
  {id:"seguroGMM", label:"Primas de seguro de gastos médicos"},
  {id:"interesesHipotecarios", label:"Intereses reales hipotecarios"},
  {id:"donativos", label:"Donativos"},
  {id:"transporteEscolar", label:"Transporte escolar obligatorio"},
  {id:"otros", label:"Otros conceptos autorizados"}
];

/* ==================== Init ==================== */
(function init(){
  if(!validateTaxConfig()){
    document.body.innerHTML = '<div style="max-width:480px;margin:60px auto;padding:24px;font-family:sans-serif;text-align:center"><h2>Error de configuración</h2><p>Hay un problema con los parámetros fiscales (TAX_CONFIG). Revisa la consola y corrige antes de usar esta herramienta.</p></div>';
    return;
  }
  if(CONFIG.colorMarca){ document.documentElement.style.setProperty('--accent',CONFIG.colorMarca); }
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  $("agentName").textContent=CONFIG.agente; $("agentTitle").textContent=CONFIG.titulo;
  $("cName").textContent=CONFIG.agente; $("footAgent").textContent=CONFIG.agente;
  $("acName").textContent=CONFIG.agente; $("acRole").textContent=CONFIG.titulo+" · sin costo";
  $("privacyLink").href=CONFIG.avisoPrivacidadURL||"#";
  if(CONFIG.fotoURL||CONFIG.logoURL){ var src=CONFIG.fotoURL||CONFIG.logoURL;
    $("agentAva").innerHTML='<img src="'+src+'" alt="">'; $("acPhoto").innerHTML='<img src="'+src+'" alt="">';
  } else { $("agentAva").textContent=initials; $("acPhoto").textContent=initials; }
  (CONFIG.credenciales||[]).forEach(function(c){
    var li=document.createElement('li');
    li.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>'+c+'</span>';
    $("acCred").appendChild(li);
  });
  $("fab").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent("Hola "+CONFIG.agente.split(" ")[0]+", tengo una duda sobre la Calculadora de Ahorro Fiscal.");
  if(CONFIG.calendlyURL){ $("calendlyBtn").href=CONFIG.calendlyURL; $("calendlyBtn").style.display="flex"; }

  renderFiscalOpts(); renderDedChips(); renderFAQ();
  var ref=new URLSearchParams(location.search).get('ref'); if(ref) window._referidoPor=ref;
  trackEvent('tax_calculator_started');
})();

/* ==================== Navegación ==================== */
var STEPS=["ingreso","fiscal","micro","deducciones","ppr"];
function go(step){
  if(step==="micro") paintMicro();
  if(step==="gate") paintGateTeaser();
  if(step==="ppr" && (S.pprEstado==='no'||S.pprEstado==='evaluando')){ refreshPprSlider(); onPprSliderOrInput(); }
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('on'); });
  document.querySelector('.step[data-step="'+step+'"]').classList.add('on');
  var idx=STEPS.indexOf(step);
  $("gprogWrap").style.display = idx>=0 ? "block":"none";
  if(idx>=0){ $("gpbar").style.width=Math.round((idx+1)/STEPS.length*100)+"%"; }
  window.scrollTo({top:0,behavior:'smooth'});
  trackEvent('section_view',{step:step});
}
function startCalc(){ trackEvent('tax_calculator_started'); go('ingreso'); }

/* ==================== STEP 1 · INGRESO ==================== */
function onIngresoAnualInput(){
  S.ingresoAnual = num($("ingresoAnual").value);
  $("ingresoNext").disabled = !(S.ingresoAnual>0);
  trackEvent('income_completed',{ingresoAnual:S.ingresoAnual});
}
function toggleIngresoMensual(){
  var on=$("noSeAnual").checked; $("ingresoMensualWrap").style.display=on?"block":"none";
  if(on){ $("ingresoAnual").value=""; S.ingresoAnual=0; $("ingresoNext").disabled=true; $("ingresoLive").style.display="none"; }
}
function onIngresoMensualInput(){
  var m=num($("ingresoMensual").value), anual=m*12;
  $("ingresoAnual").value = anual||"";
  S.ingresoAnual = anual;
  var lb=$("ingresoLive");
  if(m>0){ lb.style.display="block"; lb.innerHTML='Ingreso anual estimado<br><b>'+fmt(anual)+' '+CONFIG.moneda+'</b>'; }
  else lb.style.display="none";
  $("ingresoNext").disabled = !(anual>0);
}

/* ==================== STEP 2 · SITUACIÓN FISCAL ==================== */
function renderFiscalOpts(){
  var w=$("fiscalOpts"); w.innerHTML="";
  SITUACIONES.forEach(function(o){
    var b=document.createElement("button"); b.className="opt"; b.id="sit_"+o.id;
    b.innerHTML='<div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg></div><div class="ox"><b>'+o.t+'</b><span>'+o.s+'</span></div>';
    b.onclick=function(){ selectSituacion(o.id); };
    w.appendChild(b);
  });
}
function selectSituacion(id){
  S.situacionFiscal=id;
  document.querySelectorAll('#fiscalOpts .opt').forEach(function(x){x.classList.remove('sel')});
  $("sit_"+id).classList.add('sel');
  checkFiscalNext();
  trackEvent('tax_profile_completed',{situacion:id});
}
function onIsrRetenidoInput(){
  S.isrRetenido = num($("isrRetenido").value);
  if(S.isrRetenido>0){ $("noSeISR").checked=false; S.isrRetenidoConocido=true; }
  checkFiscalNext();
}
function toggleNoSeISR(){
  var on=$("noSeISR").checked;
  if(on){ $("isrRetenido").value=""; $("isrRetenido").disabled=true; S.isrRetenido=null; S.isrRetenidoConocido=false; }
  else { $("isrRetenido").disabled=false; S.isrRetenidoConocido=true; }
  checkFiscalNext();
}
function checkFiscalNext(){ $("fiscalNext").disabled = !(S.situacionFiscal); }

/* ==================== MICRORESULTADO ==================== */
function paintMicro(){
  $("microIngreso").textContent = fmt(S.ingresoAnual);
  var sit = SITUACIONES.find(function(s){return s.id===S.situacionFiscal});
  $("microSituacion").textContent = sit? sit.t : "—";
  $("microISR").textContent = S.isrRetenidoConocido && S.isrRetenido>0 ? fmt(S.isrRetenido) : "No especificado";
}

/* ==================== STEP 3 · DEDUCCIONES ==================== */
function renderDedChips(){
  var w=$("dedChips"); w.innerHTML="";
  DEDUCCIONES.forEach(function(d){
    var b=document.createElement("button"); b.className="chip"; b.textContent=d.label; b.id="chip_"+d.id;
    b.onclick=function(){ toggleDed(d.id); };
    w.appendChild(b);
  });
}
function toggleDed(id){
  var i=S.dedSel.indexOf(id);
  if(i>=0){ S.dedSel.splice(i,1); S.ded[id]=0; } else { S.dedSel.push(id); }
  $("chip_"+id).classList.toggle('on', S.dedSel.indexOf(id)>=0);
  renderDedFields();
  updateDedLive();
}
function renderDedFields(){
  var w=$("dedFields"); w.innerHTML="";
  DEDUCCIONES.forEach(function(d){
    if(S.dedSel.indexOf(d.id)<0) return;
    var wrap=document.createElement("div"); wrap.className="field";
    wrap.innerHTML='<label>'+d.label+' — monto anual</label><div class="money"><span class="cur">$</span><input type="number" min="0" placeholder="Ej. 24000" data-ded="'+d.id+'" value="'+(S.ded[d.id]||"")+'"></div>';
    w.appendChild(wrap);
  });
  w.querySelectorAll('input[data-ded]').forEach(function(inp){
    inp.oninput=function(){ S.ded[inp.dataset.ded]=num(inp.value); updateDedLive(); };
  });
}
function onColegiaturaChange(){
  S.colNivel = $("colNivel").value;
  $("colMontoWrap").style.display = S.colNivel? "block":"none";
  if(S.colNivel){
    var tope = TAX_CONFIG.colegiaturas[S.colNivel];
    $("colTopeTexto").innerHTML = "Tope aplicable para este nivel: <b>"+fmt(tope)+"</b> anuales por alumno. Este monto es independiente de tus otras deducciones.";
  }
  S.colMonto = num($("colMonto").value);
  updateDedLive();
}
function updateDedLive(){
  var ingreso = S.ingresoAnual||0;
  var ded = calculatePersonalDeductions(dedItemsFromState(), ingreso);
  var lb=$("dedLive");
  if(ded.sumaRegistrada>0 || ded.colegiaturasAplicada>0){
    lb.style.display="block";
    var msg = "Deducciones registradas: <b>"+fmt(ded.sumaRegistrada+(S.colMonto||0))+"</b>";
    if(ded.sumaRegistrada > ded.limite){
      msg += "<br><span style='font-size:13px;font-weight:400'>Registraste "+fmt(ded.sumaRegistrada)+", pero para esta simulación se aplicará un máximo deducible estimado de "+fmt(ded.limite)+" en deducciones generales, según el tope configurado.</span>";
    }
    lb.innerHTML = msg;
  } else lb.style.display="none";
}
function dedItemsFromState(){
  var tope = S.colNivel? TAX_CONFIG.colegiaturas[S.colNivel] : 0;
  return Object.assign({}, S.ded, { colegiaturasMonto:S.colMonto||0, colegiaturasTope:tope });
}

/* ==================== STEP 4 · PPR ==================== */
function refreshPprSlider(){
  var max = Math.max(20000, Math.ceil(limitePPR(S.ingresoAnual||0)/1000)*1000);
  var slider=$("pprSlider");
  slider.max=max;
  if(num(slider.value) > max) slider.value = max;
  $("pprSimMin").textContent="$0"; $("pprSimMax").textContent=fmt(max);
}
function setPprEstado(v){
  S.pprEstado=v;
  ["pprYes","pprNo","pprEval"].forEach(function(id){ $(id).classList.remove('sel'); });
  $(v==='si'?'pprYes':(v==='no'?'pprNo':'pprEval')).classList.add('sel');
  $("pprActualWrap").style.display = v==='si' ? "block":"none";
  $("pprSimWrap").style.display = (v==='no'||v==='evaluando') ? "block":"none";
  if(v==='no'||v==='evaluando'){ refreshPprSlider(); }
  onPprSliderOrInput();
  trackEvent('ppr_simulated',{estado:v});
}
function onPprSliderOrInput(){
  var ingreso=S.ingresoAnual||0;
  if(S.pprEstado==='si'){
    S.pprActual = num($("pprActual").value);
    return;
  }
  var monto = num($("pprSlider").value);
  $("pprSimAmount").textContent = fmt(monto);
  S.pprSim = monto;
  var ppr = calculatePPRDeduction(monto, ingreso);
  var dedBase = calculatePersonalDeductions(dedItemsFromState(), ingreso).totalAplicado;
  var baseAntes = calculateTaxableBase(ingreso, dedBase);
  var baseDespues = calculateTaxableBase(ingreso, dedBase+ppr.aplicada);
  var isrAntes = calculateISR(baseAntes), isrDespues = calculateISR(baseDespues);
  $("pprDeducible").textContent = fmt(ppr.aplicada);
  $("pprReduccion").textContent = fmt(ppr.aplicada);
  $("pprImpacto").textContent = fmt(isrAntes-isrDespues);
  $("pprTope10Label").textContent = fmt(ingreso*TAX_CONFIG.ppr.limitePctIngreso);
  $("pprTopeUMALabel").textContent = fmt(TAX_CONFIG.ppr.limiteUMA*TAX_CONFIG.uma.anual);
  $("pprTopeLabel").textContent = fmt(limitePPR(ingreso));
}

/* ==================== EFI (Art. 185) ==================== */
function onEfiToggle(){
  var on = $("efiCheck").checked;
  $("efiWrap").style.display = on ? "block":"none";
  S.efiMonto = on ? num($("efiMonto").value) : 0;
  trackEvent('scenario_changed',{efi:S.efiMonto});
}

/* ==================== FAQ ==================== */
function renderFAQ(){
  var w=$("faqWrap"); if(!w) return; w.innerHTML="";
  FAQS.forEach(function(item,i){
    var el=document.createElement("div"); el.className="faq-item"; el.id="faq_"+i;
    el.innerHTML = '<button class="faq-q" onclick="toggleFaq('+i+')"><span>'+item.q+'</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button><div class="faq-a"><p>'+item.a+'</p></div>';
    w.appendChild(el);
  });
}
function toggleFaq(i){ $("faq_"+i).classList.toggle('open'); }

/* ==================== GATE ==================== */
function paintGateTeaser(){
  var r = computeAll();
  $("gateTeaser").textContent = fmt(r.ahorroFiscal);
}

/* ==================== MOTOR COMPLETO (agrega todos los pasos) ==================== */
function computeAll(pprOverride){
  var ingreso = S.ingresoAnual||0;
  var dedItems = dedItemsFromState();
  var ded = calculatePersonalDeductions(dedItems, ingreso);

  var pprMonto = (typeof pprOverride==='number') ? pprOverride : (S.pprEstado==='si'? S.pprActual : S.pprSim);
  var ppr = calculatePPRDeduction(pprMonto, ingreso);
  var efi = calculateEFIDeduction(S.efiMonto||0);

  var baseSin = calculateTaxableBase(ingreso, 0);
  var baseConDed = calculateTaxableBase(ingreso, ded.totalAplicado);
  var baseConTodo = calculateTaxableBase(ingreso, ded.totalAplicado+ppr.aplicada+efi.aplicada);

  var isrSin = calculateISR(baseSin);
  var isrConDed = calculateISR(baseConDed);
  var isrConTodo = calculateISR(baseConTodo);

  var ahorroFiscal = calculateTaxSavings(isrSin, isrConTodo);
  var saldo = S.isrRetenidoConocido ? calculateEstimatedBalance(S.isrRetenido||0, isrConTodo) : null;

  return { ingreso, ded, ppr, efi, baseSin, baseConDed, baseConTodo, isrSin, isrConDed, isrConTodo, ahorroFiscal, saldo, tasaMarginal: tasaMarginal(baseConTodo) };
}

/* ==================== LEAD + CRM ==================== */
function buildLead(r){
  var base = {
    agenteID:CONFIG.agenteID, recurso:"calculadora-ahorro-fiscal", ejercicioFiscal:CONFIG.ejercicioFiscal,
    nombre:(S.lead&&S.lead.nombre)||"", whatsapp:(S.lead&&S.lead.whatsapp)||"", email:(S.lead&&S.lead.email)||"",
    consentimiento:!!(S.lead&&S.lead.consent), timestamp:new Date().toISOString(), referidoPor:window._referidoPor||null,
    opportunityLevel: opportunityLevel(r)
  };
  if(!SEND_FINANCIAL_DETAILS) return base;
  return Object.assign(base, {
    situacionFiscal:S.situacionFiscal, ingresoAnual:Math.round(r.ingreso),
    isrRetenido: S.isrRetenidoConocido? Math.round(S.isrRetenido||0) : null,
    deduccionesAplicadas: Math.round(r.ded.totalAplicado),
    aportacionPPRSimulada: Math.round(r.ppr.aportacion),
    ahorroFiscalEstimado: Math.round(r.ahorroFiscal),
    saldoFavorEstimado: r.saldo!=null? Math.round(r.saldo): null,
    tasaMarginal: r.tasaMarginal
  });
}
function opportunityLevel(r){
  var pct = r.ingreso>0 ? r.ahorroFiscal/r.ingreso : 0;
  var brecha = limitePPR(r.ingreso) - r.ppr.aplicada;
  var interesPPR = (S.pprEstado==='no'||S.pprEstado==='evaluando') ? 1 : 0;
  var score = pct*100 + (brecha>0?10:0) + interesPPR*10;
  if(score>=40) return "VERY_HIGH";
  if(score>=22) return "HIGH";
  if(score>=10) return "MEDIUM";
  return "LOW";
}
function sendLeadToCRM(lead){
  var pprMontoResuelto = S.pprEstado==='si' ? (S.pprActual||0) : (S.pprSim||0);
  var hostedPayload = {
    nombre: lead.nombre, whatsapp: lead.whatsapp, email: lead.email,
    consentimiento: lead.consentimiento, fecha: lead.timestamp, consentimiento_fecha: lead.timestamp,
    referidoPor: lead.referidoPor, agenteID: lead.agenteID, recurso: lead.recurso, ejercicioFiscal: lead.ejercicioFiscal,
    situacionFiscal: S.situacionFiscal||"",
    ingresoAnual: S.ingresoAnual||0,
    isrRetenido: S.isrRetenidoConocido ? (S.isrRetenido||0) : null,
    medicos: S.ded.medicos||0, dentales: S.ded.dentales||0, hospitalarios: S.ded.hospitalarios||0,
    seguroGMM: S.ded.seguroGMM||0, interesesHipotecarios: S.ded.interesesHipotecarios||0,
    donativos: S.ded.donativos||0, transporteEscolar: S.ded.transporteEscolar||0, otros: S.ded.otros||0,
    colegiaturasNivel: S.colNivel||"", colegiaturasMonto: S.colMonto||0,
    pprEstado: S.pprEstado||"", pprMonto: pprMontoResuelto, efiMonto: S.efiMonto||0
  };
  fetch('/api/public/mini-apps/'+AF_SLUG+'/hosted-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hostedPayload),keepalive:true}).catch(function(){});
  if(!CONFIG.webhookURL) return;
  try{ fetch(CONFIG.webhookURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead),keepalive:true}); }catch(e){}
}

function revealResult(skip){
  if(!skip){
    var nombre=$("leadName").value.trim(), wa=$("leadWa").value.replace(/\D/g,''), email=$("leadEmail").value.trim();
    if(nombre.length<2||wa.length<10||!$("leadConsent").checked){
      if(nombre.length<2)$("leadName").style.borderColor="var(--danger)";
      if(wa.length<10)$("leadWa").style.borderColor="var(--danger)";
      if(!$("leadConsent").checked){ var b=$("revealBtn"),t=b.textContent; b.textContent="Completa tus datos y acepta para continuar"; setTimeout(function(){b.textContent=t},1900); }
      return;
    }
    S.lead={nombre:nombre,whatsapp:wa,email:email,consent:true};
    var r=computeAll();
    sendLeadToCRM(buildLead(r)); trackEvent('lead_captured');
  }
  paintWow(); go('wow');
}

/* ==================== WOW ==================== */
function paintWow(){
  var r=computeAll();
  window._lastCalc=r;
  $("wowBaseSin").textContent=fmt(r.baseSin);
  $("wowIsrSin").textContent=fmt(r.isrSin);
  $("wowBaseCon").textContent=fmt(r.baseConTodo);
  $("wowIsrCon").textContent=fmt(r.isrConTodo);
  animateNumber($("wowAhorro"),0,r.ahorroFiscal,1200);
  trackEvent('tax_result_viewed',{ahorro:Math.round(r.ahorroFiscal)});
}

/* ==================== RESULTADO COMPLETO ==================== */
function paintResultado(){
  var r = window._lastCalc || computeAll();

  var bw=$("balanceWrap"); bw.innerHTML="";
  if(r.saldo!=null){
    var positivo = r.saldo>=0;
    var box=document.createElement("div");
    box.className="balance-box"+(positivo?"":" warn");
    box.innerHTML = '<div class="bi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>'+
      '<div><b>'+(positivo?'Saldo a favor estimado: '+fmt(r.saldo):'ISR pendiente de pago estimado: '+fmt(Math.abs(r.saldo)))+'</b>'+
      '<span>ISR retenido ('+fmt(S.isrRetenido||0)+') menos ISR estimado después de deducciones ('+fmt(r.isrConTodo)+'). '+
      (positivo? 'Esto no es lo mismo que tu ahorro fiscal: es la diferencia frente a lo que ya te retuvieron.':'Con estos datos, lo retenido no alcanzaría a cubrir el ISR estimado del ejercicio.')+'</span></div>';
    bw.appendChild(box);
  } else {
    var box2=document.createElement("div"); box2.className="balance-box";
    box2.innerHTML='<div class="bi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div><div><b>No calculamos un saldo a favor</b><span>No indicaste tu ISR retenido, así que solo mostramos tu ahorro fiscal estimado — la diferencia entre el ISR con y sin tus deducciones.</span></div>';
    bw.appendChild(box2);
  }

  var cw=$("cascadeWrap"); cw.innerHTML="";
  var steps=[
    {l:"Ingreso", v:r.ingreso},
    {l:"Deducciones aplicables", v:-(r.ded.totalAplicado+r.ppr.aplicada+r.efi.aplicada), neg:true},
    {l:"Base gravable estimada", v:r.baseConTodo},
    {l:"ISR estimado", v:-r.isrConTodo, neg:true},
    {l:"Diferencia fiscal (ahorro)", v:r.ahorroFiscal, pos:true}
  ];
  steps.forEach(function(st,i){
    var el=document.createElement("div"); el.className="cstep"+(st.neg?" neg":"")+(st.pos?" pos":"");
    el.innerHTML='<span class="cl">'+st.l+'</span><span class="cv">'+(st.v<0?'-':'')+fmt(Math.abs(st.v))+'</span>';
    cw.appendChild(el);
    if(i<steps.length-1){
      var ar=document.createElement("div"); ar.className="carrow";
      ar.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>';
      cw.appendChild(ar);
    }
  });

  buildScenarios(r);

  var max = Math.max(20000, Math.ceil(limitePPR(r.ingreso)/1000)*1000);
  var pSlider=$("postSlider"); pSlider.max=max; pSlider.value=Math.min(r.ppr.aplicada||0,max);
  $("postSimMin").textContent="$0"; $("postSimMax").textContent=fmt(max);
  onPostSlider();

  buildRelated();

  var msg="Hola "+CONFIG.agente.split(" ")[0]+", soy "+(S.lead?S.lead.nombre.split(" ")[0]:"[tu nombre]")+".\n\nAcabo de completar la Calculadora de Ahorro Fiscal 2026.\nLa simulación mostró una diferencia fiscal que me gustaría revisar contigo.\n\n¿Podemos analizarla?";
  $("waBtn").href="https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(msg);
}

function buildScenarios(r){
  var w=$("scenariosWrap"); w.innerHTML="";
  var ingreso=r.ingreso;
  var isrA = calculateISR(ingreso);

  var isrB = r.isrConDed;
  var ahorroB = calculateTaxSavings(isrA, isrB);

  var list = [
    {name:"Sin deducciones", isr:isrA, ahorro:0, show:true},
    {name:"Deducciones actuales", isr:isrB, ahorro:ahorroB, show: r.ded.totalAplicado>0}
  ];

  if(r.ppr.aplicada>0 || r.efi.aplicada>0){
    var nombreConEstrategia = r.ppr.aplicada>0 && r.efi.aplicada>0 ? "Deducciones + PPR + Cuenta Art. 185"
      : (r.ppr.aplicada>0 ? "Deducciones + PPR" : "Deducciones + Cuenta Art. 185");
    list.push({name:nombreConEstrategia, isr:r.isrConTodo, ahorro:calculateTaxSavings(isrA,r.isrConTodo), show:true});
  }

  var topePPRTotal = limitePPR(ingreso), topeEFITotal = TAX_CONFIG.efi.limiteMonto;
  if(topePPRTotal > r.ppr.aplicada || topeEFITotal > r.efi.aplicada){
    var baseCompleta = calculateTaxableBase(ingreso, r.ded.totalAplicado + topePPRTotal + topeEFITotal);
    var isrCompleto = calculateISR(baseCompleta);
    list.push({name:"Estrategia completa (deducciones + PPR + Art. 185, todo al tope)", isr:isrCompleto, ahorro:calculateTaxSavings(isrA,isrCompleto), show:true, best:true});
  }

  var maxAhorro = Math.max.apply(null, list.map(function(x){return x.ahorro}));
  list.forEach(function(sc){
    if(!sc.show) return;
    var card=document.createElement("div"); card.className="scard"+(sc.ahorro===maxAhorro && sc.ahorro>0?" best":"");
    card.innerHTML = (sc.ahorro===maxAhorro && sc.ahorro>0?'<span class="stag">Mejor escenario</span>':'')+
      '<div class="sname">'+sc.name+'</div>'+
      '<div class="srow"><span>ISR estimado</span><b>'+fmt(sc.isr)+'</b></div>'+
      '<div class="sahorro">Ahorro: '+fmt(sc.ahorro)+'</div>';
    w.appendChild(card);
  });
}

function onPostSlider(){
  var ingreso=S.ingresoAnual||0;
  var monto=num($("postSlider").value);
  $("postSimAmount").textContent=fmt(monto);

  var ded = calculatePersonalDeductions(dedItemsFromState(), ingreso).totalAplicado;
  var ppr = calculatePPRDeduction(monto, ingreso);
  var base = calculateTaxableBase(ingreso, ded+ppr.aplicada);
  var isr = calculateISR(base);
  var isrSinEstaAportacion = calculateISR(calculateTaxableBase(ingreso, ded));
  var ahorroAsociado = calculateTaxSavings(isrSinEstaAportacion, isr);
  var isrSinNada = calculateISR(ingreso);
  var ahorroTotal = calculateTaxSavings(isrSinNada, isr);

  $("postBase").textContent=fmt(base);
  $("postIsr").textContent=fmt(isr);
  $("postAhorro").textContent=fmt(ahorroTotal);
  $("postTasa").textContent=Math.round(tasaMarginal(base)*100)+"%";

  $("netAportacion").textContent=fmt(monto);
  $("netAhorro").textContent=fmt(ahorroAsociado);
  $("netFinal").textContent=fmt(Math.max(0,monto-ahorroAsociado));

  trackEvent('scenario_changed',{ppr:monto});
}

function buildRelated(){
  var w=$("relatedWrap"); w.innerHTML="";
  if(CONFIG.urlRetiro){
    w.innerHTML += '<a href="'+CONFIG.urlRetiro+(window._referidoPor?('?ref='+encodeURIComponent(window._referidoPor)):'')+'"><div class="ri"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><div><b>Calculadora de Brecha de Retiro</b><span>Descubre cuánto necesitarías construir para mantener tu estilo de vida al retirarte.</span></div></a>';
  }
  if(CONFIG.urlDiagnostico){
    w.innerHTML += '<a href="'+CONFIG.urlDiagnostico+(window._referidoPor?('?ref='+encodeURIComponent(window._referidoPor)):'')+'"><div class="ri"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div><div><b>Diagnóstico de Solidez Financiera</b><span>Evalúa los 6 pilares principales de tus finanzas.</span></div></a>';
  }
}

function animateNumber(elm, from, to, dur){
  var t0=performance.now();
  (function tick(t){
    var p=Math.min(1,(t-t0)/dur), v=from+(to-from)*(1-Math.pow(1-p,3));
    elm.textContent=fmt(v); if(p<1)requestAnimationFrame(tick);
  })(t0);
}

var _origGo = go;
go = function(step){ _origGo(step); if(step==='resultado') paintResultado(); };

function printReport(){ trackEvent('report_downloaded'); window.print(); }

function shareCalc(){
  trackEvent('calculator_shared');
  var url=location.origin+location.pathname+"?ref="+encodeURIComponent(CONFIG.agenteID);
  var data={title:"Calculadora de Ahorro Fiscal", text:"Estima cuánto podrías ahorrar aprovechando tus deducciones fiscales:", url:url};
  if(navigator.share){ navigator.share(data).catch(function(){}); }
  else { navigator.clipboard && navigator.clipboard.writeText(url); toast('Link copiado'); }
}
function restart(){
  if(!confirm("¿Empezar una nueva simulación? Se perderán los datos actuales.")) return;
  location.href=location.origin+location.pathname+(window._referidoPor?("?ref="+encodeURIComponent(window._referidoPor)):"");
}

`;
