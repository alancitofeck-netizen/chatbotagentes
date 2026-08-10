/** Plantilla verbatim de "Meeting OS" (módulo Asesorías) — CSS, HTML del
 * <body> y JS copiados carácter por carácter del archivo v11 entregado
 * (growth-link-meeting-os-v11-fix-desborde.html — fix de overflow: un slide
 * más alto que el viewport ya no queda recortado, ver el comentario CSS
 * sobre `.slide>.wrap`). Reemplaza la v10 (growth-link-meeting-os-v10-
 * powing-cards.html). CERO cambios: ni un byte de HTML/CSS/JS fue tocado —
 * la fidelidad exacta se garantiza generando este archivo por script (ver
 * scratchpad/extract_v11.mjs de esta sesión) en vez de transcribir a mano,
 * para que la única transformación posible sea el escape mecánico de
 * backslash/backtick/${ que exige incrustar el texto dentro de un template
 * literal de TypeScript.
 *
 * Este tipo de Módulo NO se sirve como fragmento inyectado en una página
 * React (a diferencia de las plantillas de Mini Apps) — el archivo original
 * declara más de 100 `function nombre(){}` a nivel superior sin ningún IIFE
 * que las encierre, lo que las cuelga de `window.*`; ya sabemos por el fix de
 * "Diagnóstico Interactivo Financiero" (commit 8b361bd) que `window.next`
 * puede quedar pisado por el runtime de Next.js, y esta plantilla vuelve a usar
 * exactamente ese patrón (más de 100 funciones globales). Por eso se sirve
 * dentro de un <iframe> mismo-origen (src/app/api/asesorias/[asesoriaId]/frame/route.ts),
 * que le da a este script su propio `window` real, aislado del de Next.js. */

export const MEETING_OS_CSS = `

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@400;600;700;800&family=Manrope:wght@400;600;700;800&family=Lato:wght@400;700;900&family=Poppins:wght@400;600;700;800&family=Merriweather:wght@400;700;900&family=Playfair+Display:wght@500;700;800&family=Fraunces:wght@400;600;800&display=swap');
:root{
  --gl-bg:#050817;--gl-bg2:#0A1230;--gl-surface:#0D1838;--gl-surface2:#122250;
  --gl-text:#EAF2FF;--gl-text2:#8FA3C8;--gl-muted:#5E719A;
  --gl-accent:#2E7BF6;--gl-accent-soft:#5B9BFF;--gl-accent-contrast:#FFFFFF;
  --gl-border:rgba(127,196,255,.18);--gl-border-strong:rgba(127,196,255,.32);
  --gl-input-bg:#0D1838;--gl-button-text:#FFFFFF;
  --gl-ok:#3DD68C;--gl-warn:#FFB454;--gl-danger:#FF6B6B;
  --gl-glow:rgba(46,123,246,.16);--gl-star:180,215,255;--gl-star-line:127,196,255;
  --gl-shadow:0 12px 34px rgba(46,123,246,.34);--gl-radius:20px;
  --gl-font-body:'Inter',system-ui,sans-serif;--gl-font-head:'Inter',system-ui,sans-serif;--gl-star-opacity:.55;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:var(--gl-bg);font-family:var(--gl-font-body);color:var(--gl-text);-webkit-font-smoothing:antialiased;transition:background .4s,color .3s}
button{font-family:var(--gl-font-body);cursor:pointer}
h1,h2,.logo .txt,.stat .num{font-family:var(--gl-font-head)}
#stars{position:fixed;inset:0;z-index:0;opacity:var(--gl-star-opacity);transition:opacity .4s}
.glow{position:fixed;border-radius:50%;filter:blur(120px);z-index:0;pointer-events:none;transition:background .4s}
.glow.a{width:600px;height:600px;background:var(--gl-glow);top:-200px;right:-150px}
.glow.b{width:500px;height:500px;background:var(--gl-glow);bottom:-220px;left:-140px;opacity:.6}
#deck{position:relative;z-index:2;height:100%;width:100%}
.slide{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:flex-start;padding:64px 40px 96px;overflow-y:auto;overflow-x:hidden}
.slide.active{display:flex;animation:rise .5s ease both}
/* margin auto centra verticalmente cuando cabe, pero NO recorta cuando el contenido es más alto que la pantalla */
.slide>.wrap{flex:0 0 auto;margin-top:auto;margin-bottom:auto}
@keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.wrap{width:100%;max-width:820px;margin:0 auto}.center{text-align:center}
.kicker{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:600;margin-bottom:20px}
h1{font-size:clamp(30px,5vw,54px);line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-bottom:20px;color:var(--gl-text)}
h2{font-size:clamp(24px,3.6vw,38px);line-height:1.18;font-weight:700;letter-spacing:-.02em;margin-bottom:18px;color:var(--gl-text)}
.em{color:var(--gl-accent-soft)}
p{font-size:clamp(16px,2vw,19px);line-height:1.6;color:var(--gl-text2)}
p strong{color:var(--gl-text);font-weight:600}
p.big{font-size:clamp(18px,2.3vw,22px);color:var(--gl-text)}
.lead{color:var(--gl-text2);margin-bottom:8px}
.logo{display:flex;align-items:center;gap:12px;font-weight:800}
.logo.center{justify-content:center;margin-bottom:28px}
.logo .mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(150deg,var(--gl-surface2),var(--gl-surface));border:1px solid var(--gl-border-strong);display:flex;align-items:center;justify-content:center;box-shadow:var(--gl-shadow);overflow:hidden}
.logo .mark span{font-size:18px;font-weight:800;color:var(--gl-text)}.logo .mark span b{color:var(--gl-accent-soft)}
.logo .mark img{width:100%;height:100%}
.logo .txt{font-size:15px;line-height:1.05;text-align:left;color:var(--gl-text)}
.logo .txt small{display:block;font-size:9px;letter-spacing:.34em;color:var(--gl-muted);font-weight:600;margin-top:2px}
.badges{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.center .badges{justify-content:center}
.badge{font-size:12px;padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--gl-accent) 12%,transparent);border:1px solid var(--gl-border-strong);color:var(--gl-accent-soft);font-weight:500}
.cover-name{margin-top:30px;font-size:15px;color:var(--gl-text2)}.cover-name b{color:var(--gl-text);font-weight:600}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.center .actions{justify-content:center}
.btn{appearance:none;border:none;cursor:pointer;font-family:var(--gl-font-body);font-weight:600;font-size:16px;padding:15px 30px;border-radius:14px;transition:transform .18s,box-shadow .2s,background .2s;background:linear-gradient(135deg,var(--gl-accent),color-mix(in srgb,var(--gl-accent) 78%,#000));color:var(--gl-button-text);box-shadow:var(--gl-shadow)}
.btn:hover{transform:translateY(-2px)}
.btn.ghost{background:transparent;border:1px solid var(--gl-border-strong);color:var(--gl-text);box-shadow:none}
.btn.ghost:hover{background:color-mix(in srgb,var(--gl-accent) 8%,transparent)}
.btn.sm{padding:9px 16px;font-size:13px;border-radius:10px}
.steps{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px}
.step{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:var(--gl-radius);padding:24px}
.step.hl{background:linear-gradient(160deg,var(--gl-surface2),var(--gl-surface));border-color:var(--gl-border-strong)}
.step .when{font-size:11px;color:var(--gl-accent-soft);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
.step .t{font-size:22px;font-weight:700;color:var(--gl-text)}.step .d{font-size:14px;color:var(--gl-text2);margin-top:10px}
.prior{list-style:none;margin-top:26px;display:flex;flex-direction:column;gap:10px;max-width:560px;margin-left:auto;margin-right:auto}
.prior li{display:flex;align-items:center;gap:14px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:14px;padding:14px 16px;cursor:grab;transition:border .2s,background .2s}
.prior li:hover{border-color:var(--gl-border-strong);background:var(--gl-surface2)}
.prior li.drag{opacity:.4}.prior li.over{border-color:var(--gl-accent);background:color-mix(in srgb,var(--gl-accent) 10%,transparent)}
.prior li .rank{width:30px;height:30px;flex:0 0 30px;border-radius:9px;background:color-mix(in srgb,var(--gl-accent) 14%,transparent);color:var(--gl-accent-soft);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.prior li .lbl{font-weight:600;font-size:17px;color:var(--gl-text)}.prior li .grip{margin-left:auto;color:var(--gl-muted);font-size:18px}
.field{margin-top:24px;width:100%}
textarea,.money input{width:100%;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:14px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:17px;padding:16px 18px;resize:vertical;outline:none;transition:border .2s;line-height:1.5}
textarea:focus,.money input:focus{border-color:var(--gl-accent)}textarea::placeholder{color:var(--gl-muted)}
.money{position:relative;margin-top:24px}
.money span{position:absolute;left:18px;top:50%;transform:translateY(-50%);font-size:20px;color:var(--gl-accent-soft);font-weight:700}
.money input{padding-left:44px;font-size:22px;font-weight:600}
.twoup{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px;text-align:left}
.choice{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:var(--gl-radius);padding:26px 22px;cursor:pointer;transition:border .2s,background .2s,transform .18s}
.choice:hover{border-color:var(--gl-accent);background:var(--gl-surface2);transform:translateY(-3px)}
.choice.sel{border-color:var(--gl-accent);background:color-mix(in srgb,var(--gl-accent) 12%,transparent)}
.choice .k{font-size:28px;font-weight:800;color:var(--gl-accent-soft);margin-bottom:10px}
.choice p{font-size:16px;color:var(--gl-text2)}.choice p strong{color:var(--gl-text)}
.opts{display:flex;flex-direction:column;gap:12px;margin-top:24px;max-width:600px;margin-left:auto;margin-right:auto}
.opt{display:flex;align-items:center;gap:14px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:14px;padding:16px 18px;cursor:pointer;transition:border .2s,background .2s}
.opt:hover{border-color:var(--gl-border-strong);background:var(--gl-surface2)}.opt.sel{border-color:var(--gl-accent);background:color-mix(in srgb,var(--gl-accent) 12%,transparent)}
.opt .ic{font-size:20px}.opt .ol{font-size:16px;font-weight:500;color:var(--gl-text)}
.echo{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:14px}
.echo li{background:var(--gl-surface);border:1px solid var(--gl-border);border-left:3px solid var(--gl-accent);border-radius:12px;padding:16px 18px}
.echo li .q{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gl-muted);margin-bottom:6px}
.echo li .a{font-size:17px;color:var(--gl-text);font-weight:500;white-space:pre-wrap}.echo li .a:empty:before{content:'—';color:var(--gl-muted)}
.stat{margin:20px 0;text-align:center}
.stat .num{font-size:clamp(44px,7vw,76px);font-weight:800;color:var(--gl-accent-soft);letter-spacing:-.03em;line-height:1}
.stat .cap{font-size:17px;color:var(--gl-text2);margin-top:12px}
.simple-list{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:12px;max-width:600px;margin-left:auto;margin-right:auto}
.simple-list li{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:12px;padding:15px 18px;font-size:16px;color:var(--gl-text2);display:flex;gap:12px;align-items:center}
.simple-list li .n{color:var(--gl-accent-soft);font-weight:700}
.media img{max-width:100%;border-radius:16px;border:1px solid var(--gl-border-strong);margin-top:24px}
.embed{margin-top:24px;border-radius:16px;overflow:hidden;border:1px solid var(--gl-border-strong);aspect-ratio:16/9}
.embed iframe{width:100%;height:100%;border:0}
#bar{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--gl-accent),var(--gl-accent-soft));z-index:20;width:0;transition:width .5s ease}
#hud{position:fixed;bottom:22px;left:0;right:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:18px;pointer-events:none}
.nav{pointer-events:auto;width:46px;height:46px;border-radius:50%;background:var(--gl-surface);border:1px solid var(--gl-border-strong);color:var(--gl-text);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s}
.nav:hover{background:var(--gl-accent);color:var(--gl-accent-contrast);transform:scale(1.06)}.nav:disabled{opacity:.3;cursor:default;transform:none}
#count{pointer-events:none;font-size:13px;color:var(--gl-text2);letter-spacing:.14em;font-weight:600;min-width:72px;text-align:center}#count b{color:var(--gl-text)}
.corner{position:fixed;top:22px;left:26px;z-index:20}
.hint{position:fixed;bottom:80px;left:0;right:0;text-align:center;font-size:12px;color:var(--gl-muted);z-index:19}
body.edit #deck{position:absolute;inset:114px 340px 0 260px;z-index:2}
body.edit .slide{padding:48px 36px}
body.edit #hud,body.edit #bar,body.edit .corner,body.edit .hint{display:none}
body.edit .slide .actions{opacity:.35;pointer-events:none}
#topbar{position:fixed;top:0;left:0;right:0;height:58px;z-index:60;display:none;align-items:center;gap:12px;padding:0 16px;background:color-mix(in srgb,var(--gl-bg) 82%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--gl-border)}
body.edit #topbar{display:flex}
.tb-brand{display:flex;align-items:center;gap:10px}
.tb-brand .m{width:34px;height:34px;border-radius:9px;background:linear-gradient(150deg,var(--gl-surface2),var(--gl-surface));border:1px solid var(--gl-border-strong);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:var(--gl-text)}
.tb-brand .m b{color:var(--gl-accent-soft)}
.tb-brand .t{font-size:13px;font-weight:700;line-height:1;color:var(--gl-text)}
.tb-brand .t small{display:block;font-size:8px;letter-spacing:.28em;color:var(--gl-muted);margin-top:3px}
.tb-title{font-size:13px;color:var(--gl-text2)}.tb-title b{color:var(--gl-text)}
.tb-sp{flex:1}
.seg{display:flex;background:var(--gl-surface);border:1px solid var(--gl-border-strong);border-radius:11px;padding:3px;gap:2px}
.seg button{border:none;background:transparent;color:var(--gl-text2);font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;transition:.15s}
.seg button.on{background:var(--gl-accent);color:var(--gl-accent-contrast)}
.tb-actions{display:flex;gap:6px;align-items:center}
.icon-btn{width:34px;height:34px;border-radius:9px;border:1px solid var(--gl-border);background:transparent;color:var(--gl-text2);font-size:15px;display:flex;align-items:center;justify-content:center;transition:.15s}
.icon-btn:hover:not(:disabled){border-color:var(--gl-accent);color:var(--gl-accent-soft)}
.icon-btn:disabled{opacity:.3}
.save-state{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--gl-text2);padding:0 6px;white-space:nowrap}
.save-dot{width:8px;height:8px;border-radius:50%;background:var(--gl-muted);transition:.2s}
.save-state.saving .save-dot{background:var(--gl-warn);animation:pulse 1s infinite}
.save-state.saved .save-dot{background:var(--gl-ok)}
.save-state.dirty .save-dot{background:var(--gl-warn)}
.save-state.error .save-dot{background:var(--gl-danger)}
@keyframes pulse{50%{opacity:.4}}

#leftCol{position:fixed;top:58px;bottom:0;left:0;width:260px;z-index:50;background:color-mix(in srgb,var(--gl-bg2) 92%,transparent);border-right:1px solid var(--gl-border);display:none;flex-direction:column}
#rightCol{position:fixed;top:58px;bottom:0;right:0;width:340px;z-index:50;background:color-mix(in srgb,var(--gl-bg2) 92%,transparent);border-left:1px solid var(--gl-border);display:none;flex-direction:column}
#editHint{position:fixed;top:66px;left:260px;right:340px;z-index:40;text-align:center;font-size:12px;color:var(--gl-muted);display:none;pointer-events:none}
body.edit #leftCol,body.edit #rightCol{display:flex}body.edit #editHint{display:block}
.col-head{padding:14px 16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gl-muted);font-weight:700;border-bottom:1px solid var(--gl-border);display:flex;align-items:center;gap:8px}
.col-head .sp{flex:1}
.col-scroll{overflow-y:auto;flex:1;padding:12px}
.col-scroll::-webkit-scrollbar{width:8px}.col-scroll::-webkit-scrollbar-thumb{background:var(--gl-border-strong);border-radius:4px}
.slide-item{display:flex;align-items:center;gap:10px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:11px;padding:10px 11px;margin-bottom:8px;cursor:pointer;transition:.15s;position:relative}
.slide-item:hover{border-color:var(--gl-border-strong)}.slide-item.sel{border-color:var(--gl-accent);background:var(--gl-surface2)}
.slide-item.drag{opacity:.4}.slide-item.over{border-color:var(--gl-accent)}.slide-item.off{opacity:.45}
.slide-item .num{width:22px;height:22px;flex:0 0 22px;border-radius:6px;background:color-mix(in srgb,var(--gl-accent) 14%,transparent);color:var(--gl-accent-soft);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.slide-item .info{min-width:0;flex:1}
.slide-item .nm{font-size:13px;font-weight:600;color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slide-item .tp{font-size:10px;color:var(--gl-muted);letter-spacing:.06em;text-transform:uppercase}
.slide-item .acts{display:flex;gap:3px;opacity:0;transition:.15s}.slide-item:hover .acts{opacity:1}
.mini{width:24px;height:24px;border-radius:7px;border:1px solid var(--gl-border);background:transparent;color:var(--gl-text2);font-size:12px;display:flex;align-items:center;justify-content:center;transition:.15s}
.mini:hover{border-color:var(--gl-accent);color:var(--gl-accent-soft)}.mini.del:hover{border-color:var(--gl-danger);color:var(--gl-danger)}
.add-slide{width:100%;border:1px dashed var(--gl-border-strong);background:transparent;color:var(--gl-accent-soft);border-radius:11px;padding:12px;font-size:13px;font-weight:600;transition:.15s}
.add-slide:hover{background:color-mix(in srgb,var(--gl-accent) 8%,transparent);border-color:var(--gl-accent)}
.prop{margin-bottom:16px}
.prop label{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gl-muted);font-weight:600;margin-bottom:6px}
.prop input,.prop textarea,.prop select{width:100%;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:10px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:13px;padding:10px 12px;outline:none;transition:.15s}
.prop input:focus,.prop textarea:focus,.prop select:focus{border-color:var(--gl-accent)}
.prop textarea{resize:vertical;min-height:64px;line-height:1.45}
.prop-group{border:1px solid var(--gl-border);border-radius:12px;padding:12px;margin-bottom:14px}
.prop-group .gh{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:700;margin-bottom:10px}
.chip-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gl-text2);margin-bottom:4px}
.switch{width:38px;height:22px;border-radius:999px;background:var(--gl-surface2);border:1px solid var(--gl-border-strong);position:relative;cursor:pointer;transition:.2s;flex:0 0 38px}
.switch.on{background:var(--gl-accent);border-color:var(--gl-accent)}
.switch i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s}.switch.on i{left:18px}
.opt-editor{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:9px;padding:8px;margin-bottom:6px;display:flex;gap:6px;align-items:center}
.opt-editor input,.opt-editor select{border-radius:7px;padding:7px 9px}.opt-editor .oi{flex:0 0 46px}
.opt-editor .grip{color:var(--gl-muted);cursor:grab;font-size:14px}.opt-editor.drag{opacity:.4}.opt-editor.over{border-color:var(--gl-accent)}
.add-opt{width:100%;border:1px dashed var(--gl-border-strong);background:transparent;color:var(--gl-accent-soft);border-radius:9px;padding:9px;font-size:12px;font-weight:600;margin-top:2px}
.add-opt:hover{background:color-mix(in srgb,var(--gl-accent) 8%,transparent)}
.prop-empty{color:var(--gl-muted);font-size:13px;text-align:center;padding:40px 12px;line-height:1.6}
body.edit [data-edit]{cursor:text;border-radius:6px;transition:box-shadow .15s;outline:none}
body.edit [data-edit]:hover{box-shadow:0 0 0 1px var(--gl-border-strong)}
[data-edit].editing{box-shadow:0 0 0 2px var(--gl-accent)!important;background:color-mix(in srgb,var(--gl-accent) 6%,transparent);cursor:text}
#toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:120;background:var(--gl-surface2);border:1px solid var(--gl-border-strong);border-radius:12px;padding:12px 20px;font-size:14px;color:var(--gl-text);opacity:0;transition:.3s;pointer-events:none;max-width:90vw}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#modal{position:fixed;inset:0;z-index:100;background:rgba(3,6,18,.72);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:30px}
#modal.on{display:flex}
.modal-card{background:var(--gl-bg2);border:1px solid var(--gl-border-strong);border-radius:20px;padding:26px;max-width:680px;width:100%;max-height:84vh;overflow-y:auto}
.modal-card h3{font-size:20px;font-weight:700;margin-bottom:16px;color:var(--gl-text)}
.modal-x{float:right;background:transparent;border:none;color:var(--gl-text2);font-size:22px;line-height:1;cursor:pointer}
.type-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.type-card{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:12px;padding:14px 12px;text-align:center;transition:.15s;cursor:pointer}
.type-card:hover{border-color:var(--gl-accent);background:var(--gl-surface2);transform:translateY(-2px)}
.type-card .ti{font-size:22px;margin-bottom:6px}.type-card .tn{font-size:12px;font-weight:600;color:var(--gl-text)}
.theme-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.theme-card{border:1px solid var(--gl-border);border-radius:14px;overflow:hidden;cursor:pointer;transition:.15s;background:var(--gl-surface)}
.theme-card:hover{border-color:var(--gl-accent);transform:translateY(-2px)}
.theme-card.active{border-color:var(--gl-accent);box-shadow:0 0 0 2px var(--gl-accent)}
.theme-thumb{height:88px;position:relative;padding:12px;display:flex;flex-direction:column;justify-content:space-between}
.theme-thumb .tt{font-size:13px;font-weight:700}
.theme-thumb .dots{display:flex;gap:5px}
.theme-thumb .dots i{width:14px;height:14px;border-radius:50%;display:block}
.theme-name{padding:9px 12px;font-size:12px;font-weight:600;color:var(--gl-text);border-top:1px solid var(--gl-border);background:var(--gl-surface)}
.mode-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.mode-tab{border:1px solid var(--gl-border-strong);background:transparent;color:var(--gl-text2);border-radius:9px;padding:8px 14px;font-size:13px;font-weight:600;transition:.15s}
.mode-tab.on{background:var(--gl-accent);color:var(--gl-accent-contrast);border-color:var(--gl-accent)}
.contrast-warn{margin-top:12px;background:color-mix(in srgb,var(--gl-warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--gl-warn) 40%,transparent);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--gl-text);display:none}
.contrast-warn.show{display:block}
.contrast-warn button{margin-top:8px}
.color-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.color-row input[type=color]{width:40px;height:34px;padding:2px;border-radius:8px;flex:0 0 40px;cursor:pointer;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong)}
.color-row .cl{font-size:12px;color:var(--gl-text2);flex:1}
.color-row .cv{font-size:11px;color:var(--gl-muted);font-family:monospace}
.dropzone{border:2px dashed var(--gl-border-strong);border-radius:14px;padding:24px;text-align:center;color:var(--gl-text2);font-size:13px;transition:.15s;cursor:pointer;background:var(--gl-surface)}
.dropzone:hover,.dropzone.over{border-color:var(--gl-accent);background:var(--gl-surface2)}
.logo-preview{display:flex;align-items:center;gap:14px;margin-top:12px;padding:12px;border:1px solid var(--gl-border);border-radius:12px;background:var(--gl-surface)}
.logo-preview .lp-box{width:64px;height:64px;border-radius:10px;border:1px solid var(--gl-border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 64px}
.logo-preview .lp-box img{max-width:100%;max-height:100%}
.logo-preview .lp-info{font-size:12px;color:var(--gl-text2);min-width:0}
.logo-preview .lp-info b{color:var(--gl-text);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.field-mini{margin-bottom:12px}
.field-mini label{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gl-muted);font-weight:600;margin-bottom:5px}
.field-mini input,.field-mini select{width:100%;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:10px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:13px;padding:10px 12px;outline:none}
.field-mini input:focus{border-color:var(--gl-accent)}
.prep-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.prep-tile{border:1px solid var(--gl-border);background:var(--gl-surface);border-radius:12px;padding:14px;text-align:left;transition:.15s;cursor:pointer}
.prep-tile:hover{border-color:var(--gl-accent);background:var(--gl-surface2)}
.prep-tile b{display:block;font-size:14px;color:var(--gl-text);margin-bottom:3px}
.prep-tile span{font-size:12px;color:var(--gl-text2)}
.local-badge{position:fixed;bottom:16px;left:16px;z-index:30;font-size:11px;color:var(--gl-muted);background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:999px;padding:5px 12px;display:none}
body.edit .local-badge{display:block}
/* ===== PRESENTACIÓN LIMPIA + salida discreta ===== */
#exitCorner{position:fixed;top:14px;right:16px;z-index:60;background:var(--gl-surface);border:1px solid var(--gl-border-strong);color:var(--gl-text2);border-radius:10px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;opacity:0;transform:translateY(-8px);transition:.2s;pointer-events:none;display:none}
body.present #exitCorner{display:block}
body.present #exitCorner.reveal{opacity:.9;transform:none;pointer-events:auto}
#fsBtn{position:fixed;bottom:22px;right:20px;z-index:20;display:none}
body.present #fsBtn{display:block}
body.fs #fsBtn{display:none}
#fsHint{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:60;background:var(--gl-surface2);border:1px solid var(--gl-border-strong);color:var(--gl-text);font-size:13px;padding:8px 16px;border-radius:999px;opacity:0;transition:.3s;pointer-events:none}
#fsHint.show{opacity:1}
/* ocultar TODO lo administrativo en presentación */
body.present #topbar,body.present #leftCol,body.present #rightCol,body.present #editHint,body.present .local-badge,body.present #notesBtn,body.present #notesPanel{display:none!important}
body.present #stageProgress{display:flex}

/* ===== MENÚ MÁS ===== */
.more-wrap{position:relative}
.more-menu{position:absolute;top:42px;right:0;z-index:70;background:var(--gl-bg2);border:1px solid var(--gl-border-strong);border-radius:12px;padding:6px;min-width:210px;box-shadow:0 16px 40px rgba(0,0,0,.4);display:none;flex-direction:column;gap:2px}
.more-menu.on{display:flex}
.more-menu button{background:transparent;border:none;color:var(--gl-text);font-size:13px;text-align:left;padding:9px 12px;border-radius:8px;transition:.12s}
.more-menu button:hover{background:var(--gl-surface2);color:var(--gl-accent-soft)}
.more-sep{height:1px;background:var(--gl-border);margin:4px 6px}

/* ===== PANTALLA INICIAL (HOME) ===== */
#home{position:fixed;inset:0;z-index:80;background:var(--gl-bg);display:none;align-items:center;justify-content:center;padding:30px;overflow-y:auto}
body.home #home{display:flex}
body.home #hud,body.home #bar,body.home .corner,body.home .hint,body.home #stageProgress,body.home #fsBtn,body.home #deck,body.home #notesBtn{display:none!important}
.home-card{width:100%;max-width:520px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:24px;padding:40px 36px;box-shadow:var(--gl-shadow);position:relative;z-index:2}
.home-card .logo.center{margin-bottom:26px}
.home-title{font-size:clamp(26px,4vw,34px);font-weight:800;letter-spacing:-.02em;margin-bottom:10px;color:var(--gl-text);text-align:center}
.home-sub{font-size:15px;color:var(--gl-text2);text-align:center;margin-bottom:28px;line-height:1.5}
.home-label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gl-muted);font-weight:600;margin-bottom:8px}
.home-opt{text-transform:none;letter-spacing:0;color:var(--gl-muted);font-weight:400}
.home-names{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:520px){.home-names{grid-template-columns:1fr}}
.home-input{width:100%;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:14px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:18px;padding:16px 18px;outline:none;transition:border .2s}
.home-input:focus{border-color:var(--gl-accent)}
.home-err{color:var(--gl-danger);font-size:13px;margin-top:8px;display:none}
.home-err.show{display:block}
.home-go{width:100%;margin-top:18px;font-size:17px;padding:16px}
.home-noname{width:100%;margin-top:10px;background:transparent;border:none;color:var(--gl-text2);font-size:14px;font-weight:600;padding:8px;transition:.15s}
.home-noname:hover{color:var(--gl-accent-soft)}
.home-more-toggle{background:transparent;border:none;color:var(--gl-accent-soft);font-size:13px;font-weight:600;margin-top:14px;padding:6px 0;transition:.15s}
.home-more{max-height:0;overflow:hidden;transition:max-height .3s}
.home-more.open{max-height:340px;margin-top:12px}
.home-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.home-continue{margin-top:22px;border:1px solid var(--gl-border-strong);border-radius:16px;padding:16px;background:var(--gl-surface2)}
.home-continue .hc-top{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:700;margin-bottom:8px}
.home-continue .hc-name{font-size:18px;font-weight:700;color:var(--gl-text)}
.home-continue .hc-meta{font-size:13px;color:var(--gl-text2);margin-top:3px}
.home-continue .hc-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.home-secondary{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:24px;flex-wrap:wrap}
.home-secondary button{background:transparent;border:none;color:var(--gl-text2);font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
.home-secondary button:hover{color:var(--gl-accent-soft)}
.home-secondary span{color:var(--gl-muted)}

/* ===== PROGRESO POR ETAPAS ===== */
#stageProgress{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:19;display:none;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;max-width:80vw;pointer-events:none}
body.edit #stageProgress{top:70px}
.stage-chip{font-size:11px;letter-spacing:.04em;color:var(--gl-muted);padding:5px 11px;border-radius:999px;border:1px solid var(--gl-border);background:color-mix(in srgb,var(--gl-surface) 70%,transparent);white-space:nowrap;transition:.2s}
.stage-chip.done{color:var(--gl-text2);border-color:var(--gl-border-strong)}
.stage-chip.active{color:var(--gl-accent-contrast);background:var(--gl-accent);border-color:var(--gl-accent);font-weight:700}
.stage-arrow{color:var(--gl-muted);font-size:10px}

/* ===== SECCIONES en columna izquierda ===== */
.sec-head{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:700;padding:12px 6px 6px;display:flex;align-items:center;gap:6px}
.sec-head .sec-dot{width:8px;height:8px;border-radius:50%;background:var(--gl-accent)}

/* ===== NOTAS PRIVADAS ===== */
#notesBtn{position:fixed;bottom:22px;left:22px;z-index:55;width:42px;height:42px;border-radius:50%;background:var(--gl-surface);border:1px solid var(--gl-border-strong);color:var(--gl-text2);font-size:16px;display:none;align-items:center;justify-content:center;transition:.15s}
body.edit #notesBtn{display:flex}
#notesBtn:hover{border-color:var(--gl-accent);color:var(--gl-accent-soft)}
#notesPanel{position:fixed;bottom:74px;left:22px;z-index:56;width:320px;max-width:86vw;background:var(--gl-bg2);border:1px solid var(--gl-border-strong);border-radius:16px;padding:14px;box-shadow:0 16px 40px rgba(0,0,0,.4);display:none;flex-direction:column;gap:10px}
#notesPanel.on{display:flex}
.notes-head{display:flex;align-items:center;gap:8px}
.notes-head b{font-size:14px;color:var(--gl-text)}
.notes-only{font-size:10px;color:var(--gl-warn);border:1px solid color-mix(in srgb,var(--gl-warn) 40%,transparent);border-radius:999px;padding:2px 8px}
.notes-x{margin-left:auto;background:transparent;border:none;color:var(--gl-text2);font-size:20px;cursor:pointer;line-height:1}
#notesArea{width:100%;min-height:160px;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:12px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:14px;padding:12px;outline:none;resize:vertical;line-height:1.5}
#notesArea:focus{border-color:var(--gl-accent)}

/* ===== bloque nextStep ===== */
.nextstep-grid{display:flex;flex-direction:column;gap:14px;margin-top:24px;text-align:left;max-width:600px;margin-left:auto;margin-right:auto}
.ns-row{background:var(--gl-surface);border:1px solid var(--gl-border);border-left:3px solid var(--gl-accent);border-radius:12px;padding:14px 18px}
.ns-row .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gl-muted);margin-bottom:5px}
.ns-row .v{font-size:17px;color:var(--gl-text);font-weight:500}.ns-row .v:empty:before{content:'—';color:var(--gl-muted)}
.stars-input{display:flex;gap:8px;margin-top:24px;justify-content:center}
.stars-input .st{font-size:34px;color:var(--gl-muted);cursor:pointer;transition:.15s}
.stars-input .st.on{color:var(--gl-warn)}

.prop-label-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.prop-label-row label{margin-bottom:0}
.dyn-btn{background:color-mix(in srgb,var(--gl-accent) 14%,transparent);border:1px solid var(--gl-border-strong);color:var(--gl-accent-soft);font-size:10px;font-weight:600;padding:3px 8px;border-radius:7px;cursor:pointer;transition:.12s}
.dyn-btn:hover{background:var(--gl-accent);color:var(--gl-accent-contrast)}
.dyn-menu{position:absolute;right:0;z-index:80;margin-top:4px;background:var(--gl-bg2);border:1px solid var(--gl-border-strong);border-radius:10px;padding:5px;min-width:200px;box-shadow:0 12px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:1px}
.dyn-menu button{background:transparent;border:none;color:var(--gl-text);font-size:12px;text-align:left;padding:8px 10px;border-radius:6px;cursor:pointer}
.dyn-menu button:hover{background:var(--gl-surface2);color:var(--gl-accent-soft)}
.pl-chip{display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb,var(--gl-accent) 16%,transparent);border:1px solid var(--gl-border-strong);color:var(--gl-accent-soft);font-size:13px;font-weight:600;padding:8px 12px;border-radius:9px}
.pl-preview{background:var(--gl-surface2);border:1px solid var(--gl-border);border-radius:9px;padding:10px 12px;font-size:14px;color:var(--gl-text)}
.pl-warn{background:color-mix(in srgb,var(--gl-warn) 12%,transparent);border:1px solid color-mix(in srgb,var(--gl-warn) 40%,transparent);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--gl-text);margin-bottom:12px;line-height:1.4}
.prop{position:relative}
/* ===== MEETING ROUTER ===== */
#router{position:fixed;inset:0;z-index:82;background:var(--gl-bg);display:none;align-items:flex-start;justify-content:center;padding:40px 24px;overflow-y:auto}
body.router #router{display:flex}
body.router #home,body.router #deck,body.router #hud,body.router #bar,body.router .corner,body.router .hint,body.router #stageProgress,body.router #fsBtn,body.router #finishBtn,body.router #notesBtn,body.router #topbar,body.router #leftCol,body.router #rightCol,body.router #editHint,body.router .local-badge,body.router #exitCorner{display:none!important}
.rt-card-wrap{width:100%;max-width:760px;margin:auto}
.rt-kicker{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:700;margin-bottom:10px;text-align:center}
.rt-title{font-size:clamp(22px,3.4vw,32px);font-weight:800;letter-spacing:-.02em;color:var(--gl-text);text-align:center;margin-bottom:28px;line-height:1.2}
.rt-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rt-cards.two{grid-template-columns:1fr 1fr;max-width:560px;margin:0 auto}
.rt-card{text-align:left;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:18px;padding:22px;cursor:pointer;transition:.16s;position:relative}
.rt-card:hover{border-color:var(--gl-accent);background:var(--gl-surface2);transform:translateY(-2px)}
.rt-card.sel{border-color:var(--gl-accent);box-shadow:0 0 0 2px var(--gl-accent);background:color-mix(in srgb,var(--gl-accent) 10%,transparent)}
.rt-num{width:34px;height:34px;border-radius:10px;background:color-mix(in srgb,var(--gl-accent) 16%,transparent);color:var(--gl-accent-soft);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;margin-bottom:12px}
.rt-name{font-size:18px;font-weight:700;color:var(--gl-text);margin-bottom:6px}
.rt-desc{font-size:14px;color:var(--gl-text2);line-height:1.45}
.rt-nav{display:flex;justify-content:space-between;gap:10px;margin-top:26px}
.rt-start{font-size:16px;padding:14px 28px}
.rt-sub{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gl-accent-soft);font-weight:700;margin:18px 0 10px}
.rt-checks{display:flex;flex-wrap:wrap;gap:8px}
.rt-check{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gl-text2);background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:999px;padding:7px 13px;cursor:pointer;transition:.14s}
.rt-check.on{border-color:var(--gl-accent);color:var(--gl-accent-soft);background:color-mix(in srgb,var(--gl-accent) 10%,transparent)}
.rt-check input{accent-color:var(--gl-accent)}
.rt-form{margin-top:16px;border-top:1px solid var(--gl-border);padding-top:8px}
.rt-group-title{font-size:13px;font-weight:700;color:var(--gl-text);margin:18px 0 10px}
.rt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rt-context{width:100%;min-height:120px;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:12px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:14px;padding:12px 14px;outline:none;resize:vertical;line-height:1.5;margin-top:6px}
.rt-context:focus{border-color:var(--gl-accent)}
.rt-summary-name{font-size:26px;font-weight:800;letter-spacing:.02em;color:var(--gl-text);text-align:center;margin:8px 0 20px}
.rt-summary-grid{display:flex;flex-direction:column;gap:10px;max-width:520px;margin:0 auto}
.rt-srow{display:flex;gap:14px;background:var(--gl-surface);border:1px solid var(--gl-border);border-left:3px solid var(--gl-accent);border-radius:12px;padding:12px 16px}
.rt-sk{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gl-muted);font-weight:600;min-width:130px;flex:0 0 130px;align-self:center}
.rt-sv{font-size:15px;color:var(--gl-text);font-weight:500}
/* ===== FINALIZAR CITA ===== */
#finishBtn{position:fixed;bottom:22px;right:180px;z-index:20;display:none}
body.present #finishBtn{display:block}
body.fs #finishBtn{right:20px;bottom:70px}
.fin-check{display:flex;flex-direction:column;gap:8px}
.fin-row{font-size:14px;padding:10px 14px;border-radius:10px;border:1px solid var(--gl-border)}
.fin-row.ok{color:var(--gl-ok);border-color:color-mix(in srgb,var(--gl-ok) 30%,transparent)}
.fin-row.miss{color:var(--gl-warn);border-color:color-mix(in srgb,var(--gl-warn) 40%,transparent)}
.pm-check{font-size:16px;font-weight:700;color:var(--gl-ok);margin-bottom:6px}
.pm-name{font-size:24px;font-weight:800;color:var(--gl-text)}
.pm-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;justify-content:flex-end}
.pm-acts .btn[disabled]{opacity:.4;cursor:not-allowed}

/* ===== CALENDLY ===== */
.cal-sub{margin-bottom:20px}
.cal-embed{position:relative;width:100%;max-width:760px;margin:18px auto 0;height:min(62vh,620px);border-radius:16px;overflow:hidden;border:1px solid var(--gl-border-strong);background:var(--gl-surface)}
.cal-embed iframe{width:100%;height:100%;border:0;display:block}
.cal-fallback{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--gl-surface);color:var(--gl-text2);font-size:15px;text-align:center;padding:24px}
.cal-embed:not(.loaded) .cal-fallback{}
.cal-empty{width:100%;max-width:760px;margin:18px auto 0;min-height:220px;border-radius:16px;border:1px dashed var(--gl-border-strong);display:flex;align-items:center;justify-content:center;color:var(--gl-muted);font-size:14px;text-align:center;padding:24px}
.cal-openext{margin-top:16px}
.cal-openext a{color:var(--gl-accent-soft);font-size:14px;font-weight:600;text-decoration:none}
.cal-openext a:hover{text-decoration:underline}
.cal-done{max-width:520px;margin:20px auto 0;background:linear-gradient(160deg,var(--gl-surface2),var(--gl-surface));border:1px solid var(--gl-border-strong);border-radius:18px;padding:32px 28px}
.cal-done-top{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--gl-ok);font-weight:700;margin-bottom:14px}
.cal-done-date{font-size:clamp(24px,4vw,34px);font-weight:800;color:var(--gl-text);letter-spacing:-.02em}
.cal-done-type{font-size:16px;color:var(--gl-accent-soft);font-weight:600;margin-top:8px}
.cal-done-part{font-size:15px;color:var(--gl-text2);margin-top:6px}

/* ===== REFERIDOS ===== */
.ref-crit{list-style:none;margin:14px 0 8px;display:flex;flex-direction:column;gap:8px;border-left:3px solid var(--gl-accent);padding-left:16px}
.ref-crit li{font-size:16px;color:var(--gl-text2)}.ref-crit li strong{color:var(--gl-text)}
.ref-box{margin-top:18px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:16px;padding:20px}
.ref-list-title{font-size:16px;font-weight:700;color:var(--gl-text);margin-bottom:4px}
.ref-list-sub{font-size:13px;color:var(--gl-text2);margin-bottom:14px}
.ref-rows{display:flex;flex-direction:column;gap:8px}
.ref-row{display:grid;grid-template-columns:1fr 62px 1fr 34px;gap:8px;align-items:center}
.ref-row input{background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:10px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:14px;padding:11px 12px;outline:none;transition:.15s}
.ref-row input:focus{border-color:var(--gl-accent)}
.ref-cc{text-align:center}
.ref-del{width:34px;height:34px;border-radius:9px;border:1px solid var(--gl-border);background:transparent;color:var(--gl-muted);font-size:13px;transition:.15s}
.ref-del:hover{border-color:var(--gl-danger);color:var(--gl-danger)}
.ref-add{width:100%;border:1px dashed var(--gl-border-strong);background:transparent;color:var(--gl-accent-soft);border-radius:10px;padding:11px;font-size:13px;font-weight:600;margin-top:12px;transition:.15s}
.ref-add:hover{background:color-mix(in srgb,var(--gl-accent) 8%,transparent);border-color:var(--gl-accent)}
.ref-send{width:100%;margin-top:14px;font-size:16px;padding:15px}
.ref-review{display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto}
.ref-review-row{display:flex;justify-content:space-between;gap:12px;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:10px;padding:11px 14px}
.ref-review-row b{color:var(--gl-text)}.ref-review-row span{color:var(--gl-text2);font-size:14px}
.ref-msg-icon{width:56px;height:56px;border-radius:50%;background:var(--gl-accent);color:var(--gl-accent-contrast);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 18px}
.ref-chat{max-width:560px;margin:20px auto 0;background:var(--gl-surface);border:1px solid var(--gl-border-strong);border-radius:16px;overflow:hidden;text-align:left}
.ref-chat-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--gl-border);background:var(--gl-surface2)}
.ref-chat-av{width:34px;height:34px;border-radius:50%;background:var(--gl-accent);color:var(--gl-accent-contrast);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.ref-chat-head b{font-size:14px;color:var(--gl-text);display:block}.ref-chat-head small{font-size:11px;color:var(--gl-ok)}
.ref-chat-body{padding:18px 16px;font-size:15px;color:var(--gl-text);line-height:1.55}

/* ===== RECAP + VALORACIÓN ===== */
.recap-wrap{display:grid;grid-template-columns:280px 1fr;gap:36px;align-items:start;max-width:1040px}
.recap-media{aspect-ratio:3/4;max-height:60vh;border:1px dashed var(--gl-border-strong);border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--gl-surface)}
.recap-media img{width:100%;height:100%;object-fit:cover}
.recap-media-ph{font-size:32px;color:var(--gl-muted);opacity:.5}
.recap-main{min-width:0;text-align:left}
.recap-bullets{list-style:none;margin:6px 0 20px;display:flex;flex-direction:column;gap:10px}
.recap-bullets li{position:relative;padding-left:26px;font-size:18px;color:var(--gl-text)}
.recap-bullets li:before{content:'';position:absolute;left:0;top:12px;width:14px;height:2px;background:var(--gl-accent)}
.recap-quote{border-left:3px solid var(--gl-accent);padding:6px 0 6px 18px;margin:0 0 22px;font-size:17px;color:var(--gl-text2);line-height:1.55}
.recap-quote strong{color:var(--gl-text)}
.recap-op-title{font-size:20px;font-weight:700;color:var(--gl-text);margin-bottom:14px}
.recap-q{background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:16px;padding:18px 20px;margin-bottom:12px}
.recap-q.hl{background:linear-gradient(120deg,color-mix(in srgb,var(--gl-accent) 78%,#7c3aed),color-mix(in srgb,var(--gl-accent) 55%,#000));border-color:transparent}
.recap-q.hl .recap-q-txt{color:var(--gl-accent-contrast)}
.recap-q-txt{font-size:17px;font-weight:600;color:var(--gl-text);line-height:1.4}
.recap-a{width:100%;margin-top:12px;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:10px;color:var(--gl-text);font-family:var(--gl-font-body);font-size:15px;padding:11px 13px;outline:none;resize:vertical;line-height:1.5}
.recap-a:focus{border-color:var(--gl-accent)}
.recap-q.hl .recap-a{background:color-mix(in srgb,#000 22%,transparent);border-color:transparent;color:#fff}
.recap-q.hl .recap-a::placeholder{color:rgba(255,255,255,.7)}

/* ===== OFERTA DE REGALO (referralOffer, estilo Powing) ===== */
.ro-wrap{max-width:1060px;text-align:left}
.ro-wrap h2{margin-bottom:26px}
.ro-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:36px}
.ro-step{position:relative;background:var(--gl-surface);border:1px solid var(--gl-border);border-radius:16px;padding:26px 20px 20px;text-align:center;min-height:96px;display:flex;align-items:center;justify-content:center}
.ro-num{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:var(--gl-accent);color:var(--gl-accent-contrast);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px var(--gl-bg)}
.ro-txt{font-size:15px;color:var(--gl-text);line-height:1.4}
.ro-bottom{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:stretch}
.ro-value{display:flex;flex-direction:column;justify-content:center}
.ro-value-lead{font-size:16px;color:var(--gl-text2);margin-bottom:14px;line-height:1.5}.ro-value-lead strong{color:var(--gl-text)}
.ro-value-hl{font-size:clamp(24px,3.6vw,34px);font-weight:800;letter-spacing:-.02em;color:var(--gl-accent-soft);margin-bottom:16px}
.ro-value-badge{background:linear-gradient(120deg,var(--gl-accent),color-mix(in srgb,var(--gl-accent) 60%,#000));color:var(--gl-accent-contrast);border-radius:12px;padding:16px 18px;font-size:16px;font-weight:600}
.ro-resource{border-radius:18px;overflow:hidden;min-height:220px;max-height:42vh;display:flex}
.ro-resource img{width:100%;height:100%;object-fit:cover}
.ro-resource-ph{width:100%;background:radial-gradient(120% 100% at 70% 20%,color-mix(in srgb,var(--gl-accent) 22%,transparent),var(--gl-surface2));border:1px solid var(--gl-border);border-radius:18px;padding:26px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px}
.ro-res-tag{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--gl-accent-soft)}
.ro-res-title{font-size:20px;font-weight:800;color:var(--gl-text);line-height:1.2;margin:2px 0}
.ro-res-sub{font-size:12px;color:var(--gl-text2)}
.ro-res-orb{width:74px;height:74px;border-radius:50%;margin:14px 0;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;background:conic-gradient(from 0deg,#f43f5e,#f59e0b,#22d3ee,#6366f1,#f43f5e)}
.ro-res-cta{font-size:12px;color:var(--gl-text2)}
/* ===== GRILLA DE RECURSOS (resourceGrid) ===== */
.rg-wrap{max-width:1060px;text-align:left}
.rg-wrap h2{margin-bottom:26px}
.rg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.rg-card{display:flex;flex-direction:column;gap:10px}
.rg-card img{width:100%;aspect-ratio:3/4;max-height:46vh;object-fit:cover;border-radius:16px;border:1px solid var(--gl-border);background:var(--gl-surface)}
.rg-ph{aspect-ratio:3/4;max-height:46vh;border:1px dashed var(--gl-border-strong);border-radius:16px;background:var(--gl-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;position:relative}
.rg-ph-num{position:absolute;top:12px;left:14px;font-size:13px;font-weight:800;color:var(--gl-accent-soft)}
.rg-ph-ic{font-size:30px;opacity:.4}
.rg-title{font-size:15px;font-weight:600;color:var(--gl-text);text-align:center}
.rg-note{margin-top:22px;background:color-mix(in srgb,var(--gl-accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--gl-accent) 30%,transparent);border-radius:14px;padding:16px 18px;font-size:15px;color:var(--gl-text)}
/* campo de imagen en editor */
.img-field{display:flex;gap:8px;margin-bottom:8px}
.img-file{display:none}
.img-file-btn{display:inline-block;background:var(--gl-surface2);border:1px solid var(--gl-border-strong);border-radius:9px;padding:9px 14px;font-size:13px;color:var(--gl-text);cursor:pointer;transition:.15s}
.img-file-btn:hover{border-color:var(--gl-accent)}
.img-url{width:100%}
.rg-thumb{position:relative;margin-bottom:8px}
.rg-thumb img{width:100%;border-radius:10px;border:1px solid var(--gl-border)}
.rg-thumb .mini{margin-top:6px}
.opt-num{width:22px;height:22px;border-radius:50%;background:var(--gl-accent);color:var(--gl-accent-contrast);font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px}

@media (max-width:820px){.recap-wrap{grid-template-columns:1fr}.recap-media{aspect-ratio:16/9;position:static;order:-1;max-height:200px}.ro-bottom{grid-template-columns:1fr}.ro-steps{grid-template-columns:1fr}.rg-grid{grid-template-columns:1fr}}
@media (max-width:640px){.slide{padding:70px 22px 98px}.steps,.twoup{grid-template-columns:1fr}.corner .txt{display:none}.hint{display:none}.theme-grid,.type-grid{grid-template-columns:1fr 1fr}.home-grid{grid-template-columns:1fr}.rt-cards,.rt-cards.two,.rt-grid{grid-template-columns:1fr}#finishBtn{right:16px;bottom:70px}.cal-embed{height:70vh}.ref-row{grid-template-columns:1fr 54px 1fr 30px}}
`;

export const MEETING_OS_BODY_HTML = `

<canvas id="stars"></canvas>
<div class="glow a"></div><div class="glow b"></div>
<div id="bar"></div>
<div id="topbar">
  <div class="tb-brand"><div class="m"><b>G</b>L</div><div class="t">Meeting OS<small>EDITOR</small></div></div>
  <div class="tb-title">Plantilla: <b id="tbName">Cita inicial base</b></div>
  <div class="tb-sp"></div>
  <div class="save-state saved" id="saveState"><span class="save-dot"></span><span id="saveLabel">Guardado</span></div>
  <div class="tb-actions">
    <button class="icon-btn" id="undoBtn" title="Deshacer (Ctrl+Z)" onclick="History.undo()">&#8630;</button>
    <button class="icon-btn" id="redoBtn" title="Rehacer (Ctrl+Shift+Z)" onclick="History.redo()">&#8631;</button>
    <button class="btn ghost sm" onclick="openPrepare()">Preparar reunión</button>
    <div class="seg"><button id="segEdit" class="on" onclick="setMode('edit')">Editar</button><button id="segPlay" onclick="setMode('present')">Presentar</button></div>
    <button class="btn sm" onclick="saveTemplate()">Guardar</button>
    <div class="more-wrap">
      <button class="icon-btn" id="moreBtn" title="Más opciones" onclick="toggleMore(event)">&#8942;</button>
      <div class="more-menu" id="moreMenu">
        <button onclick="closeMore();openIdentity()">Identidad visual</button>
        <button onclick="closeMore();openThemes()">Diseños</button>
        <button onclick="closeMore();openTemplates()">Plantillas</button>
        <div class="more-sep"></div>
        <button onclick="closeMore();importProject()">Importar proyecto</button>
        <button onclick="closeMore();exportProject()">Exportar proyecto</button>
        <div class="more-sep"></div>
        <button onclick="closeMore();goHome()">Ir a la pantalla inicial</button>
      </div>
    </div>
  </div>
</div>
<div id="leftCol"><div class="col-head">Diapositivas <span class="sp"></span></div><div class="col-scroll" id="slideList"></div><div style="padding:12px"><button class="add-slide" onclick="openAddSlide()">+ Agregar diapositiva</button></div></div>
<div id="rightCol"><div class="col-head">Propiedades</div><div class="col-scroll" id="propPanel"></div></div>
<div id="editHint">Doble clic sobre cualquier texto de la diapositiva para editarlo · o usá el panel derecho</div>
<div class="corner"><div class="logo" id="cornerLogo"></div></div>
<div id="stageProgress"></div>
<div id="deck"></div>
<div class="hint">Usá las flechas &larr; &rarr; del teclado o los botones para navegar</div>
<div id="hud"><button class="nav" id="prev">&larr;</button><div id="count"></div><button class="nav" id="next">&rarr;</button></div>
<button class="btn ghost sm" id="fsBtn" title="Pantalla completa" onclick="toggleFullscreen()">&#9974; Pantalla completa</button>
<button class="btn sm" id="finishBtn" title="Finalizar cita" onclick="finalizeMeeting()">Finalizar cita</button>
<div class="local-badge">Modo local — los datos se guardan en este navegador</div>
<div id="exitCorner" onclick="setMode('edit')" title="Volver al editor (Esc)">&#9998; Editar</div>
<div id="fsHint">Presioná <b>Esc</b> para salir de pantalla completa</div>

<!-- MEETING ROUTER (interno, no lo ve el prospecto) -->
<div id="router"></div>

<!-- PANTALLA INICIAL -->
<div id="home">
  <div class="home-card">
    <div class="logo center" id="homeLogo"></div>
    <h1 class="home-title">Comienza tu próxima asesoría</h1>
    <p class="home-sub">Prepara la reunión en pocos segundos y presenta una experiencia personalizada.</p>
    <div class="home-names">
      <div><label class="home-label" for="homeFirst">Nombre</label>
        <input id="homeFirst" class="home-input" type="text" placeholder="Carlos" autocomplete="off"></div>
      <div><label class="home-label" for="homeLast">Apellido <span class="home-opt">(opcional)</span></label>
        <input id="homeLast" class="home-input" type="text" placeholder="Hernández" autocomplete="off"></div>
    </div>
    <div class="home-err" id="homeErr">Escribe el nombre del prospecto para comenzar.</div>
    <button class="btn home-go" onclick="homeStart()">Continuar</button>
    <button class="home-noname" onclick="homeStart(true)">Comenzar sin nombre</button>
    <button class="home-more-toggle" id="homeMoreToggle" onclick="toggleHomeMore()">▸ Agregar más datos</button>
    <div class="home-more" id="homeMore">
      <div class="home-grid">
        <div class="field-mini"><label>Empresa</label><input id="hm_company" type="text"></div>
        <div class="field-mini"><label>WhatsApp</label><input id="hm_whatsapp" type="text"></div>
        <div class="field-mini"><label>Email</label><input id="hm_email" type="text"></div>
        <div class="field-mini"><label>Fuente</label><input id="hm_source" type="text"></div>
        <div class="field-mini"><label>Objetivo declarado</label><input id="hm_objective" type="text"></div>
        <div class="field-mini"><label>Nombre del asesor</label><input id="hm_advisor" type="text"></div>
      </div>
    </div>
    <div id="homeContinue"></div>
    <div class="home-secondary">
      <button onclick="homeDemo()">Practicar con datos de prueba</button>
      <span>·</span>
      <button onclick="goEditor()">Editar plantillas</button>
      <span>·</span>
      <button onclick="goEditor(openIdentity)">Identidad visual</button>
    </div>
  </div>
</div>

<!-- NOTAS PRIVADAS -->
<div id="notesPanel">
  <div class="notes-head"><b>Notas privadas</b><span class="notes-only">Solo visible para el asesor</span><button class="notes-x" onclick="toggleNotes(false)">×</button></div>
  <textarea id="notesArea" placeholder="Objeciones, información sensible, seguimiento, temas pendientes…"></textarea>
</div>
<button id="notesBtn" title="Notas privadas (N)" onclick="toggleNotes()">&#9998;</button>

<div id="modal"><div class="modal-card" id="modalBody"></div></div>
<div id="toast"></div>
`;

export const MEETING_OS_LOGIC_JS = `






/* ================================================================
   THEME PRESETS — sistema de temas real (tokens completos)
   ================================================================ */
const THEME_PRESETS={
  "gl-dark":{ id:"gl-dark", name:"Growth Link Dark", mode:"dark",
    background:"#050817", backgroundSecondary:"#0A1230", surface:"#0D1838", surfaceSecondary:"#122250",
    textPrimary:"#EAF2FF", textSecondary:"#8FA3C8", textMuted:"#5E719A",
    accent:"#2E7BF6", accentSoft:"#5B9BFF", accentContrast:"#FFFFFF",
    border:"rgba(127,196,255,.18)", borderStrong:"rgba(127,196,255,.32)",
    inputBackground:"#0D1838", buttonText:"#FFFFFF", success:"#3DD68C", warning:"#FFB454", danger:"#FF6B6B",
    glow:"rgba(46,123,246,.16)", star:"180,215,255", starLine:"127,196,255", starOpacity:.55 },
  "patrimonial-light":{ id:"patrimonial-light", name:"Patrimonial Light", mode:"light",
    background:"#F3F6FA", backgroundSecondary:"#E9EEF5", surface:"#FFFFFF", surfaceSecondary:"#F7F9FC",
    textPrimary:"#142033", textSecondary:"#526174", textMuted:"#8390A0",
    accent:"#1769D2", accentSoft:"#2E7BF6", accentContrast:"#FFFFFF",
    border:"#DCE3EC", borderStrong:"#C5D0DD",
    inputBackground:"#FFFFFF", buttonText:"#FFFFFF", success:"#1FA971", warning:"#C77A16", danger:"#D14343",
    glow:"rgba(23,105,210,.10)", star:"120,150,190", starLine:"120,150,190", starOpacity:.12 },
  "corporativo-azul":{ id:"corporativo-azul", name:"Corporativo Azul", mode:"dark",
    background:"#0A1A2F", backgroundSecondary:"#0E2440", surface:"#123152", surfaceSecondary:"#173C63",
    textPrimary:"#EAF3FF", textSecondary:"#9DB6D2", textMuted:"#6E88A6",
    accent:"#2FA4E7", accentSoft:"#5FBEF0", accentContrast:"#04121F",
    border:"rgba(120,180,230,.20)", borderStrong:"rgba(120,180,230,.36)",
    inputBackground:"#123152", buttonText:"#04121F", success:"#3DD68C", warning:"#FFB454", danger:"#FF6B6B",
    glow:"rgba(47,164,231,.16)", star:"150,200,240", starLine:"120,180,230", starOpacity:.4 },
  "verde-proteccion":{ id:"verde-proteccion", name:"Verde Protección", mode:"dark",
    background:"#07160F", backgroundSecondary:"#0B2117", surface:"#0F2C1F", surfaceSecondary:"#163B2A",
    textPrimary:"#E8F7EE", textSecondary:"#96C4A9", textMuted:"#5F8C72",
    accent:"#1FB574", accentSoft:"#3FD693", accentContrast:"#04150C",
    border:"rgba(120,220,170,.18)", borderStrong:"rgba(120,220,170,.34)",
    inputBackground:"#0F2C1F", buttonText:"#04150C", success:"#3DD68C", warning:"#FFB454", danger:"#FF6B6B",
    glow:"rgba(31,181,116,.16)", star:"150,220,180", starLine:"120,200,160", starOpacity:.4 },
  "minimal-beige":{ id:"minimal-beige", name:"Minimal Beige", mode:"light",
    background:"#F5F1E8", backgroundSecondary:"#EDE6D6", surface:"#FFFDF8", surfaceSecondary:"#F7F2E7",
    textPrimary:"#2B2419", textSecondary:"#6B6151", textMuted:"#9A8F7C",
    accent:"#B0803A", accentSoft:"#C89A54", accentContrast:"#FFFFFF",
    border:"#E1D8C6", borderStrong:"#CDBFA0",
    inputBackground:"#FFFDF8", buttonText:"#FFFFFF", success:"#1FA971", warning:"#C77A16", danger:"#D14343",
    glow:"rgba(176,128,58,.10)", star:"180,160,120", starLine:"180,160,120", starOpacity:.10 },
  "luxury-black":{ id:"luxury-black", name:"Luxury Black", mode:"dark",
    background:"#0A0A0C", backgroundSecondary:"#121216", surface:"#17171C", surfaceSecondary:"#1F1F26",
    textPrimary:"#F4F0E6", textSecondary:"#B8B2A2", textMuted:"#7C766A",
    accent:"#C9A24B", accentSoft:"#DBB968", accentContrast:"#0A0A0C",
    border:"rgba(201,162,75,.20)", borderStrong:"rgba(201,162,75,.38)",
    inputBackground:"#17171C", buttonText:"#0A0A0C", success:"#3DD68C", warning:"#FFB454", danger:"#FF6B6B",
    glow:"rgba(201,162,75,.14)", star:"220,205,160", starLine:"201,162,75", starOpacity:.30 }
};
const FONTS=["Inter","Montserrat","Manrope","Lato","Poppins","Merriweather","Playfair Display","Fraunces"];

/* ================================================================
   TEMPLATE por defecto (contenido puro, SIN respuestas ni prospecto)
   ================================================================ */
const DEFAULT_TEMPLATE={
  id:"cita-inicial", name:"Cita inicial base", isMaster:true,
  settings:{ showProgress:true, allowKeyboard:true },
  slides:[
    { id:"cover", type:"cover", enabled:true, section:"Encuadre", internalName:"Portada", kicker:"Cita inicial",
      title:"Asesoría en <em>Protección</em> y Patrimonio",
      subtitle:"Una conversación para entender tus objetivos y ver qué tan cerca o lejos estás de lograrlos.",
      badges:["Seguro de Vida","Ahorro para el Retiro","Gastos Médicos"],
      prospectLine:{ enabled:true, prefix:"Preparada para", showProspectName:true, suffix:"", anonymousText:"Preparada especialmente para ti" }, buttonText:"Comenzar asesoría →" },
    { id:"referral-apertura", type:"statement", enabled:true, routes:["referral"], section:"Encuadre", internalName:"Apertura · Referido", kicker:"Gracias por estar acá",
      title:"{{prospect.name}}, <em>{{referral.name}}</em> me comentó que podía tener sentido que conversáramos.",
      body:"Hoy quiero entender tu situación para ver si realmente puedo ayudarte.", buttonText:"Empezar" },
    { id:"direct-buscas", type:"textQuestion", enabled:true, routes:["direct"], section:"Objetivos", internalName:"¿Qué estás buscando?", kicker:"Interés directo",
      title:"¿Qué es lo que <em>estás buscando</em> resolver?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"direct-porahora", type:"textQuestion", enabled:true, routes:["direct"], section:"Objetivos", internalName:"¿Por qué ahora?",
      title:"¿Por qué <em>ahora</em> y no antes?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"direct-espera", type:"textQuestion", enabled:true, routes:["direct"], section:"Compromiso", internalName:"Qué espera de una estrategia",
      title:"¿Qué <em>esperás</em> de una buena estrategia?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"tiempo", type:"statement", enabled:true, section:"Encuadre", internalName:"Encuadre · Tiempo", kicker:"El encuadre",
      title:"Nos reservamos el <em>tiempo adecuado</em>",
      body:"Normalmente ocupamos <strong>de 20 a 30 minutos</strong>, pero reservé <strong>45</strong> por si querés profundizar en algún tema.",
      buttonText:"Sí, perfecto" },
    { id:"regalo", type:"statement", enabled:true, routes:["discovery"], section:"Encuadre", internalName:"Encuadre · Valor", kicker:"El valor",
      title:"Esta asesoría normalmente tiene un <em>valor</em>…",
      body:"Pero en este caso fue un <strong>regalo</strong>. Alguien decidió que valía la pena que tuvieras esta claridad.",
      buttonText:"Suena bien" },
    { id:"mapa", type:"twostep", enabled:true, routes:["discovery","direct","referral","follow_up"], section:"Encuadre", internalName:"Mapa de la cita", kicker:"El plan de trabajo",
      title:"Hoy entendemos, la próxima <em>construimos</em>.",
      stepA:{ when:"Hoy", title:"Descubrimiento", desc:"Entender tu situación y tus metas" },
      stepB:{ when:"Próxima cita", title:"Estrategia", desc:"La mejor opción, hecha a tu medida" },
      buttonText:"Empezar descubrimiento" },
    { id:"porque-hoy", type:"textQuestion", enabled:true, section:"Objetivos", internalName:"¿Por qué hoy?", kicker:"Descubrimiento",
      title:"¿Qué te hizo <em>agendar y presentarte</em> hoy?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"prioridades", type:"ranking", enabled:true, section:"Objetivos", internalName:"Prioridades",
      lead:"Antes de seguir, identifiquemos lo que más te importa.",
      title:"Ordená de <em>más</em> a <em>menos</em> importante",
      items:[{id:"p1",label:"Protección familiar"},{id:"p2",label:"Ahorro para el retiro"},{id:"p3",label:"Gastos médicos"},{id:"p4",label:"Educación de los hijos"},{id:"p5",label:"Ahorro / liquidez"},{id:"p6",label:"Patrimonio / herencia"}],
      buttonText:"Continuar" },
    { id:"porque-ese", type:"textQuestion", enabled:true, section:"Objetivos", internalName:"¿Por qué ese objetivo?",
      title:"¿Por qué elegiste <em>ese objetivo</em> como tu prioridad?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"importancia-ahora", type:"textQuestion", enabled:true, routes:["discovery"], section:"Objetivos", internalName:"Importancia actual",
      title:"¿Qué hace que conseguirlo sea <em>importante ahora</em> y no postergarlo?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"accion-actual", type:"textQuestion", enabled:true, section:"Situación actual", internalName:"Acción actual",
      title:"¿Estás haciendo <em>algo actualmente</em> para conseguirlo?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"tiempo-objetivo", type:"options", enabled:true, section:"Situación actual", internalName:"Tiempo con el objetivo",
      title:"¿Hace cuánto estás <em>pensando en este objetivo</em>?",
      items:[{id:"t1",label:"Menos de 6 meses"},{id:"t2",label:"6 a 12 meses"},{id:"t3",label:"1 a 3 años"},{id:"t4",label:"Más de 3 años"}], buttonText:"Continuar" },
    { id:"que-cambio", type:"textQuestion", enabled:true, routes:["discovery"], section:"Situación actual", internalName:"Qué cambió",
      title:"¿Qué cambió hoy para que decidieras <em>ponerte en marcha</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"frena", type:"textQuestion", enabled:true, section:"Situación actual", internalName:"¿Qué te frena?",
      title:"¿Qué sentís que te está <em>impidiendo avanzar</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"consecuencia", type:"textQuestion", enabled:true, section:"Consecuencias", internalName:"Consecuencias", kicker:"Toma de conciencia",
      title:"¿Qué pasaría si <em>no lo conseguís</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"resistencia-futura", type:"textQuestion", enabled:false, routes:["discovery"], section:"Consecuencias", internalName:"Resistencia futura",
      title:"¿Qué tendría que pasar para que, aun sabiendo esto, <em>continúes sin avanzar</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"vision", type:"textQuestion", enabled:true, section:"Visión", internalName:"Visión", lead:"Ahora imaginate que lo lográs…",
      title:"¿Cómo te ves una vez que <em>lo hayas conseguido</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"acuerdo", type:"statement", enabled:true, section:"Compromiso", internalName:"Punto de giro", kicker:"El punto de giro",
      title:"¿Estás de acuerdo en que, si no <em>cambiamos algunas cosas</em>, estaríamos lejos del objetivo?",
      body:"Y si es así… ¿estás dispuesto a hacer esos cambios?", buttonText:"Sí, estoy dispuesto" },
    { id:"dos-formas", type:"choice2", enabled:true, section:"Compromiso", internalName:"Dos formas de planificar", kicker:"Cómo planificamos",
      title:"Existen <em>2 formas</em> de planificar. ¿Cuál te hace más sentido?",
      optionA:{ k:"A", text:"Definimos <strong>cuánto vas a necesitar</strong> y acomodamos el presupuesto para llegar." },
      optionB:{ k:"B", text:"Empezamos <strong>con lo que puedas hoy</strong> y ajustamos con el tiempo." } },
    { id:"meta-requerida", type:"money", enabled:true, section:"Compromiso", internalName:"Meta requerida", responseKey:"requiredAmount",
      title:"¿Cuánto dinero <em>necesitarías</em> para lograr este objetivo?",
      body:"Una estimación es suficiente por ahora.", placeholder:"0", buttonText:"Continuar" },
    { id:"monto", type:"money", enabled:true, section:"Compromiso", internalName:"Capacidad actual", responseKey:"startingAmount",
      title:"¿Con cuánto podrías <em>comenzar</em> hoy?",
      body:"Sin compromiso todavía — solo para dimensionar el punto de partida.", placeholder:"0", buttonText:"Continuar" },
    { id:"info-adicional", type:"textQuestion", enabled:true, section:"Situación actual", internalName:"Información adicional",
      title:"¿Hay algo más que necesite saber <em>antes de preparar tu estrategia</em>?", placeholder:"Escribir respuesta…", buttonText:"Continuar" },
    { id:"criterios", type:"criteria", enabled:false, section:"Compromiso", internalName:"Criterios de decisión",
      title:"Para vos, ¿cuáles son los <em>tres puntos más importantes</em> que debe cumplir una buena estrategia?", buttonText:"Continuar" },
    { id:"compromiso-criterios", type:"options", enabled:false, section:"Compromiso", internalName:"Compromiso · criterios",
      title:"Si la estrategia cumple con esos tres puntos, ¿te haría sentido <em>avanzar</em>?",
      items:[{id:"c1",label:"Sí"},{id:"c2",label:"Probablemente"},{id:"c3",label:"Necesito revisarlo"},{id:"c4",label:"Depende de otro decisor"}], buttonText:"Continuar" },
    { id:"decisores", type:"decisionMakers", enabled:false, section:"Compromiso", internalName:"Decisores",
      title:"¿Esta decisión la <em>tomás vos</em> o necesitamos sumar a alguien más?", buttonText:"Continuar" },
    { id:"estrategia-24h", type:"stat", enabled:true, section:"Próximo paso", internalName:"Estrategia en 24h", kicker:"El siguiente paso",
      title:"Tu estrategia estará lista en <em>24 horas</em>.",
      statValue:"200+", statCaption:"alternativas que evaluamos con el equipo para elegir la mejor para vos.", buttonText:"Continuar" },
    { id:"resumen", type:"summary", enabled:true, section:"Próximo paso", internalName:"Resumen", kicker:"Devolución",
      title:"Esto es lo que <em>escuché de vos</em>:",
      sourceSlides:["porque-hoy","consecuencia","frena","vision"],
      labels:["Tu objetivo / motivo","Lo que está en juego","Lo que te frenó","Cómo te ves logrando"], buttonText:"Continuar" },
    { id:"proximo-paso", type:"nextStep", enabled:false, section:"Próximo paso", internalName:"Próximo paso", kicker:"Entonces quedamos así",
      title:"Definamos el <em>siguiente paso</em>", buttonText:"Confirmar siguiente cita" },
    { id:"calendly-booking", type:"calendly", enabled:true, section:"Próximo paso", internalName:"Agendar próxima cita",
      kicker:"Próximo paso", title:"Agendemos nuestra <em>próxima conversación</em>",
      subtitle:"Elegí el día y horario que mejor te funcione para revisar juntos tu estrategia.",
      calendlyUrl:"", source:"brand", showFallbackButton:true, fallbackButtonText:"Abrir agenda en otra pestaña ↗",
      confirmationEnabled:true, confirmationButtonText:"Cita agendada ✓" },
    { id:"valoracion-recap", type:"recapValue", enabled:true, section:"Valoración", internalName:"Lo que trabajamos hoy",
      title:"Lo que <em>trabajamos hoy</em>",
      bullets:["Entender tu situación financiera actual","Darte claridad sobre cómo ayudarte"],
      valueNote:"En mi despacho, esta asesoría normalmente tiene un valor, pero en este caso fue un <strong>regalo</strong>.",
      opinionTitle:"Me gustaría conocer tu opinión…",
      question1:"De todo lo que revisamos hoy: ¿qué fue lo que <em>más te sirvió</em> concretamente?",
      question2:"Y con base en tu experiencia: ¿qué hace que esta asesoría <em>tenga valor para ti</em>?",
      showMedia:true, media:{src:""}, buttonText:"Continuar" },
    { id:"valoracion-util", type:"textQuestion", enabled:false, section:"Valoración", internalName:"Valoración · lo más útil",
      title:"De todo lo que revisamos hoy, ¿qué fue <em>lo más útil</em> para vos?", placeholder:"Escribir respuesta…", responseKey:"feedbackMostUseful", buttonText:"Continuar" },
    { id:"valoracion-valor", type:"feedback", enabled:false, section:"Valoración", internalName:"Valoración · valor",
      title:"¿Qué hizo que esta conversación <em>tuviera valor</em>?", buttonText:"Continuar" },
    { id:"ref-oferta", type:"referralOffer", enabled:false, section:"Referidos", internalName:"Referidos · Oferta", kicker:"Un regalo para compartir",
      title:"Como te fue útil, quiero darte la posibilidad de regalársela a <em>5 colegas</em> cercanos para que también puedan tener esta claridad.",
      steps:["Solo necesito sus WhatsApps","Tú les avisas hoy y yo los contacto al día siguiente","Y si alguno no quiere, no pasa absolutamente nada"],
      valueLead:"Por compartírmelos, mi despacho me permite <strong>REGALARTE</strong> nuestra", valueHighlight:"Inteligencia Artificial", valueBadge:"Valor habitual —",
      showResource:true, resource:{src:"",tag:"DIAGNÓSTICO FINANCIERO",title:"¿Sabes realmente dónde estás parado?",sub:"2 minutos · Sin registro · Sin trampa"}, buttonText:"Me interesa" },
    { id:"ref-bonus", type:"resourceGrid", enabled:false, section:"Referidos", internalName:"Referidos · Bonificación", kicker:"Bonificación adicional",
      title:"Además, por compartírmelos <em>en esta llamada</em>, me autorizan a sumarte 3 recursos más que normalmente comercializamos.",
      cards:[{src:"",title:""},{src:"",title:""},{src:"",title:""}], note:"Valor total del regalo: todo esto, simplemente por ayudar a colegas que aprecies.", buttonText:"Continuar" },
    { id:"ref-perfil", type:"referralCapture", enabled:false, section:"Referidos", internalName:"Referidos · Captura",
      kicker:"Bonificación adicional", title:"Al pensar en ellos, <em>idealmente que sean…</em>",
      criteria:["<strong>Profesionales entre 25–45 años</strong> que les vaya bien en estos momentos","Alguien a quien admires financieramente"],
      listTitle:"Personas a las que quieres ayudar ❤️", listSubtitle:"Pueden ser colegas, compañeros de trabajo y/o familia.", minRows:5, defaultCC:"+52", buttonText:"Enviar regalo" },
    { id:"ref-mensaje", type:"referralMessage", enabled:false, section:"Referidos", internalName:"Referidos · Mensaje WhatsApp",
      kicker:"Para activar tus regalos", title:"El despacho nos pide que les mandes <em>este mensaje</em> antes de cerrar.",
      messageTemplate:"¡Hola! Espero estés muy bien.\\n\\nHace un rato tuve una plática con {{advisor.name}}, asesor financiero y patrimonial, y me gustó mucho cómo trabaja. Tengo una sesión para regalar y te elegí a ti.\\n\\nPensé que también te podría servir para revisar opciones de protección para tus finanzas (salud, retiro, ahorro…). La sesión incluye varios regalos interesantes.\\n\\nEn estos días te va a escribir para ver si te sirve.", buttonText:"Continuar" },
    { id:"cierre", type:"cover", enabled:true, section:"Valoración", internalName:"Cierre", kicker:"Nos vemos en la próxima",
      title:"Tu <em>estrategia</em> ya está en marcha.",
      subtitle:"Gracias por tu tiempo y tu confianza. En 24 horas la tenés lista y la vemos juntos.",
      dynamicClose:true,
      badges:["Cita de estrategia agendada ✓"], buttonText:"↺ Empezar de nuevo", isRestart:true }
  ]
};
const DEFAULT_BRAND={
  companyName:"Growth Link", companySub:"PROTECCIÓN · PATRIMONIO", advisorName:"",
  fontHead:"Inter", fontBody:"Inter",
  contact:{ email:"", whatsapp:"", calendly:"", website:"" },
  assets:{ logo:{ sourceType:"upload", data:"", url:"", mimeType:"", fileName:"", fit:"contain", position:"center", background:"transparent" } }
};
function blankSession(){ return { prospect:{ id:"", firstName:"", lastName:"", fullName:"", name:"", company:"", source:"", email:"", whatsapp:"", objective:"" },
  responses:{}, progress:0, status:"No iniciada", createdAt:null, updatedAt:null, advisor:"",
  decisionCriteria:["","",""],
  decisionMakers:[],
  nextStep:{ date:"", time:"", tz:"", mode:"", participants:"", objective:"", docs:"", advisorCommit:"", prospectCommit:"", calendly:"", whatsapp:"", notes:"" },
  feedback:{ mostUseful:"", perceivedValue:"", rating:null },
  internalNotes:"",
  referrals:[],
  meetingContext:{ meetingType:"discovery", route:"discovery" },
  preMeeting:{ hasPrevInfo:false, sources:[], rawContext:"",
    general:{ company:"", profession:"", age:"", maritalStatus:"", dependents:"", location:"" },
    commercial:{ source:"", referredBy:"", setter:"", productInterest:"", declaredObjective:"", meetingReason:"" },
    financial:{ incomeRange:"", estimatedCapacity:"", savings:"", currentCoverage:"", currentProduct:"", timeHorizon:"" } },
  referralSource:{ name:"", relationship:"", context:"" },
  meetingData:blankMeetingData(),
  sync:{ status:"local", lastAttempt:null, lastSuccess:null, error:null },
  finalSnapshot:null }; }
function blankMeetingData(){ return {
  objective:{ primary:"", why:"", whyNow:"", importance:"" },
  currentSituation:{ actions:"", obstacles:"", existingSolutions:"", notes:"" },
  consequences:{ costOfInaction:"", concerns:"" },
  vision:{ desiredSituation:"", timeline:"", requiredAmount:null },
  qualification:{ startingAmount:null, currency:"", frequency:"", decisionCriteria:[], decisionMakerStatus:"", additionalDecisionMakers:[] },
  nextStep:{ date:"", time:"", participants:[], objective:"", requirements:[] },
  feedback:{ mostUseful:"", perceivedValue:"", score:null } }; }
/* completa una sesión vieja con los campos nuevos, sin pisar lo existente */
function ensureSessionShape(se){ const b=blankSession();
  for(const k in b){ if(se[k]===undefined) se[k]=b[k]; }
  // migración de identidad: sesiones viejas solo con prospect.name
  if(se.prospect){ const p=se.prospect;
    if(p.firstName===undefined)p.firstName="";
    if(p.lastName===undefined)p.lastName="";
    if(p.fullName===undefined)p.fullName="";
    if(!p.fullName && !p.firstName && p.name){ // separar solo para migrar, sin perder el original
      p.fullName=p.name; const parts=p.name.trim().split(/\\s+/);
      p.firstName=parts[0]||""; p.lastName=parts.slice(1).join(' ')||""; }
    if(!p.fullName && (p.firstName||p.lastName)) p.fullName=(p.firstName+' '+p.lastName).trim();
    if(!p.name) p.name=p.fullName; }
  if(!se.nextStep)se.nextStep=b.nextStep; if(!se.feedback)se.feedback=b.feedback;
  if(!Array.isArray(se.decisionCriteria))se.decisionCriteria=["","",""];
  if(!Array.isArray(se.decisionMakers))se.decisionMakers=[];
  if(!Array.isArray(se.referrals))se.referrals=[];
  if(!se.meetingContext)se.meetingContext={meetingType:"discovery",route:"discovery"};
  if(!se.preMeeting)se.preMeeting=b.preMeeting;
  if(!se.meetingData)se.meetingData=blankMeetingData();
  if(!se.referralSource)se.referralSource=b.referralSource;
  if(!se.sync)se.sync=b.sync;
  return se; }
/* Tipos de cita (editables) */
const MEETING_TYPES=[
  {id:"discovery",num:"1",name:"Llamada de descubrimiento",desc:"Necesito conocer su situación, objetivos y necesidades.",route:"discovery"},
  {id:"direct_intent",num:"2",name:"Interés directo",desc:"El prospecto ya mostró interés concreto en una solución.",route:"direct"},
  {id:"referral",num:"3",name:"Referido",desc:"Llegó recomendado por un cliente, contacto o aliado.",route:"referral"},
  {id:"follow_up",num:"4",name:"Seguimiento",desc:"Ya tuvimos una conversación previa y quiero continuar el proceso.",route:"follow_up"}
];
const PREMEETING_SOURCES=["Formulario","Setter","LinkedIn","Meta Ads","WhatsApp","CRM","Referido","Reunión anterior","Otro"];
/* Reglas de ruteo (simples, sin árbol visual) */
const routingRules=[
  {condition:{field:"session.meetingContext.meetingType",equals:"discovery"},route:"discovery"},
  {condition:{field:"session.meetingContext.meetingType",equals:"direct_intent"},route:"direct"},
  {condition:{field:"session.meetingContext.meetingType",equals:"referral"},route:"referral"},
  {condition:{field:"session.meetingContext.meetingType",equals:"follow_up"},route:"follow_up"}
];
function resolveRoute(){const mt=SE().meetingContext&&SE().meetingContext.meetingType;
  const r=routingRules.find(x=>x.condition.equals===mt);return r?r.route:"discovery";}
/* Mapa slide → campo de meetingData (espejo del diagnóstico) */
const DIAGNOSIS_MAP={
  "porque-hoy":"objective.primary","porque-ese":"objective.why","importancia-ahora":"objective.importance",
  "accion-actual":"currentSituation.actions","frena":"currentSituation.obstacles","info-adicional":"currentSituation.notes",
  "consecuencia":"consequences.costOfInaction",
  "vision":"vision.desiredSituation","meta-requerida":"vision.requiredAmount",
  "monto":"qualification.startingAmount" };
function setDeep(obj,path,val){const p=path.split('.');let o=obj;for(let k=0;k<p.length-1;k++){if(o[p[k]]==null)o[p[k]]={};o=o[p[k]];}o[p[p.length-1]]=val;}
function mirrorDiagnosis(slideId,val){const path=DIAGNOSIS_MAP[slideId];if(!path)return;
  SE().meetingData=SE().meetingData||blankMeetingData();setDeep(SE().meetingData,path,val);}
/* Secciones predeterminadas de la reunión */
const MEETING_SECTIONS=["Encuadre","Objetivos","Situación actual","Consecuencias","Visión","Compromiso","Próximo paso","Valoración","Referidos","General"];
/* Etapas macro para el progreso por etapas (presentación) */
const STAGE_ORDER=["Encuadre","Objetivos","Situación actual","Visión","Compromiso","Próximo paso","Valoración"];

/* ================================================================
   meetingProject — FUENTE DE VERDAD (4 cajas separadas)
   ================================================================ */
let meetingProject={
  schemaVersion:2,
  template:JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)),
  theme:JSON.parse(JSON.stringify(THEME_PRESETS["gl-dark"])),
  brand:JSON.parse(JSON.stringify(DEFAULT_BRAND)),
  session:blankSession()
};
const T=()=>meetingProject.template, TH=()=>meetingProject.theme, BR=()=>meetingProject.brand, SE=()=>meetingProject.session;

/* ================================================================
   SANITIZACIÓN
   ================================================================ */
function sanitizeText(str){ if(str==null)return str; if(typeof str!=='string')return str;
  return str.replace(/<script[\\s\\S]*?<\\/script>/gi,'').replace(/\\son\\w+\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)/gi,'').replace(/javascript:/gi,''); }
function deepSanitize(obj){ if(Array.isArray(obj))return obj.map(deepSanitize);
  if(obj&&typeof obj==='object'){const o={};for(const k in obj)o[k]=deepSanitize(obj[k]);return o;}
  return typeof obj==='string'?sanitizeText(obj):obj; }

/* ================================================================
   MIGRACIÓN a v2
   ================================================================ */
function migrateToV2(raw){
  if(!raw||typeof raw!=='object')return null;
  if(raw.schemaVersion>=2 && raw.template)return raw;
  if(raw.slides){
    const oldColors=(raw.brand&&raw.brand.colors)||{};
    return {
      schemaVersion:2,
      template:{ id:raw.id||"importada", name:raw.name||"Importada", isMaster:!!raw.isMaster,
        settings:raw.settings||{showProgress:true,allowKeyboard:true}, slides:raw.slides },
      theme:Object.assign(JSON.parse(JSON.stringify(THEME_PRESETS["gl-dark"])),{
        background:oldColors.background||undefined, surface:oldColors.panel||undefined,
        accent:oldColors.accent||undefined, textPrimary:oldColors.text||undefined, name:"Tema importado", id:"custom-"+rid()
      }),
      brand:{ companyName:(raw.brand&&raw.brand.companyName)||"Growth Link",
        companySub:(raw.brand&&raw.brand.companySub)||"", advisorName:(raw.brand&&raw.brand.advisorName)||"",
        fontHead:"Inter", fontBody:"Inter",
        contact:(raw.brand&&raw.brand.contact)||{email:"",whatsapp:"",calendly:"",website:""},
        assets:{ logo:{ sourceType:(raw.brand&&raw.brand.logo)?"url":"upload", data:"", url:(raw.brand&&raw.brand.logo)||"", mimeType:"", fileName:"", fit:"contain", position:"center", background:"transparent" } } },
      session:blankSession()
    };
  }
  return null;
}
function rid(){return Math.random().toString(36).slice(2,8);}

/* ================================================================
   STORE + CRMAdapter
   ================================================================ */
const K_PROJECT='gl-project-current', TPL_PREFIX='gl-template-', TPL_INDEX='gl-template-index';
const Store={
  saveProject(){ try{
      const copy=JSON.parse(JSON.stringify(meetingProject));
      localStorage.setItem(K_PROJECT,JSON.stringify(copy)); return true;
    }catch(e){ if(e&&/quota/i.test(e.name||e.message||''))return 'quota'; return false; } },
  loadProject(){ try{const r=localStorage.getItem(K_PROJECT);if(!r)return null;
      const m=migrateToV2(JSON.parse(r));return m; }catch(e){return null;} },
  listTemplates(){try{return JSON.parse(localStorage.getItem(TPL_INDEX)||'[]');}catch(e){return[];}},
  saveTemplate(tpl,theme,brand){try{
      const idx=this.listTemplates().filter(t=>t.id!==tpl.id);
      idx.push({id:tpl.id,name:tpl.name,isMaster:!!tpl.isMaster,updated:Date.now()});
      localStorage.setItem(TPL_INDEX,JSON.stringify(idx));
      localStorage.setItem(TPL_PREFIX+tpl.id,JSON.stringify({schemaVersion:2,template:tpl,theme,brand}));return true;
    }catch(e){return false;}},
  loadTemplate(id){try{const r=localStorage.getItem(TPL_PREFIX+id);return r?migrateToV2(JSON.parse(r)):null;}catch(e){return null;}},
  deleteTemplate(id){try{localStorage.removeItem(TPL_PREFIX+id);
    localStorage.setItem(TPL_INDEX,JSON.stringify(this.listTemplates().filter(t=>t.id!==id)));}catch(e){}},
  estimateUsage(){ try{let n=0;for(let k in localStorage)if(localStorage.hasOwnProperty(k))n+=(localStorage[k].length+k.length);return n;}catch(e){return 0;} }
};
const CRMAdapter={
  loadContact(c){Object.assign(SE().prospect,c||{});}, loadAdvisor(a){SE().advisor=a&&a.name||SE().advisor;},
  loadTemplate(){}, createSession(){}, saveSession(){}, saveResponses(){}, saveProgress(){},
  saveReferrals(){}, closeMeeting(){}, scheduleNextMeeting(){}
};

(function readURL(){const q=new URLSearchParams(location.search);
  if(q.get('prospectId'))SE().prospect.id=q.get('prospectId');
  if(q.get('prospectName'))SE().prospect.name=q.get('prospectName');
  if(q.get('prospectCompany'))SE().prospect.company=q.get('prospectCompany');
  if(q.get('advisor'))BR().advisorName=q.get('advisor');
})();

/* ================================================================
   VARIABLES DINÁMICAS — con salvaguarda de nombre
   ================================================================ */
const NEUTRAL_NAME="ti";
/* Identidad del prospecto: conversacional = firstName; formal = fullName */
function firstNm(){ return (SE().prospect.firstName||'').trim(); }
function fullNm(){ const p=SE().prospect; return (p.fullName||p.name||'').trim(); }
function safeName(){ return firstNm() || fullNm() || NEUTRAL_NAME; }        // trato al prospecto ("preparada para X")
function safeFirstInternal(){ return firstNm() || 'del prospecto'; }        // interfaces internas del asesor (Router)
function fullNameOrNeutral(){ return fullNm() || 'Sin nombre'; }            // fichas / formal
function interpolate(str){if(!str)return '';const pm=SE().preMeeting||{},md=SE().meetingData||{},rf=SE().referralSource||{},dc=SE().decisionCriteria||[],ns=SE().nextStep||{};
  const full=fullNm()||safeName();
  return str
  .replace(/\\{\\{prospect\\.firstName\\}\\}/g,firstNm()||safeName())
  .replace(/\\{\\{prospect\\.lastName\\}\\}/g,(SE().prospect.lastName||'').trim())
  .replace(/\\{\\{prospect\\.fullName\\}\\}/g,full)
  .replace(/\\{\\{prospect\\.name\\}\\}/g,full)
  .replace(/\\[Prospecto\\]/g,safeName())
  .replace(/\\{\\{prospect\\.company\\}\\}/g,(SE().prospect.company||(pm.general&&pm.general.company)||'').trim())
  .replace(/\\{\\{prospect\\.profession\\}\\}/g,((pm.general&&pm.general.profession)||'').trim())
  .replace(/\\{\\{prospect\\.age\\}\\}/g,((pm.general&&pm.general.age)||'').toString().trim())
  .replace(/\\{\\{prospect\\.objective\\}\\}/g,(SE().prospect.objective||(pm.commercial&&pm.commercial.declaredObjective)||'').trim())
  .replace(/\\{\\{meeting\\.type\\}\\}/g,meetingTypeName())
  .replace(/\\{\\{meeting\\.source\\}\\}/g,((SE().preMeeting&&SE().preMeeting.sources||[]).join(', ')))
  .replace(/\\{\\{meeting\\.objective\\}\\}/g,((md.objective&&md.objective.primary)||SE().prospect.objective||'').trim())
  .replace(/\\{\\{referral\\.name\\}\\}/g,(rf.name||'').trim())
  .replace(/\\{\\{decision\\.criteria1\\}\\}/g,(dc[0]||'').trim())
  .replace(/\\{\\{decision\\.criteria2\\}\\}/g,(dc[1]||'').trim())
  .replace(/\\{\\{decision\\.criteria3\\}\\}/g,(dc[2]||'').trim())
  .replace(/\\{\\{nextMeeting\\.date\\}\\}/g,(ns.date||'').trim())
  .replace(/\\{\\{nextMeeting\\.time\\}\\}/g,(ns.time||'').trim())
  .replace(/\\{\\{nextMeeting\\.type\\}\\}/g,(ns.meetingType||'').trim())
  .replace(/\\{\\{advisor\\.calendly\\}\\}/g,((BR().contact&&BR().contact.calendly)||'').trim())
  .replace(/\\{\\{advisor\\.name\\}\\}/g,(BR().advisorName||SE().advisor||'').trim())
  .replace(/\\{\\{company\\.name\\}\\}/g,(BR().companyName||'').trim())
  .replace(/\\{\\{brand\\.name\\}\\}/g,(BR().companyName||'').trim());}
function meetingTypeName(){const t=(SE().meetingContext&&SE().meetingContext.meetingType);const m=MEETING_TYPES.find(x=>x.id===t);return m?m.name:'';}

/* ================================================================
   APPLY THEME
   ================================================================ */
function resolveMode(theme){ if(theme.mode!=='auto')return theme.mode;
  return (window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark'; }
function applyTheme(){
  const th=TH(), r=document.documentElement.style, mode=resolveMode(th);
  const base = mode==='light' ? THEME_PRESETS["patrimonial-light"] : THEME_PRESETS["gl-dark"];
  const g=(k)=>th[k]!=null?th[k]:base[k];
  r.setProperty('--gl-bg',g('background')); r.setProperty('--gl-bg2',g('backgroundSecondary'));
  r.setProperty('--gl-surface',g('surface')); r.setProperty('--gl-surface2',g('surfaceSecondary'));
  r.setProperty('--gl-text',g('textPrimary')); r.setProperty('--gl-text2',g('textSecondary')); r.setProperty('--gl-muted',g('textMuted'));
  r.setProperty('--gl-accent',g('accent')); r.setProperty('--gl-accent-soft',g('accentSoft')); r.setProperty('--gl-accent-contrast',g('accentContrast'));
  r.setProperty('--gl-border',g('border')); r.setProperty('--gl-border-strong',g('borderStrong'));
  r.setProperty('--gl-input-bg',g('inputBackground')); r.setProperty('--gl-button-text',g('buttonText'));
  r.setProperty('--gl-ok',g('success')); r.setProperty('--gl-warn',g('warning')); r.setProperty('--gl-danger',g('danger'));
  r.setProperty('--gl-glow',g('glow')); r.setProperty('--gl-star',g('star')); r.setProperty('--gl-star-line',g('starLine'));
  r.setProperty('--gl-star-opacity',(g('starOpacity')!=null?g('starOpacity'):.4));
  r.setProperty('--gl-font-head',"'"+(BR().fontHead||'Inter')+"',system-ui,sans-serif");
  r.setProperty('--gl-font-body',"'"+(BR().fontBody||'Inter')+"',system-ui,sans-serif");
  document.getElementById('cornerLogo').innerHTML=logoHTML();
}
if(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').addEventListener){
  matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(TH().mode==='auto')applyTheme();});
}
function hexToRgb(hex){hex=(hex||'').replace('#','');if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');
  const n=parseInt(hex,16);return isNaN(n)?null:{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
function lum(rgb){if(!rgb)return 0;const a=[rgb.r,rgb.g,rgb.b].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*a[0]+.7152*a[1]+.0722*a[2];}
function contrastRatio(h1,h2){const L1=lum(hexToRgb(h1)),L2=lum(hexToRgb(h2));const hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+.05)/(lo+.05);}
function isLight(hex){return lum(hexToRgb(hex))>.5;}

function logoHTML(){const a=BR().assets.logo, src=a.data||a.url;
  const inner=src?'<img src="'+src+'" style="object-fit:'+(a.fit||'contain')+';'+(a.background&&a.background!=='transparent'?'background:'+a.background+';':'')+'" alt="">':'<span>G<b>L</b></span>';
  return '<div class="mark">'+inner+'</div><div class="txt">'+escapeHtml(BR().companyName)+'<small>'+escapeHtml(BR().companySub||'')+'</small></div>';}
function escapeHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function escapeHtmlKeep(s){return escapeHtml(s);} // saneo del texto inyectado (nombre/fecha) manteniendo el <em> del literal

/* ---- Línea de prospecto: nombre SIEMPRE desde la sesión, nunca texto fijo ---- */
function migrateCover(s){
  if(s.type!=='cover')return;
  if(s.prospectLine)return;                    // ya migrada
  const cn=s.coverName;
  if(cn==null){ s.prospectLine={enabled:false,prefix:"",showProspectName:false,suffix:"",anonymousText:"Preparada especialmente para ti"}; return; }
  const hasVar=/\\{\\{prospect\\.name\\}\\}|\\[Prospecto\\]/.test(cn);
  if(hasVar){ // Caso A/B: separar prefijo y sufijo alrededor de la variable
    const parts=cn.split(/\\{\\{prospect\\.name\\}\\}|\\[Prospecto\\]/);
    const strip=t=>(t||'').replace(/<\\/?b>/g,'').replace(/<\\/?strong>/g,'').trim();
    s.prospectLine={enabled:true,prefix:strip(parts[0]),showProspectName:true,suffix:strip(parts[1]),anonymousText:"Preparada especialmente para ti"};
  }else{ // Caso C: texto fijo, no adivinar. Marcar para advertir en el editor.
    s.prospectLine={enabled:true,prefix:strip_(cn),showProspectName:false,suffix:"",anonymousText:"Preparada especialmente para ti",fixedWarning:true};
  }
  delete s.coverName;
}
function strip_(t){return (t||'').replace(/<\\/?b>/g,'').replace(/<\\/?strong>/g,'').trim();}
function migrateAllCovers(){ (T().slides||[]).forEach(migrateCover); }
function prospectLineHTML(s){
  if(s.coverName!=null && !s.prospectLine) migrateCover(s); // por si llega sin migrar
  const pl=s.prospectLine; if(!pl||pl.enabled===false)return '';
  let inner;
  const nm=safeName()===NEUTRAL_NAME?'':safeName();
  if(pl.showProspectName){
    if(nm){ inner=(pl.prefix?escapeHtml(pl.prefix)+' ':'')+'<b>'+escapeHtml(nm)+'</b>'+(pl.suffix?' '+escapeHtml(pl.suffix):''); }
    else  { inner=escapeHtml(pl.anonymousText||'Preparada especialmente para ti'); }
  }else{
    inner=escapeHtml(pl.prefix||'');
  }
  return '<div class="cover-name">'+inner+'</div>';
}
/* ================================================================
   RENDERER
   ================================================================ */
function activeSlides(){const route=(SE().meetingContext&&SE().meetingContext.route)||resolveRoute();
  const presenting=document.body.classList.contains('present');
  return T().slides.filter(s=>{
    if(s.enabled===false)return false;
    if(s.routes&&s.routes.length&&route&&s.routes.indexOf(route)<0)return false;   // filtro por ruta
    if(presenting&&s.visibility==='advisor')return false;                          // privado: nunca al prospecto
    return true;});}
const EDITING=()=>document.body.classList.contains('edit');
function ed(s,f){return EDITING()?' data-edit="'+f+'" data-sid="'+s.id+'"':'';}
function slideHTML(s){
  const kick=s.kicker!=null?'<div class="kicker"'+ed(s,'kicker')+'>'+interpolate(s.kicker)+'</div>':'';
  const lead=s.lead!=null?'<p class="lead"'+ed(s,'lead')+'>'+interpolate(s.lead)+'</p>':'';
  const btn=s.buttonText!=null?'<div class="actions"><button class="btn" data-action="'+(s.isRestart?'restart':'next')+'"'+ed(s,'buttonText')+'>'+interpolate(s.buttonText)+'</button></div>':'';
  switch(s.type){
    case 'cover':{
      let title=s.title, subtitle=s.subtitle;
      if(s.dynamicClose && SE().nextStep && SE().nextStep.scheduled && !EDITING()){
        const ns=SE().nextStep;const fecha=ns.date||'';
        title=firstNm()?(escapeHtmlKeep(firstNm())+', nos vemos el <em>'+escapeHtmlKeep(fecha||'próximo encuentro')+'</em>.'):'Nos vemos en la <em>próxima cita</em>.';
        subtitle='En nuestra próxima reunión veremos la estrategia que construimos a partir de todo lo que conversamos hoy.';
      }
      return '<div class="wrap center"><div class="logo center">'+logoHTML()+'</div>'+kick+
      '<h1'+ed(s,'title')+'>'+interpolate(title)+'</h1>'+
      (subtitle!=null?'<p class="big"'+ed(s,'subtitle')+'>'+interpolate(subtitle)+'</p>':'')+
      (s.badges?'<div class="badges">'+s.badges.map((b,bi)=>'<span class="badge"'+(EDITING()?' data-edit="badge:'+bi+'" data-sid="'+s.id+'"':'')+'>'+interpolate(b)+'</span>').join('')+'</div>':'')+
      prospectLineHTML(s)+btn+'</div>';}
    case 'statement':return '<div class="wrap">'+kick+lead+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+(s.body!=null?'<p class="big"'+ed(s,'body')+'>'+interpolate(s.body)+'</p>':'')+btn+'</div>';
    case 'textQuestion':return '<div class="wrap">'+kick+lead+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="field"><textarea data-response="'+s.id+'" rows="3" placeholder="'+escapeHtml(s.placeholder||'Escribir…')+'"></textarea></div>'+btn+'</div>';
    case 'money':return '<div class="wrap">'+kick+lead+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+(s.body!=null?'<p'+ed(s,'body')+'>'+interpolate(s.body)+'</p>':'')+
      '<div class="money"><span>$</span><input type="text" inputmode="numeric" data-response="'+s.id+'" data-rkey="'+(s.responseKey||'')+'" placeholder="'+escapeHtml(s.placeholder||'0')+'"></div>'+btn+'</div>';
    case 'criteria':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="field"><input class="crit-in" data-crit="0" placeholder="Criterio 1" style="width:100%;margin-bottom:10px;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:12px;color:var(--gl-text);font-size:16px;padding:14px 16px;outline:none">'+
      '<input class="crit-in" data-crit="1" placeholder="Criterio 2" style="width:100%;margin-bottom:10px;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:12px;color:var(--gl-text);font-size:16px;padding:14px 16px;outline:none">'+
      '<input class="crit-in" data-crit="2" placeholder="Criterio 3" style="width:100%;background:var(--gl-input-bg);border:1px solid var(--gl-border-strong);border-radius:12px;color:var(--gl-text);font-size:16px;padding:14px 16px;outline:none"></div>'+btn+'</div>';
    case 'decisionMakers':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="opts" data-dm>'+
        [['solo','Decido personalmente'],['pareja','Necesito sumar a mi pareja'],['socio','Necesito sumar a un socio'],['familiar','Necesito sumar a un familiar'],['otro','Otra persona']]
        .map(o=>'<div class="opt" data-dmopt="'+o[0]+'"><span class="ol">'+o[1]+'</span></div>').join('')+'</div>'+
      '<div id="dmExtra" style="margin-top:16px"></div>'+btn+'</div>';
    case 'nextStep':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+nextStepView()+btn+'</div>';
    case 'feedback':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="field"><textarea data-response="'+s.id+'" data-rkey="feedbackValue" rows="3" placeholder="Escribir respuesta…"></textarea></div>'+
      '<div class="stars-input" data-stars>'+[1,2,3,4,5].map(n=>'<span class="st" data-star="'+n+'">★</span>').join('')+'</div>'+btn+'</div>';
    case 'twostep':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="steps"><div class="step hl"><div class="when">'+escapeHtml(s.stepA.when)+'</div><div class="t">'+escapeHtml(s.stepA.title)+'</div><div class="d">'+escapeHtml(s.stepA.desc)+'</div></div>'+
      '<div class="step"><div class="when">'+escapeHtml(s.stepB.when)+'</div><div class="t">'+escapeHtml(s.stepB.title)+'</div><div class="d">'+escapeHtml(s.stepB.desc)+'</div></div></div>'+btn+'</div>';
    case 'choice2':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="twoup"><div class="choice" data-choice="A" data-response="'+s.id+'"><div class="k">'+escapeHtml(s.optionA.k)+'</div><p>'+interpolate(s.optionA.text)+'</p></div>'+
      '<div class="choice" data-choice="B" data-response="'+s.id+'"><div class="k">'+escapeHtml(s.optionB.k)+'</div><p>'+interpolate(s.optionB.text)+'</p></div></div></div>';
    case 'options':return '<div class="wrap">'+kick+lead+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="opts">'+(s.items||[]).map(o=>'<div class="opt" data-option="'+o.id+'" data-response="'+s.id+'">'+(o.icon?'<span class="ic">'+escapeHtml(o.icon)+'</span>':'')+'<span class="ol">'+escapeHtml(o.label)+'</span></div>').join('')+'</div>'+btn+'</div>';
    case 'ranking':return '<div class="wrap">'+lead+'<h2 class="center"'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<ul class="prior" data-ranking="'+s.id+'">'+(s.items||[]).map((it,n)=>'<li draggable="true" data-item="'+it.id+'"><div class="rank">'+(n+1)+'</div><div class="lbl">'+escapeHtml(it.label)+'</div><div class="grip">⋮⋮</div></li>').join('')+'</ul>'+btn+'</div>';
    case 'stat':return '<div class="wrap center">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<div class="stat"><div class="num"'+ed(s,'statValue')+'>'+escapeHtml(s.statValue)+'</div><div class="cap"'+ed(s,'statCaption')+'>'+interpolate(s.statCaption||'')+'</div></div>'+btn+'</div>';
    case 'list':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<ul class="simple-list">'+(s.items||[]).map((it,n)=>'<li><span class="n">'+String(n+1).padStart(2,'0')+'</span>'+escapeHtml(it.label||it)+'</li>').join('')+'</ul>'+btn+'</div>';
    case 'summary':return '<div class="wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
      '<ul class="echo" data-summary="'+s.id+'">'+(s.sourceSlides||[]).map((sid,idx2)=>'<li><div class="q">'+escapeHtml((s.labels&&s.labels[idx2])||'')+'</div><div class="a" data-echo="'+sid+'"></div></li>').join('')+'</ul>'+btn+'</div>';
    case 'media':return '<div class="wrap center">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2><div class="media">'+(s.media&&s.media.src?'<img src="'+s.media.src+'" alt="'+escapeHtml(s.media.alt||'')+'">':'<p style="color:var(--gl-muted)">Sin imagen — definí media.src en propiedades</p>')+'</div>'+btn+'</div>';
    case 'embed':return '<div class="wrap center">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2><div class="embed">'+(s.embedUrl?'<iframe src="'+escapeHtml(s.embedUrl)+'" allowfullscreen></iframe>':'<p style="color:var(--gl-muted);padding:40px">Sin URL — definí embedUrl en propiedades</p>')+'</div>'+btn+'</div>';
    case 'calendly':return calendlyView(s,kick);
    case 'referralCapture':return referralCaptureView(s,kick);
    case 'referralMessage':return referralMessageView(s,kick);
    case 'recapValue':return recapValueView(s,kick);
    case 'referralOffer':return referralOfferView(s,kick);
    case 'resourceGrid':return resourceGridView(s,kick);
    default:return '<div class="wrap"><h2'+ed(s,'title')+'>'+interpolate(s.title||'')+'</h2>'+btn+'</div>';
  }
}
/* --- Oferta de referidos: 3 pasos numerados + bloque de valor + recurso (estilo Powing) --- */
function referralOfferView(s,kick){
  const steps=(s.steps&&s.steps.length)?'<div class="ro-steps">'+s.steps.map((st,n)=>'<div class="ro-step"><span class="ro-num">'+(n+1)+'</span><div class="ro-txt"'+(EDITING()?' data-edit="step:'+n+'" data-sid="'+s.id+'"':'')+'>'+interpolate(st)+'</div></div>').join('')+'</div>':'';
  const valueBlock='<div class="ro-value">'+
    (s.valueLead!=null?'<p class="ro-value-lead"'+ed(s,'valueLead')+'>'+interpolate(s.valueLead)+'</p>':'')+
    (s.valueHighlight!=null?'<div class="ro-value-hl"'+ed(s,'valueHighlight')+'>'+interpolate(s.valueHighlight)+'</div>':'')+
    (s.valueBadge!=null?'<div class="ro-value-badge"'+ed(s,'valueBadge')+'>★ '+interpolate(s.valueBadge)+'</div>':'')+
    '</div>';
  const resource=s.showResource!==false?'<div class="ro-resource">'+
    (s.resource&&s.resource.src?'<img src="'+escapeHtml(s.resource.src)+'" alt="">':
      '<div class="ro-resource-ph"><div class="ro-res-tag">'+escapeHtml((s.resource&&s.resource.tag)||'DIAGNÓSTICO')+'</div><div class="ro-res-title">'+escapeHtml((s.resource&&s.resource.title)||'Tu recurso de regalo')+'</div><div class="ro-res-sub">'+escapeHtml((s.resource&&s.resource.sub)||'2 minutos · Sin registro')+'</div><div class="ro-res-orb">▶</div><div class="ro-res-cta">▶ Toca para explorar</div></div>')+
    '</div>':'';
  const btn=s.buttonText!=null&&!EDITING()?'<div class="actions"><button class="btn" data-action="next">'+interpolate(s.buttonText)+'</button></div>':'';
  return '<div class="wrap ro-wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+steps+
    '<div class="ro-bottom">'+valueBlock+resource+'</div>'+btn+'</div>';
}
/* --- Grilla de recursos: 3 tarjetas con imagen editable --- */
function resourceGridView(s,kick){
  const cards=(s.cards||[]).map((c,n)=>'<div class="rg-card">'+
    (c.src?'<img src="'+escapeHtml(c.src)+'" alt="">':'<div class="rg-ph"><span class="rg-ph-num">'+String(n+1).padStart(2,'0')+'</span><span class="rg-ph-ic">🖼</span></div>')+
    (c.title?'<div class="rg-title">'+escapeHtml(c.title)+'</div>':'')+
    '</div>').join('');
  const btn=s.buttonText!=null&&!EDITING()?'<div class="actions"><button class="btn" data-action="next">'+interpolate(s.buttonText)+'</button></div>':'';
  const note=s.note!=null?'<div class="rg-note"'+ed(s,'note')+'>'+interpolate(s.note)+'</div>':'';
  return '<div class="wrap rg-wrap">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
    '<div class="rg-grid">'+cards+'</div>'+note+btn+'</div>';
}
/* --- "Lo que trabajamos hoy": recap + valor + 2 preguntas --- */
function recapValueView(s,kick){
  const bullets=(s.bullets&&s.bullets.length)?'<ul class="recap-bullets">'+s.bullets.map((b,bi)=>'<li'+(EDITING()?' data-edit="bullet:'+bi+'" data-sid="'+s.id+'"':'')+'>'+interpolate(b)+'</li>').join('')+'</ul>':'';
  const quote=s.valueNote!=null?'<div class="recap-quote"'+ed(s,'valueNote')+'>'+interpolate(s.valueNote)+'</div>':'';
  const opinion=s.opinionTitle!=null?'<div class="recap-op-title"'+ed(s,'opinionTitle')+'>'+interpolate(s.opinionTitle)+'</div>':'';
  const q1=s.question1!=null?'<div class="recap-q hl"><div class="recap-q-txt"'+ed(s,'question1')+'>'+interpolate(s.question1)+'</div>'+(EDITING()?'':'<textarea class="recap-a" data-response="'+s.id+'-q1" data-rkey="feedbackMostUseful" rows="2" placeholder="Escribir respuesta…"></textarea>')+'</div>':'';
  const q2=s.question2!=null?'<div class="recap-q"><div class="recap-q-txt"'+ed(s,'question2')+'>'+interpolate(s.question2)+'</div>'+(EDITING()?'':'<textarea class="recap-a" data-response="'+s.id+'-q2" data-rkey="feedbackValue" rows="2" placeholder="Escribir respuesta…"></textarea>')+'</div>':'';
  const media=s.showMedia!==false?'<div class="recap-media">'+(s.media&&s.media.src?'<img src="'+escapeHtml(s.media.src)+'" alt="">':'<span class="recap-media-ph">🖼</span>')+'</div>':'';
  const btn=s.buttonText!=null&&!EDITING()?'<div class="actions"><button class="btn" data-action="next">'+interpolate(s.buttonText)+'</button></div>':'';
  return '<div class="wrap recap-wrap">'+media+
    '<div class="recap-main">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+bullets+quote+opinion+q1+q2+btn+'</div></div>';
}
/* --- Captura de referidos (Nombre + WhatsApp) — session.referrals --- */
function referralCaptureView(s,kick){
  const lead=s.lead!=null?'<p class="lead"'+ed(s,'lead')+'>'+interpolate(s.lead)+'</p>':'';
  const criteria=(s.criteria&&s.criteria.length)?'<ul class="ref-crit">'+s.criteria.map((c,ci)=>'<li'+(EDITING()?' data-edit="crit:'+ci+'" data-sid="'+s.id+'"':'')+'>'+interpolate(c)+'</li>').join('')+'</ul>':'';
  const min=s.minRows||5;
  const refs=SE().referrals&&SE().referrals.length?SE().referrals:[];
  const rows=[];const total=Math.max(min,refs.length+ (refs.length<min?0:1));
  for(let n=0;n<Math.max(min,refs.length);n++){const r=refs[n]||{};
    rows.push('<div class="ref-row" data-refrow="'+n+'">'+
      '<input class="ref-name" data-reffield="name" data-idx="'+n+'" value="'+escapeHtml(r.name||'')+'" placeholder="Nombre">'+
      '<input class="ref-cc" data-reffield="cc" data-idx="'+n+'" value="'+escapeHtml(r.cc||s.defaultCC||'+52')+'">'+
      '<input class="ref-phone" data-reffield="phone" data-idx="'+n+'" value="'+escapeHtml(r.phone||'')+'" placeholder="10 dígitos" inputmode="numeric">'+
      '<button class="ref-del" onclick="removeReferral('+n+')" title="Quitar">✕</button>'+
      '</div>');}
  const heart=s.listTitle!=null?'<div class="ref-list-title"'+ed(s,'listTitle')+'>'+interpolate(s.listTitle)+'</div>':'';
  const listSub=s.listSubtitle!=null?'<div class="ref-list-sub"'+ed(s,'listSubtitle')+'>'+interpolate(s.listSubtitle)+'</div>':'';
  return '<div class="wrap">'+kick+lead+'<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+criteria+
    '<div class="ref-box">'+heart+listSub+
    '<div class="ref-rows" data-refrows>'+rows.join('')+'</div>'+
    '<button class="ref-add" onclick="addReferralRow()">+ Agregar otro</button>'+
    '<button class="btn ref-send" onclick="sendReferrals()">'+interpolate(s.buttonText||'Enviar regalo')+'</button>'+
    '</div></div>';
}
/* --- Mensaje de WhatsApp para reenviar --- */
function referralMessageView(s,kick){
  const msg=interpolate(s.messageTemplate||'');
  return '<div class="wrap center">'+kick+
    (s.icon!==false?'<div class="ref-msg-icon">💬</div>':'')+
    '<h2'+ed(s,'title')+'>'+interpolate(s.title)+'</h2>'+
    '<div class="ref-chat">'+
      '<div class="ref-chat-head"><span class="ref-chat-av">'+escapeHtml((BR().advisorName||'A').slice(0,1))+'</span><div><b>'+escapeHtml(BR().advisorName||'Tu asesor')+'</b><small>en línea</small></div></div>'+
      '<div class="ref-chat-body"'+ed(s,'messageTemplate')+'>'+msg.replace(/\\n/g,'<br>')+'</div>'+
    '</div>'+
    (EDITING()?'':'<div class="actions" style="justify-content:center"><button class="btn" onclick="copyReferralMessage(this)">Copiar mensaje</button>'+
      (s.buttonText!=null?'<button class="btn ghost" data-action="next">'+interpolate(s.buttonText)+'</button>':'')+'</div>')+
    '</div>';
}
/* --- Calendly: URL, embed grande, fallback obligatorio, estado agendado --- */
function calendlyResolveUrl(s){
  const raw=(s.source==='custom'?(s.calendlyUrl||''):((BR().contact&&BR().contact.calendly)||s.calendlyUrl||'')).trim();
  return normalizeCalendly(raw);
}
function normalizeCalendly(url){ if(!url)return '';
  if(/^javascript:/i.test(url))return '';                          // bloquear inseguros
  if(/^https?:\\/\\//i.test(url)){ return /calendly\\.com/i.test(url)?url:''; }
  if(/^calendly\\.com/i.test(url)||/^[\\w-]+\\/[\\w-]+/i.test(url)){    // "usuario/reunion" o "calendly.com/..."
    return 'https://'+(/^calendly\\.com/i.test(url)?url:'calendly.com/'+url); }
  return '';
}
function calendlyView(s,kick){
  const ns=SE().nextStep||{};
  const subtitle=s.subtitle!=null?'<p class="big cal-sub"'+ed(s,'subtitle')+'>'+interpolate(s.subtitle)+'</p>':'';
  // estado AGENDADO
  if(ns.scheduled){
    const fecha=[ns.date,ns.time].filter(Boolean).join(' · ')||'Fecha por confirmar';
    return '<div class="wrap center">'+kick+'<div class="cal-done">'+
      '<div class="cal-done-top">✓ Próxima cita agendada</div>'+
      '<div class="cal-done-date">'+escapeHtml(fecha)+'</div>'+
      (ns.meetingType?'<div class="cal-done-type">'+escapeHtml(ns.meetingType)+'</div>':'')+
      (ns.participants?'<div class="cal-done-part">'+escapeHtml(ns.participants)+'</div>':'')+
      '</div>'+
      (EDITING()?'':'<div class="actions" style="justify-content:center"><button class="btn ghost" onclick="openScheduleModal()">Cambiar cita</button></div>')+
      '</div>';
  }
  const url=calendlyResolveUrl(s);
  let area;
  if(!url){
    area='<div class="cal-empty">'+(EDITING()?'Configurá tu Calendly para activar esta diapositiva (propiedades → URL).':'<div class="cal-fallback"><p>No pudimos mostrar la agenda aquí.</p></div>')+'</div>';
  }else{
    area='<div class="cal-embed" data-cal-embed="'+encodeURIComponent(url)+'">'+
      '<iframe src="'+escapeHtml(url)+'?hide_gdpr_banner=1" title="Calendly" onload="calMarkLoaded(this)"></iframe>'+
      '<div class="cal-fallback" data-cal-fallback><p>No pudimos mostrar la agenda aquí.</p>'+
        '<a class="btn" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Abrir agenda →</a></div>'+
      '</div>';
  }
  const fb=(url&&s.showFallbackButton!==false)?'<div class="cal-openext"><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(interpolate(s.fallbackButtonText||'Abrir agenda en otra pestaña ↗'))+'</a></div>':'';
  const confirmBtn=(s.confirmationEnabled!==false&&!EDITING())?'<div class="actions" style="justify-content:center"><button class="btn" onclick="openScheduleModal()">'+escapeHtml(interpolate(s.confirmationButtonText||'Cita agendada ✓'))+'</button></div>':'';
  return '<div class="wrap center">'+kick+'<h2'+ed(s,'title')+'>'+interpolate(s.title||'')+'</h2>'+subtitle+area+fb+confirmBtn+'</div>';
}

/* iframe cargó bien — cancelar el fallback pendiente */
function calMarkLoaded(iframe){const box=iframe.closest('.cal-embed');if(box){box.classList.add('loaded');const fb=box.querySelector('[data-cal-fallback]');if(fb)fb.style.display='none';}}
/* si en 6s no cargó, mostrar el fallback (embed bloqueado / lento / error) */
function calWatchFallback(){document.querySelectorAll('.cal-embed:not(.loaded)').forEach(box=>{
  setTimeout(()=>{if(!box.classList.contains('loaded')){const fb=box.querySelector('[data-cal-fallback]');if(fb)fb.style.display='flex';}},6000);});}
/* modal Confirmar próxima cita */
function openScheduleModal(){const ns=SE().nextStep||{};
  const f=(label,key,ph)=>'<div class="field-mini"><label>'+label+'</label><input data-ns="'+key+'" value="'+escapeHtml(ns[key]||'')+'" placeholder="'+(ph||'')+'"></div>';
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Confirmar próxima cita</h3>'+
    '<div class="rt-grid">'+
      f('Fecha','date','14/08/2026')+f('Hora','time','16:00')+f('Zona horaria','tz','GMT-3')+
      '<div class="field-mini"><label>Tipo de reunión</label><input data-ns="meetingType" value="'+escapeHtml(ns.meetingType||'Cita de estrategia')+'"></div>'+
      f('Participantes','participants','Carlos, Laura, Diego')+f('Objetivo','objective','Revisar la estrategia')+
    '</div>'+
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn ghost sm" onclick="closeModal()">Cancelar</button><button class="btn" onclick="confirmSchedule()">Confirmar</button></div>');
  document.querySelectorAll('[data-ns]').forEach(inp=>inp.addEventListener('keydown',e=>e.stopPropagation()));
}
function confirmSchedule(){const data={scheduled:true,source:'calendly'};
  document.querySelectorAll('[data-ns]').forEach(inp=>data[inp.dataset.ns]=inp.value);
  updateNextStep(data);closeModal();toast('Próxima cita registrada');}

/* ================================================================
   REFERIDOS
   ================================================================ */
function readReferralRows(){const rows=[];document.querySelectorAll('[data-refrow]').forEach(row=>{
  const name=row.querySelector('[data-reffield="name"]').value.trim();
  const cc=row.querySelector('[data-reffield="cc"]').value.trim();
  const phone=row.querySelector('[data-reffield="phone"]').value.trim();
  if(name||phone)rows.push({name,cc,phone});});
  return rows;}
function persistReferrals(){SE().referrals=readReferralRows();SE().updatedAt=Date.now();scheduleSave();}
function addReferralRow(){persistReferrals();const s=activeSlides()[i]||T().slides.find(x=>x.id===currentEditId);const min=(s&&s.minRows)||5;
  // rellenar hasta el mínimo visible antes de crecer por encima
  while(SE().referrals.length<min)SE().referrals.push({name:'',cc:'',phone:''});
  SE().referrals.push({name:'',cc:'',phone:''});build();
  if(document.body.classList.contains('present'))render();else showEditSlide();
  setTimeout(()=>{const rows=document.querySelectorAll('[data-refrow]');const last=rows[rows.length-1];last&&last.querySelector('.ref-name').focus();},0);}
function removeReferral(n){persistReferrals();SE().referrals.splice(n,1);build();
  if(document.body.classList.contains('present'))render();else showEditSlide();}
function wireReferralRows(){document.querySelectorAll('[data-reffield]').forEach(inp=>{
  inp.addEventListener('keydown',e=>e.stopPropagation());
  inp.addEventListener('input',()=>{persistReferrals();});});}
function validPhone(r){return (r.phone||'').replace(/\\D/g,'').length>=8;}
function sendReferrals(){persistReferrals();
  const valid=SE().referrals.filter(r=>r.name&&validPhone(r));
  if(!valid.length){toast('Agregá al menos un nombre y WhatsApp válido');return;}
  SE().referrals.forEach(r=>{if(r.name&&validPhone(r))r.status='pending';});
  scheduleSave();
  openModal('<button class="modal-x" onclick="closeModal()">×</button>'+
    '<div class="pm-check">✓ '+valid.length+' referido'+(valid.length>1?'s':'')+' guardado'+(valid.length>1?'s':'')+'</div>'+
    '<p style="font-size:14px;color:var(--gl-text2);margin:10px 0 16px">Quedaron registrados en esta reunión. Podés exportarlos al finalizar la cita.</p>'+
    '<div class="ref-review">'+valid.map(r=>'<div class="ref-review-row"><b>'+escapeHtml(r.name)+'</b><span>'+escapeHtml((r.cc||'')+' '+(r.phone||''))+'</span></div>').join('')+'</div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn ghost sm" onclick="exportReferrals()">Exportar referidos</button><button class="btn" onclick="closeModal()">Listo</button></div>');
  toast('Referidos guardados');}
function copyReferralMessage(btn){const s=activeSlides()[i];const msg=interpolate((s&&s.messageTemplate)||'');
  const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('Mensaje copiado');}catch(e){toast('No se pudo copiar');}
  document.body.removeChild(ta);if(btn){const t=btn.textContent;btn.textContent='Copiado ✓';setTimeout(()=>btn.textContent=t,1500);}}
function exportReferrals(){const refs=(SE().referrals||[]).filter(r=>r.name||r.phone);
  if(!refs.length){toast('No hay referidos para exportar');return;}
  const head='Nombre,Código,WhatsApp,Estado';
  const csv=[head].concat(refs.map(r=>[r.name,r.cc,r.phone,r.status||'pending'].map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(','))).join('\\n');
  download(csv,'referidos-'+(SE().prospect.firstName||'cita').toLowerCase().replace(/\\s+/g,'-')+'.csv');
  toast('Referidos exportados (CSV)');}

function nextStepView(){const ns=SE().nextStep||{};  const fecha=[ns.date,ns.time].filter(Boolean).join(' · ')||'';
  const rows=[['Próxima cita',fecha],['Participan',ns.participants],['Vamos a revisar',ns.objective],['Antes de la cita',ns.docs],['Compromiso del asesor',ns.advisorCommit],['Compromiso del prospecto',ns.prospectCommit]];
  return '<div class="nextstep-grid">'+rows.map(r=>'<div class="ns-row"><div class="k">'+r[0]+'</div><div class="v">'+escapeHtml(r[1]||'')+'</div></div>').join('')+'</div>';}
/* ================================================================
   ENGINE presentación
   ================================================================ */
let i=0,slides=[];
const deck=document.getElementById('deck'),bar=document.getElementById('bar');
const count=document.getElementById('count'),prevBtn=document.getElementById('prev'),nextBtn=document.getElementById('next');
function build(){migrateAllCovers();slides=activeSlides();
  deck.innerHTML=slides.map(s=>'<section class="slide" data-id="'+s.id+'">'+slideHTML(s)+'</section>').join('');
  wireInteractions();hydrate();if(EDITING())wireInlineEditing();calWatchFallback();}
function render(){[...deck.children].forEach((el,n)=>el.classList.toggle('active',n===i));
  const total=slides.length||1;if(bar){bar.style.width=((i+1)/total*100)+'%';
  bar.style.display=T().settings.showProgress===false?'none':'';}
  count.innerHTML='<b>'+String(i+1).padStart(2,'0')+'</b> / '+total;
  prevBtn.disabled=i===0;nextBtn.disabled=i===total-1;
  const cur=slides[i];if(cur&&cur.type==='summary')fillSummary(cur);
  renderStages();
  if(!EDITING()){SE().progress=i;scheduleSave();}}
function goTo(n){i=Math.max(0,Math.min(slides.length-1,n));render();}
function next(){goTo(i+1);}function prev(){goTo(i-1);}function restart(){goTo(0);}
function setResponse(id,val){SE().responses[id]=val;mirrorDiagnosis(id,val);if(SE().status==='No iniciada')SE().status='En progreso';scheduleSave();}
function setNamedResponse(key,val){const R=SE().responses;
  if(key==='requiredAmount')R.requiredAmount=val;
  else if(key==='startingAmount')R.startingAmount=val;
  else if(key==='feedbackMostUseful'){SE().feedback=SE().feedback||{};SE().feedback.mostUseful=val;}
  else if(key==='feedbackValue'){SE().feedback=SE().feedback||{};SE().feedback.perceivedValue=val;}
  scheduleSave();}
function dmField(label,key){return '<div class="field-mini"><label>'+label+'</label><input data-dmf="'+key+'" type="text"></div>';}
function wireInteractions(){
  if(EDITING())return;
  deck.querySelectorAll('[data-action="next"]').forEach(b=>b.onclick=next);
  deck.querySelectorAll('[data-action="restart"]').forEach(b=>b.onclick=restart);
  deck.querySelectorAll('textarea[data-response],input[data-response]').forEach(el=>{
    el.addEventListener('keydown',e=>e.stopPropagation());
    el.addEventListener('input',()=>{setResponse(el.dataset.response,el.value);
      const rk=el.dataset.rkey;if(rk)setNamedResponse(rk,el.value);});});
  // criterios de decisión — session.decisionCriteria
  deck.querySelectorAll('.crit-in').forEach(inp=>{const idx=+inp.dataset.crit;
    inp.value=(SE().decisionCriteria&&SE().decisionCriteria[idx])||'';
    inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{SE().decisionCriteria=SE().decisionCriteria||["","",""];SE().decisionCriteria[idx]=inp.value;scheduleSave();});});
  // decisores — session.decisionMakers
  deck.querySelectorAll('.opt[data-dmopt]').forEach(o=>{o.onclick=()=>{
    o.parentElement.querySelectorAll('.opt').forEach(x=>x.classList.remove('sel'));o.classList.add('sel');
    const val=o.dataset.dmopt;const box=deck.querySelector('#dmExtra');
    SE().decisionMakers=[{type:val}];
    if(val==='otro'&&box){box.innerHTML='<div class="prop-group"><div class="gh">Datos de la otra persona</div>'+
      dmField('Nombre','name')+dmField('Relación','relation')+dmField('Email','email')+dmField('WhatsApp','whatsapp')+dmField('Disponibilidad','availability')+
      '<label class="chip-toggle"><input type="checkbox" id="dmMust"> Debe participar en la siguiente cita</label></div>';
      box.querySelectorAll('[data-dmf]').forEach(f=>f.addEventListener('input',()=>{SE().decisionMakers[0][f.dataset.dmf]=f.value;scheduleSave();}));
      const mk=box.querySelector('#dmMust');if(mk)mk.addEventListener('change',()=>{SE().decisionMakers[0].mustAttend=mk.checked;scheduleSave();});
    }else if(box){box.innerHTML='';}
    scheduleSave();};});
  // feedback — stars
  deck.querySelectorAll('[data-stars] .st').forEach(star=>{star.onclick=()=>{
    const n=+star.dataset.star;SE().feedback=SE().feedback||{};SE().feedback.rating=n;
    star.parentElement.querySelectorAll('.st').forEach((x,k)=>x.classList.toggle('on',k<n));scheduleSave();};});
  deck.querySelectorAll('.choice[data-response]').forEach(c=>{c.onclick=()=>{
    c.parentElement.querySelectorAll('.choice').forEach(x=>x.classList.remove('sel'));
    c.classList.add('sel');setResponse(c.dataset.response,c.dataset.choice);setTimeout(next,220);};});
  deck.querySelectorAll('.opt[data-response]').forEach(o=>{o.onclick=()=>{
    o.parentElement.querySelectorAll('.opt').forEach(x=>x.classList.remove('sel'));
    o.classList.add('sel');setResponse(o.dataset.response,o.dataset.option);};});
  deck.querySelectorAll('[data-ranking]').forEach(list=>setupRanking(list));
  if(deck.querySelector('[data-refrows]'))wireReferralRows();}
function setupRanking(list){let dragEl=null;const rid2=list.dataset.ranking;
  const refresh=()=>{[...list.children].forEach((li,n)=>li.querySelector('.rank').textContent=n+1);
    setResponse(rid2,[...list.children].map(li=>li.querySelector('.lbl').textContent));};
  list.addEventListener('dragstart',e=>{dragEl=e.target.closest('li');dragEl.classList.add('drag');});
  list.addEventListener('dragend',()=>{dragEl&&dragEl.classList.remove('drag');[...list.children].forEach(li=>li.classList.remove('over'));refresh();});
  list.addEventListener('dragover',e=>{e.preventDefault();const li=e.target.closest('li');if(!li||li===dragEl)return;
    [...list.children].forEach(x=>x.classList.remove('over'));li.classList.add('over');
    const r=li.getBoundingClientRect();const after=(e.clientY-r.top)/r.height>.5;list.insertBefore(dragEl,after?li.nextSibling:li);});}
function hydrate(){const R=SE().responses;
  deck.querySelectorAll('textarea[data-response],input[data-response]').forEach(el=>{if(R[el.dataset.response]!=null)el.value=R[el.dataset.response];});
  deck.querySelectorAll('.choice[data-response]').forEach(c=>{if(R[c.dataset.response]===c.dataset.choice)c.classList.add('sel');});
  deck.querySelectorAll('.opt[data-response]').forEach(o=>{if(R[o.dataset.response]===o.dataset.option)o.classList.add('sel');});
  const dm=(SE().decisionMakers&&SE().decisionMakers[0])?SE().decisionMakers[0].type:null;
  if(dm)deck.querySelectorAll('.opt[data-dmopt]').forEach(o=>{if(o.dataset.dmopt===dm)o.classList.add('sel');});
  const rate=SE().feedback&&SE().feedback.rating;
  if(rate)deck.querySelectorAll('[data-stars] .st').forEach((x,k)=>x.classList.toggle('on',k<rate));}
function fillSummary(s){(s.sourceSlides||[]).forEach(sid=>{const cell=deck.querySelector('[data-echo="'+sid+'"]');
  if(cell){const v=SE().responses[sid];cell.textContent=Array.isArray(v)?v[0]:(v||'');}});}
document.addEventListener('keydown',e=>{
  if(EDITING()){
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();History.undo();}
    else if(mod&&(e.key.toLowerCase()==='y'||(e.key.toLowerCase()==='z'&&e.shiftKey))){e.preventDefault();History.redo();}
    return;}
  if(T().settings.allowKeyboard===false)return;
  if(['ArrowRight',' '].includes(e.key)){e.preventDefault();next();}
  else if(e.key==='ArrowLeft')prev();else if(e.key==='Home')goTo(0);else if(e.key==='End')goTo(slides.length-1);});
let sx=null;document.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
document.addEventListener('touchend',e=>{if(sx===null||EDITING())return;const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>60){dx<0?next():prev();}sx=null;},{passive:true});
nextBtn.onclick=next;prevBtn.onclick=prev;

/* ================================================================
   HISTORY — deshacer / rehacer
   ================================================================ */
const History={
  stack:[], ptr:-1, limit:50, lastPushType:null, lastPushAt:0,
  snapshot(){return JSON.stringify({template:meetingProject.template,theme:meetingProject.theme,brand:meetingProject.brand});},
  push(type){ const now=Date.now();
    if(type&&type===this.lastPushType&&type.indexOf('text')===0&&(now-this.lastPushAt)<900){this.lastPushAt=now;this.stack[this.ptr]=this.snapshot();return;}
    this.stack=this.stack.slice(0,this.ptr+1);
    this.stack.push(this.snapshot());
    if(this.stack.length>this.limit)this.stack.shift();
    this.ptr=this.stack.length-1;this.lastPushType=type;this.lastPushAt=now;this.updateButtons();},
  apply(snap){ const s=JSON.parse(snap);
    meetingProject.template=s.template;meetingProject.theme=s.theme;meetingProject.brand=s.brand;
    applyTheme();renderSlideList();build();showEditSlide();renderProps();
    document.getElementById('tbName').textContent=T().name;markDirty();},
  undo(){ if(this.ptr<=0){toast('Nada para deshacer');return;} this.ptr--;this.apply(this.stack[this.ptr]);this.updateButtons();toast('Deshecho');},
  redo(){ if(this.ptr>=this.stack.length-1){toast('Nada para rehacer');return;} this.ptr++;this.apply(this.stack[this.ptr]);this.updateButtons();toast('Rehecho');},
  reset(){this.stack=[this.snapshot()];this.ptr=0;this.updateButtons();},
  updateButtons(){const u=document.getElementById('undoBtn'),r=document.getElementById('redoBtn');
    if(u)u.disabled=this.ptr<=0;if(r)r.disabled=this.ptr>=this.stack.length-1;}
};

/* ================================================================
   AUTOGUARDADO visible
   ================================================================ */
let saveTimer=null,dirty=false;
function setSaveState(state,label){const el=document.getElementById('saveState');
  el.className='save-state '+state;document.getElementById('saveLabel').textContent=label;}
function markDirty(){dirty=true;setSaveState('dirty','Cambios sin guardar');scheduleSave();}
function scheduleSave(){clearTimeout(saveTimer);setSaveState('saving','Guardando…');
  saveTimer=setTimeout(doSave,700);}
function doSave(){
  const usage=Store.estimateUsage();
  const res=Store.saveProject();
  if(res===true){dirty=false;const t=new Date();setSaveState('saved','Guardado '+t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    if(usage>4.5e6)toast('⚠ Almacenamiento casi lleno. Exportá y liberá espacio.');}
  else if(res==='quota'){setSaveState('error','Almacenamiento lleno');toast('⚠ No se pudo guardar: almacenamiento lleno. Exportá el proyecto.');}
  else{setSaveState('error','Error al guardar');}
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
function confirmIfDirty(msg){ if(!dirty)return true; return confirm((msg||'Tenés cambios sin guardar.')+'\\n\\n¿Continuar de todos modos? (Aceptar = descartar cambios no guardados)'); }
/* ================================================================
   MODOS
   ================================================================ */
function setMode(mode){
  document.body.classList.remove('home');
  document.body.classList.toggle('edit',mode==='edit');
  document.body.classList.toggle('present',mode==='present');
  document.getElementById('segEdit').classList.toggle('on',mode==='edit');
  document.getElementById('segPlay').classList.toggle('on',mode==='present');
  closeMore();
  build();
  if(mode==='edit'){renderSlideList();selectSlide(currentEditId||(slides[0]&&slides[0].id));showEditSlide();}
  else{i=Math.min(SE().progress||0,slides.length-1);render();}
  renderStages();
}
let currentEditId=null;
function showEditSlide(){const idx=slides.findIndex(s=>s.id===currentEditId);if(idx>=0){i=idx;render();}}

/* progreso por etapas (según la sección de la slide activa) */
function renderStages(){const box=document.getElementById('stageProgress');if(!box)return;
  const cur=slides[i];const curSec=cur&&cur.section;
  const present=STAGE_ORDER.filter(sec=>slides.some(s=>s.section===sec));
  if(T().settings.showStages===false||!present.length){box.innerHTML='';return;}
  const curIdx=present.indexOf(curSec);
  box.innerHTML=present.map((sec,n)=>{
    const cls=n===curIdx?'active':(n<curIdx?'done':'');
    return '<span class="stage-chip '+cls+'">'+escapeHtml(sec)+'</span>'+(n<present.length-1?'<span class="stage-arrow">›</span>':'');
  }).join('');}

function renderSlideList(){const list=document.getElementById('slideList');
  let html='';let lastSec=null;
  T().slides.forEach((s,n)=>{
    const sec=s.section||'General';
    if(sec!==lastSec){html+='<div class="sec-head"><span class="sec-dot"></span>'+escapeHtml(sec)+'</div>';lastSec=sec;}
    html+='<div class="slide-item '+(s.id===currentEditId?'sel':'')+' '+(s.enabled===false?'off':'')+'" data-id="'+s.id+'" draggable="true">'+
      '<div class="num">'+(n+1)+'</div>'+
      '<div class="info"><div class="nm">'+escapeHtml(s.internalName||s.id)+'</div><div class="tp">'+(TYPE_LABELS[s.type]||s.type)+'</div></div>'+
      '<div class="acts">'+
        '<button class="mini" title="'+(s.enabled===false?'Activar':'Ocultar')+'" onclick="event.stopPropagation();toggleSlide(\\''+s.id+'\\')">'+(s.enabled===false?'○':'●')+'</button>'+
        '<button class="mini" title="Duplicar" onclick="event.stopPropagation();duplicateSlide(\\''+s.id+'\\')">⧉</button>'+
        '<button class="mini del" title="Eliminar" onclick="event.stopPropagation();deleteSlide(\\''+s.id+'\\')">✕</button>'+
      '</div></div>';});
  list.innerHTML=html;
  list.querySelectorAll('.slide-item').forEach(el=>el.addEventListener('click',()=>{selectSlide(el.dataset.id);showEditSlide();}));
  setupSlideDrag(list);}
function setupSlideDrag(list){let dragEl=null;
  list.querySelectorAll('.slide-item').forEach(it=>{
    it.addEventListener('dragstart',()=>{dragEl=it;it.classList.add('drag');});
    it.addEventListener('dragend',()=>{it.classList.remove('drag');list.querySelectorAll('.slide-item').forEach(x=>x.classList.remove('over'));commitSlideOrder(list);});
    it.addEventListener('dragover',e=>{e.preventDefault();if(!dragEl||it===dragEl)return;
      list.querySelectorAll('.slide-item').forEach(x=>x.classList.remove('over'));it.classList.add('over');
      const r=it.getBoundingClientRect();const after=(e.clientY-r.top)/r.height>.5;list.insertBefore(dragEl,after?it.nextSibling:it);});});}
function commitSlideOrder(list){const order=[...list.querySelectorAll('.slide-item')].map(el=>el.dataset.id);
  T().slides.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  History.push('reorder');renderSlideList();build();showEditSlide();markDirty();}
function selectSlide(id){currentEditId=id;renderSlideList();renderProps();}
function uid(p){return p+'-'+rid();}
function toggleSlide(id){const s=T().slides.find(x=>x.id===id);s.enabled=s.enabled===false;History.push('toggle');renderSlideList();build();showEditSlide();markDirty();toast(s.enabled===false?'Diapositiva oculta':'Diapositiva activada');}
function duplicateSlide(id){const idx=T().slides.findIndex(x=>x.id===id);
  const copy=JSON.parse(JSON.stringify(T().slides[idx]));copy.id=uid(copy.type);copy.internalName=(copy.internalName||copy.type)+' (copia)';
  T().slides.splice(idx+1,0,copy);History.push('duplicate');selectSlide(copy.id);build();showEditSlide();markDirty();toast('Diapositiva duplicada');}
function deleteSlide(id){if(T().slides.length<=1){toast('No podés eliminar la última');return;}
  if(!confirm('¿Eliminar esta diapositiva?\\n(Podés recuperarla con Deshacer)'))return;
  const idx=T().slides.findIndex(x=>x.id===id);T().slides.splice(idx,1);
  History.push('delete');currentEditId=T().slides[Math.max(0,idx-1)].id;renderSlideList();build();showEditSlide();renderProps();markDirty();toast('Eliminada — Ctrl+Z para recuperar');}

const TYPE_LABELS={cover:'Portada',statement:'Texto',textQuestion:'Pregunta',money:'Monto',twostep:'Dos pasos',choice2:'Dos opciones',options:'Varias opciones',ranking:'Ranking',stat:'Estadística',list:'Lista',summary:'Resumen',media:'Imagen',embed:'Video/Embed',criteria:'Criterios',decisionMakers:'Decisores',nextStep:'Próximo paso',feedback:'Valoración',calendly:'Agenda / Calendly',referralCapture:'Captura de referidos',referralMessage:'Mensaje WhatsApp',recapValue:'Recap + Valoración',referralOffer:'Oferta de regalo',resourceGrid:'Grilla de recursos'};
const TYPE_ICONS={cover:'★',statement:'¶',textQuestion:'?',money:'$',twostep:'⇉',choice2:'⚖',options:'☰',ranking:'≡',stat:'#',list:'⁘',summary:'✎',media:'▢',embed:'▷',criteria:'☑',decisionMakers:'☺',nextStep:'➤',feedback:'★',calendly:'📅',referralCapture:'👥',referralMessage:'💬',recapValue:'✨',referralOffer:'🎁',resourceGrid:'🖼'};
function blockTemplate(type){const base={id:uid(type),type,enabled:true,internalName:TYPE_LABELS[type],title:'Nuevo título',buttonText:'Continuar'};
  const ext={cover:{kicker:'Etiqueta',subtitle:'Subtítulo',badges:['Etiqueta 1'],prospectLine:{enabled:true,prefix:'Preparada para',showProspectName:true,suffix:'',anonymousText:'Preparada especialmente para ti'},buttonText:'Comenzar →'},
    statement:{kicker:'Etiqueta',body:'Texto explicativo.'},textQuestion:{kicker:'',placeholder:'Escribir respuesta…'},
    money:{body:'Texto de apoyo.',placeholder:'0'},twostep:{stepA:{when:'Hoy',title:'Paso A',desc:'Descripción'},stepB:{when:'Luego',title:'Paso B',desc:'Descripción'}},
    choice2:{optionA:{k:'A',text:'Primera opción'},optionB:{k:'B',text:'Segunda opción'}},
    options:{items:[{id:uid('o'),label:'Opción 1'},{id:uid('o'),label:'Opción 2'}]},
    ranking:{items:[{id:uid('p'),label:'Prioridad 1'},{id:uid('p'),label:'Prioridad 2'},{id:uid('p'),label:'Prioridad 3'}]},
    stat:{statValue:'100+',statCaption:'descripción del número.'},list:{items:[{label:'Elemento 1'},{label:'Elemento 2'}]},
    summary:{sourceSlides:[],labels:[]},media:{media:{src:'',alt:''}},embed:{embedUrl:''},
    calendly:{section:'Próximo paso',internalName:'Agendar próxima cita',kicker:'Próximo paso',title:'Agendemos nuestra <em>próxima conversación</em>',subtitle:'Elegí el horario que mejor te funcione.',calendlyUrl:'',source:'brand',showFallbackButton:true,fallbackButtonText:'Abrir agenda en otra pestaña ↗',confirmationEnabled:true,confirmationButtonText:'Cita agendada ✓'},
    referralCapture:{section:'Referidos',internalName:'Captura de referidos',kicker:'Bonificación adicional',title:'Al pensar en ellos, <em>idealmente que sean…</em>',criteria:['<strong>Profesionales entre 25–45 años</strong> que les vaya bien en estos momentos','Alguien a quien admires financieramente'],listTitle:'Personas a las que quieres ayudar ❤️',listSubtitle:'Pueden ser colegas, compañeros de trabajo y/o familia.',minRows:5,defaultCC:'+52',buttonText:'Enviar regalo'},
    referralMessage:{section:'Referidos',internalName:'Mensaje de WhatsApp',kicker:'Para activar tus regalos',title:'El despacho nos pide que les mandes <em>este mensaje</em> antes de cerrar.',messageTemplate:'¡Hola! Espero estés muy bien.\\n\\nHace un rato tuve una plática con {{advisor.name}}, asesor financiero y patrimonial, y me gustó mucho cómo trabaja. Tengo una sesión para regalar y te elegí a ti.\\n\\nPensé que también te podría servir para revisar opciones de protección para tus finanzas (salud, retiro, ahorro…). La sesión incluye varios regalos interesantes.\\n\\nEn estos días te va a escribir para ver si te sirve.',buttonText:'Continuar'},
    recapValue:{section:'Valoración',internalName:'Lo que trabajamos hoy',title:'Lo que <em>trabajamos hoy</em>',bullets:['Entender tu situación financiera actual','Darte claridad sobre cómo ayudarte'],valueNote:'En mi despacho, esta asesoría normalmente tiene un valor, pero en este caso fue un <strong>regalo</strong>.',opinionTitle:'Me gustaría conocer tu opinión…',question1:'De todo lo que revisamos hoy: ¿qué fue lo que <em>más te sirvió</em> concretamente?',question2:'Y con base en tu experiencia: ¿qué hace que esta asesoría <em>tenga valor para ti</em>?',showMedia:true,media:{src:''},buttonText:'Continuar'},
    referralOffer:{section:'Referidos',internalName:'Oferta de regalo',kicker:'Un regalo para compartir',title:'Como te fue útil, quiero darte la posibilidad de regalársela a <em>5 colegas</em> cercanos para que también puedan tener esta claridad.',steps:['Solo necesito sus WhatsApps','Tú les avisas hoy y yo los contacto al día siguiente','Y si alguno no quiere, no pasa absolutamente nada'],valueLead:'Por compartírmelos, mi despacho me permite <strong>REGALARTE</strong> nuestra',valueHighlight:'Inteligencia Artificial',valueBadge:'Valor habitual —',showResource:true,resource:{src:'',tag:'DIAGNÓSTICO FINANCIERO',title:'¿Sabes realmente dónde estás parado?',sub:'2 minutos · Sin registro · Sin trampa'},buttonText:'Me interesa'},
    resourceGrid:{section:'Referidos',internalName:'Grilla de recursos',kicker:'Bonificación adicional',title:'Además, por compartírmelos <em>en esta llamada</em>, me autorizan a sumarte 3 recursos más que normalmente comercializamos.',cards:[{src:'',title:''},{src:'',title:''},{src:'',title:''}],note:'Valor total del regalo: todo esto, simplemente por ayudar a colegas que aprecies.',buttonText:'Continuar'}}[type]||{};
  const b=Object.assign(base,ext);
  if(type==='calendly')delete b.buttonText; // el bloque tiene su propio flujo
  return b;}
function openAddSlide(){const grid=Object.keys(TYPE_LABELS).map(t=>'<div class="type-card" onclick="addSlide(\\''+t+'\\')"><div class="ti">'+TYPE_ICONS[t]+'</div><div class="tn">'+TYPE_LABELS[t]+'</div></div>').join('');
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Agregar diapositiva</h3><div class="type-grid">'+grid+'</div>');}
function addSlide(type){const idx=T().slides.findIndex(x=>x.id===currentEditId);const block=blockTemplate(type);
  T().slides.splice(idx<0?T().slides.length:idx+1,0,block);History.push('add');closeModal();selectSlide(block.id);build();showEditSlide();markDirty();toast('Diapositiva agregada');}

function wireInlineEditing(){deck.querySelectorAll('[data-edit]').forEach(el=>el.addEventListener('dblclick',e=>{e.preventDefault();startInline(el);}));}
function startInline(el){el.classList.add('editing');el.setAttribute('contenteditable','true');
  const field=el.dataset.edit,sid=el.dataset.sid,s=T().slides.find(x=>x.id===sid);
  el.textContent=getField(s,field);el.focus();document.getSelection().selectAllChildren(el);
  const finish=()=>{el.removeAttribute('contenteditable');el.classList.remove('editing');
    setField(s,field,sanitizeText(el.textContent.trim()));History.push('text-'+sid+'-'+field);
    build();showEditSlide();renderProps();markDirty();el.removeEventListener('blur',finish);};
  el.addEventListener('blur',finish);
  el.addEventListener('keydown',ev=>{ev.stopPropagation();
    if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();el.blur();}
    if(ev.key==='Escape'){el.textContent=getField(s,field);el.blur();}});}
function getField(s,field){if(field.indexOf('badge:')===0)return (s.badges||[])[+field.split(':')[1]]||'';if(field.indexOf('crit:')===0)return (s.criteria||[])[+field.split(':')[1]]||'';if(field.indexOf('bullet:')===0)return (s.bullets||[])[+field.split(':')[1]]||'';if(field.indexOf('step:')===0)return (s.steps||[])[+field.split(':')[1]]||'';return s[field]!=null?s[field]:'';}
function setField(s,field,val){if(field.indexOf('badge:')===0){s.badges[+field.split(':')[1]]=val;return;}if(field.indexOf('crit:')===0){s.criteria[+field.split(':')[1]]=val;return;}if(field.indexOf('bullet:')===0){s.bullets[+field.split(':')[1]]=val;return;}if(field.indexOf('step:')===0){s.steps[+field.split(':')[1]]=val;return;}s[field]=val;}
/* ================================================================
   PANEL DE PROPIEDADES
   ================================================================ */
function renderProps(){const panel=document.getElementById('propPanel');const s=T().slides.find(x=>x.id===currentEditId);
  if(!s){panel.innerHTML='<div class="prop-empty">Seleccioná una diapositiva</div>';return;}
  let html='';html+=field('Nombre interno','internalName',s.internalName||'','text');
  html+='<div class="prop"><label>Tipo de bloque</label><input value="'+(TYPE_LABELS[s.type]||s.type)+'" disabled></div>';
  html+='<div class="prop"><div class="chip-toggle"><div class="switch '+(s.enabled!==false?'on':'')+'" onclick="propToggle(\\'enabled\\')"><i></i></div> Visible en la presentación</div></div>';
  html+='<div class="prop"><label>Sección de la reunión</label><select data-section>'+MEETING_SECTIONS.map(sec=>'<option '+((s.section||'General')===sec?'selected':'')+'>'+sec+'</option>').join('')+'</select></div>';
  html+='<div class="prop-group"><div class="gh">Contenido</div>';
  if('kicker' in s)html+=field('Etiqueta (kicker)','kicker',s.kicker||'','text');
  if('lead' in s)html+=field('Línea previa','lead',s.lead||'','text');
  if('title' in s)html+=field('Título','title',s.title||'','area');
  if('subtitle' in s)html+=field('Subtítulo','subtitle',s.subtitle||'','area');
  if('body' in s)html+=field('Texto','body',s.body||'','area');
  if('placeholder' in s)html+=field('Placeholder','placeholder',s.placeholder||'','text');
  if('statValue' in s)html+=field('Número','statValue',s.statValue||'','text');
  if('statCaption' in s)html+=field('Descripción del número','statCaption',s.statCaption||'','area');
  if('buttonText' in s)html+=field('Texto del botón','buttonText',s.buttonText||'','text');
  if('embedUrl' in s)html+=field('URL del embed','embedUrl',s.embedUrl||'','text');
  html+='</div>';
  if(s.type==='choice2'){html+='<div class="prop-group"><div class="gh">Opciones</div>'+field('Opción A · letra','optionA.k',s.optionA.k,'text')+field('Opción A · texto','optionA.text',s.optionA.text,'area')+field('Opción B · letra','optionB.k',s.optionB.k,'text')+field('Opción B · texto','optionB.text',s.optionB.text,'area')+'</div>';}
  if(s.type==='twostep'){html+='<div class="prop-group"><div class="gh">Pasos</div>'+field('Paso A · cuándo','stepA.when',s.stepA.when,'text')+field('Paso A · título','stepA.title',s.stepA.title,'text')+field('Paso A · desc','stepA.desc',s.stepA.desc,'text')+field('Paso B · cuándo','stepB.when',s.stepB.when,'text')+field('Paso B · título','stepB.title',s.stepB.title,'text')+field('Paso B · desc','stepB.desc',s.stepB.desc,'text')+'</div>';}
  if(s.type==='ranking'||s.type==='options'||s.type==='list')html+=listEditor(s);
  if(s.type==='cover'){ migrateCover(s); html+=prospectLineEditor(s); }
  if(s.type==='cover'&&s.badges)html+=badgeEditor(s);
  if(s.type==='summary')html+=summaryEditor(s);
  if(s.type==='calendly')html+=calendlyEditor(s);
  if(s.type==='referralCapture')html+=referralCaptureEditor(s);
  if(s.type==='referralMessage')html+=field('Mensaje de WhatsApp','messageTemplate',s.messageTemplate||'','area');
  if(s.type==='recapValue')html+=recapValueEditor(s);
  if(s.type==='referralOffer')html+=referralOfferEditor(s);
  if(s.type==='resourceGrid')html+=resourceGridEditor(s);
  panel.innerHTML=html;
  const roFile=panel.querySelector('#rgfile-ro');
  if(roFile)roFile.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const s=T().slides.find(x=>x.id===currentEditId);
    const rd=new FileReader();rd.onload=()=>compressImage(rd.result,f,(data)=>{s.resource=s.resource||{};s.resource.src=data;History.push('ro-img');renderProps();build();showEditSlide();markDirty();});rd.readAsDataURL(f);});
  const recapFile=panel.querySelector('#rgfile-recap');
  if(recapFile)recapFile.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const s=T().slides.find(x=>x.id===currentEditId);
    const rd=new FileReader();rd.onload=()=>compressImage(rd.result,f,(data)=>{s.media=s.media||{};s.media.src=data;History.push('recap-img');renderProps();build();showEditSlide();markDirty();});rd.readAsDataURL(f);});
  panel.querySelectorAll('[data-prop]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{setProp(inp.dataset.prop,inp.value);});});
  const secSel=panel.querySelector('[data-section]');
  if(secSel)secSel.addEventListener('change',()=>{const s2=T().slides.find(x=>x.id===currentEditId);s2.section=secSel.value;History.push('section');renderSlideList();renderStages();markDirty();});
  wireProspectLineEditor();
  panel.querySelectorAll('[data-cal]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{const s=T().slides.find(x=>x.id===currentEditId);s[inp.dataset.cal]=inp.value;History.push('text-cal');build();showEditSlide();markDirty();});});}
function prospectLineEditor(s){const pl=s.prospectLine||{};const nm=safeName();
  const preview = pl.showProspectName ? (nm?(escapeHtml(pl.prefix||'')+' '+nm+(pl.suffix?' '+escapeHtml(pl.suffix):'')):escapeHtml(pl.anonymousText||'Preparada especialmente para ti')) : escapeHtml(pl.prefix||'');
  return '<div class="prop-group"><div class="gh">Personalización del prospecto</div>'+
    (pl.fixedWarning?'<div class="pl-warn">Esta portada contenía un texto fijo. ¿Vincularla al nombre del prospecto?<div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" onclick="linkProspect(true)">Vincular nombre</button><button class="btn ghost sm" onclick="linkProspect(false)">Mantener fijo</button></div></div>':'')+
    '<div class="chip-toggle" style="margin-bottom:10px"><div class="switch '+(pl.showProspectName?'on':'')+'" onclick="togglePL()"><i></i></div> Mostrar nombre del prospecto</div>'+
    '<div class="prop"><label>Texto previo</label><input data-pl="prefix" value="'+String(pl.prefix||'').replace(/"/g,'&quot;')+'"></div>'+
    (pl.showProspectName?'<div class="prop"><label>Dato dinámico</label><div class="pl-chip">Nombre del prospecto →</div></div>'+
      '<div class="prop"><label>Texto posterior (opcional)</label><input data-pl="suffix" value="'+String(pl.suffix||'').replace(/"/g,'&quot;')+'"></div>'+
      '<div class="prop"><label>Texto sin nombre</label><input data-pl="anonymousText" value="'+String(pl.anonymousText||'').replace(/"/g,'&quot;')+'"></div>':'')+
    '<div class="prop"><label>Vista previa</label><div class="pl-preview">'+(preview||'—')+'</div></div></div>';}
function wireProspectLineEditor(){document.querySelectorAll('[data-pl]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
  inp.addEventListener('input',()=>{const s=T().slides.find(x=>x.id===currentEditId);s.prospectLine=s.prospectLine||{};s.prospectLine[inp.dataset.pl]=inp.value;History.push('text-pl');build();showEditSlide();markDirty();
    const pv=document.querySelector('.pl-preview');if(pv){const pl=s.prospectLine,nm=safeName();pv.textContent=pl.showProspectName?(nm?((pl.prefix||'')+' '+nm+(pl.suffix?' '+pl.suffix:'')):(pl.anonymousText||'')):(pl.prefix||'');}});});}
function togglePL(){const s=T().slides.find(x=>x.id===currentEditId);s.prospectLine=s.prospectLine||{};s.prospectLine.showProspectName=!s.prospectLine.showProspectName;s.prospectLine.enabled=true;delete s.prospectLine.fixedWarning;History.push('pl-toggle');renderProps();build();showEditSlide();markDirty();}
function linkProspect(link){const s=T().slides.find(x=>x.id===currentEditId);s.prospectLine=s.prospectLine||{};
  if(link){s.prospectLine.showProspectName=true;s.prospectLine.prefix=s.prospectLine.prefix||'Preparada para';}
  delete s.prospectLine.fixedWarning;History.push('pl-link');renderProps();build();showEditSlide();markDirty();
  toast(link?'Portada vinculada al nombre del prospecto':'Se mantiene el texto fijo');}
function field(label,prop,val,kind){const esc=String(val).replace(/"/g,'&quot;');
  const dyn=['title','subtitle','body','lead','kicker','statCaption','buttonText'].includes(prop);
  const btn=dyn?'<button type="button" class="dyn-btn" onclick="openDynMenu(this,\\''+prop+'\\')" title="Insertar dato dinámico">+ dato</button>':'';
  const head='<div class="prop-label-row"><label>'+label+'</label>'+btn+'</div>';
  if(kind==='area')return '<div class="prop">'+head+'<textarea data-prop="'+prop+'">'+String(val).replace(/</g,'&lt;')+'</textarea></div>';
  return '<div class="prop">'+head+'<input data-prop="'+prop+'" value="'+esc+'"></div>';}
const DYN_VARS=[['Nombre del prospecto','{{prospect.firstName}}'],['Nombre completo','{{prospect.fullName}}'],['Empresa del prospecto','{{prospect.company}}'],['Nombre del asesor','{{advisor.name}}'],['Calendly del asesor','{{advisor.calendly}}'],['Nombre del despacho','{{company.name}}'],['Objetivo declarado','{{prospect.objective}}'],['Fecha próxima cita','{{nextMeeting.date}}'],['Hora próxima cita','{{nextMeeting.time}}'],['Tipo próxima cita','{{nextMeeting.type}}']];
function openDynMenu(btn,prop){closeDynMenu();
  const m=document.createElement('div');m.className='dyn-menu';m.id='dynMenu';
  m.innerHTML=DYN_VARS.map(v=>'<button type="button" onmousedown="event.preventDefault();insertDyn(\\''+prop+'\\',\\''+v[1]+'\\')">'+v[0]+'</button>').join('');
  btn.parentElement.appendChild(m);setTimeout(()=>document.addEventListener('click',closeDynMenu,{once:true}),0);}
function closeDynMenu(){const m=document.getElementById('dynMenu');if(m)m.remove();}
function insertDyn(prop,varText){const el=document.querySelector('[data-prop="'+prop+'"]');if(!el)return;
  const start=el.selectionStart!=null?el.selectionStart:el.value.length;
  el.value=el.value.slice(0,start)+varText+el.value.slice(el.selectionEnd!=null?el.selectionEnd:start);
  setProp(prop,el.value);closeDynMenu();el.focus();}
function listEditor(s){const rows=(s.items||[]).map((it,n)=>'<div class="opt-editor" data-idx="'+n+'" draggable="true"><span class="grip">⋮⋮</span>'+(s.type==='options'?'<input class="oi" data-optfield="icon" data-idx="'+n+'" value="'+(it.icon||'').replace(/"/g,'&quot;')+'" placeholder="●">':'')+'<input data-optfield="label" data-idx="'+n+'" value="'+(it.label||'').replace(/"/g,'&quot;')+'"><button class="mini del" onclick="removeItem('+n+')">✕</button></div>').join('');
  const html='<div class="prop-group"><div class="gh">'+(s.type==='ranking'?'Prioridades':(s.type==='list'?'Elementos':'Opciones'))+'</div><div id="itemRows">'+rows+'</div><button class="add-opt" onclick="addItem()">+ Agregar</button></div>';
  setTimeout(()=>{document.querySelectorAll('[data-optfield]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{const it=s.items[+inp.dataset.idx];it[inp.dataset.optfield]=inp.value;History.push('text-item');build();showEditSlide();markDirty();});});setupItemDrag(s);},0);
  return html;}
function setupItemDrag(s){const cont=document.getElementById('itemRows');if(!cont)return;let dragEl=null;
  cont.querySelectorAll('.opt-editor').forEach(row=>{row.addEventListener('dragstart',()=>{dragEl=row;row.classList.add('drag');});
    row.addEventListener('dragend',()=>{row.classList.remove('drag');cont.querySelectorAll('.opt-editor').forEach(x=>x.classList.remove('over'));
      const order=[...cont.querySelectorAll('.opt-editor')].map(el=>+el.dataset.idx);s.items=order.map(idx=>s.items[idx]);History.push('reorder-item');renderProps();build();showEditSlide();markDirty();});
    row.addEventListener('dragover',e=>{e.preventDefault();if(!dragEl||row===dragEl)return;cont.querySelectorAll('.opt-editor').forEach(x=>x.classList.remove('over'));row.classList.add('over');
      const r=row.getBoundingClientRect();const after=(e.clientY-r.top)/r.height>.5;cont.insertBefore(dragEl,after?row.nextSibling:row);});});}
function addItem(){const s=T().slides.find(x=>x.id===currentEditId);s.items=s.items||[];s.items.push(s.type==='list'?{label:'Nuevo elemento'}:{id:uid(s.type==='ranking'?'p':'o'),label:'Nuevo'});History.push('add-item');renderProps();build();showEditSlide();markDirty();}
function removeItem(n){const s=T().slides.find(x=>x.id===currentEditId);s.items.splice(n,1);History.push('rm-item');renderProps();build();showEditSlide();markDirty();}
function badgeEditor(s){const rows=(s.badges||[]).map((b,n)=>'<div class="opt-editor" data-idx="'+n+'"><input data-badgefield data-idx="'+n+'" value="'+(b||'').replace(/"/g,'&quot;')+'"><button class="mini del" onclick="removeBadge('+n+')">✕</button></div>').join('');
  setTimeout(()=>{document.querySelectorAll('[data-badgefield]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());inp.addEventListener('input',()=>{s.badges[+inp.dataset.idx]=inp.value;History.push('text-badge');build();showEditSlide();markDirty();});});},0);
  return '<div class="prop-group"><div class="gh">Insignias</div>'+rows+'<button class="add-opt" onclick="addBadge()">+ Agregar insignia</button></div>';}
function addBadge(){const s=T().slides.find(x=>x.id===currentEditId);s.badges=s.badges||[];s.badges.push('Nueva');History.push('add-badge');renderProps();build();showEditSlide();markDirty();}
function removeBadge(n){const s=T().slides.find(x=>x.id===currentEditId);s.badges.splice(n,1);History.push('rm-badge');renderProps();build();showEditSlide();markDirty();}
function recapValueEditor(s){
  const bl=(s.bullets||[]).map((b,n)=>'<div class="opt-editor"><input data-recbul="'+n+'" value="'+escapeHtml(b).replace(/"/g,'&quot;')+'"><button class="mini del" onclick="removeRecBullet('+n+')">✕</button></div>').join('');
  setTimeout(()=>{document.querySelectorAll('[data-recbul]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{s.bullets[+inp.dataset.recbul]=inp.value;History.push('text-recbul');build();showEditSlide();markDirty();});});},0);
  return '<div class="prop-group"><div class="gh">Lo que trabajamos hoy</div>'+bl+'<button class="add-opt" onclick="addRecBullet()">+ Agregar punto</button></div>'+
    '<div class="prop-group"><div class="gh">Nota de valor / regalo</div>'+field('Texto','valueNote',s.valueNote||'','area')+'</div>'+
    '<div class="prop-group"><div class="gh">Preguntas de opinión</div>'+
      field('Encabezado','opinionTitle',s.opinionTitle||'','text')+
      field('Pregunta 1 (destacada)','question1',s.question1||'','area')+
      field('Pregunta 2','question2',s.question2||'','area')+'</div>'+
    '<div class="prop"><div class="chip-toggle"><div class="switch '+(s.showMedia!==false?'on':'')+'" onclick="toggleRecMedia()"><i></i></div> Mostrar imagen lateral</div></div>'+
    (s.showMedia!==false?
      imageField('Imagen lateral','media.src',(s.media&&s.media.src)||'','recap')+
      ((s.media&&s.media.src)?'<div class="rg-thumb"><img src="'+escapeHtml(s.media.src)+'" alt=""><button class="mini del" onclick="clearRecapMedia()">Quitar imagen</button></div>':'')
      :'');}
function clearRecapMedia(){const s=T().slides.find(x=>x.id===currentEditId);s.media=s.media||{};s.media.src='';History.push('clr-recap-img');renderProps();build();showEditSlide();markDirty();}
function addRecBullet(){const s=T().slides.find(x=>x.id===currentEditId);s.bullets=s.bullets||[];s.bullets.push('Nuevo punto');History.push('add-recbul');renderProps();build();showEditSlide();markDirty();}
function removeRecBullet(n){const s=T().slides.find(x=>x.id===currentEditId);s.bullets.splice(n,1);History.push('rm-recbul');renderProps();build();showEditSlide();markDirty();}
function toggleRecMedia(){const s=T().slides.find(x=>x.id===currentEditId);s.showMedia=s.showMedia===false;History.push('rec-media');renderProps();build();showEditSlide();markDirty();}
/* ---- Oferta de regalo (referralOffer) ---- */
function referralOfferEditor(s){
  const steps=(s.steps||[]).map((st,n)=>'<div class="opt-editor"><span class="opt-num">'+(n+1)+'</span><input data-rostep="'+n+'" value="'+escapeHtml(st).replace(/"/g,'&quot;')+'"><button class="mini del" onclick="removeRoStep('+n+')">✕</button></div>').join('');
  setTimeout(()=>{document.querySelectorAll('[data-rostep]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{s.steps[+inp.dataset.rostep]=inp.value;History.push('text-rostep');build();showEditSlide();markDirty();});});},0);
  const r=s.resource||{};
  return '<div class="prop-group"><div class="gh">Pasos (tarjetas numeradas)</div>'+steps+'<button class="add-opt" onclick="addRoStep()">+ Agregar paso</button></div>'+
    '<div class="prop-group"><div class="gh">Bloque de valor</div>'+
      field('Texto introductorio','valueLead',s.valueLead||'','area')+
      field('Destacado (regalo)','valueHighlight',s.valueHighlight||'','text')+
      field('Etiqueta de valor','valueBadge',s.valueBadge||'','text')+'</div>'+
    '<div class="prop-group"><div class="gh">Tarjeta de recurso (derecha)</div>'+
      '<div class="prop"><div class="chip-toggle"><div class="switch '+(s.showResource!==false?'on':'')+'" onclick="toggleRoResource()"><i></i></div> Mostrar recurso</div></div>'+
      (s.showResource!==false?
        imageField('Imagen del recurso','resource.src',r.src||'','ro')+
        field('Etiqueta','resource.tag',r.tag||'','text')+
        field('Título','resource.title',r.title||'','text')+
        field('Subtítulo','resource.sub',r.sub||'','text'):'')+'</div>';}
function addRoStep(){const s=T().slides.find(x=>x.id===currentEditId);s.steps=s.steps||[];s.steps.push('Nuevo paso');History.push('add-rostep');renderProps();build();showEditSlide();markDirty();}
function removeRoStep(n){const s=T().slides.find(x=>x.id===currentEditId);s.steps.splice(n,1);History.push('rm-rostep');renderProps();build();showEditSlide();markDirty();}
function toggleRoResource(){const s=T().slides.find(x=>x.id===currentEditId);s.showResource=s.showResource===false;History.push('ro-res');renderProps();build();showEditSlide();markDirty();}
/* ---- Grilla de recursos (resourceGrid) ---- */
function resourceGridEditor(s){
  s.cards=s.cards||[];
  const cards=s.cards.map((c,n)=>'<div class="prop-group"><div class="gh">Recurso '+(n+1)+(s.cards.length>1?' <button class="mini del" style="float:right" onclick="removeRgCard('+n+')">✕</button>':'')+'</div>'+
    imageField('Imagen','__rgimg','','rg'+n)+
    (c.src?'<div class="rg-thumb"><img src="'+escapeHtml(c.src)+'" alt=""><button class="mini del" onclick="clearRgCard('+n+')">Quitar imagen</button></div>':'')+
    '<div class="prop"><label>Título (opcional)</label><input data-rgtitle="'+n+'" value="'+escapeHtml(c.title||'').replace(/"/g,'&quot;')+'"></div>'+
    '</div>').join('');
  setTimeout(()=>{
    document.querySelectorAll('[data-rgtitle]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
      inp.addEventListener('input',()=>{s.cards[+inp.dataset.rgtitle].title=inp.value;History.push('text-rgtitle');build();showEditSlide();markDirty();});});
    s.cards.forEach((c,n)=>{const inp=document.getElementById('rgfile-rg'+n);if(inp)inp.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;
      const rd=new FileReader();rd.onload=()=>compressImage(rd.result,f,(data)=>{s.cards[n].src=data;History.push('rg-img');renderProps();build();showEditSlide();markDirty();});rd.readAsDataURL(f);});});
  },0);
  return cards+'<button class="add-opt" onclick="addRgCard()">+ Agregar recurso</button>'+
    '<div class="prop-group"><div class="gh">Nota inferior</div>'+field('Texto','note',s.note||'','area')+'</div>';}
function addRgCard(){const s=T().slides.find(x=>x.id===currentEditId);s.cards=s.cards||[];s.cards.push({src:'',title:''});History.push('add-rgcard');renderProps();build();showEditSlide();markDirty();}
function removeRgCard(n){const s=T().slides.find(x=>x.id===currentEditId);s.cards.splice(n,1);History.push('rm-rgcard');renderProps();build();showEditSlide();markDirty();}
function clearRgCard(n){const s=T().slides.find(x=>x.id===currentEditId);s.cards[n].src='';History.push('clr-rgcard');renderProps();build();showEditSlide();markDirty();}
/* campo de imagen: subir archivo (comprime) o pegar URL */
function imageField(label,prop,val,tag){
  return '<div class="prop"><label>'+label+'</label>'+
    '<div class="img-field"><input type="file" accept="image/*" id="rgfile-'+tag+'" class="img-file">'+
    '<label for="rgfile-'+tag+'" class="img-file-btn">📁 Subir imagen</label></div>'+
    (prop!=='__rgimg'?'<input class="img-url" data-prop="'+prop+'" value="'+String(val).replace(/"/g,'&quot;')+'" placeholder="…o pegá una URL">':'')+'</div>';}
function referralCaptureEditor(s){
  const crits=(s.criteria||[]).map((c,n)=>'<div class="opt-editor"><input data-refcrit="'+n+'" value="'+escapeHtml(c).replace(/"/g,'&quot;')+'"><button class="mini del" onclick="removeRefCrit('+n+')">✕</button></div>').join('');
  setTimeout(()=>{document.querySelectorAll('[data-refcrit]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{s.criteria[+inp.dataset.refcrit]=inp.value;History.push('text-refcrit');build();showEditSlide();markDirty();});});},0);
  return '<div class="prop-group"><div class="gh">Perfil del referido ideal</div>'+crits+'<button class="add-opt" onclick="addRefCrit()">+ Agregar criterio</button></div>'+
    '<div class="prop-group"><div class="gh">Lista de referidos</div>'+
      field('Título de la lista','listTitle',s.listTitle||'','text')+
      field('Subtítulo','listSubtitle',s.listSubtitle||'','text')+
      '<div class="prop"><label>Filas iniciales</label><input data-prop="minRows" value="'+(s.minRows||5)+'" type="number" min="1" max="15"></div>'+
      '<div class="prop"><label>Código de país por defecto</label><input data-prop="defaultCC" value="'+escapeHtml(s.defaultCC||'+52')+'"></div>'+
      field('Texto del botón','buttonText',s.buttonText||'Enviar regalo','text')+
    '</div>';}
function addRefCrit(){const s=T().slides.find(x=>x.id===currentEditId);s.criteria=s.criteria||[];s.criteria.push('Nuevo criterio');History.push('add-refcrit');renderProps();build();showEditSlide();markDirty();}
function removeRefCrit(n){const s=T().slides.find(x=>x.id===currentEditId);s.criteria.splice(n,1);History.push('rm-refcrit');renderProps();build();showEditSlide();markDirty();}
function calendlyEditor(s){const src=s.source||'brand';const brandUrl=(BR().contact&&BR().contact.calendly)||'';
  return '<div class="prop-group"><div class="gh">Agenda / Calendly</div>'+
    '<div class="prop"><label>Fuente de Calendly</label>'+
      '<label class="chip-toggle" style="margin-bottom:6px"><input type="radio" name="calsrc" '+(src==='brand'?'checked':'')+' onchange="setCalSource(\\'brand\\')"> Usar Calendly de mi perfil</label>'+
      '<label class="chip-toggle"><input type="radio" name="calsrc" '+(src==='custom'?'checked':'')+' onchange="setCalSource(\\'custom\\')"> Usar enlace personalizado</label></div>'+
    (src==='brand'?'<div class="prop"><label>Calendly de tu perfil</label><input value="'+escapeHtml(brandUrl)+'" disabled placeholder="Configuralo en Identidad visual"></div>'
                  :'<div class="prop"><label>URL personalizada</label><input data-cal="calendlyUrl" value="'+escapeHtml(s.calendlyUrl||'')+'" placeholder="https://calendly.com/usuario/reunion"></div>')+
    '<div class="prop"><label>Texto del botón para abrir en otra pestaña</label><input data-cal="fallbackButtonText" value="'+escapeHtml(s.fallbackButtonText||'')+'"></div>'+
    '<div class="prop"><div class="chip-toggle"><div class="switch '+(s.showFallbackButton!==false?'on':'')+'" onclick="toggleCal(\\'showFallbackButton\\')"><i></i></div> Mostrar enlace "abrir en otra pestaña"</div></div>'+
    '<div class="prop"><div class="chip-toggle"><div class="switch '+(s.confirmationEnabled!==false?'on':'')+'" onclick="toggleCal(\\'confirmationEnabled\\')"><i></i></div> Mostrar botón "Cita agendada"</div></div>'+
    '<div class="prop"><label>Texto del botón de confirmación</label><input data-cal="confirmationButtonText" value="'+escapeHtml(s.confirmationButtonText||'')+'"></div>'+
    ((src==='brand'&&!brandUrl)?'<div class="pl-warn">Configurá tu Calendly en Identidad visual para activar esta diapositiva.</div>':'')+
    '</div>';}
function setCalSource(v){const s=T().slides.find(x=>x.id===currentEditId);s.source=v;History.push('cal-src');renderProps();build();showEditSlide();markDirty();}
function toggleCal(key){const s=T().slides.find(x=>x.id===currentEditId);s[key]=s[key]===false?true:false;History.push('cal-tog');renderProps();build();showEditSlide();markDirty();}
function summaryEditor(s){const opts=T().slides.filter(x=>['textQuestion','money','choice2','options'].includes(x.type));
  const rows=(s.sourceSlides||[]).map((sid,n)=>'<div class="opt-editor" data-idx="'+n+'"><select data-sumslide data-idx="'+n+'">'+opts.map(o=>'<option value="'+o.id+'" '+(o.id===sid?'selected':'')+'>'+escapeHtml(o.internalName||o.id)+'</option>').join('')+'</select><input data-sumlabel data-idx="'+n+'" value="'+((s.labels&&s.labels[n])||'').replace(/"/g,'&quot;')+'" placeholder="Etiqueta"><button class="mini del" onclick="removeSum('+n+')">✕</button></div>').join('');
  setTimeout(()=>{document.querySelectorAll('[data-sumslide]').forEach(sel=>sel.addEventListener('change',()=>{s.sourceSlides[+sel.dataset.idx]=sel.value;History.push('sum');markDirty();}));
    document.querySelectorAll('[data-sumlabel]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());inp.addEventListener('input',()=>{s.labels=s.labels||[];s.labels[+inp.dataset.idx]=inp.value;History.push('text-sum');markDirty();});});},0);
  return '<div class="prop-group"><div class="gh">Filas del resumen</div>'+rows+'<button class="add-opt" onclick="addSum()">+ Agregar fila</button></div>';}
function addSum(){const s=T().slides.find(x=>x.id===currentEditId);const first=T().slides.find(x=>['textQuestion','money','choice2','options'].includes(x.type));s.sourceSlides=s.sourceSlides||[];s.labels=s.labels||[];s.sourceSlides.push(first?first.id:'');s.labels.push('');History.push('add-sum');renderProps();markDirty();}
function removeSum(n){const s=T().slides.find(x=>x.id===currentEditId);s.sourceSlides.splice(n,1);(s.labels||[]).splice(n,1);History.push('rm-sum');renderProps();markDirty();}
function propToggle(prop){const s=T().slides.find(x=>x.id===currentEditId);if(prop==='enabled'){s.enabled=s.enabled===false;History.push('toggle');renderProps();renderSlideList();build();showEditSlide();markDirty();}}
function setProp(path,val){const s=T().slides.find(x=>x.id===currentEditId);const parts=path.split('.');let o=s;for(let k=0;k<parts.length-1;k++)o=o[parts[k]];o[parts[parts.length-1]]=val;
  History.push('text-prop-'+path);if(path==='internalName')renderSlideList();else{build();showEditSlide();}markDirty();}
/* ================================================================
   IDENTIDAD VISUAL (marca + logo desde archivo)
   ================================================================ */
function openIdentity(){const b=BR(),a=b.assets.logo;
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Identidad visual</h3>'+
    '<div class="prop-group"><div class="gh">Información</div>'+
      idField('Nombre del despacho','companyName',b.companyName)+
      idField('Bajada / lema','companySub',b.companySub||'')+
      idField('Nombre del asesor','advisorName',b.advisorName||'')+
      idField('Email','contact.email',b.contact.email||'')+
      idField('WhatsApp','contact.whatsapp',b.contact.whatsapp||'')+
      idField('Calendly','contact.calendly',b.contact.calendly||'')+
      idField('Sitio web','contact.website',b.contact.website||'')+'</div>'+
    '<div class="prop-group"><div class="gh">Logo principal</div>'+
      '<div class="dropzone" id="logoDrop">Arrastrá una imagen aquí o hacé clic para elegir<br><small style="color:var(--gl-muted)">PNG · JPG · WebP · SVG — se comprime automáticamente</small></div>'+
      '<div id="logoPreviewWrap">'+(a.data||a.url?logoPreviewHTML(a):'')+'</div>'+
      '<div class="field-mini" style="margin-top:12px"><label>Ajuste</label>'+
        '<select id="logoFit"><option value="contain" '+(a.fit==='contain'?'selected':'')+'>Contain (mostrar completo)</option><option value="cover" '+(a.fit==='cover'?'selected':'')+'>Cover (rellenar)</option></select></div>'+
    '</div>'+
    '<div class="prop-group"><div class="gh">Tipografía</div>'+
      '<div class="field-mini"><label>Títulos</label><select id="fontHead">'+FONTS.map(f=>'<option '+(b.fontHead===f?'selected':'')+'>'+f+'</option>').join('')+'</select></div>'+
      '<div class="field-mini"><label>Cuerpo</label><select id="fontBody">'+FONTS.map(f=>'<option '+(b.fontBody===f?'selected':'')+'>'+f+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div style="text-align:right"><button class="btn" onclick="closeModal()">Listo</button></div>');
  document.querySelectorAll('[data-id]').forEach(inp=>inp.addEventListener('input',()=>{setId(inp.dataset.id,inp.value);}));
  document.getElementById('logoFit').addEventListener('change',e=>{BR().assets.logo.fit=e.target.value;applyTheme();build();showEditSlide();markDirty();});
  document.getElementById('fontHead').addEventListener('change',e=>{BR().fontHead=e.target.value;applyTheme();markDirty();});
  document.getElementById('fontBody').addEventListener('change',e=>{BR().fontBody=e.target.value;applyTheme();markDirty();});
  setupLogoDrop();}
function idField(label,path,val){return '<div class="field-mini"><label>'+label+'</label><input data-id="'+path+'" value="'+String(val).replace(/"/g,'&quot;')+'"></div>';}
function setId(path,val){const parts=path.split('.');let o=BR();for(let k=0;k<parts.length-1;k++)o=o[parts[k]];o[parts[parts.length-1]]=val;applyTheme();build();showEditSlide();markDirty();}
function logoPreviewHTML(a){return '<div class="logo-preview"><div class="lp-box"><img src="'+(a.data||a.url)+'" style="object-fit:'+(a.fit||'contain')+'"></div>'+
  '<div class="lp-info"><b>'+escapeHtml(a.fileName||'logo')+'</b>'+(a.mimeType||'')+' '+(a.data?'· '+Math.round(a.data.length/1024)+' KB':'')+'<br>'+
  '<button class="mini del" style="margin-top:6px;width:auto;padding:0 10px" onclick="removeLogo()">Eliminar</button></div></div>';}
function setupLogoDrop(){const dz=document.getElementById('logoDrop');
  dz.addEventListener('click',()=>{const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/webp,image/svg+xml';inp.onchange=()=>handleLogoFile(inp.files[0]);inp.click();});
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])handleLogoFile(e.dataTransfer.files[0]);});}
function handleLogoFile(file){if(!file)return;
  const okTypes=['image/png','image/jpeg','image/webp','image/svg+xml'];
  if(!okTypes.includes(file.type)){toast('Formato no válido. Usá PNG, JPG, WebP o SVG.');return;}
  if(file.size>6e6){toast('La imagen es muy pesada (máx. 6 MB).');return;}
  if(file.type==='image/svg+xml'){const r=new FileReader();r.onload=()=>{const clean=sanitizeSVG(r.result);
    const data='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(clean)));saveLogo(data,file.type,file.name);};r.readAsText(file);return;}
  const r=new FileReader();r.onload=()=>compressImage(r.result,file,(data)=>saveLogo(data,'image/png',file.name));r.readAsDataURL(file);}
function sanitizeSVG(svg){return svg.replace(/<script[\\s\\S]*?<\\/script>/gi,'').replace(/\\son\\w+\\s*=\\s*("[^"]*"|'[^']*')/gi,'').replace(/href\\s*=\\s*("javascript:[^"]*"|'javascript:[^']*')/gi,'');}
function compressImage(dataUrl,file,cb){const img=new Image();img.onload=()=>{
    const max=512;let w=img.width,h=img.height;if(w>max||h>max){const sc=max/Math.max(w,h);w=Math.round(w*sc);h=Math.round(h*sc);}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);
    let out=cv.toDataURL('image/png');if(out.length>1.2e6)out=cv.toDataURL('image/jpeg',.82);
    if(file.size>1.5e6)toast('Imagen grande: se comprimió para el guardado local.');cb(out);};
  img.onerror=()=>toast('No se pudo procesar la imagen.');img.src=dataUrl;}
function saveLogo(data,mime,name){const a=BR().assets.logo;a.sourceType='upload';a.data=data;a.url='';a.mimeType=mime;a.fileName=name;
  document.getElementById('logoPreviewWrap').innerHTML=logoPreviewHTML(a);applyTheme();build();showEditSlide();markDirty();toast('Logo cargado');}
function removeLogo(){const a=BR().assets.logo;a.data='';a.url='';a.fileName='';a.mimeType='';
  document.getElementById('logoPreviewWrap').innerHTML='';applyTheme();build();showEditSlide();markDirty();toast('Logo eliminado');}

/* ================================================================
   DISEÑOS — galería + modo + custom + contraste
   ================================================================ */
function openThemes(){
  const cur=TH();const mode=cur.mode||'dark';
  const cards=Object.values(THEME_PRESETS).map(t=>
    '<div class="theme-card '+(cur.id===t.id?'active':'')+'" onclick="applyPreset(\\''+t.id+'\\')">'+
      '<div class="theme-thumb" style="background:'+t.background+';color:'+t.textPrimary+'">'+
        '<div class="tt">'+t.name+'</div>'+
        '<div class="dots"><i style="background:'+t.accent+'"></i><i style="background:'+t.surface+';border:1px solid '+t.border+'"></i><i style="background:'+t.textSecondary+'"></i></div>'+
      '</div><div class="theme-name">'+(t.mode==='light'?'☀ Claro':'☾ Oscuro')+'</div></div>').join('');
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Diseños</h3>'+
    '<div class="mode-tabs">'+
      '<button class="mode-tab '+(mode==='dark'?'on':'')+'" onclick="setThemeMode(\\'dark\\')">☾ Oscuro</button>'+
      '<button class="mode-tab '+(mode==='light'?'on':'')+'" onclick="setThemeMode(\\'light\\')">☀ Claro</button>'+
      '<button class="mode-tab '+(mode==='auto'?'on':'')+'" onclick="setThemeMode(\\'auto\\')">◐ Automático</button>'+
      '<button class="mode-tab '+(mode==='custom'?'on':'')+'" onclick="setThemeMode(\\'custom\\')">🎨 Personalizado</button>'+
    '</div>'+
    '<div class="theme-grid">'+cards+'</div>'+
    '<div id="customPanel">'+(mode==='custom'?customPanelHTML():'')+'</div>'+
    '<div class="contrast-warn" id="contrastWarn"></div>'+
    '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">'+
      '<button class="btn ghost sm" onclick="saveThemeAsCustom()">Guardar tema actual</button>'+
      '<button class="btn ghost sm" onclick="exportTheme()">Exportar tema</button>'+
      '<button class="btn ghost sm" onclick="importTheme()">Importar tema</button>'+
      '<button class="btn ghost sm" onclick="applyPreset(\\'gl-dark\\')">Restaurar original</button>'+
    '</div>');
  checkContrast();}
function applyPreset(id){const p=THEME_PRESETS[id];if(!p)return;
  meetingProject.theme=JSON.parse(JSON.stringify(p));applyTheme();History.push('theme');markDirty();
  build();showEditSlide();openThemes();toast('Tema aplicado: '+p.name);}
function setThemeMode(mode){
  if(mode==='auto'||mode==='custom'){TH().mode=mode;}
  else{const baseId=mode==='light'?'patrimonial-light':'gl-dark';
    if(resolveMode(TH())!==mode){meetingProject.theme=JSON.parse(JSON.stringify(THEME_PRESETS[baseId]));}
    TH().mode=mode;}
  applyTheme();History.push('theme');markDirty();openThemes();}
function customPanelHTML(){const t=TH();const keys=[['background','Fondo'],['surface','Paneles'],['textPrimary','Texto principal'],['textSecondary','Texto secundario'],['accent','Acento'],['accentSoft','Acento suave']];
  return '<div class="prop-group" style="margin-top:14px"><div class="gh">Colores personalizados</div>'+
    keys.map(([k,l])=>'<div class="color-row"><input type="color" value="'+((t[k]||'#000000').charAt(0)==='#'?t[k]:'#222222')+'" data-tk="'+k+'"><span class="cl">'+l+'</span><span class="cv">'+t[k]+'</span></div>').join('')+'</div>';}
function bindCustomInputs(){document.querySelectorAll('[data-tk]').forEach(inp=>inp.addEventListener('input',()=>{
  TH()[inp.dataset.tk]=inp.value;TH().mode='custom';applyTheme();markDirty();
  const cv=inp.parentElement.querySelector('.cv');if(cv)cv.textContent=inp.value;checkContrast();}));}
function checkContrast(){const w=document.getElementById('contrastWarn');if(!w)return;const t=TH();
  const bg=t.background||'#050817',tx=t.textPrimary||'#EAF2FF';
  if(bg.charAt(0)!=='#'||tx.charAt(0)!=='#'){w.classList.remove('show');return;}
  const ratio=contrastRatio(bg,tx);
  if(ratio<4.5){w.classList.add('show');const suggested=isLight(bg)?'#142033':'#EAF2FF';
    w.innerHTML='El contraste entre el fondo y el texto es bajo ('+ratio.toFixed(1)+':1). Recomendamos un texto más '+(isLight(bg)?'oscuro':'claro')+'.'+
      '<br><button class="btn sm" onclick="TH().textPrimary=\\''+suggested+'\\';applyTheme();markDirty();openThemes();">Usar color recomendado</button>';}
  else w.classList.remove('show');}
function saveThemeAsCustom(){const name=prompt('Nombre del tema:',TH().name||'Mi tema');if(!name)return;
  TH().name=name;TH().id='custom-'+rid();History.push('theme');markDirty();toast('Tema guardado en el proyecto');openThemes();}
function exportTheme(){download(JSON.stringify({schemaVersion:2,kind:'theme',theme:TH()},null,2),(TH().id||'tema')+'.theme.json');toast('Tema exportado');}
function importTheme(){pickJSON(obj=>{const th=obj.theme||obj;if(!th||!th.background){toast('Archivo de tema inválido');return;}
  meetingProject.theme=deepSanitize(th);applyTheme();History.push('theme');markDirty();build();showEditSlide();openThemes();toast('Tema importado');});}

/* ================================================================
   PREPARAR REUNIÓN / SESIONES
   ================================================================ */
function openPrepare(){const p=SE().prospect,b=BR();
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Preparar reunión</h3>'+
    '<div class="prep-actions" style="margin-bottom:16px">'+
      '<div class="prep-tile" onclick="newSession()"><b>Iniciar nueva reunión</b><span>Empieza limpio, sin respuestas previas</span></div>'+
      '<div class="prep-tile" onclick="continueSession()"><b>Continuar anterior</b><span>Retomás donde quedaste</span></div>'+
      '<div class="prep-tile" onclick="demoSession()"><b>Reunión de prueba</b><span>Datos de ejemplo para practicar</span></div>'+
      '<div class="prep-tile" onclick="noProspectSession()"><b>Empezar sin prospecto</b><span>Se mostrará "preparada para ti"</span></div>'+
    '</div>'+
    '<div class="prop-group"><div class="gh">Datos del prospecto</div>'+
      idField2('Nombre','firstName',p.firstName)+
      idField2('Apellido','lastName',p.lastName)+
      idField2('Empresa','company',p.company)+
      idField2('WhatsApp','whatsapp',p.whatsapp)+
      idField2('Email','email',p.email)+
      idField2('Fuente','source',p.source)+
      idField2('Objetivo declarado','objective',p.objective)+
    '</div>'+
    '<div class="prop-group"><div class="gh">Reunión</div>'+
      '<div class="field-mini"><label>Nombre del asesor</label><input data-se="advisor" value="'+escapeHtml(SE().advisor||b.advisorName||'')+'"></div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;gap:8px"><button class="btn ghost sm" onclick="clearResponses()">Limpiar respuestas</button><button class="btn" onclick="closeModal();setMode(\\'present\\')">Entrar a presentación ▶</button></div>');
  document.querySelectorAll('[data-sep]').forEach(inp=>inp.addEventListener('input',()=>{updateProspectData({[inp.dataset.sep]:inp.value});markDirty();}));
  document.querySelectorAll('[data-se]').forEach(inp=>inp.addEventListener('input',()=>{SE()[inp.dataset.se]=inp.value;markDirty();}));}
function idField2(label,path,val){return '<div class="field-mini"><label>'+label+'</label><input data-sep="'+path+'" value="'+String(val||'').replace(/"/g,'&quot;')+'"></div>';}
function applyPrepLive(){build();if(document.body.classList.contains('edit'))showEditSlide();else render();}
function newSession(){if(!confirmIfDirty('Vas a iniciar una nueva reunión.'))return;
  meetingProject.session=blankSession();meetingProject.session.createdAt=Date.now();meetingProject.session.status='No iniciada';
  toast('Nueva reunión — sin datos anteriores');closeModal();openPrepare();markDirty();}
function continueSession(){const saved=Store.loadProject();if(saved&&saved.session){meetingProject.session=saved.session;toast('Reunión anterior recuperada');}else toast('No hay reunión anterior guardada');closeModal();openPrepare();}
function demoSession(){meetingProject.session=blankSession();
  Object.assign(meetingProject.session.prospect,{name:'Martín G.',company:'Independiente',source:'LinkedIn',objective:'Retiro'});
  meetingProject.session.status='En progreso';toast('Reunión de prueba lista');closeModal();openPrepare();markDirty();}
function noProspectSession(){if(!confirmIfDirty())return;meetingProject.session=blankSession();
  build();showEditSlide();toast('Reunión sin prospecto — se mostrará "preparada para ti"');closeModal();setMode('present');}
function clearResponses(){if(!confirm('¿Reiniciar todas las respuestas de esta reunión?'))return;
  SE().responses={};SE().progress=0;SE().status='No iniciada';build();showEditSlide();markDirty();toast('Respuestas reiniciadas');}
/* ================================================================
   PLANTILLAS
   ================================================================ */
function saveTemplate(){
  if(T().isMaster){
    if(confirm('Esta es la plantilla MAESTRA.\\n\\nAceptar = duplicar como copia editable (recomendado)\\nCancelar = guardar igual sobre la maestra'))return duplicateTemplate();
  }
  const ok=Store.saveTemplate(T(),TH(),BR());doSave();toast(ok?'Plantilla guardada':'No se pudo guardar');}
function duplicateTemplate(){const name=prompt('Nombre de la nueva plantilla:',T().name.replace(/ \\(copia\\)$/,'')+' (copia)');if(!name)return;
  const tpl=JSON.parse(JSON.stringify(T()));tpl.id='tpl-'+rid();tpl.name=name;tpl.isMaster=false;
  meetingProject.template=tpl;meetingProject.session=blankSession();
  document.getElementById('tbName').textContent=name;Store.saveTemplate(tpl,TH(),BR());History.reset();doSave();
  toast('Plantilla duplicada (sin datos de prospecto): '+name);}
function openTemplates(){const list=Store.listTemplates();
  const rows=list.length?list.map(t=>'<div class="slide-item" style="cursor:default">'+
    '<div class="info"><div class="nm">'+escapeHtml(t.name)+' '+(t.isMaster?'· <span style="color:var(--gl-accent-soft)">maestra</span>':'')+'</div><div class="tp">'+new Date(t.updated).toLocaleString()+'</div></div>'+
    '<div class="acts" style="opacity:1"><button class="mini" title="Cargar" onclick="loadTpl(\\''+t.id+'\\')">⤒</button>'+(t.isMaster?'':'<button class="mini del" title="Eliminar" onclick="delTpl(\\''+t.id+'\\')">✕</button>')+'</div></div>').join(''):'<div class="prop-empty">Todavía no guardaste ninguna plantilla.</div>';
  openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Plantillas guardadas</h3>'+
    '<div style="margin-bottom:14px">'+rows+'</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button class="btn ghost sm" onclick="duplicateTemplate()">Duplicar actual (sin respuestas)</button>'+
      '<button class="btn ghost sm" onclick="exportProject()">Exportar proyecto</button>'+
      '<button class="btn ghost sm" onclick="importProject()">Importar</button>'+
      '<button class="btn ghost sm" onclick="newFromScratch()">Nueva vacía</button>'+
    '</div>');}
function loadTpl(id){if(!confirmIfDirty('Vas a cargar otra plantilla.'))return;const proj=Store.loadTemplate(id);if(!proj){toast('No encontrada');return;}
  meetingProject.template=proj.template;if(proj.theme)meetingProject.theme=proj.theme;if(proj.brand)meetingProject.brand=proj.brand;
  meetingProject.session=blankSession();
  document.getElementById('tbName').textContent=T().name;applyTheme();closeModal();currentEditId=T().slides[0].id;History.reset();setMode('edit');toast('Plantilla cargada');}
function delTpl(id){if(!confirm('¿Eliminar esta plantilla?'))return;Store.deleteTemplate(id);openTemplates();}
function newFromScratch(){if(!confirmIfDirty())return;if(!confirm('¿Crear una plantilla nueva vacía?'))return;
  meetingProject.template={id:'tpl-'+rid(),name:'Nueva reunión',isMaster:false,settings:{showProgress:true,allowKeyboard:true},slides:[blockTemplate('cover')]};
  meetingProject.session=blankSession();document.getElementById('tbName').textContent='Nueva reunión';currentEditId=T().slides[0].id;applyTheme();closeModal();History.reset();setMode('edit');}

function exportProject(){
  const incResp=SE().responses&&Object.keys(SE().responses).length>0 ? confirm('¿Incluir las respuestas del prospecto en el archivo?\\n\\nAceptar = incluir (contiene datos personales)\\nCancelar = exportar sin respuestas') : false;
  const out=JSON.parse(JSON.stringify(meetingProject));
  if(!incResp){out.session=blankSession();}
  download(JSON.stringify(out,null,2),(T().id||'proyecto')+'.json');toast('Proyecto exportado');}
function importProject(){if(!confirmIfDirty('Vas a importar un proyecto.'))return;
  pickJSON(obj=>{const m=migrateToV2(obj);if(!m||!m.template||!m.template.slides){toast('Archivo inválido');return;}
    meetingProject.template=deepSanitize(m.template);meetingProject.theme=m.theme?deepSanitize(m.theme):meetingProject.theme;
    meetingProject.brand=m.brand?deepSanitize(m.brand):meetingProject.brand;meetingProject.session=blankSession();
    document.getElementById('tbName').textContent=T().name;applyTheme();closeModal();currentEditId=T().slides[0].id;History.reset();setMode('edit');toast('Proyecto importado');});}

function download(text,name){const blob=new Blob([text],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();}
function pickJSON(cb){const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{cb(JSON.parse(r.result));}catch(e){toast('Archivo inválido');}};r.readAsText(f);};inp.click();}

function openModal(html){document.getElementById('modalBody').innerHTML=html;document.getElementById('modal').classList.add('on');
  setTimeout(()=>{if(document.querySelectorAll('[data-tk]').length)bindCustomInputs();},0);}
function closeModal(){document.getElementById('modal').classList.remove('on');}
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
let toastT;function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),2200);}

/* ================================================================
   PANTALLA INICIAL (HOME)
   ================================================================ */
function goHome(){document.body.classList.remove('edit','present');document.body.classList.add('home');closeMore();
  document.getElementById('homeLogo').innerHTML=logoHTML();
  const f=document.getElementById('homeFirst'),l=document.getElementById('homeLast');if(f)f.value='';if(l)l.value='';
  const err=document.getElementById('homeErr');if(err)err.classList.remove('show');
  renderHomeContinue();setTimeout(()=>{f&&f.focus();},60);}
function toggleHomeMore(){const m=document.getElementById('homeMore'),t=document.getElementById('homeMoreToggle');
  const open=m.classList.toggle('open');t.textContent=(open?'▾':'▸')+' Agregar más datos';}
function homeStart(noName){
  // 1. Leer y validar (solo Nombre es obligatorio)
  const first=(document.getElementById('homeFirst').value||'').trim();
  const last=(document.getElementById('homeLast').value||'').trim();
  if(!noName && !first){document.getElementById('homeErr').classList.add('show');document.getElementById('homeFirst').focus();return;}
  // 2. Sesión nueva; 3-5. datos, reset respuestas/progreso
  meetingProject.session=blankSession();
  const se=meetingProject.session;
  if(!noName){ se.prospect.firstName=first; se.prospect.lastName=last; se.prospect.fullName=(first+' '+last).trim(); se.prospect.name=se.prospect.fullName; }
  se.prospect.company=val('hm_company');se.prospect.whatsapp=val('hm_whatsapp');se.prospect.email=val('hm_email');
  se.prospect.source=val('hm_source');se.prospect.objective=val('hm_objective');se.advisor=val('hm_advisor')||BR().advisorName||'';
  se.responses={};se.progress=0;
  se.createdAt=Date.now();se.updatedAt=Date.now();se.status='En progreso';
  // 6. Guardar
  markDirty();doSave();
  // 7. Abrir el MEETING ROUTER (interno)
  openRouter();
  toast(noName?'Reunión creada (sin nombre)':'Reunión creada · '+(se.prospect.fullName||first));
}
/* entra directo a presentación (usado por "Comenzar cita" del router) */
function startPresentation(){
  SE().meetingContext.route=resolveRoute();
  document.body.classList.remove('home','router');
  document.body.classList.add('present');document.body.classList.remove('edit');
  document.getElementById('segPlay').classList.add('on');document.getElementById('segEdit').classList.remove('on');
  closeRouter();
  build(); i=0; render();
}
/* Punto ÚNICO de identidad del prospecto */
function updateProspectIdentity(firstName,lastName){
  const p=SE().prospect;
  p.firstName=(firstName||'').trim(); p.lastName=(lastName||'').trim();
  p.fullName=(p.firstName+' '+p.lastName).trim(); p.name=p.fullName; // compatibilidad
  SE().updatedAt=Date.now(); build(); render(); scheduleSave();
}
/* Punto ÚNICO para datos del prospecto (no-identidad) desde cualquier interfaz */
function updateProspectData(data){
  Object.assign(SE().prospect, data||{});
  if('firstName' in (data||{}) || 'lastName' in (data||{})){
    const p=SE().prospect;p.fullName=((p.firstName||'')+' '+(p.lastName||'')).trim();p.name=p.fullName; }
  SE().updatedAt=Date.now();
  build(); render(); scheduleSave();
}
/* Punto ÚNICO para el próximo paso (nextStep + espejo en meetingData) */
function updateNextStep(data){
  SE().nextStep=Object.assign({},SE().nextStep,data||{});
  SE().meetingData=SE().meetingData||blankMeetingData();
  const ns=SE().nextStep;
  SE().meetingData.nextStep=Object.assign({},SE().meetingData.nextStep,{
    date:ns.date,time:ns.time,objective:ns.objective,
    participants:ns.participants?String(ns.participants).split(/\\s*,\\s*/).filter(Boolean):[] });
  SE().updatedAt=Date.now(); build(); if(document.body.classList.contains('present'))render(); scheduleSave();
}
function val(id){const el=document.getElementById(id);return el?el.value.trim():'';}
function homeDemo(){meetingProject.session=blankSession();
  Object.assign(meetingProject.session.prospect,{name:'Martín G.',company:'Independiente',source:'LinkedIn',objective:'Retiro'});
  meetingProject.session.status='En progreso';meetingProject.session.createdAt=Date.now();markDirty();doSave();
  startPresentation();toast('Práctica con datos de prueba');}
function renderHomeContinue(){const box=document.getElementById('homeContinue');if(!box)return;
  const saved=Store.loadProject();
  if(saved&&saved.session&&(saved.session.prospect.name||saved.session.status==='En progreso')&&saved.session.progress>0){
    const se=saved.session;const total=(saved.template&&saved.template.slides.filter(x=>x.enabled!==false).length)||0;
    const upd=se.updatedAt?new Date(se.updatedAt):null;
    box.innerHTML='<div class="home-continue"><div class="hc-top">Continuar última reunión</div>'+
      '<div class="hc-name">'+(escapeHtml(se.prospect.name)||'Sin nombre')+'</div>'+
      '<div class="hc-meta">'+escapeHtml((saved.template&&saved.template.name)||'Reunión')+' · '+((se.progress||0)+1)+' de '+total+' pasos'+
      (upd?' · '+upd.toLocaleString():'')+'</div>'+
      '<div class="hc-acts"><button class="btn sm" onclick="continueLast()">Continuar</button>'+
      '<button class="btn ghost sm" onclick="continueLast(true)">Ver resumen</button>'+
      '<button class="btn ghost sm" onclick="deleteLast()">Eliminar</button></div></div>';
  }else box.innerHTML='';}
function continueLast(toSummary){const saved=Store.loadProject();if(!saved){toast('No hay reunión guardada');return;}
  const nm=saved.session&&saved.session.prospect.name?saved.session.prospect.name:'sin nombre';
  if(!confirm('Vas a continuar la reunión de: '+nm+'\\n\\n¿Es el prospecto correcto?'))return;
  meetingProject=saved;ensureSessionShape(meetingProject.session);
  applyTheme();currentEditId=T().slides[0].id;build();
  if(toSummary){const idx=activeSlides().findIndex(s=>s.type==='summary');setMode('present');goTo(idx>=0?idx:activeSlides().length-1);}
  else{setMode('present');goTo(Math.min(SE().progress||0,activeSlides().length-1));}
  toast('Continuando: '+nm);}
function deleteLast(){if(!confirm('¿Eliminar la reunión guardada? Esta acción no se puede deshacer.'))return;
  meetingProject.session=blankSession();Store.saveProject();renderHomeContinue();toast('Reunión eliminada');}
function goEditor(after){document.body.classList.remove('home','router');setMode('edit');if(typeof after==='function')setTimeout(after,50);}
/* ================================================================
   MEETING ROUTER (interno — el prospecto no lo ve)
   ================================================================ */
let routerStep=1;
function openRouter(){routerStep=1;document.body.classList.remove('home','edit','present');document.body.classList.add('router');renderRouter();}
function closeRouter(){document.body.classList.remove('router');const r=document.getElementById('router');if(r)r.classList.remove('on');}
function routerGoto(step){routerStep=step;renderRouter();}
function renderRouter(){
  const r=document.getElementById('router');r.classList.add('on');
  const nm=safeFirstInternal();
  let html='';
  if(routerStep===1){
    html='<div class="rt-kicker">Antes de comenzar</div>'+
      '<h2 class="rt-title">¿Cuál es la situación de <em>'+escapeHtml(nm)+'</em> para esta cita?</h2>'+
      '<div class="rt-cards">'+MEETING_TYPES.map(t=>{
        const on=SE().meetingContext.meetingType===t.id;
        return '<button class="rt-card '+(on?'sel':'')+'" onclick="pickMeetingType(\\''+t.id+'\\')"><div class="rt-num">'+t.num+'</div><div class="rt-name">'+escapeHtml(t.name)+'</div><div class="rt-desc">'+escapeHtml(t.desc)+'</div></button>';
      }).join('')+'</div>'+
      '<div class="rt-nav"><button class="btn ghost sm" onclick="goHome()">← Volver</button><button class="btn" onclick="routerGoto(2)">Continuar</button></div>';
  }else if(routerStep===2){
    const has=SE().preMeeting.hasPrevInfo;
    html='<div class="rt-kicker">Contexto previo</div>'+
      '<h2 class="rt-title">¿Conocés información previa de <em>'+escapeHtml(nm)+'</em> antes de esta reunión?</h2>'+
      '<div class="rt-cards two">'+
        '<button class="rt-card '+(has===true?'sel':'')+'" onclick="setPrevInfo(true)"><div class="rt-name">Sí, tengo información</div><div class="rt-desc">Cargar contexto previo</div></button>'+
        '<button class="rt-card '+(has===false?'sel':'')+'" onclick="setPrevInfo(false)"><div class="rt-name">No</div><div class="rt-desc">Lo conoceré durante la reunión</div></button>'+
      '</div>'+
      (has?prevInfoForm():'')+
      '<div class="rt-nav"><button class="btn ghost sm" onclick="routerGoto(1)">← Atrás</button><button class="btn" onclick="routerGoto(3)">Continuar</button></div>';
  }else{
    html=routerSummary();
  }
  r.innerHTML='<div class="rt-card-wrap">'+html+'</div>';
  wireRouter();
}
function pickMeetingType(id){SE().meetingContext.meetingType=id;SE().meetingContext.route=resolveRoute();markDirty();renderRouter();}
function setPrevInfo(v){SE().preMeeting.hasPrevInfo=v;markDirty();renderRouter();}
function prevInfoForm(){const pm=SE().preMeeting;
  const sources='<div class="rt-sub">Fuente de información</div><div class="rt-checks">'+PREMEETING_SOURCES.map(s=>{
    const on=pm.sources.indexOf(s)>=0;return '<label class="rt-check '+(on?'on':'')+'"><input type="checkbox" data-src="'+s+'" '+(on?'checked':'')+'> '+s+'</label>';}).join('')+'</div>';
  const g=pm.general,c=pm.commercial,f=pm.financial;
  const gi=(label,grp,key,val)=>'<div class="field-mini"><label>'+label+'</label><input data-pm="'+grp+'.'+key+'" value="'+escapeHtml(val||'')+'"></div>';
  return '<div class="rt-form">'+
    '<div class="rt-sub" style="margin-top:6px">Lo que sabemos de '+escapeHtml(safeName())+'</div>'+
    sources+
    '<div class="rt-group-title">Información general</div><div class="rt-grid">'+
      gi('Empresa','general','company',g.company)+gi('Profesión','general','profession',g.profession)+gi('Edad','general','age',g.age)+
      gi('Estado civil','general','maritalStatus',g.maritalStatus)+gi('Hijos / dependientes','general','dependents',g.dependents)+gi('Ciudad / país','general','location',g.location)+'</div>'+
    '<div class="rt-group-title">Contexto comercial</div><div class="rt-grid">'+
      gi('Fuente','commercial','source',c.source)+gi('Referido por','commercial','referredBy',c.referredBy)+gi('Setter responsable','commercial','setter',c.setter)+
      gi('Producto de interés','commercial','productInterest',c.productInterest)+gi('Objetivo declarado','commercial','declaredObjective',c.declaredObjective)+gi('Motivo de la cita','commercial','meetingReason',c.meetingReason)+'</div>'+
    '<div class="rt-group-title">Información financiera previa</div><div class="rt-grid">'+
      gi('Rango de ingresos','financial','incomeRange',f.incomeRange)+gi('Capacidad estimada','financial','estimatedCapacity',f.estimatedCapacity)+gi('Ahorros / inversiones','financial','savings',f.savings)+
      gi('Coberturas actuales','financial','currentCoverage',f.currentCoverage)+gi('Producto actual','financial','currentProduct',f.currentProduct)+gi('Horizonte temporal','financial','timeHorizon',f.timeHorizon)+'</div>'+
    '<div class="rt-group-title">Contexto previo</div>'+
    '<textarea class="rt-context" data-rawcontext placeholder="Pegá aquí la información que tengas del prospecto (formulario, WhatsApp, notas del setter, LinkedIn, CRM, comentario del referido)…">'+escapeHtml(pm.rawContext||'')+'</textarea>'+
    (SE().meetingContext.meetingType==='referral'?referralForm():'')+
    '</div>';
}
function referralForm(){const rf=SE().referralSource;
  return '<div class="rt-group-title">Referido por</div><div class="rt-grid">'+
    '<div class="field-mini"><label>Nombre de quien refiere</label><input data-ref="name" value="'+escapeHtml(rf.name||'')+'"></div>'+
    '<div class="field-mini"><label>Relación</label><input data-ref="relationship" value="'+escapeHtml(rf.relationship||'')+'"></div>'+
    '<div class="field-mini" style="grid-column:1/-1"><label>Contexto</label><input data-ref="context" value="'+escapeHtml(rf.context||'')+'"></div></div>';
}
function routerSummary(){const pm=SE().preMeeting,mt=meetingTypeName();
  const src=(pm.sources||[]).join(', ')||'—';
  const obj=SE().prospect.objective||pm.commercial.declaredObjective||'—';
  const prev=pm.rawContext?pm.rawContext.slice(0,160)+(pm.rawContext.length>160?'…':''):(pm.hasPrevInfo?'Cargada':'Se conocerá durante la reunión');
  return '<div class="rt-kicker">Preparados para la reunión</div>'+
    '<div class="rt-summary-name">'+escapeHtml((SE().prospect.name||'Sin nombre').toUpperCase())+'</div>'+
    '<div class="rt-summary-grid">'+
      sumRow('Tipo de cita',mt)+sumRow('Fuente',src)+sumRow('Objetivo conocido',obj)+
      sumRow('Información previa',prev)+sumRow('Plantilla',T().name)+
    '</div>'+
    '<div class="rt-nav"><button class="btn ghost sm" onclick="routerGoto(2)">Editar información</button><button class="btn rt-start" onclick="startPresentation()">Comenzar cita ▶</button></div>';
}
function sumRow(k,v){return '<div class="rt-srow"><div class="rt-sk">'+escapeHtml(k)+'</div><div class="rt-sv">'+escapeHtml(v||'—')+'</div></div>';}
function wireRouter(){
  document.querySelectorAll('[data-src]').forEach(cb=>cb.addEventListener('change',()=>{
    const s=cb.dataset.src,arr=SE().preMeeting.sources,ix=arr.indexOf(s);
    if(cb.checked&&ix<0)arr.push(s);else if(!cb.checked&&ix>=0)arr.splice(ix,1);
    cb.parentElement.classList.toggle('on',cb.checked);markDirty();}));
  document.querySelectorAll('[data-pm]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{const[grp,key]=inp.dataset.pm.split('.');SE().preMeeting[grp][key]=inp.value;markDirty();});});
  document.querySelectorAll('[data-ref]').forEach(inp=>{inp.addEventListener('keydown',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{SE().referralSource[inp.dataset.ref]=inp.value;markDirty();});});
  const ta=document.querySelector('[data-rawcontext]');
  if(ta){ta.addEventListener('keydown',e=>e.stopPropagation());ta.addEventListener('input',()=>{SE().preMeeting.rawContext=ta.value;markDirty();});}
}

/* ================================================================
   FINALIZAR CITA (básico) — guardar local primero, luego snapshot
   ================================================================ */
function finalizeMeeting(){
  const chk=finalizeChecklist();
  const faltan=chk.filter(c=>!c.ok);
  const proceed=()=>doFinalize();
  if(faltan.length){
    openModal('<button class="modal-x" onclick="closeModal()">×</button><h3>Antes de finalizar</h3>'+
      '<div class="fin-check">'+chk.map(c=>'<div class="fin-row '+(c.ok?'ok':'miss')+'">'+(c.ok?'✓':'!')+' '+escapeHtml(c.label)+(c.ok?'':' — '+escapeHtml(c.hint))+'</div>').join('')+'</div>'+
      '<p style="font-size:13px;color:var(--gl-text2);margin:12px 0">Podés completar los pendientes o finalizar igualmente. No se pierde ninguna información.</p>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" onclick="closeModal()">Completar pendientes</button><button class="btn" onclick="closeModal();doFinalize()">Finalizar igualmente</button></div>');
  }else proceed();
}
function finalizeChecklist(){const md=SE().meetingData,dc=(SE().decisionCriteria||[]).filter(Boolean);
  const list=[
    {label:'Objetivo',ok:!!(md.objective.primary),hint:'no registrado'},
    {label:'Situación actual',ok:!!(md.currentSituation.obstacles||md.currentSituation.actions),hint:'sin datos'},
    {label:'Capacidad',ok:!!(md.qualification.startingAmount||SE().responses.monto),hint:'no registrada'},
    {label:'Criterios',ok:dc.length>0,hint:'sin criterios'},
    {label:'Decisor',ok:(SE().decisionMakers||[]).length>0,hint:'no confirmado'},
    {label:'Próximo paso',ok:!!(SE().nextStep.date||SE().nextStep.objective),hint:'sin fecha'}
  ];
  const hasCalendly=T().slides.some(s=>s.type==='calendly'&&s.enabled!==false);
  if(hasCalendly)list.push({label:'Próxima cita',ok:!!SE().nextStep.scheduled,hint:'no registrada'});
  const hasRef=T().slides.some(s=>s.type==='referralCapture'&&s.enabled!==false);
  if(hasRef)list.push({label:'Referidos',ok:(SE().referrals||[]).some(r=>r.name&&r.phone),hint:'ninguno registrado'});
  return list;
}
function doFinalize(){
  // 1. GUARDAR LOCALMENTE primero (nunca perder datos)
  syncMeetingDataFromSession();
  SE().status='Finalizada';SE().finalizedAt=Date.now();SE().updatedAt=Date.now();
  // 2. GENERAR SNAPSHOT inmutable
  SE().finalSnapshot=buildSnapshot();
  // 3. Estado de sync local
  SE().sync={status:'local',lastAttempt:null,lastSuccess:null,error:null};
  doSave();
  // 4. (Entrega 3) generar payload + intentar CRM — por ahora solo local
  closeRouter();showPostMeeting();
  toast('Cita finalizada y guardada localmente');
}
function syncMeetingDataFromSession(){const md=SE().meetingData=SE().meetingData||blankMeetingData();
  // reflejar criterios/decisores/nextStep/feedback en meetingData.qualification
  md.qualification.decisionCriteria=(SE().decisionCriteria||[]).filter(Boolean);
  md.qualification.decisionMakerStatus=(SE().decisionMakers&&SE().decisionMakers[0]&&SE().decisionMakers[0].type)||'';
  md.qualification.additionalDecisionMakers=SE().decisionMakers||[];
  if(SE().responses.requiredAmount!=null)md.vision.requiredAmount=SE().responses.requiredAmount;
  if(SE().responses.startingAmount!=null)md.qualification.startingAmount=SE().responses.startingAmount;
  md.nextStep=Object.assign({},md.nextStep,{date:SE().nextStep.date,time:SE().nextStep.time,objective:SE().nextStep.objective});
  md.feedback=Object.assign({},md.feedback,SE().feedback);
}
function buildSnapshot(){return {
  version:2, at:Date.now(), templateId:T().id, templateName:T().name,
  prospect:JSON.parse(JSON.stringify(SE().prospect)),
  meetingContext:JSON.parse(JSON.stringify(SE().meetingContext)),
  preMeeting:JSON.parse(JSON.stringify(SE().preMeeting)),
  responses:JSON.parse(JSON.stringify(SE().responses)),
  meetingData:JSON.parse(JSON.stringify(SE().meetingData)),
  decisionCriteria:JSON.parse(JSON.stringify(SE().decisionCriteria||[])),
  decisionMakers:JSON.parse(JSON.stringify(SE().decisionMakers||[])),
  nextStep:JSON.parse(JSON.stringify(SE().nextStep)),
  feedback:JSON.parse(JSON.stringify(SE().feedback)),
  internalNotes:SE().internalNotes||'',
  referralSource:JSON.parse(JSON.stringify(SE().referralSource||{})),
  referrals:JSON.parse(JSON.stringify(SE().referrals||[]))
};}
/* pantalla post-cita (mínima en Entrega 1; se amplía en Entrega 2) */
function showPostMeeting(){const md=SE().meetingData,dc=(SE().decisionCriteria||[]).filter(Boolean);
  const ns=SE().nextStep,fecha=[ns.date,ns.time].filter(Boolean).join(' · ')||'—';
  const dm=(SE().decisionMakers&&SE().decisionMakers[0]&&SE().decisionMakers[0].type)||'—';
  const refs=(SE().referrals||[]).filter(r=>r.name||r.phone);
  openModal('<button class="modal-x" onclick="closeModal();goHome()">×</button>'+
    '<div class="pm-check">✓ Cita guardada correctamente</div>'+
    '<div class="pm-name">'+escapeHtml(SE().prospect.name||'Sin nombre')+'</div>'+
    '<div class="rt-summary-grid" style="margin-top:14px">'+
      sumRow('Estado','Cita inicial completada')+
      sumRow('Objetivo',md.objective.primary||'—')+
      sumRow('Capacidad',md.qualification.startingAmount||SE().responses.monto||'—')+
      sumRow('Criterios',dc.join(' · ')||'—')+
      sumRow('Decisor',dm)+
      sumRow('Próxima cita',fecha)+
      sumRow('Referidos',refs.length?(refs.length+' registrado'+(refs.length>1?'s':'')):'—')+
    '</div>'+
    '<div class="pm-acts"><button class="btn ghost sm" disabled title="Próxima entrega">Ver ficha completa</button>'+
      (refs.length?'<button class="btn ghost sm" onclick="exportReferrals()">Exportar referidos</button>':'')+
      '<button class="btn ghost sm" onclick="exportProject()">Exportar datos</button>'+
      '<button class="btn ghost sm" disabled title="Próxima entrega">Preparar cita de estrategia</button>'+
      '<button class="btn" onclick="closeModal();goHome()">Volver al inicio</button></div>');
}

/* ================================================================
   PANTALLA COMPLETA
   ================================================================ */
function toggleFullscreen(){
  const el=document.documentElement;
  if(!document.fullscreenElement){
    (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el);
  }else{(document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document);}
}
document.addEventListener('fullscreenchange',()=>{
  const fs=!!document.fullscreenElement;document.body.classList.toggle('fs',fs);
  if(fs){const h=document.getElementById('fsHint');h.classList.add('show');setTimeout(()=>h.classList.remove('show'),2600);}
});

/* ================================================================
   NOTAS PRIVADAS
   ================================================================ */
function toggleNotes(force){const p=document.getElementById('notesPanel');
  const show=force===undefined?!p.classList.contains('on'):force;
  p.classList.toggle('on',show);
  if(show){const a=document.getElementById('notesArea');a.value=SE().internalNotes||'';a.focus();}}
(function wireNotes(){const a=document.getElementById('notesArea');
  a.addEventListener('keydown',e=>e.stopPropagation());
  a.addEventListener('input',()=>{SE().internalNotes=a.value;scheduleSave();});})();

/* ================================================================
   MENÚ "MÁS"
   ================================================================ */
function toggleMore(e){e&&e.stopPropagation();document.getElementById('moreMenu').classList.toggle('on');}
function closeMore(){const m=document.getElementById('moreMenu');if(m)m.classList.remove('on');}
document.addEventListener('click',e=>{if(!e.target.closest('.more-wrap'))closeMore();});

/* salida discreta del modo presentación: mover cursor a esquina sup. der. */
document.addEventListener('mousemove',e=>{if(!document.body.classList.contains('present'))return;
  const c=document.getElementById('exitCorner');if(!c)return;
  c.classList.toggle('reveal', e.clientX>innerWidth-160 && e.clientY<80);});
/* Ctrl/Cmd+E y Esc para volver al editor */
document.addEventListener('keydown',e=>{
  if(document.body.classList.contains('home'))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='e'){e.preventDefault();setMode(document.body.classList.contains('present')?'edit':'present');return;}
  if(e.key==='Escape'&&document.body.classList.contains('present')&&!document.fullscreenElement){setMode('edit');}
  if(e.key.toLowerCase()==='n'&&document.body.classList.contains('edit')&&!/input|textarea|select/i.test((e.target.tagName||''))){toggleNotes();}
});
/* Enter en el campo de nombre inicia la reunión */
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement&&(document.activeElement.id==='homeFirst'||document.activeElement.id==='homeLast')){e.preventDefault();homeStart();}});

/* ================================================================
   STARFIELD
   ================================================================ */
const cv=document.getElementById('stars'),ctx=cv.getContext('2d');let W,H,st=[];
function rsz(){W=cv.width=innerWidth;H=cv.height=innerHeight;st=Array.from({length:Math.min(120,Math.floor(W*H/14000))},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.3,o:Math.random()*.6+.2,tw:Math.random()*.02+.004,dir:1}));}
rsz();addEventListener('resize',rsz);
function cssv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function loop(){ctx.clearRect(0,0,W,H);const sc=cssv('--gl-star')||'180,215,255',sl=cssv('--gl-star-line')||'127,196,255';
  ctx.strokeStyle='rgba('+sl+',.06)';ctx.lineWidth=1;
  for(let a=0;a<st.length;a++)for(let b=a+1;b<st.length;b++){const dx=st[a].x-st[b].x,dy=st[a].y-st[b].y,d=Math.hypot(dx,dy);
    if(d<130){ctx.globalAlpha=(1-d/130)*.5;ctx.beginPath();ctx.moveTo(st[a].x,st[a].y);ctx.lineTo(st[b].x,st[b].y);ctx.stroke();}}
  ctx.globalAlpha=1;for(const s of st){s.o+=s.tw*s.dir;if(s.o>.85||s.o<.2)s.dir*=-1;ctx.beginPath();ctx.fillStyle='rgba('+sc+','+s.o+')';ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();}
  requestAnimationFrame(loop);}
loop();

/* ================================================================
   BOOT
   ================================================================ */
(function boot(){
  const saved=Store.loadProject();
  if(saved&&saved.template){
    meetingProject=saved;
    if(!meetingProject.session)meetingProject.session=blankSession();
    ensureSessionShape(meetingProject.session);
    if(!meetingProject.theme)meetingProject.theme=JSON.parse(JSON.stringify(THEME_PRESETS["gl-dark"]));
  }
  document.getElementById('tbName').textContent=T().name;
  applyTheme();
  currentEditId=T().slides[0].id;
  build();
  History.reset();
  setSaveState('saved','Guardado');
  goHome();          // abre SIEMPRE en la pantalla inicial, nunca en una reunión anterior
})();
`;
