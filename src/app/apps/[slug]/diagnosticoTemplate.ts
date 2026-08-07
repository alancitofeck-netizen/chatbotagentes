/** Plantilla verbatim de "Diagnóstico Interactivo Financiero" — CSS, HTML y
 * JS copiados literal del archivo original que sirvió de base a este tipo
 * de Mini App (mismo diseño, animaciones, flujo y lógica de score, sin
 * ningún rediseño). Las ÚNICAS diferencias respecto del original, dentro
 * de DIAGNOSTICO_LOGIC_JS, son:
 *
 * 1. Las 3 declaraciones `const AGENTE = {...}` / `const QUESTIONS = [...]`
 *    / `const LEVELS = [...]` (antes hardcodeadas) ahora leen de
 *    `window.__DIAGNOSTICO_DATA__`, inyectado por DiagnosticoFinancieroApp
 *    a partir de la config guardada en el CRM.
 * 2. Dentro de `submitLead()`, además del `fetch` original a
 *    `CONFIG.webhookUrl` (que se deja intacto), se agrega un `fetch` a
 *    `/api/public/mini-apps/{slug}/hosted-lead` con el contrato que
 *    `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. La UI de resultado no cambia en nada.
 * 3. Se agrega un `fetch` fire-and-forget a `/api/public/mini-apps/{slug}/
 *    visit` al cargar, igual que ya hacen los otros tipos de Mini App, para
 *    que el conteo de visitas de la pestaña Analíticas funcione también acá.
 *
 * Todo el resto — CSS, HTML, y cada función de DIAGNOSTICO_LOGIC_JS — es
 * una copia literal del archivo original.
 */

export const DIAGNOSTICO_CSS = `
  :root{
    --green-900:#1f5c46;
    --green-700:#2f8a63;
    --green-500:#4faf82;
    --green-300:#8fd0b0;
    --ink:#101b2d;
    --ink-soft:#3a4a5f;
    --muted:#8a97a6;
    --card:#ffffff;
    --bg:#eef2f4;
    --line:rgba(31,92,70,.10);
    --shadow:0 10px 30px rgba(16,27,45,.06);
    --shadow-hover:0 14px 40px rgba(31,92,70,.14);
    --radius:18px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--ink);
    background:var(--bg);
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
  }
  /* fondo con grilla sutil + halo verde */
  .stage{
    min-height:100vh;
    position:relative;
    overflow:hidden;
    display:flex;
    align-items:flex-start;
    justify-content:center;
    padding:clamp(20px,4vw,56px) clamp(16px,4vw,40px);
  }
  .stage::before{
    content:"";
    position:absolute;inset:0;
    background:
      linear-gradient(180deg,#f4f8f8 0%,#e9f1ee 55%,#eef2f4 100%),
      radial-gradient(900px 500px at 85% 0%, rgba(79,175,130,.18), transparent 60%),
      radial-gradient(700px 500px at 0% 100%, rgba(47,138,99,.10), transparent 60%);
    z-index:0;
  }
  .stage::after{
    content:"";
    position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(31,92,70,.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(31,92,70,.05) 1px,transparent 1px);
    background-size:46px 46px;
    -webkit-mask-image:radial-gradient(120% 90% at 60% 10%,#000 30%,transparent 80%);
            mask-image:radial-gradient(120% 90% at 60% 10%,#000 30%,transparent 80%);
    z-index:0;
  }
  .wrap{position:relative;z-index:1;width:100%;max-width:860px}

  /* ---------- barra de progreso segmentada ---------- */
  .progress{margin-bottom:8px}
  .segs{display:flex;gap:8px}
  .seg{
    flex:1;height:12px;border-radius:999px;
    background:#dfe7e6;overflow:hidden;position:relative;
    transition:transform .2s ease;
  }
  .seg .fill{
    position:absolute;inset:0;width:0%;
    background:linear-gradient(90deg,var(--green-500),var(--green-700));
    border-radius:999px;transition:width .5s cubic-bezier(.4,0,.2,1);
  }
  .seg.done .fill{width:100%}
  .seg.current{box-shadow:0 0 0 4px rgba(79,175,130,.16)}
  .seg.current .fill{width:100%;opacity:.5}
  .meta{display:flex;justify-content:space-between;align-items:center;
    margin-top:10px;font-size:14px;color:var(--muted)}
  .meta .pct{color:var(--green-700);font-weight:700}

  /* ---------- pregunta ---------- */
  .eyebrow{
    margin:28px 0 14px;font-size:13px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--green-700);font-weight:700;
  }
  h1.q{
    font-size:clamp(26px,4.4vw,40px);line-height:1.14;
    font-weight:800;letter-spacing:-.01em;color:var(--ink);
    max-width:20ch;margin-bottom:clamp(22px,3vw,34px);
  }
  .options{display:flex;flex-direction:column;gap:14px}
  .opt{
    display:flex;align-items:center;gap:18px;
    background:var(--card);border:1.5px solid transparent;
    border-radius:var(--radius);padding:20px 22px;
    box-shadow:var(--shadow);cursor:pointer;text-align:left;width:100%;
    font-size:clamp(15px,1.8vw,17px);color:var(--ink-soft);font-weight:500;
    transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease;
  }
  .opt:hover{transform:translateY(-2px);box-shadow:var(--shadow-hover)}
  .opt:focus-visible{outline:none;border-color:var(--green-500);box-shadow:0 0 0 4px rgba(79,175,130,.22)}
  .opt .letter{
    flex:0 0 auto;width:42px;height:42px;border-radius:50%;
    display:grid;place-items:center;font-weight:700;font-size:15px;
    color:var(--green-700);background:#f1f7f4;border:1px solid var(--line);
    transition:background .2s ease,color .2s ease;
  }
  .opt.selected{border-color:var(--green-500);background:#f4fbf7}
  .opt.selected .letter{background:var(--green-700);color:#fff;border-color:var(--green-700)}

  /* ---------- navegación ---------- */
  .nav{display:flex;justify-content:space-between;align-items:center;margin-top:34px;gap:14px}
  .btn{
    border:none;border-radius:999px;padding:15px 26px;font-size:15px;font-weight:600;
    cursor:pointer;display:inline-flex;align-items:center;gap:9px;
    transition:transform .15s ease,box-shadow .2s ease,opacity .2s ease;font-family:inherit;
  }
  .btn-ghost{background:#fff;color:var(--ink-soft);box-shadow:var(--shadow)}
  .btn-ghost:hover{transform:translateY(-1px);box-shadow:var(--shadow-hover)}
  .btn-primary{background:linear-gradient(90deg,var(--green-700),var(--green-900));color:#fff;
    box-shadow:0 10px 24px rgba(31,92,70,.28)}
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(31,92,70,.36)}
  .btn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:var(--shadow)}
  .btn-primary:disabled{background:#c7d3cf;color:#fff;box-shadow:none}

  /* ---------- pantallas genéricas (intro / análisis / captura / resultado) ---------- */
  .screen{display:none;animation:fade .45s ease both}
  .screen.active{display:block}
  @keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

  .center{text-align:center;padding-top:clamp(20px,6vh,70px)}

  /* ---------- portada del agente ---------- */
  .cover{text-align:center;padding-top:clamp(10px,3vh,40px)}
  .cover .badge-pill{
    display:inline-flex;align-items:center;gap:9px;background:#fff;
    border:1px solid var(--line);border-radius:999px;padding:11px 22px;
    font-size:15px;font-weight:600;color:var(--ink);box-shadow:var(--shadow);margin-bottom:28px;
  }
  .cover .badge-pill .dot{width:10px;height:10px;border-radius:50%;
    background:linear-gradient(180deg,var(--green-500),var(--green-700))}
  .agent-logo{
    width:118px;height:118px;border-radius:26px;margin:0 auto 20px;
    display:grid;place-items:center;overflow:hidden;
    background:linear-gradient(160deg,var(--ink),#1b2740);
    box-shadow:0 16px 34px rgba(16,27,45,.22);
  }
  .agent-logo img{width:100%;height:100%;object-fit:cover}
  .agent-logo .initials{color:#fff;font-size:38px;font-weight:800;letter-spacing:.02em}
  .agent-name{font-size:clamp(22px,3.6vw,30px);font-weight:800;letter-spacing:-.01em;margin-bottom:8px;color:var(--ink)}
  .agent-role{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:24px}
  .cover h1.hook{
    font-size:clamp(30px,6.4vw,52px);line-height:1.06;font-weight:800;
    letter-spacing:-.02em;color:var(--ink);max-width:16ch;margin:0 auto 20px;
  }
  .cover .sub{font-size:clamp(16px,2.4vw,21px);color:var(--ink-soft);max-width:34ch;margin:0 auto 30px;line-height:1.5}
  .chips{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:32px}
  .chip{display:inline-flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line);
    border-radius:999px;padding:13px 22px;font-size:15px;font-weight:600;color:var(--ink-soft);box-shadow:var(--shadow)}
  .chip svg{width:18px;height:18px;stroke:var(--green-700);fill:none;stroke-width:2}
  .cover .btn-primary{font-size:17px;padding:18px 34px}
  .cover .wa{
    position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;
    background:#25d366;display:grid;place-items:center;box-shadow:0 10px 26px rgba(37,211,102,.45);
    z-index:5;cursor:pointer;text-decoration:none;transition:transform .15s ease;
  }
  .cover .wa:hover{transform:scale(1.06)}
  .cover .wa svg{width:30px;height:30px;fill:#fff}

  .badge{
    display:inline-block;font-size:12px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--green-700);font-weight:700;background:#e7f4ee;padding:8px 16px;border-radius:999px;
    margin-bottom:22px;
  }
  h2.big{font-size:clamp(30px,5.4vw,52px);line-height:1.08;font-weight:800;letter-spacing:-.02em;margin-bottom:18px}
  .lead{font-size:clamp(16px,2.2vw,20px);color:var(--ink-soft);max-width:46ch;margin:0 auto 30px;line-height:1.55}
  .pills{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:34px}
  .pill{background:#fff;border:1px solid var(--line);border-radius:999px;padding:10px 18px;font-size:14px;color:var(--ink-soft);box-shadow:var(--shadow)}

  /* ---------- análisis ---------- */
  .loader-ring{width:120px;height:120px;margin:10px auto 40px;position:relative}
  .loader-ring svg{width:100%;height:100%;animation:spin 2.4s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loader-core{
    position:absolute;inset:0;margin:auto;width:60px;height:60px;background:#fff;border-radius:50%;
    display:grid;place-items:center;box-shadow:0 8px 20px rgba(16,27,45,.10);font-size:24px;
  }
  .steps{max-width:340px;margin:0 auto;text-align:left;display:flex;flex-direction:column;gap:16px}
  .step{display:flex;align-items:center;gap:14px;color:var(--muted);opacity:.4;transition:opacity .4s ease,color .4s ease}
  .step.on{opacity:1;color:var(--ink-soft)}
  .step .tick{width:26px;height:26px;border-radius:50%;background:#dfe7e6;color:#fff;display:grid;place-items:center;font-size:13px;flex:0 0 auto;transition:background .4s ease}
  .step.on .tick{background:var(--green-700)}
  .thin-bar{max-width:420px;height:8px;border-radius:999px;background:#dfe7e6;margin:36px auto 0;overflow:hidden}
  .thin-bar .fill{height:100%;width:0%;background:linear-gradient(90deg,var(--green-500),var(--green-700));transition:width .3s linear}

  /* ---------- captura ---------- */
  .form-card{
    background:#fff;border-radius:22px;box-shadow:var(--shadow);
    padding:clamp(26px,4vw,42px);max-width:520px;margin:24px auto 0;text-align:left;
  }
  .field{margin-bottom:18px}
  .field label{display:block;font-size:14px;font-weight:600;color:var(--ink);margin-bottom:8px}
  .field input{
    width:100%;padding:15px 16px;border:1.5px solid #e2e8e6;border-radius:12px;
    font-size:16px;font-family:inherit;color:var(--ink);transition:border-color .2s ease,box-shadow .2s ease;
  }
  .field input:focus{outline:none;border-color:var(--green-500);box-shadow:0 0 0 4px rgba(79,175,130,.16)}
  .consent{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5}

  /* ---------- resultado ---------- */
  .score-wrap{display:flex;flex-direction:column;align-items:center;margin:6px auto 26px}
  .gauge{position:relative;width:200px;height:200px}
  .gauge svg{transform:rotate(-90deg)}
  .gauge .num{position:absolute;inset:0;display:grid;place-items:center;flex-direction:column;text-align:center}
  .gauge .num b{font-size:52px;font-weight:800;line-height:1;color:var(--ink)}
  .gauge .num span{display:block;font-size:13px;color:var(--muted);margin-top:4px;letter-spacing:.05em}
  .level-tag{display:inline-block;margin-top:14px;padding:8px 20px;border-radius:999px;font-weight:700;font-size:15px}
  .result-body{max-width:560px;margin:8px auto 0;text-align:left}
  .result-body h3{font-size:20px;margin:26px 0 12px;color:var(--ink)}
  .bkdn{display:flex;flex-direction:column;gap:12px}
  .bar-row{background:#fff;border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}
  .bar-row .top{display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:8px}
  .bar-row .track{height:8px;border-radius:999px;background:#e9eeec;overflow:hidden}
  .bar-row .track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green-500),var(--green-700))}
  .reco{background:#f4fbf7;border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-top:22px;color:var(--ink-soft);line-height:1.6;font-size:15px}
  .cta-final{display:flex;flex-direction:column;gap:12px;align-items:center;margin:34px auto 10px;max-width:520px}
  .cta-final .btn{width:100%;justify-content:center;font-size:16px;padding:17px}
  .cta-note{font-size:13px;color:var(--muted);text-align:center}
  .restart{background:none;border:none;color:var(--green-700);font-weight:600;cursor:pointer;font-size:14px;margin-top:8px;font-family:inherit}

  @media(max-width:560px){
    .opt{padding:16px 16px;gap:14px}
    .opt .letter{width:36px;height:36px;font-size:14px}
    .nav .btn{padding:13px 20px}
  }
`;

export const DIAGNOSTICO_BODY_HTML = `
<div class="stage">
  <div class="wrap">

    <!-- ============ PORTADA DEL AGENTE (personalizable) ============ -->
    <section class="screen active cover" id="intro">
      <span class="badge-pill"><span class="dot"></span> <span id="coverBadge">Diagnóstico interactivo</span></span>
      <div class="agent-logo" id="agentLogo"><span class="initials" id="agentInitials">ES</span></div>
      <div class="agent-name" id="agentName">Nombre del Agente</div>
      <div class="agent-role" id="agentRole">Asesoría Financiera</div>
      <h1 class="hook" id="coverHook">¿Cuántos meses de gastos realmente necesitas ahorrar para estar seguro?</h1>
      <p class="sub" id="coverSub">Descubre si tu fondo de emergencia es suficiente y cómo proteger tu estabilidad financiera.</p>
      <div class="chips">
        <span class="chip"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> <span id="coverTime">~3 min</span></span>
        <span class="chip"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> <span id="coverCount">7 preguntas</span></span>
      </div>
      <button class="btn btn-primary" onclick="start()">Comenzar diagnóstico →</button>
      <a class="wa" id="waBtn" href="#" target="_blank" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.2-1.7-.8-1.9-.9-.3-.1-.5-.2-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1 1 12 20.3z"/></svg>
      </a>
    </section>

    <!-- ============ QUIZ ============ -->
    <section class="screen" id="quiz">
      <div class="progress">
        <div class="segs" id="segs"></div>
        <div class="meta">
          <span id="qcount">Pregunta 1 de 7</span>
          <span class="pct" id="qpct">14%</span>
        </div>
      </div>

      <div class="eyebrow" id="eyebrow">Pregunta 1 de 7</div>
      <h1 class="q" id="qtext">…</h1>
      <div class="options" id="options"></div>

      <div class="nav">
        <button class="btn btn-ghost" id="prevBtn" onclick="prev()">← Anterior</button>
        <button class="btn btn-primary" id="nextBtn" onclick="next()" disabled>Siguiente →</button>
      </div>
    </section>

    <!-- ============ ANÁLISIS ============ -->
    <section class="screen center" id="analyzing">
      <div class="loader-ring">
        <svg viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="52" stroke="#8fd0b0" stroke-width="3" stroke-dasharray="60 260" stroke-linecap="round"/>
          <circle cx="60" cy="60" r="44" stroke="#6f7bd0" stroke-width="3" stroke-dasharray="40 240" stroke-linecap="round"/>
          <circle cx="60" cy="60" r="36" stroke="#2f8a63" stroke-width="3" stroke-dasharray="50 180" stroke-linecap="round"/>
        </svg>
        <div class="loader-core">🧠</div>
      </div>
      <h2 class="big" style="font-size:clamp(26px,4.4vw,38px)">Analizando tus respuestas</h2>
      <div class="steps" style="margin-top:26px">
        <div class="step" id="st1"><span class="tick">✓</span> Evaluando respuestas…</div>
        <div class="step" id="st2"><span class="tick">✓</span> Calculando tu perfil…</div>
        <div class="step" id="st3"><span class="tick">✓</span> Generando recomendaciones…</div>
      </div>
      <div class="thin-bar"><div class="fill" id="analyzeFill"></div></div>
    </section>

    <!-- ============ CAPTURA ============ -->
    <section class="screen center" id="capture">
      <span class="badge">Tu diagnóstico está listo</span>
      <h2 class="big" style="font-size:clamp(26px,4.6vw,42px)">¿A dónde enviamos<br>tu resultado?</h2>
      <p class="lead">Déjanos tus datos para mostrarte el diagnóstico completo y tu plan de prioridades.</p>
      <div class="form-card">
        <div class="field">
          <label for="name">Nombre</label>
          <input id="name" type="text" placeholder="Tu nombre" autocomplete="given-name">
        </div>
        <div class="field">
          <label for="email">Correo electrónico</label>
          <input id="email" type="email" placeholder="tucorreo@ejemplo.com" autocomplete="email">
        </div>
        <div class="field">
          <label for="phone">WhatsApp</label>
          <input id="phone" type="tel" placeholder="+52 55 0000 0000" autocomplete="tel">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;font-size:16px;padding:16px" onclick="submitLead()">Ver mi diagnóstico →</button>
        <p class="consent">Al continuar aceptas recibir tu resultado y contacto de seguimiento. Tus datos están seguros y no se comparten con terceros.</p>
      </div>
    </section>

    <!-- ============ RESULTADO ============ -->
    <section class="screen center" id="result">
      <span class="badge" id="resGreeting">Tu diagnóstico</span>
      <div class="score-wrap">
        <div class="gauge">
          <svg width="200" height="200">
            <circle cx="100" cy="100" r="86" stroke="#e3ebe8" stroke-width="16" fill="none"/>
            <circle id="gaugeArc" cx="100" cy="100" r="86" stroke="#2f8a63" stroke-width="16" fill="none"
              stroke-linecap="round" stroke-dasharray="540" stroke-dashoffset="540"/>
          </svg>
          <div class="num"><div><b id="scoreNum">0</b><span>DE 100</span></div></div>
        </div>
        <span class="level-tag" id="levelTag">…</span>
      </div>

      <div class="result-body">
        <p class="lead" id="resLead" style="margin-bottom:0"></p>

        <h3>Tu perfil por área</h3>
        <div class="bkdn" id="breakdown"></div>

        <div class="reco" id="reco"></div>

        <div class="cta-final">
          <button class="btn btn-primary" onclick="cta()">Agendar mi sesión gratuita →</button>
          <p class="cta-note" id="ctaNote">30 minutos, sin compromiso. Repasamos tu diagnóstico y tu siguiente paso.</p>
        </div>
        <div style="text-align:center"><button class="restart" onclick="restart()">↺ Volver a empezar</button></div>
      </div>
    </section>

  </div>
</div>
`;

export const DIAGNOSTICO_LOGIC_JS = `
const AGENTE = window.__DIAGNOSTICO_DATA__.agente;
const QUESTIONS = window.__DIAGNOSTICO_DATA__.questions;
const LEVELS = window.__DIAGNOSTICO_DATA__.levels;
const DIAGNOSTICO_SLUG = window.__DIAGNOSTICO_DATA__.slug;

fetch(\`/api/public/mini-apps/\${DIAGNOSTICO_SLUG}/visit\`, { method: 'POST', keepalive: true }).catch(()=>{});

const CONFIG = {
  ctaUrl: AGENTE.ctaUrl,
  webhookUrl: AGENTE.webhookUrl,
};

function applyAgent(){
  const set = (id,val)=>{ const el=$(id); if(el) el.textContent=val; };
  const brandName = AGENTE.marca ? \`\${AGENTE.nombre}_\${AGENTE.marca}\` : AGENTE.nombre;
  set('agentName', brandName);
  set('agentRole', AGENTE.rol);
  set('coverBadge', AGENTE.badge);
  set('coverHook', AGENTE.titulo);
  set('coverSub', AGENTE.subtitulo);
  set('coverTime', AGENTE.time || '~3 min');
  set('coverCount', \`\${QUESTIONS.length} preguntas\`);
  document.title = \`\${AGENTE.nombre} · Diagnóstico\`;

  const logo = $('agentLogo');
  if(AGENTE.logoUrl){ logo.innerHTML = \`<img src="\${AGENTE.logoUrl}" alt="\${AGENTE.nombre}">\`; }
  else { $('agentInitials').textContent = AGENTE.iniciales || AGENTE.nombre.slice(0,2).toUpperCase(); }

  const wa = $('waBtn');
  if(AGENTE.whatsapp){
    const msg = encodeURIComponent(\`Hola \${AGENTE.nombre}, acabo de hacer el diagnóstico y quiero más información.\`);
    wa.href = \`https://wa.me/\${AGENTE.whatsapp}?text=\${msg}\`;
  } else { wa.style.display='none'; }
}

const answers = new Array(QUESTIONS.length).fill(null);
let cur = 0;
let lead = {};

const $ = id => document.getElementById(id);
function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); }

/* segmentos de progreso */
function buildSegs(){
  const c = $('segs'); c.innerHTML='';
  QUESTIONS.forEach(()=>{ const d=document.createElement('div'); d.className='seg'; d.innerHTML='<i class="fill"></i>'; c.appendChild(d); });
}
function start(){ buildSegs(); cur=0; render(); show('quiz'); }

function render(){
  const q = QUESTIONS[cur];
  const total = QUESTIONS.length;
  const pct = Math.round(((cur+1)/total)*100);
  $('qcount').textContent = \`Pregunta \${cur+1} de \${total}\`;
  $('qpct').textContent = pct+'%';
  $('eyebrow').textContent = \`Pregunta \${cur+1} de \${total}\`;
  $('qtext').textContent = q.text;

  // segmentos
  document.querySelectorAll('.seg').forEach((s,i)=>{
    s.classList.remove('done','current');
    if(i < cur) s.classList.add('done');
    else if(i === cur) s.classList.add('current');
  });

  // opciones
  const box = $('options'); box.innerHTML='';
  q.options.forEach((o,i)=>{
    const b = document.createElement('button');
    b.className = 'opt' + (answers[cur]===i ? ' selected':'');
    b.innerHTML = \`<span class="letter">\${'ABCD'[i]}</span><span>\${o.t}</span>\`;
    b.onclick = ()=>{ answers[cur]=i; render(); };
    box.appendChild(b);
  });

  $('prevBtn').style.visibility = cur===0 ? 'hidden':'visible';
  $('nextBtn').disabled = answers[cur]===null;
  $('nextBtn').textContent = cur===total-1 ? 'Ver resultado →' : 'Siguiente →';
}

function prev(){ if(cur>0){cur--; render();} }
function next(){
  if(answers[cur]===null) return;
  if(cur < QUESTIONS.length-1){ cur++; render(); }
  else { runAnalysis(); }
}

/* pantalla de análisis animada */
function runAnalysis(){
  show('analyzing');
  ['st1','st2','st3'].forEach(s=>$(s).classList.remove('on'));
  $('analyzeFill').style.width='0%';
  const steps=['st1','st2','st3'];
  steps.forEach((s,i)=> setTimeout(()=>$(s).classList.add('on'), 500 + i*650));
  let p=0; const iv=setInterval(()=>{ p+=4; $('analyzeFill').style.width=Math.min(p,100)+'%'; if(p>=100) clearInterval(iv); },80);
  setTimeout(()=> show('capture'), 2600);
}

/* captura de lead */
function submitLead(){
  const name=$('name').value.trim(), email=$('email').value.trim(), phone=$('phone').value.trim();
  if(!name){ $('name').focus(); return; }
  if(!/^[^@]+@[^@]+\\.[^@]+$/.test(email)){ $('email').focus(); return; }
  if(phone.replace(/\\D/g,'').length < 8){ $('phone').focus(); return; }
  lead = {name,email,phone,score:computeScore().pct,answers,ts:new Date().toISOString()};

  const nowIso = new Date().toISOString();
  fetch(\`/api/public/mini-apps/\${DIAGNOSTICO_SLUG}/hosted-lead\`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ nombre:name, whatsapp:phone, email, fecha:nowIso, consentimiento:true, consentimiento_fecha:nowIso, answers }),
  }).catch(()=>{});

  if(CONFIG.webhookUrl){
    fetch(CONFIG.webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead)}).catch(()=>{});
  }
  showResult();
}

/* cálculo de puntaje */
function computeScore(){
  let raw=0, maxRaw=0; const areas={};
  QUESTIONS.forEach((q,i)=>{
    const w = q.options[answers[i]].w;
    raw += w; maxRaw += 3;
    if(!areas[q.area]) areas[q.area]={sum:0,max:0};
    areas[q.area].sum += w; areas[q.area].max += 3;
  });
  const pct = Math.round((raw/maxRaw)*100);
  return {pct, areas};
}
function levelFor(pct){ return LEVELS.find(l=> pct>=l.min && pct<=l.max) || LEVELS[0]; }

function showResult(){
  const {pct, areas} = computeScore();
  const lv = levelFor(pct);

  $('resGreeting').textContent = lead.name ? \`Resultado de \${lead.name}\` : 'Tu diagnóstico';
  $('resLead').textContent = lv.lead;

  // gauge
  const tag=$('levelTag'); tag.textContent=lv.name; tag.style.color=lv.color; tag.style.background=lv.bg;
  $('gaugeArc').setAttribute('stroke', lv.color);
  show('result');
  // animaciones tras render
  requestAnimationFrame(()=>{
    const circ=540, off=circ - (pct/100)*circ;
    $('gaugeArc').style.transition='stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)';
    $('gaugeArc').style.strokeDashoffset=off;
    let n=0; const iv=setInterval(()=>{ n+=Math.ceil(pct/34); if(n>=pct){n=pct;clearInterval(iv);} $('scoreNum').textContent=n; },30);
  });

  // desglose por área
  const bd=$('breakdown'); bd.innerHTML='';
  Object.entries(areas).forEach(([name,v])=>{
    const p = Math.round((v.sum/v.max)*100);
    const row=document.createElement('div'); row.className='bar-row';
    row.innerHTML=\`<div class="top"><span>\${name}</span><span>\${p}%</span></div><div class="track"><i style="width:0%"></i></div>\`;
    bd.appendChild(row);
    requestAnimationFrame(()=> setTimeout(()=> row.querySelector('i').style.cssText=\`width:\${p}%;transition:width .9s ease\`, 200));
  });

  $('reco').innerHTML = \`<strong>Tu siguiente paso:</strong> \${lv.reco}\`;
  $('ctaNote').textContent = \`30 minutos con \${AGENTE.nombre}, sin compromiso. Repasamos tu diagnóstico y tu siguiente paso.\`;
}

function cta(){ window.open(CONFIG.ctaUrl,'_blank'); }
function restart(){ answers.fill(null); cur=0; lead={}; ['name','email','phone'].forEach(id=>$(id).value=''); show('intro'); }

/* inicializa la portada con los datos del agente */
applyAgent();

/* teclado: 1-4 para opciones, Enter para avanzar */
document.addEventListener('keydown',e=>{
  if(!$('quiz').classList.contains('active')) return;
  if(['1','2','3','4'].includes(e.key)){ const i=+e.key-1; if(QUESTIONS[cur].options[i]){answers[cur]=i;render();} }
  if(e.key==='Enter' && answers[cur]!==null) next();
});
`;
