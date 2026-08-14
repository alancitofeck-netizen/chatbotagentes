/** Plantilla verbatim de "Top Apps, de ingresos y gastos" (Control
 * Financiero — Presupuesto Base Cero) — CSS, HTML y JS copiados literal del
 * archivo original que sirvió de base a este tipo de Mini App (mismo
 * diseño, tipografía Fraunces/Hanken Grotesk/Space Grotesk, presupuesto
 * base cero por categorías + registro de transacciones por mes + dashboard
 * anual con gráficos, sin ningún rediseño).
 *
 * Las ÚNICAS diferencias respecto del original, dentro de
 * CONTROL_FINANCIERO_LOGIC_JS, son:
 *
 * 1. El objeto `CONFIG` (antes hardcodeado) ahora lee de
 *    `window.__CONTROL_FINANCIERO_DATA__`, inyectado por
 *    ControlFinancieroApp.tsx a partir de la config guardada en el CRM.
 * 2. Se agrega un `fetch` fire-and-forget a
 *    `/api/public/mini-apps/{slug}/visit` al cargar, igual que los demás
 *    tipos de Mini App — es lo ÚNICO que esta integración manda al
 *    servidor. A diferencia de todos los demás templates, NO se agrega
 *    ningún `fetch` de lead: el archivo original no tiene `buildLead()`
 *    ni `sendLeadToCRM()` — todo el presupuesto/transacciones vive
 *    exclusivamente en `localStorage` del navegador, por diseño explícito
 *    del propio archivo (ver el comentario de controlFinancieroDefaults.ts
 *    para el razonamiento completo).
 * 3. Los 6 controles de nivel superior que en el HTML original llamaban a
 *    sus funciones vía atributos `onclick="..."`/`onchange="..."` inline
 *    pasan a conectarse con `addEventListener` al final del script — mismo
 *    motivo ya documentado en el resto de los templates (un global como
 *    `window.next` puede quedar pisado por el runtime de Next.js, commit
 *    8b361bd). 4 de esos controles no tenían `id` en el original (los
 *    botones de descargar/cargar datos, "Empezar con mi presupuesto" y
 *    agregar transacción) y lo reciben acá (`exportBtn`/
 *    `importTriggerBtn`/`startBtn`/`txAddBtn`); los otros 2 (el selector
 *    de categoría de transacción y el `<input type="file">` de importar)
 *    ya tenían `id` propio. Los MUCHOS `onclick`/`oninput` que el propio
 *    archivo genera dinámicamente dentro de sus funciones de renderizado
 *    (agregar/editar/quitar subcategoría de presupuesto, quitar
 *    transacción, selector de moneda, tabs de mes) se dejan intactos: son
 *    asignaciones de propiedad JS resueltas por closure o strings armados
 *    recién al renderizar la lista, no atributos `onclick="nombreGlobal()"`
 *    estáticos del HTML — "arreglarlos" exigiría reescribir la lógica de
 *    renderizado en sí, que es justo lo que no se debe tocar.
 *
 * Todo el resto — CSS, HTML, y cada función de CONTROL_FINANCIERO_LOGIC_JS
 * (el modelo de datos, los cálculos de remanente/tasa de ahorro, los
 * gráficos, la persistencia en localStorage, exportar/importar JSON) — es
 * una copia literal del archivo original.
 */

export const CONTROL_FINANCIERO_CSS = `

  :root{
    --ink:#161B22; --ink-soft:#3A424D;
    --paper:#FFFFFF; --bg:#F4F2ED; --bg-2:#ECE9E1; --panel:#FBFAF6;
    --line:#E4E1D8; --line-2:#EEEBE3; --muted:#6C7580; --muted-2:#9AA1AA;
    /* colores por categoría (semánticos, no semáforo) */
    --c-ingreso:#2E7D6B; --c-esencial:#3E6E9A; --c-discrecional:#B0793C;
    --c-deuda:#A25048; --c-ahorro:#6D6AAE; --c-inversion:#2F8A8A;
    --accent:#2E7D6B; --accent-d:#215F51;
    --pos:#2E7D6B; --neg:#A25048; --zero:#2E7D6B;
    --danger:#B4472F;
    --shadow-card:0 18px 44px -26px rgba(22,27,34,.32);
    --shadow-soft:0 4px 14px -8px rgba(22,27,34,.18);
    --f:'Hanken Grotesk',system-ui,-apple-system,sans-serif;
    --f-d:'Fraunces',Georgia,serif;
    --f-n:'Space Grotesk',var(--f);
    --r:16px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{font-family:var(--f);color:var(--ink);line-height:1.5;min-height:100vh;background:var(--bg);
    padding-bottom:calc(20px + env(safe-area-inset-bottom))}
  .num{font-family:var(--f-n);font-feature-settings:"tnum" 1;font-variant-numeric:tabular-nums}

  /* ---------- Top bar ---------- */
  .topbar{position:sticky;top:0;z-index:40;background:rgba(244,242,237,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .topbar .in{max-width:1080px;margin:0 auto;padding:11px 18px;display:flex;align-items:center;gap:14px}
  .brand{display:flex;align-items:center;gap:11px;min-width:0}
  .brand .mk{width:38px;height:38px;border-radius:11px;flex:0 0 auto;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-weight:700;font-size:15px;overflow:hidden}
  .brand .mk img{width:100%;height:100%;object-fit:cover}
  .brand .bt{min-width:0;line-height:1.2}
  .brand .bt b{font-size:14px;font-weight:800;display:block;letter-spacing:-.01em}
  .brand .bt span{font-size:11.5px;color:var(--muted)}
  .top-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
  .cur-select{display:flex;align-items:center;gap:6px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:4px}
  .cur-select button{border:none;background:none;font-family:var(--f-n);font-size:14px;font-weight:700;color:var(--muted-2);width:32px;height:30px;border-radius:7px;cursor:pointer;transition:.14s}
  .cur-select button.on{background:var(--accent);color:#fff}
  .icon-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink-soft);cursor:pointer;display:grid;place-items:center;transition:.14s}
  .icon-btn:hover{border-color:var(--accent);color:var(--accent)}

  /* ---------- Tabs ---------- */
  .tabs{position:sticky;top:61px;z-index:35;background:rgba(244,242,237,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);overflow-x:auto;-webkit-overflow-scrolling:touch}
  .tabs::-webkit-scrollbar{display:none}
  .tabs .in{max-width:1080px;margin:0 auto;padding:0 12px;display:flex;gap:2px;min-width:max-content}
  .tab{border:none;background:none;font-family:var(--f);font-size:13.5px;font-weight:700;color:var(--muted);padding:13px 14px;cursor:pointer;position:relative;white-space:nowrap;transition:.14s;border-bottom:2.5px solid transparent}
  .tab:hover{color:var(--ink)}
  .tab.on{color:var(--accent-d);border-bottom-color:var(--accent)}
  .tab.sep{margin-left:8px;padding-left:16px;border-left:1px solid var(--line)}

  .wrap{max-width:1080px;margin:0 auto;padding:22px 18px}

  h1{font-family:var(--f-d);font-weight:600;font-size:clamp(26px,4.4vw,34px);letter-spacing:-.015em;line-height:1.1;margin-bottom:6px}
  .subtitle{font-size:14.5px;color:var(--muted);margin-bottom:22px;max-width:640px;line-height:1.55}
  h2{font-family:var(--f-d);font-weight:600;font-size:22px;letter-spacing:-.01em;margin-bottom:4px}
  .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-d);font-weight:700;margin-bottom:10px;display:inline-flex;align-items:center;gap:8px}
  .eyebrow::before{content:"";width:18px;height:1.5px;background:currentColor;opacity:.5}

  /* ---------- Remanente banner ---------- */
  .remanente{position:sticky;top:105px;z-index:30;background:var(--paper);border:1px solid var(--line);border-radius:14px;
    padding:14px 18px;margin-bottom:22px;display:flex;align-items:center;gap:16px;box-shadow:var(--shadow-soft);flex-wrap:wrap}
  .remanente .rl{font-size:12.5px;color:var(--muted);font-weight:600}
  .remanente .rl b{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:2px}
  .remanente .rv{font-family:var(--f-n);font-size:26px;font-weight:700;letter-spacing:-.01em}
  .remanente .rv.pos{color:var(--accent-d)}
  .remanente .rv.neg{color:var(--neg)}
  .remanente .rv.zero{color:var(--accent-d)}
  .remanente .rbadge{margin-left:auto;font-size:12px;font-weight:700;padding:7px 14px;border-radius:20px}
  .rbadge.pos{background:rgba(176,121,60,.14);color:var(--c-discrecional)}
  .rbadge.neg{background:rgba(162,80,72,.12);color:var(--neg)}
  .rbadge.zero{background:rgba(46,125,107,.14);color:var(--accent-d)}
  .remanente .mini{font-size:12px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap}
  .remanente .mini b{font-family:var(--f-n);color:var(--ink);font-weight:700}

  /* ---------- Categoría panel ---------- */
  .cat{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);margin-bottom:16px;overflow:hidden;box-shadow:var(--shadow-soft)}
  .cat-head{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line-2);cursor:pointer}
  .cat-head .dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}
  .cat-head .ct{font-size:15.5px;font-weight:800;letter-spacing:-.01em}
  .cat-head .cnum{font-family:var(--f-n);font-size:12px;font-weight:700;color:var(--muted-2);background:var(--bg);width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:0 0 auto}
  .cat-head .ctot{margin-left:auto;font-family:var(--f-n);font-size:16px;font-weight:700;text-align:right}
  .cat-head .ctot small{display:block;font-family:var(--f);font-size:10.5px;font-weight:600;color:var(--muted-2);text-transform:uppercase;letter-spacing:.06em}
  .cat-body{padding:8px 12px 14px}
  .subrow{display:grid;grid-template-columns:1fr 128px 30px;gap:8px;align-items:center;padding:5px 6px;border-radius:9px;transition:.12s}
  .subrow:hover{background:var(--panel)}
  .subrow input{font-family:var(--f);font-size:14px;padding:9px 11px;border:1.5px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);width:100%;transition:.14s}
  .subrow input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(46,125,107,.12)}
  .subrow input.amt{font-family:var(--f-n);text-align:right;font-weight:600}
  .subrow .del{width:28px;height:28px;border:none;background:none;color:var(--muted-2);cursor:pointer;border-radius:7px;display:grid;place-items:center;transition:.12s}
  .subrow .del:hover{color:var(--danger);background:rgba(180,71,47,.08)}
  .addsub{display:inline-flex;align-items:center;gap:7px;font-family:var(--f);font-size:13.5px;font-weight:700;color:var(--accent-d);background:none;border:none;cursor:pointer;padding:9px 8px;margin-top:2px;border-radius:8px}
  .addsub:hover{background:var(--panel)}
  .colhead{display:grid;grid-template-columns:1fr 128px 30px;gap:8px;padding:2px 6px 8px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2);font-weight:700}
  .colhead span:nth-child(2){text-align:right}

  /* ---------- Botones ---------- */
  .btn{font-family:var(--f);font-size:14.5px;font-weight:700;padding:12px 18px;border:none;border-radius:12px;cursor:pointer;
    background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;transition:.15s;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 22px -12px rgba(46,125,107,.55)}
  .btn:hover{transform:translateY(-1px)}
  .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
  .btn.ghost:hover{background:var(--panel)}
  .btn.sm{padding:9px 14px;font-size:13px;border-radius:10px}

  /* ---------- Meses ---------- */
  .month-top{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:22px}
  .kpi{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--shadow-soft)}
  .kpi .kl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2);font-weight:700;margin-bottom:7px;display:flex;align-items:center;gap:7px}
  .kpi .kl .kd{width:8px;height:8px;border-radius:50%}
  .kpi .kv{font-family:var(--f-n);font-size:24px;font-weight:700;letter-spacing:-.01em;line-height:1}
  .kpi .ks{font-size:12px;color:var(--muted);margin-top:5px}
  .kpi .ks.pos{color:var(--pos)} .kpi .ks.neg{color:var(--neg)}

  /* comparativo estimado vs real por categoría */
  .cmp{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin-bottom:16px;box-shadow:var(--shadow-soft)}
  .cmp h3{font-size:15px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:9px}
  .cmp h3 .dot{width:10px;height:10px;border-radius:50%}
  .cmp-sub{display:grid;grid-template-columns:1fr auto auto;gap:10px 18px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
  .cmp-sub:last-child{border-bottom:none}
  .cmp-sub .snm{font-weight:600}
  .cmp-sub .sest{font-family:var(--f-n);color:var(--muted);text-align:right;min-width:80px}
  .cmp-sub .sreal{font-family:var(--f-n);font-weight:700;text-align:right;min-width:80px}
  .cmp-bar{grid-column:1/-1;height:6px;background:var(--bg);border-radius:4px;overflow:hidden;margin-top:2px}
  .cmp-bar>i{display:block;height:100%;border-radius:4px;transition:width .5s}
  .cmp-tot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1.5px solid var(--line);font-weight:800;font-size:14px}
  .cmp-tot .num{font-size:16px}

  /* transacciones */
  .txbox{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-soft);margin-bottom:16px}
  .txform{display:grid;grid-template-columns:150px 1fr 120px 108px 40px;gap:9px;align-items:end;margin-bottom:16px}
  .txform .fld label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px}
  .txform select,.txform input{font-family:var(--f);font-size:14px;padding:10px 11px;border:1.5px solid var(--line);border-radius:10px;background:var(--paper);width:100%;color:var(--ink)}
  .txform input.amt{font-family:var(--f-n);text-align:right;font-weight:600}
  .txform select:focus,.txform input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(46,125,107,.12)}
  .txadd{width:40px;height:40px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;display:grid;place-items:center;transition:.14s}
  .txadd:hover{background:var(--accent-d)}
  .txlist{display:flex;flex-direction:column}
  .txrow{display:grid;grid-template-columns:110px 1fr 130px 110px 34px;gap:9px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--line-2);font-size:13.5px}
  .txrow:last-child{border-bottom:none}
  .txrow .tcat{display:inline-flex;align-items:center;gap:7px;font-weight:600}
  .txrow .tcat .td{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
  .txrow .tsub{color:var(--ink);font-weight:600}
  .txrow .tdate{color:var(--muted);font-family:var(--f-n)}
  .txrow .tamt{font-family:var(--f-n);font-weight:700;text-align:right}
  .txrow .tdel{color:var(--muted-2);cursor:pointer;text-align:center;border:none;background:none;font-size:15px}
  .txrow .tdel:hover{color:var(--danger)}
  .txempty{text-align:center;color:var(--muted-2);font-size:13.5px;padding:26px 10px;border:1px dashed var(--line);border-radius:12px}
  .txcount{font-size:12px;color:var(--muted);margin-bottom:12px}

  /* ---------- Dashboard ---------- */
  .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:20px}
  .chartcard{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-soft)}
  .chartcard h3{font-size:14px;font-weight:800;margin-bottom:4px}
  .chartcard .ch-sub{font-size:12px;color:var(--muted);margin-bottom:16px}
  .barchart{display:flex;align-items:flex-end;gap:5px;height:150px;padding-top:10px}
  .barcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
  .barcol .bwrap{width:100%;display:flex;gap:2px;align-items:flex-end;height:100%;justify-content:center}
  .barcol .bar{width:44%;border-radius:4px 4px 0 0;min-height:2px;transition:height .6s cubic-bezier(.22,1,.36,1)}
  .barcol .bl{font-size:10px;color:var(--muted);font-weight:600}
  .legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11.5px;color:var(--muted)}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .legend i{width:10px;height:10px;border-radius:3px}
  .donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .donut{width:132px;height:132px;flex:0 0 auto}
  .donut-legend{flex:1;min-width:150px;display:flex;flex-direction:column;gap:7px}
  .donut-legend .dl{display:flex;align-items:center;gap:9px;font-size:12.5px}
  .donut-legend .dl i{width:11px;height:11px;border-radius:3px;flex:0 0 auto}
  .donut-legend .dl .dv{margin-left:auto;font-family:var(--f-n);font-weight:700}
  .anrow{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
  .anrow:last-child{border-bottom:none}
  .anrow .al{display:inline-flex;align-items:center;gap:8px;font-weight:600}
  .anrow .al i{width:9px;height:9px;border-radius:50%}
  .anrow .av{font-family:var(--f-n);font-weight:700}
  .yeartable{width:100%;border-collapse:collapse;font-size:12.5px}
  .yeartable th,.yeartable td{padding:8px 6px;text-align:right;border-bottom:1px solid var(--line-2);font-family:var(--f-n);white-space:nowrap}
  .yeartable th:first-child,.yeartable td:first-child{text-align:left;font-family:var(--f);font-weight:700;position:sticky;left:0;background:var(--paper)}
  .yeartable thead th{font-family:var(--f);font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);font-weight:700}
  .yeartable .totrow td{font-weight:800;border-top:1.5px solid var(--line);border-bottom:none}
  .tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

  /* ---------- Instrucciones / intro ---------- */
  .steps{display:grid;gap:12px;margin:20px 0}
  .stepc{display:flex;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow-soft)}
  .stepc .sn{width:32px;height:32px;flex:0 0 auto;border-radius:9px;background:linear-gradient(145deg,var(--accent),var(--accent-d));color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-weight:700}
  .stepc b{font-size:15px;display:block;margin-bottom:3px}
  .stepc p{font-size:13.5px;color:var(--ink-soft);line-height:1.55}
  .stepc p b{display:inline;font-weight:700;color:var(--ink)}
  .callout{display:flex;gap:11px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:14px 16px;margin:16px 0;font-size:13px;color:var(--ink-soft);line-height:1.55}
  .callout svg{flex:0 0 auto;color:var(--accent);margin-top:1px}
  .zero-tip{background:linear-gradient(145deg,rgba(46,125,107,.09),rgba(46,125,107,.04));border-color:rgba(46,125,107,.25)}

  .foot{text-align:center;font-size:11.5px;color:var(--muted-2);margin:26px 0 8px}
  .foot b{color:var(--muted);font-weight:700}
  .agent-line{display:inline-flex;align-items:center;gap:7px}

  .toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;font-size:13px;font-weight:600;padding:11px 20px;border-radius:26px;box-shadow:0 12px 30px -8px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:.3s;z-index:70;display:flex;gap:8px;align-items:center}
  .toast.on{opacity:1;transform:translateX(-50%) translateY(0)}

  .view{display:none}
  .view.on{display:block;animation:fade .35s ease}
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  @media (max-width:720px){
    .txform{grid-template-columns:1fr 1fr;gap:10px}
    .txform .fld.full{grid-column:1/-1}
    .txadd{width:100%;height:44px}
    .txrow{grid-template-columns:1fr auto 30px;gap:6px}
    .txrow .tdate{display:none}
    .remanente{top:101px}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

`;

export const CONTROL_FINANCIERO_BODY_HTML = `
<!-- ============ TOP BAR ============ -->
<div class="topbar">
  <div class="in">
    <div class="brand">
      <div class="mk" id="brandMk">GL</div>
      <div class="bt"><b id="brandTitle">Control Financiero 2026</b><span id="brandSub">Presupuesto Base Cero</span></div>
    </div>
    <div class="top-actions">
      <div class="cur-select" id="curSelect">
        <button data-cur="$">$</button>
        <button data-cur="€">€</button>
        <button data-cur="£">£</button>
        <button data-cur="•">•</button>
      </div>
      <button class="icon-btn" id="exportBtn" title="Descargar mis datos">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      </button>
      <button class="icon-btn" id="importTriggerBtn" title="Cargar datos guardados">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v10"/></svg>
      </button>
      <input type="file" id="importFile" accept="application/json" style="display:none">
    </div>
  </div>
</div>

<!-- ============ TABS ============ -->
<div class="tabs"><div class="in" id="tabsIn"></div></div>

<div class="wrap">

  <!-- ===== INICIO ===== -->
  <div class="view on" data-view="inicio">
    <div class="eyebrow">Cómo funciona</div>
    <h1>Dale un trabajo a cada peso que ganas.</h1>
    <p class="subtitle">Este es un presupuesto <b>Base Cero</b>: la meta no es gastar todo, sino asignar cada unidad de tu ingreso a una categoría hasta que el Remanente llegue a cero. Empieza definiendo tu presupuesto y luego registra tus gastos mes a mes.</p>

    <div class="steps">
      <div class="stepc"><div class="sn">1</div><div><b>Define tu presupuesto</b><p>En la pestaña <b>Presupuesto</b> agrega tus subcategorías y el monto mensual que planeas para cada una, dentro de las 6 categorías. Se copian automáticamente a los 12 meses.</p></div></div>
      <div class="stepc"><div class="sn">2</div><div><b>Registra tus movimientos</b><p>En cada mes, agrega tus transacciones (categoría, subcategoría, fecha y monto). El <b>Real</b> se va sumando solo y lo compara contra lo estimado.</p></div></div>
      <div class="stepc"><div class="sn">3</div><div><b>Sigue tu año</b><p>El <b>Dashboard</b> reúne los 12 meses: tendencias, distribución por categoría y tu tasa de ahorro anual.</p></div></div>
    </div>

    <div class="callout zero-tip">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4l3 2"/></svg>
      <span>El <b>Remanente</b> te dice si te falta asignar dinero (positivo) o si te estás pasando (negativo). Cuando llega a <b>cero</b> se pone verde: significa que cada peso ya tiene un propósito. Eso es Base Cero.</span>
    </div>

    <div class="callout">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Tus datos se guardan solo en <b>este dispositivo</b> y no se envían a ningún servidor. Usa los botones de descargar/cargar (arriba a la derecha) para respaldarlos o moverlos a otro equipo.</span>
    </div>

    <button class="btn" id="startBtn" style="margin-top:6px">Empezar con mi presupuesto →</button>
  </div>

  <!-- ===== PRESUPUESTO ===== -->
  <div class="view" data-view="presupuesto">
    <div class="eyebrow">Presupuesto anual base</div>
    <h1>Tu presupuesto mensual</h1>
    <p class="subtitle">Agrega las subcategorías y el monto que planeas asignar a cada una. Esto define el "Estimado" de todos tus meses.</p>

    <div class="remanente" id="budgetRemanente"></div>
    <div id="budgetCats"></div>
  </div>

  <!-- ===== MES (dinámico) ===== -->
  <div class="view" data-view="mes">
    <div class="month-top">
      <div>
        <div class="eyebrow" id="mesEyebrow">Mes</div>
        <h1 id="mesTitle">Enero</h1>
      </div>
    </div>
    <div class="remanente" id="mesRemanente"></div>
    <div class="kpis" id="mesKpis"></div>

    <div class="eyebrow" style="margin-top:8px">Estimado vs Real</div>
    <div id="mesCmp"></div>

    <div class="eyebrow" style="margin-top:22px">Registrar movimiento</div>
    <div class="txbox">
      <div class="txform">
        <div class="fld"><label>Categoría</label><select id="txCat"></select></div>
        <div class="fld full"><label>Subcategoría</label><select id="txSub"></select></div>
        <div class="fld"><label>Fecha</label><input type="date" id="txDate"></div>
        <div class="fld"><label>Monto</label><input type="number" id="txAmt" class="amt" placeholder="0" min="0" step="0.01" onkeydown="if(event.key==='Enter')addTx()"></div>
        <button class="txadd" id="txAddBtn" title="Agregar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <div class="txcount" id="txCount"></div>
      <div class="txlist" id="txList"></div>
    </div>
  </div>

  <!-- ===== DASHBOARD ===== -->
  <div class="view" data-view="dashboard">
    <div class="eyebrow">Visión anual</div>
    <h1>Dashboard 2026</h1>
    <p class="subtitle">Todo tu año en un vistazo. Se actualiza con lo que registras en cada mes.</p>

    <div class="kpis" id="dashKpis"></div>

    <div class="dash-grid">
      <div class="chartcard" style="grid-column:1/-1">
        <h3>Ingresos vs Gastos por mes</h3>
        <div class="ch-sub">Gastos = esenciales + discrecionales + deudas. Ahorro e inversión se muestran aparte.</div>
        <div class="barchart" id="dashBars"></div>
        <div class="legend">
          <span><i style="background:var(--c-ingreso)"></i>Ingresos</span>
          <span><i style="background:var(--c-esencial)"></i>Gastos</span>
          <span><i style="background:var(--c-ahorro)"></i>Ahorro + Inversión</span>
        </div>
      </div>

      <div class="chartcard">
        <h3>Distribución anual</h3>
        <div class="ch-sub">A dónde fue tu dinero (real).</div>
        <div class="donut-wrap">
          <svg class="donut" id="dashDonut" viewBox="0 0 42 42"></svg>
          <div class="donut-legend" id="dashDonutLegend"></div>
        </div>
      </div>

      <div class="chartcard">
        <h3>Resumen por categoría</h3>
        <div class="ch-sub">Totales reales del año.</div>
        <div id="dashCatSummary"></div>
      </div>
    </div>

    <div class="chartcard">
      <h3>Detalle mensual</h3>
      <div class="ch-sub">Real por categoría, mes a mes.</div>
      <div class="tablewrap"><table class="yeartable" id="dashTable"></table></div>
    </div>
  </div>

  <div class="foot">
    <span class="agent-line">Herramienta de <b id="footAgent">Growth Link</b></span> · Presupuesto Base Cero 2026 · Tus datos se guardan solo en este dispositivo
  </div>
</div>

<div class="toast" id="toast"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4FBE86" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="toastMsg">Guardado</span></div>
`;

export const CONTROL_FINANCIERO_LOGIC_JS = `

/* ==================================================================
   ▓▓  CONFIG  ▓▓  ← Editá para personalizar por agente.
   ================================================================== */
const CF_DATA = window.__CONTROL_FINANCIERO_DATA__ || {};
const CF_BRAND = CF_DATA.brand || {};
const CF_SLUG = CF_DATA.slug || "";
fetch('/api/public/mini-apps/'+CF_SLUG+'/visit', { method: 'POST', keepalive: true }).catch(function(){});
const CONFIG = {
  titulo:      CF_BRAND.title || "Control Financiero 2026",
  subtitulo:   CF_BRAND.subtitle || "Presupuesto Base Cero",
  agente:      CF_BRAND.advisorName || "Growth Link",
  logoURL:     CF_BRAND.logoURL || "",
  colorMarca:  CF_BRAND.colorMarca || "",
  monedaDefault: CF_BRAND.monedaDefault || "$",
  anio: CF_BRAND.anio || 2026
};

/* ================= Modelo ================= */
const CATS = [
  { key:"ingresos",      name:"Ingresos",              n:1, color:"var(--c-ingreso)",     hex:"#2E7D6B", type:"in"  },
  { key:"esenciales",    name:"Gastos Esenciales",     n:2, color:"var(--c-esencial)",    hex:"#3E6E9A", type:"out" },
  { key:"discrecionales",name:"Gastos Discrecionales", n:3, color:"var(--c-discrecional)",hex:"#B0793C", type:"out" },
  { key:"deudas",        name:"Pago de Deudas",        n:4, color:"var(--c-deuda)",       hex:"#A25048", type:"out" },
  { key:"ahorros",       name:"Ahorros",               n:5, color:"var(--c-ahorro)",      hex:"#6D6AAE", type:"save"},
  { key:"inversiones",   name:"Inversiones",           n:6, color:"var(--c-inversion)",   hex:"#2F8A8A", type:"save"}
];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_KEYS = MONTHS.map(function(m){return m.toLowerCase();});

const LS_KEY = "gl_control_financiero_2026";
var D = {
  currency: CONFIG.monedaDefault,
  budget: {},          // key -> [{id,name,amount}]
  tx: {}               // monthKey -> [{id,cat,subId,subName,date,amount}]
};
CATS.forEach(function(c){ D.budget[c.key]=[]; });
MONTH_KEYS.forEach(function(m){ D.tx[m]=[]; });

var UI = { tab:"inicio", month:0 };

/* ================= Persistencia ================= */
function save(silent){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(D)); if(!silent)toast("Guardado"); }catch(e){}
}
function load(){
  try{ var s=localStorage.getItem(LS_KEY); if(s){ var p=JSON.parse(s);
    D.currency=p.currency||CONFIG.monedaDefault;
    CATS.forEach(function(c){ D.budget[c.key]=(p.budget&&p.budget[c.key])||[]; });
    MONTH_KEYS.forEach(function(m){ D.tx[m]=(p.tx&&p.tx[m])||[]; });
  }}catch(e){}
}
var toastT; function toast(msg){ var el=$("toast"); $("toastMsg").textContent=msg||"Guardado"; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(function(){el.classList.remove("on")},1400); }

function $(id){ return document.getElementById(id); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function num(v){ v=parseFloat(v); return isFinite(v)?v:0; }
function fmt(v){
  var neg=v<0; v=Math.abs(Math.round((v+Number.EPSILON)*100)/100);
  var s=v.toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:2});
  var c=D.currency==="•"?"":D.currency+" ";
  return (neg?"-"+c:c)+s;
}

/* ================= Init ================= */
(function init(){
  if(CONFIG.colorMarca){ document.documentElement.style.setProperty('--accent',CONFIG.colorMarca); }
  $("brandTitle").textContent=CONFIG.titulo;
  $("brandSub").textContent=CONFIG.subtitulo;
  $("footAgent").textContent=CONFIG.agente;
  var initials=CONFIG.agente.split(" ").map(function(w){return w[0]}).slice(0,2).join("").toUpperCase();
  if(CONFIG.logoURL){ $("brandMk").innerHTML='<img src="'+CONFIG.logoURL+'" alt="">'; } else { $("brandMk").textContent=initials; }
  load();
  buildTabs();
  // currency selector
  document.querySelectorAll('#curSelect button').forEach(function(b){
    b.classList.toggle('on', b.dataset.cur===D.currency);
    b.onclick=function(){ D.currency=b.dataset.cur; document.querySelectorAll('#curSelect button').forEach(function(x){x.classList.toggle('on',x===b)}); save(true); renderAll(); };
  });
  renderBudget();
})();

function buildTabs(){
  var t=$("tabsIn"); t.innerHTML="";
  addTab(t,"Inicio","inicio",false);
  addTab(t,"Presupuesto","presupuesto",false);
  MONTHS.forEach(function(m,i){ addTab(t,m.slice(0,3),"mes:"+i, i===0); });
  addTab(t,"Dashboard","dashboard",true);
}
function addTab(container,label,id,sep){
  var b=document.createElement("button"); b.className="tab"+(sep?" sep":""); b.textContent=label; b.dataset.tab=id;
  b.onclick=function(){ goTab(id); };
  container.appendChild(b);
}
function goTab(id){
  UI.tab=id;
  document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('on', x.dataset.tab===id); });
  var view = id.indexOf("mes:")===0 ? "mes" : id;
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('on'); });
  document.querySelector('.view[data-view="'+view+'"]').classList.add('on');
  if(id.indexOf("mes:")===0){ UI.month=parseInt(id.split(":")[1],10); renderMonth(); }
  else if(id==="presupuesto"){ renderBudget(); }
  else if(id==="dashboard"){ renderDashboard(); }
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderAll(){
  renderBudget();
  if(UI.tab.indexOf("mes:")===0) renderMonth();
  if(UI.tab==="dashboard") renderDashboard();
}

/* ================= Cálculos ================= */
function catBudgetTotal(catKey){ return D.budget[catKey].reduce(function(s,x){return s+num(x.amount)},0); }
function subRealForMonth(monthKey, catKey, subId){
  return D.tx[monthKey].filter(function(t){return t.cat===catKey && t.subId===subId})
    .reduce(function(s,t){return s+num(t.amount)},0);
}
function catRealForMonth(monthKey, catKey){
  return D.tx[monthKey].filter(function(t){return t.cat===catKey}).reduce(function(s,t){return s+num(t.amount)},0);
}
// Remanente presupuesto = ingresos - (esenciales+discrecionales+deudas+ahorros+inversiones)
function budgetRemanente(){
  var ing=catBudgetTotal("ingresos");
  var out=CATS.filter(function(c){return c.key!=="ingresos"}).reduce(function(s,c){return s+catBudgetTotal(c.key)},0);
  return Math.round((ing-out)*100)/100;
}
function monthRemanente(monthKey){
  var ing=catRealForMonth(monthKey,"ingresos");
  var out=CATS.filter(function(c){return c.key!=="ingresos"}).reduce(function(s,c){return s+catRealForMonth(monthKey,c.key)},0);
  return Math.round((ing-out)*100)/100;
}

/* ================= PRESUPUESTO ================= */
function renderBudget(){
  // remanente banner
  var rem=budgetRemanente(), ing=catBudgetTotal("ingresos");
  var asignado=CATS.filter(function(c){return c.key!=="ingresos"}).reduce(function(s,c){return s+catBudgetTotal(c.key)},0);
  paintRemanente($("budgetRemanente"), rem, ing, asignado, "por asignar");

  var w=$("budgetCats"); w.innerHTML="";
  CATS.forEach(function(c){
    var panel=document.createElement("div"); panel.className="cat";
    var tot=catBudgetTotal(c.key);
    var pctOfIncome = ing>0 && c.key!=="ingresos" ? " · "+Math.round(tot/ing*100)+"% de ingresos" : "";
    var head='<div class="cat-head"><span class="cnum">'+c.n+'</span><span class="dot" style="background:'+c.color+'"></span><span class="ct" style="color:'+c.color+'">'+c.name+'</span>'+
      '<span class="ctot" style="color:'+c.color+'">'+fmt(tot)+'<small>total'+pctOfIncome+'</small></span></div>';
    var body='<div class="cat-body"><div class="colhead"><span>Subcategoría</span><span>Monto mensual</span><span></span></div>';
    D.budget[c.key].forEach(function(sub){
      body+='<div class="subrow">'+
        '<input type="text" value="'+escAttr(sub.name)+'" placeholder="Ej. '+placeholderFor(c.key)+'" oninput="updSub(\\''+c.key+'\\',\\''+sub.id+'\\',\\'name\\',this.value)">'+
        '<input type="number" class="amt num" value="'+(sub.amount!==""&&sub.amount!=null?sub.amount:"")+'" placeholder="0" min="0" step="0.01" oninput="updSub(\\''+c.key+'\\',\\''+sub.id+'\\',\\'amount\\',this.value)">'+
        '<button class="del" onclick="delSub(\\''+c.key+'\\',\\''+sub.id+'\\')" title="Eliminar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>'+
        '</div>';
    });
    body+='<button class="addsub" onclick="addSub(\\''+c.key+'\\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg> Agregar subcategoría</button></div>';
    panel.innerHTML=head+body;
    w.appendChild(panel);
  });
}
function placeholderFor(key){
  return {ingresos:"Salario",esenciales:"Vivienda",discrecionales:"Restaurantes",deudas:"Tarjeta de crédito",ahorros:"Fondo de emergencia",inversiones:"Retiro"}[key]||"Nombre";
}
function addSub(catKey){ D.budget[catKey].push({id:uid(),name:"",amount:""}); renderBudget(); save(true); }
function updSub(catKey,id,field,val){
  var sub=D.budget[catKey].find(function(x){return x.id===id}); if(!sub)return;
  sub[field]= field==="amount" ? (val===""?"":num(val)) : val;
  // actualizar solo totales/remanente sin re-render completo (para no perder foco)
  var rem=budgetRemanente(), ing=catBudgetTotal("ingresos");
  var asignado=CATS.filter(function(c){return c.key!=="ingresos"}).reduce(function(s,c){return s+catBudgetTotal(c.key)},0);
  paintRemanente($("budgetRemanente"), rem, ing, asignado, "por asignar");
  // actualizar total de la categoría en su cabecera
  var idx=CATS.findIndex(function(c){return c.key===catKey});
  var head=document.querySelectorAll('.cat-head .ctot')[idx];
  if(head){ var c=CATS[idx],tot=catBudgetTotal(catKey);
    var pctOfIncome=ing>0&&catKey!=="ingresos"?" · "+Math.round(tot/ing*100)+"% de ingresos":"";
    head.innerHTML=fmt(tot)+'<small>total'+pctOfIncome+'</small>'; }
  save(true);
}
function delSub(catKey,id){
  D.budget[catKey]=D.budget[catKey].filter(function(x){return x.id!==id});
  // limpiar transacciones que apuntaban a esa subcategoría
  MONTH_KEYS.forEach(function(m){ D.tx[m]=D.tx[m].filter(function(t){return !(t.cat===catKey && t.subId===id)}); });
  renderBudget(); save(true);
}

/* ================= REMANENTE banner ================= */
function paintRemanente(el, rem, ingreso, asignado, labelRem){
  var cls = Math.abs(rem)<0.005 ? "zero" : (rem>0?"pos":"neg");
  var badge = Math.abs(rem)<0.005 ? "En cero · todo asignado" : (rem>0? "Te falta asignar" : "Te estás pasando");
  el.innerHTML =
    '<div class="rl"><b>Remanente</b><span class="rv '+cls+'">'+fmt(rem)+'</span></div>'+
    '<div class="mini"><span>Ingresos <b>'+fmt(ingreso)+'</b></span><span>Asignado <b>'+fmt(asignado)+'</b></span></div>'+
    '<span class="rbadge '+cls+'">'+badge+'</span>';
}

/* ================= MES ================= */
function renderMonth(){
  var mi=UI.month, mk=MONTH_KEYS[mi];
  $("mesEyebrow").textContent="Mes "+(mi+1)+" de 12 · "+CONFIG.anio;
  $("mesTitle").textContent=MONTHS[mi];

  // remanente del mes (real)
  var rem=monthRemanente(mk);
  var ingR=catRealForMonth(mk,"ingresos");
  var outR=CATS.filter(function(c){return c.key!=="ingresos"}).reduce(function(s,c){return s+catRealForMonth(mk,c.key)},0);
  paintRemanente($("mesRemanente"), rem, ingR, outR, "sin asignar");

  // KPIs
  var estIng=catBudgetTotal("ingresos");
  var gastosR=["esenciales","discrecionales","deudas"].reduce(function(s,k){return s+catRealForMonth(mk,k)},0);
  var saveR=["ahorros","inversiones"].reduce(function(s,k){return s+catRealForMonth(mk,k)},0);
  var tasa = ingR>0 ? Math.round(saveR/ingR*100) : 0;
  var kp=$("mesKpis"); kp.innerHTML="";
  kp.appendChild(kpi("Ingreso real", fmt(ingR), "Estimado "+fmt(estIng), ingR>=estIng?"pos":(estIng>0?"neg":"")));
  kp.appendChild(kpi("Gastos reales", fmt(gastosR), "Esenciales + discrec. + deudas", ""));
  kp.appendChild(kpi("Ahorro + inversión", fmt(saveR), "", ""));
  kp.appendChild(kpi("Tasa de ahorro", tasa+"%", tasa>=20?"Meta ideal alcanzada":"Meta sugerida: 20%", tasa>=20?"pos":""));

  // comparativo estimado vs real por categoría
  var cw=$("mesCmp"); cw.innerHTML="";
  CATS.forEach(function(c){
    var subs=D.budget[c.key].filter(function(s){return (s.name||"").trim()!==""});
    var estTot=catBudgetTotal(c.key), realTot=catRealForMonth(mk,c.key);
    var box=document.createElement("div"); box.className="cmp";
    var h='<h3><span class="dot" style="background:'+c.color+'"></span>'+c.name+'</h3>';
    var body="";
    if(!subs.length){ body='<div style="font-size:13px;color:var(--muted-2);padding:4px 0">Sin subcategorías. Agrégalas en la pestaña Presupuesto.</div>'; }
    else {
      subs.forEach(function(s){
        var est=num(s.amount), real=subRealForMonth(mk,c.key,s.id);
        var pct = est>0 ? Math.min(100, real/est*100) : (real>0?100:0);
        var over = est>0 && real>est;
        body+='<div class="cmp-sub"><span class="snm">'+escHtml(s.name)+'</span>'+
          '<span class="sest">est. '+fmt(est)+'</span><span class="sreal" style="color:'+(over?"var(--neg)":"var(--ink)")+'">'+fmt(real)+'</span>'+
          '<span class="cmp-bar"><i style="width:'+pct+'%;background:'+(over?"var(--neg)":c.color)+'"></i></span></div>';
      });
    }
    var diff=realTot-estTot;
    var diffTxt = c.type==="in"
      ? (realTot>=estTot?"+"+fmt(realTot-estTot)+" sobre lo estimado":fmt(realTot-estTot)+" vs estimado")
      : (realTot<=estTot?fmt(estTot-realTot)+" disponible":"+"+fmt(realTot-estTot)+" sobre lo estimado");
    body+='<div class="cmp-tot"><span>Total '+c.name+'</span><span class="num" style="color:'+c.color+'">'+fmt(realTot)+' <span style="color:var(--muted-2);font-weight:600">/ '+fmt(estTot)+'</span></span></div>';
    box.innerHTML=h+body;
    cw.appendChild(box);
  });

  // form de transacciones
  fillTxCatSelect();
  $("txDate").value = CONFIG.anio+"-"+String(mi+1).padStart(2,"0")+"-"+String(new Date().getDate()).padStart(2,"0");
  renderTxList();
}
function kpi(label,val,sub,cls){
  var d=document.createElement("div"); d.className="kpi";
  d.innerHTML='<div class="kl">'+label+'</div><div class="kv">'+val+'</div>'+(sub?'<div class="ks '+(cls||"")+'">'+sub+'</div>':'');
  return d;
}
function fillTxCatSelect(){
  var sel=$("txCat"); sel.innerHTML="";
  CATS.forEach(function(c){ var o=document.createElement("option"); o.value=c.key; o.textContent=c.name; sel.appendChild(o); });
  onTxCatChange();
}
function onTxCatChange(){
  var catKey=$("txCat").value, sel=$("txSub"); sel.innerHTML="";
  var subs=D.budget[catKey].filter(function(s){return (s.name||"").trim()!==""});
  if(!subs.length){ var o=document.createElement("option"); o.value=""; o.textContent="— agrega subcategorías en Presupuesto —"; sel.appendChild(o); return; }
  subs.forEach(function(s){ var o=document.createElement("option"); o.value=s.id; o.textContent=s.name; sel.appendChild(o); });
}
function addTx(){
  var mk=MONTH_KEYS[UI.month];
  var catKey=$("txCat").value, subId=$("txSub").value, date=$("txDate").value, amt=num($("txAmt").value);
  if(!subId){ toast("Elige una subcategoría"); return; }
  if(amt<=0){ $("txAmt").focus(); toast("Ingresa un monto"); return; }
  var subName=(D.budget[catKey].find(function(s){return s.id===subId})||{}).name||"";
  D.tx[mk].push({id:uid(),cat:catKey,subId:subId,subName:subName,date:date,amount:amt});
  $("txAmt").value="";
  save(true);
  renderMonth();
  $("txAmt").focus();
}
function delTx(id){
  var mk=MONTH_KEYS[UI.month];
  D.tx[mk]=D.tx[mk].filter(function(t){return t.id!==id});
  save(true); renderMonth();
}
function renderTxList(){
  var mk=MONTH_KEYS[UI.month], list=D.tx[mk].slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"")});
  var w=$("txList"), cnt=$("txCount");
  if(!list.length){ w.innerHTML='<div class="txempty">Aún no hay movimientos este mes. Agrega el primero arriba.</div>'; cnt.textContent=""; return; }
  cnt.textContent=list.length+" movimiento"+(list.length>1?"s":"")+" registrado"+(list.length>1?"s":"");
  w.innerHTML="";
  list.forEach(function(t){
    var c=CATS.find(function(x){return x.key===t.cat})||{color:"#999",name:""};
    var row=document.createElement("div"); row.className="txrow";
    var dt = t.date? t.date.slice(8,10)+"/"+t.date.slice(5,7) : "—";
    row.innerHTML='<span class="tdate">'+dt+'</span>'+
      '<span class="tcat"><span class="td" style="background:'+c.color+'"></span><span class="tsub">'+escHtml(t.subName||"—")+'</span></span>'+
      '<span style="font-size:12px;color:var(--muted)">'+c.name+'</span>'+
      '<span class="tamt">'+fmt(t.amount)+'</span>'+
      '<button class="tdel" onclick="delTx(\\''+t.id+'\\')" title="Eliminar">✕</button>';
    w.appendChild(row);
  });
}

/* ================= DASHBOARD ================= */
function catRealYear(catKey){ return MONTH_KEYS.reduce(function(s,m){return s+catRealForMonth(m,catKey)},0); }
function renderDashboard(){
  var ingY=catRealYear("ingresos");
  var gastY=["esenciales","discrecionales","deudas"].reduce(function(s,k){return s+catRealYear(k)},0);
  var saveY=["ahorros","inversiones"].reduce(function(s,k){return s+catRealYear(k)},0);
  var tasaY= ingY>0?Math.round(saveY/ingY*100):0;

  var kp=$("dashKpis"); kp.innerHTML="";
  kp.appendChild(kpi("Ingresos del año", fmt(ingY), "", ""));
  kp.appendChild(kpi("Gastos del año", fmt(gastY), "Esenciales + discrec. + deudas", ""));
  kp.appendChild(kpi("Ahorro + inversión", fmt(saveY), "", ""));
  kp.appendChild(kpi("Tasa de ahorro anual", tasaY+"%", tasaY>=20?"Meta ideal":"Meta sugerida: 20%", tasaY>=20?"pos":""));

  // barras por mes
  var maxV=1;
  var perMonth=MONTH_KEYS.map(function(m){
    var i=catRealForMonth(m,"ingresos");
    var g=["esenciales","discrecionales","deudas"].reduce(function(s,k){return s+catRealForMonth(m,k)},0);
    var sv=["ahorros","inversiones"].reduce(function(s,k){return s+catRealForMonth(m,k)},0);
    maxV=Math.max(maxV,i,g,sv); return {i:i,g:g,sv:sv};
  });
  var bw=$("dashBars"); bw.innerHTML="";
  perMonth.forEach(function(d,idx){
    var col=document.createElement("div"); col.className="barcol";
    col.innerHTML='<div class="bwrap">'+
      '<div class="bar" style="height:'+(d.i/maxV*100)+'%;background:var(--c-ingreso)" title="Ingresos '+fmt(d.i)+'"></div>'+
      '<div class="bar" style="height:'+(d.g/maxV*100)+'%;background:var(--c-esencial)" title="Gastos '+fmt(d.g)+'"></div>'+
      '<div class="bar" style="height:'+(d.sv/maxV*100)+'%;background:var(--c-ahorro)" title="Ahorro+Inv '+fmt(d.sv)+'"></div>'+
      '</div><div class="bl">'+MONTHS[idx].slice(0,3)+'</div>';
    bw.appendChild(col);
  });

  // donut distribución (gastos+ahorro+inversión reales del año)
  var parts=CATS.filter(function(c){return c.key!=="ingresos"}).map(function(c){ return {name:c.name,val:catRealYear(c.key),hex:c.hex,color:c.color}; }).filter(function(p){return p.val>0});
  drawDonut($("dashDonut"), $("dashDonutLegend"), parts);

  // resumen por categoría
  var cs=$("dashCatSummary"); cs.innerHTML="";
  CATS.forEach(function(c){
    var v=catRealYear(c.key);
    var row=document.createElement("div"); row.className="anrow";
    row.innerHTML='<span class="al"><i style="background:'+c.color+'"></i>'+c.name+'</span><span class="av" style="color:'+c.color+'">'+fmt(v)+'</span>';
    cs.appendChild(row);
  });

  // tabla mensual
  var tbl=$("dashTable");
  var head='<thead><tr><th>Categoría</th>'+MONTHS.map(function(m){return '<th>'+m.slice(0,3)+'</th>'}).join("")+'<th>Total</th></tr></thead>';
  var body='<tbody>';
  CATS.forEach(function(c){
    body+='<tr><td>'+c.name+'</td>';
    var tot=0;
    MONTH_KEYS.forEach(function(m){ var v=catRealForMonth(m,c.key); tot+=v; body+='<td>'+(v?fmt(v):'<span style="color:var(--muted-2)">–</span>')+'</td>'; });
    body+='<td style="font-weight:800;color:'+c.color+'">'+fmt(tot)+'</td></tr>';
  });
  // fila remanente
  body+='<tr class="totrow"><td>Remanente</td>';
  var totRem=0;
  MONTH_KEYS.forEach(function(m){ var r=monthRemanente(m); totRem+=r; body+='<td style="color:'+(Math.abs(r)<0.005?"var(--pos)":(r<0?"var(--neg)":"var(--ink)"))+'">'+(r?fmt(r):'<span style="color:var(--muted-2)">–</span>')+'</td>'; });
  body+='<td>'+fmt(totRem)+'</td></tr></tbody>';
  tbl.innerHTML=head+body;
}
function drawDonut(svg, legend, parts){
  svg.innerHTML=""; legend.innerHTML="";
  var total=parts.reduce(function(s,p){return s+p.val},0);
  if(total<=0){ svg.innerHTML='<circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--line)" stroke-width="6"/>';
    legend.innerHTML='<div style="font-size:12.5px;color:var(--muted-2)">Registra movimientos para ver tu distribución.</div>'; return; }
  var off=25; // empezar arriba
  parts.forEach(function(p){
    var pct=p.val/total*100;
    var circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute("cx","21"); circle.setAttribute("cy","21"); circle.setAttribute("r","15.9155");
    circle.setAttribute("fill","none"); circle.setAttribute("stroke",p.hex); circle.setAttribute("stroke-width","6");
    circle.setAttribute("stroke-dasharray",pct+" "+(100-pct));
    circle.setAttribute("stroke-dashoffset",off);
    svg.appendChild(circle);
    off = off - pct; if(off<0) off+=100;
    var dl=document.createElement("div"); dl.className="dl";
    dl.innerHTML='<i style="background:'+p.hex+'"></i>'+p.name+'<span class="dv">'+Math.round(pct)+'%</span>';
    legend.appendChild(dl);
  });
}

/* ================= Exportar / importar ================= */
function exportData(){
  var blob=new Blob([JSON.stringify(D,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="control-financiero-"+CONFIG.anio+".json"; a.click();
  setTimeout(function(){URL.revokeObjectURL(url)},500);
  toast("Datos descargados");
}
function importData(ev){
  var file=ev.target.files[0]; if(!file)return;
  var r=new FileReader();
  r.onload=function(){
    try{ var p=JSON.parse(r.result);
      if(!p.budget||!p.tx){ toast("Archivo no válido"); return; }
      D.currency=p.currency||D.currency;
      CATS.forEach(function(c){ D.budget[c.key]=p.budget[c.key]||[]; });
      MONTH_KEYS.forEach(function(m){ D.tx[m]=p.tx[m]||[]; });
      save(true);
      document.querySelectorAll('#curSelect button').forEach(function(b){ b.classList.toggle('on',b.dataset.cur===D.currency); });
      renderAll(); goTab('presupuesto'); toast("Datos cargados");
    }catch(e){ toast("No se pudo leer el archivo"); }
  };
  r.readAsText(file);
  ev.target.value="";
}

/* helpers de escape */
function escHtml(s){ return (s||"").replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]}); }
function escAttr(s){ return (s||"").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importTriggerBtn').addEventListener('click', function(){ document.getElementById('importFile').click(); });
document.getElementById('importFile').addEventListener('change', importData);
document.getElementById('startBtn').addEventListener('click', function(){ goTab('presupuesto'); });
document.getElementById('txCat').addEventListener('change', onTxCatChange);
document.getElementById('txAddBtn').addEventListener('click', addTx);
`;
