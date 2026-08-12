/** Plantilla verbatim de "Calculadora de Capacidad de Generar Ingresos" —
 * CSS, HTML y JS copiados literal del archivo original que sirvió de base a
 * este tipo de Mini App (mismo diseño Fraunces/Inter/IBM Plex Mono, mismo
 * flujo portada→form→lead→loading→resultado, misma fórmula de proyección,
 * sin ningún rediseño). Las ÚNICAS diferencias respecto del original, dentro
 * de CALCULADORA_INGRESOS_LOGIC_JS, son:
 *
 * 1. `BRAND_CONFIG` (antes hardcodeado como `const`) ahora arranca de
 *    `window.__CALCULADORA_INGRESOS_DATA__.brand`, inyectado por
 *    CalculadoraIngresosApp a partir de la config guardada en el CRM —
 *    como objeto mutable (`Object.assign`), porque el propio flujo original
 *    ya lo modifica en tiempo de ejecución (pantalla de setup de WhatsApp,
 *    parámetros de URL). `DEFAULTS` (growth/discount/edad de retiro) queda
 *    tal cual — no es editable desde el wizard en esta versión.
 * 2. `BRAND_CONFIG.crmWebhookUrl` pasa a llamarse `BRAND_CONFIG.webhookURL`
 *    (mismo nombre de campo que ya usa DiagnosticoSolidezBrand) — dentro de
 *    `sendLeadToCRM(leadData)`, además del `fetch` original a esa URL (que
 *    sigue disparando solo si el asesor configuró su propio webhook
 *    externo), se agrega un `fetch` a
 *    `/api/public/mini-apps/{slug}/hosted-lead` con el contrato que
 *    `processLeadSubmission` (ingest.ts) exige — así el lead queda
 *    registrado en el CRM. Los campos numéricos (`edad`/`edad_retiro`/
 *    `ingreso_actual`/etc.) se mandan sueltos en vez de anidados dentro de
 *    `inputs`, mismo formato snake_case que ya usan simulador_retiro/
 *    calculadora_brecha_retiro en ingest.ts — el resultado calculado en el
 *    navegador (`state.result`) nunca se manda: ingest.ts lo recalcula de
 *    forma autoritativa a partir de esos inputs. La UI de resultado no
 *    cambia en nada.
 * 3. Se agrega un `fetch` fire-and-forget a
 *    `/api/public/mini-apps/{slug}/visit` al cargar, igual que los demás
 *    tipos de Mini App, para que el conteo de visitas de la pestaña
 *    Analíticas funcione también acá.
 * 4. Todo el script queda envuelto en un IIFE — mismo motivo documentado en
 *    diagnosticoSolidezTemplate.ts: los `const` de nivel superior (`app`,
 *    `state`, `render`, etc.) podrían chocar con globals del propio runtime
 *    de Next.js si quedaran sueltos en `window`. Los botones ya usaban
 *    `.onclick = ...` (asignación de propiedad, no atributos HTML inline),
 *    así que no hizo falta tocarlos.
 *
 * Todo el resto — CSS, HTML, y cada función de CALCULADORA_INGRESOS_LOGIC_JS —
 * es una copia literal del archivo original.
 */

export const CALCULADORA_INGRESOS_CSS = `

/* ============================================================
   CALCULADORA DE CAPACIDAD DE GENERAR INGRESOS —
   Mismo sistema de tokens que el Diagnóstico de Solidez Financiera.
   Ver BRAND_CONFIG en el JS para reutilizar con otro asesor.
   ============================================================ */

:root{
  --ink:#162D4F;
  --ink-deep:#0B1B30;
  --paper:#FAF9F5;
  --paper-dim:#F1EFE6;
  --lime:#C7D400;
  --lime-deep:#96A300;
  --slate:#5B6472;
  --line: rgba(22,45,79,.14);
  --line-strong: rgba(22,45,79,.30);
  --ff-display:'Fraunces', Georgia, serif;
  --ff-body:'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --ff-mono:'IBM Plex Mono', 'SF Mono', monospace;
  --maxw: 560px;
}

*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  font-family:var(--ff-body);
  background:var(--paper);
  color:var(--ink);
  -webkit-font-smoothing:antialiased;
  line-height:1.5;
}
img{max-width:100%;display:block;}
button{font-family:inherit;cursor:pointer;}
input{font-family:inherit;}
@media (prefers-reduced-motion: reduce){
  *{animation-duration:.01ms !important;transition-duration:.01ms !important;}
}

#app{min-height:100vh;display:flex;flex-direction:column;}
.screen{
  width:100%;max-width:var(--maxw);margin:0 auto;
  padding:64px 24px 64px;
  flex:1;display:flex;flex-direction:column;
  animation:fadeUp .5s cubic-bezier(.16,1,.3,1);
}
@keyframes fadeUp{
  from{opacity:0;transform:translateY(10px);}
  to{opacity:1;transform:translateY(0);}
}

/* ---------- portada ---------- */
.portada{text-align:center;padding-top:56px;justify-content:center;}
.logo-wrap{margin:0 auto 8px;max-width:220px;}
.logo-wrap-text{
  font-family:var(--ff-display);font-size:22px;font-weight:500;color:var(--ink);
  margin:0 auto 8px;letter-spacing:.01em;text-align:center;
}
.tagline{
  font-family:var(--ff-mono);font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--slate);margin-bottom:40px;
}
.hero-title{
  font-family:var(--ff-display);font-weight:500;
  font-size:clamp(27px,6vw,36px);line-height:1.2;
  color:var(--ink);margin:0 0 18px;letter-spacing:-.01em;
}
.hero-sub{
  font-size:16px;color:var(--slate);line-height:1.6;
  max-width:440px;margin:0 auto 32px;
}
.trust-row{
  display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;
  margin-bottom:36px;
}
.trust-item{
  font-size:13px;color:var(--ink);display:flex;align-items:center;gap:6px;
  font-family:var(--ff-mono);
}
.trust-item::before{content:'✓';color:var(--lime-deep);font-weight:700;}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  border:none;border-radius:8px;padding:16px 28px;
  font-size:15px;font-weight:600;letter-spacing:.01em;
  transition:transform .15s ease, box-shadow .15s ease, background .15s ease;
  width:100%;
}
.btn-primary{background:var(--lime);color:var(--ink-deep);}
.btn-primary:hover{background:var(--lime-deep);transform:translateY(-1px);}
.btn-primary:active{transform:translateY(0);}
.btn-outline{
  background:transparent;color:var(--paper);border:1.5px solid rgba(250,249,245,.4);
}
.btn-outline:hover{border-color:var(--paper);background:rgba(250,249,245,.08);}
.micro{font-size:12px;color:var(--slate);margin-top:14px;}

/* ---------- form (inputs) ---------- */
.form-title{
  font-family:var(--ff-display);font-size:clamp(24px,5vw,30px);
  font-weight:500;color:var(--ink);margin:0 0 10px;
}
.form-sub{font-size:15px;color:var(--slate);margin:0 0 30px;line-height:1.55;}
.field{margin-bottom:16px;}
.field label{
  display:block;font-family:var(--ff-mono);font-size:11px;
  text-transform:uppercase;letter-spacing:.08em;color:var(--slate);margin-bottom:7px;
}
.field .hint{font-size:12px;color:var(--slate);margin-top:6px;}
.field input{
  width:100%;padding:14px 16px;border:1.5px solid var(--line-strong);
  border-radius:8px;font-size:15px;color:var(--ink);background:var(--paper);
  transition:border-color .15s ease;
}
.field input:focus{outline:none;border-color:var(--ink);}
.field input.invalid{border-color:#B3401F;}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}

.advanced-toggle{
  background:none;border:none;padding:0;margin:6px 0 22px;
  font-family:var(--ff-mono);font-size:12px;color:var(--slate);
  text-decoration:underline;text-underline-offset:3px;
}
.advanced-toggle:hover{color:var(--ink);}
.advanced-panel{
  display:none;background:var(--paper-dim);border-radius:10px;
  padding:18px 18px 4px;margin-bottom:22px;
}
.advanced-panel.open{display:block;}

.consent{
  display:flex;gap:10px;align-items:flex-start;margin:20px 0 26px;
  font-size:13px;color:var(--slate);line-height:1.5;
}
.consent input{margin-top:3px;flex-shrink:0;}

.error-banner{
  font-size:13px;color:#B3401F;background:rgba(179,64,31,.08);
  border-radius:8px;padding:10px 14px;margin-bottom:18px;display:none;
}
.error-banner.show{display:block;}

/* ---------- loading ---------- */
.loading{align-items:center;justify-content:center;text-align:center;flex:1;}
.loading-line{
  width:140px;height:2px;background:var(--line);margin:26px auto 0;overflow:hidden;
  position:relative;
}
.loading-line::after{
  content:'';position:absolute;left:-40%;top:0;bottom:0;width:40%;
  background:var(--lime);animation:loadsweep 1.1s ease-in-out infinite;
}
@keyframes loadsweep{
  0%{left:-40%;} 50%{left:60%;} 100%{left:100%;}
}
.loading p{font-family:var(--ff-mono);font-size:13px;color:var(--slate);}

/* ---------- result ---------- */
.result-eyebrow{
  font-family:var(--ff-mono);font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--slate);margin-bottom:6px;
}
.result-for{font-size:14px;color:var(--slate);margin-bottom:36px;}
.index-block{border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  padding:32px 0;margin-bottom:8px;text-align:center;}
.index-label{font-family:var(--ff-mono);font-size:12px;color:var(--slate);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;}
.index-number{
  font-family:var(--ff-mono);font-weight:600;
  font-size:clamp(34px,9vw,52px);color:var(--ink);line-height:1.1;
  letter-spacing:-.01em;
}
.index-sub{font-size:13.5px;color:var(--slate);margin-top:12px;}

.ledger{margin:32px 0 8px;}
.ledger-title{
  font-family:var(--ff-mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.1em;color:var(--slate);margin-bottom:18px;
}
.ledger-row{
  display:grid;grid-template-columns:1fr auto;align-items:center;
  gap:4px 14px;padding:12px 0;border-bottom:1px solid var(--line);
}
.ledger-row:last-child{border-bottom:none;}
.ledger-name{font-size:14px;color:var(--ink);font-weight:500;}
.ledger-score{font-family:var(--ff-mono);font-size:14px;color:var(--ink);font-weight:600;
  text-align:right;}
.ledger-bar-track{
  grid-column:1/-1;height:4px;background:var(--paper-dim);border-radius:2px;overflow:hidden;
}
.ledger-bar-fill{height:100%;background:var(--lime);width:0%;
  transition:width 1s cubic-bezier(.16,1,.3,1);border-radius:2px;}

.pv-block{
  margin:32px 0 0;padding:22px;background:var(--paper-dim);border-radius:12px;
}
.pv-label{font-family:var(--ff-mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.08em;color:var(--slate);margin-bottom:8px;}
.pv-number{font-family:var(--ff-mono);font-weight:600;font-size:26px;color:var(--ink);}
.pv-text{font-size:13px;color:var(--slate);margin-top:8px;line-height:1.55;}

.interp-block{padding:20px 0;border-top:1px solid var(--line);margin-top:16px;}
.interp-label{
  font-family:var(--ff-mono);font-size:11px;text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:8px;color:var(--ink);
}
.interp-text{font-size:14.5px;color:var(--ink);line-height:1.6;}

.disclaimer{font-size:11.5px;color:var(--slate);line-height:1.6;margin:20px 0 0;
  padding-top:20px;border-top:1px solid var(--line);}

.cta-section{
  background:var(--ink-deep);color:var(--paper);
  padding:52px 24px;margin-top:48px;border-radius:14px;
  text-align:center;
}
.cta-section h3{
  font-family:var(--ff-display);font-weight:500;font-size:clamp(22px,5vw,27px);
  margin:0 0 14px;color:#fff;
}
.cta-section p{font-size:14.5px;color:rgba(250,249,245,.72);line-height:1.65;
  margin:0 0 8px;max-width:420px;margin-left:auto;margin-right:auto;}
.cta-highlight{
  font-family:var(--ff-mono);font-size:12px;letter-spacing:.06em;
  color:var(--lime);text-transform:uppercase;margin:22px 0 6px;
}
.cta-duration{font-size:13px;color:rgba(250,249,245,.6);margin-bottom:26px;}
.cta-buttons{display:flex;flex-direction:column;gap:12px;max-width:340px;margin:0 auto;}

#wa-float{
  position:fixed;bottom:20px;right:20px;z-index:60;
  width:54px;height:54px;border-radius:50%;background:var(--ink);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 16px rgba(11,27,48,.28);
  transition:transform .2s ease;text-decoration:none;
}
#wa-float:hover{transform:scale(1.06);}
#wa-float svg{width:26px;height:26px;}

@media (max-width:480px){
  .screen{padding:56px 18px 56px;}
  .cta-section{padding:40px 18px;border-radius:10px;}
  .field-row{grid-template-columns:1fr;}
}
`;

export const CALCULADORA_INGRESOS_BODY_HTML = `
<div id="app"></div>
<a id="wa-float" href="#" target="_blank" rel="noopener" aria-label="Hablar por WhatsApp" title="¿Dudas? Escríbenos">
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.6 6.32A7.85 7.85 0 0 0 12.02 4a7.94 7.94 0 0 0-6.87 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.8 1h.02A7.94 7.94 0 0 0 20 12a7.9 7.9 0 0 0-2.4-5.68Zm-5.58 12.2h-.01a6.6 6.6 0 0 1-3.35-.92l-.24-.14-2.49.65.67-2.43-.16-.25a6.58 6.58 0 0 1 5.6-10.1 6.5 6.5 0 0 1 4.63 1.93 6.5 6.5 0 0 1 1.92 4.63 6.6 6.6 0 0 1-6.57 6.63Zm3.6-4.93c-.2-.1-1.17-.58-1.35-.64-.18-.07-.31-.1-.45.1-.13.19-.5.64-.62.78-.11.13-.23.15-.42.05-.2-.1-.83-.3-1.58-.97-.58-.52-.98-1.16-1.09-1.36-.11-.2-.01-.3.09-.4.09-.1.2-.24.3-.36.1-.13.13-.22.2-.36.06-.14.03-.26-.02-.36-.05-.1-.45-1.08-.61-1.48-.16-.38-.33-.33-.45-.34h-.38c-.13 0-.34.05-.52.24-.18.19-.68.66-.68 1.62 0 .95.7 1.87.79 2 .1.13 1.37 2.1 3.33 2.94.46.2.83.32 1.11.41.47.15.9.13 1.24.08.38-.06 1.17-.48 1.33-.94.17-.46.17-.85.12-.94-.05-.09-.18-.14-.38-.24Z" fill="#C7D400"/>
  </svg>
</a>
`;

export const CALCULADORA_INGRESOS_LOGIC_JS = `
(function(){

const DATA = window.__CALCULADORA_INGRESOS_DATA__;
const CALCULADORA_INGRESOS_SLUG = DATA.slug;

/* ============================================================
   BRAND_CONFIG — viene del CRM (config del Mini App). Mutable
   porque la pantalla de setup y los parámetros de URL lo modifican
   en tiempo de ejecución.
   ============================================================ */
const BRAND_CONFIG = Object.assign({}, DATA.brand);

/* ============================================================
   PERSONALIZACIÓN POR LINK
   Cada asesor puede tener su propio link con su WhatsApp (y
   opcionalmente nombre, Calendly y logo) agregando parámetros a
   la URL. Alan puede generar estos links desde el CRM, o el
   asesor puede armar el suyo con la pantalla de configuración
   que aparece automáticamente si todavía no tiene WhatsApp.
   Ejemplo: ?whatsapp=5215512345678&advisor=Diego%20Tinoco
   ============================================================ */
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('whatsapp')) BRAND_CONFIG.whatsapp = urlParams.get('whatsapp');
if (urlParams.get('advisor')) BRAND_CONFIG.advisorName = urlParams.get('advisor');
if (urlParams.get('empresa')) BRAND_CONFIG.companyName = urlParams.get('empresa');
if (urlParams.get('calendly')) BRAND_CONFIG.calendly = decodeURIComponent(urlParams.get('calendly'));
if (urlParams.get('logo')) BRAND_CONFIG.logo = decodeURIComponent(urlParams.get('logo'));

const NEEDS_WHATSAPP_SETUP = !BRAND_CONFIG.whatsapp;

function buildPersonalizedUrl(whatsapp){
  const url = new URL(window.location.href);
  url.searchParams.set('whatsapp', whatsapp);
  return url.toString();
}

const DEFAULTS = { growth: 3, discount: 5, retireAge: 65 };

const state = {
  screen: NEEDS_WHATSAPP_SETUP ? 'setup' : 'portada',
  inputs:{ edad:'', edadRetiro:String(DEFAULTS.retireAge), ingreso:'', growth:String(DEFAULTS.growth), discount:String(DEFAULTS.discount) },
  lead:{nombre:'',email:'',whatsapp:''},
  result:null
};

const app = document.getElementById('app');
const waFloat = document.getElementById('wa-float');
function initWaFloat(){
  waFloat.href = \`https://wa.me/\${BRAND_CONFIG.whatsapp}?text=\${encodeURIComponent('Hola, tengo una duda sobre la Calculadora de Capacidad de Generar Ingresos.')}\`;
  waFloat.setAttribute('aria-label', \`Hablar por WhatsApp con \${BRAND_CONFIG.advisorName}\`);
  waFloat.setAttribute('title', \`¿Dudas? Escríbele a \${BRAND_CONFIG.advisorName}\`);
  waFloat.style.display = 'flex';
}
if(NEEDS_WHATSAPP_SETUP){ waFloat.style.display = 'none'; } else { initWaFloat(); }

/* ============================================================
   ANALYTICS / CRM
   ============================================================ */
function trackEvent(name, payload){
  console.log('[trackEvent]', name, payload || {});
}
function sendLeadToCRM(leadData){
  // Webhook externo opcional del asesor — sigue disparando solo si lo configuró.
  if(BRAND_CONFIG.webhookURL){
    fetch(BRAND_CONFIG.webhookURL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(leadData)
    }).catch(err=>console.error('[sendLeadToCRM] error al enviar al webhook externo', err));
  }
  // Registro real del lead en el CRM de Growth Link.
  var hostedPayload = Object.assign({}, leadData, { consentimiento: true, consentimiento_fecha: leadData.fecha });
  fetch('/api/public/mini-apps/' + CALCULADORA_INGRESOS_SLUG + '/hosted-lead', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(hostedPayload)
  }).catch(err=>console.error('[sendLeadToCRM] error al enviar al CRM', err));
}
fetch('/api/public/mini-apps/' + CALCULADORA_INGRESOS_SLUG + '/visit', { method:'POST', keepalive:true }).catch(()=>{});
trackEvent('app_started');

function fmtMXN(n){
  return new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(n);
}

function render(){
  window.scrollTo(0,0);
  if(state.screen==='setup') return renderSetup();
  if(state.screen==='portada') return renderPortada();
  if(state.screen==='form') return renderForm();
  if(state.screen==='lead') return renderLead();
  if(state.screen==='loading') return renderLoading();
  if(state.screen==='result') return renderResult();
}

function renderPortada(){
  app.innerHTML = \`
  <div class="screen portada">
    \${BRAND_CONFIG.logo ? \`<div class="logo-wrap"><img src="\${BRAND_CONFIG.logo}" alt="\${BRAND_CONFIG.advisorName}"></div>\` : \`<div class="logo-wrap-text">\${BRAND_CONFIG.advisorName}</div>\`}
    <div class="tagline">Protección patrimonial y planeación financiera</div>
    <h1 class="hero-title">¿Cuánto vale tu capacidad de generar ingresos?</h1>
    <p class="hero-sub">Tu ingreso futuro es, probablemente, tu activo más grande — más grande que tu casa o tu auto. Descubre cuánto dinero depende, literalmente, de que puedas seguir trabajando.</p>
    <div class="trust-row">
      <span class="trust-item">2 minutos</span>
      <span class="trust-item">Cálculo personalizado</span>
      <span class="trust-item">Sin compromisos</span>
      <span class="trust-item">Información confidencial</span>
    </div>
    <button class="btn btn-primary" id="start-btn">Calcular mi valor</button>
    <p class="micro">Solo necesitamos tu edad, tu ingreso y tu edad de retiro planeada.</p>
  </div>\`;
  document.getElementById('start-btn').onclick = ()=>{
    trackEvent('calculator_started');
    state.screen='form'; render();
  };
}

function renderForm(){
  app.innerHTML = \`
  <div class="screen">
    <h2 class="form-title">Cuéntanos sobre tu situación</h2>
    <p class="form-sub">Con estos datos calculamos cuánto dinero representa tu capacidad de seguir generando ingresos.</p>
    <div class="error-banner" id="error-banner"></div>

    <div class="field-row">
      <div class="field">
        <label for="f-edad">Edad actual</label>
        <input id="f-edad" type="number" inputmode="numeric" placeholder="Ej. 35" value="\${state.inputs.edad}">
      </div>
      <div class="field">
        <label for="f-retiro">Edad de retiro planeada</label>
        <input id="f-retiro" type="number" inputmode="numeric" placeholder="Ej. 65" value="\${state.inputs.edadRetiro}">
      </div>
    </div>

    <div class="field">
      <label for="f-ingreso">Ingreso mensual actual (MXN)</label>
      <input id="f-ingreso" type="number" inputmode="numeric" placeholder="Ej. 45000" value="\${state.inputs.ingreso}">
    </div>

    <button type="button" class="advanced-toggle" id="advanced-toggle">Ajustar supuestos de cálculo ⌄</button>
    <div class="advanced-panel" id="advanced-panel">
      <div class="field">
        <label for="f-growth">Crecimiento salarial anual esperado (%)</label>
        <input id="f-growth" type="number" inputmode="numeric" value="\${state.inputs.growth}">
        <p class="hint">Qué tanto esperas que crezca tu ingreso cada año.</p>
      </div>
      <div class="field">
        <label for="f-discount">Tasa de descuento anual (%)</label>
        <input id="f-discount" type="number" inputmode="numeric" value="\${state.inputs.discount}">
        <p class="hint">Se usa para traer tus ingresos futuros a valor de hoy.</p>
      </div>
    </div>

    <button class="btn btn-primary" id="form-submit">Calcular</button>
  </div>\`;

  document.getElementById('advanced-toggle').onclick = (e)=>{
    document.getElementById('advanced-panel').classList.toggle('open');
  };

  document.getElementById('form-submit').onclick = ()=>{
    const edad = parseInt(document.getElementById('f-edad').value);
    const edadRetiro = parseInt(document.getElementById('f-retiro').value);
    const ingreso = parseFloat(document.getElementById('f-ingreso').value);
    const growth = parseFloat(document.getElementById('f-growth').value);
    const discount = parseFloat(document.getElementById('f-discount').value);

    const ids = ['f-edad','f-retiro','f-ingreso'];
    ids.forEach(id=>document.getElementById(id).classList.remove('invalid'));
    const banner = document.getElementById('error-banner');
    banner.classList.remove('show');

    let msg = '';
    if(!edad || edad<18 || edad>75){ document.getElementById('f-edad').classList.add('invalid'); msg='Revisa tu edad actual.'; }
    else if(!edadRetiro || edadRetiro<=edad || edadRetiro>80){ document.getElementById('f-retiro').classList.add('invalid'); msg='Tu edad de retiro debe ser mayor a tu edad actual.'; }
    else if(!ingreso || ingreso<=0){ document.getElementById('f-ingreso').classList.add('invalid'); msg='Ingresa tu ingreso mensual.'; }

    if(msg){ banner.textContent = msg; banner.classList.add('show'); return; }

    state.inputs = {
      edad:String(edad), edadRetiro:String(edadRetiro), ingreso:String(ingreso),
      growth:String(growth||DEFAULTS.growth), discount:String(discount||DEFAULTS.discount)
    };
    trackEvent('inputs_completed', state.inputs);
    state.screen='lead'; render();
  };
}

function renderLead(){
  app.innerHTML = \`
  <div class="screen">
    <h2 class="form-title">¿Dónde te enviamos tu resultado?</h2>
    <p class="form-sub">Tu cálculo ya está listo. Solo necesitamos saber a dónde enviártelo.</p>
    <div class="field">
      <label for="f-nombre">Nombre</label>
      <input id="f-nombre" type="text" placeholder="Tu nombre" value="\${state.lead.nombre}">
    </div>
    <div class="field">
      <label for="f-whatsapp">WhatsApp</label>
      <input id="f-whatsapp" type="tel" placeholder="Ej. 55 1234 5678" value="\${state.lead.whatsapp}">
    </div>
    <div class="field">
      <label for="f-email">Correo electrónico</label>
      <input id="f-email" type="email" placeholder="tucorreo@ejemplo.com" value="\${state.lead.email}">
    </div>
    <label class="consent">
      <input type="checkbox" id="f-consent">
      <span>Acepto que \${BRAND_CONFIG.advisorName} pueda contactarme para platicar sobre mi resultado. Mi información se mantiene confidencial y solo se usa para generar y compartir mi cálculo.</span>
    </label>
    <button class="btn btn-primary" id="lead-submit">Ver mi resultado</button>
  </div>\`;

  document.getElementById('lead-submit').onclick = ()=>{
    const nombre = document.getElementById('f-nombre').value.trim();
    const whatsapp = document.getElementById('f-whatsapp').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const consent = document.getElementById('f-consent').checked;

    let ok = true;
    const nombreEl = document.getElementById('f-nombre');
    const emailEl = document.getElementById('f-email');
    const waEl = document.getElementById('f-whatsapp');
    [nombreEl,emailEl,waEl].forEach(el=>el.classList.remove('invalid'));

    if(nombre.length<2){ nombreEl.classList.add('invalid'); ok=false; }
    if(!/^\\S+@\\S+\\.\\S+$/.test(email)){ emailEl.classList.add('invalid'); ok=false; }
    if(whatsapp.replace(/\\D/g,'').length<8){ waEl.classList.add('invalid'); ok=false; }
    if(!consent){ ok=false; alert('Para enviarte tu resultado necesitamos tu autorización de contacto.'); }
    if(!ok) return;

    state.lead = {nombre, whatsapp, email};
    state.result = computeResult();

    sendLeadToCRM({
      nombre, whatsapp, email,
      edad: state.inputs.edad,
      edad_retiro: state.inputs.edadRetiro,
      ingreso_actual: state.inputs.ingreso,
      crecimiento_salarial_pct: state.inputs.growth,
      tasa_descuento_pct: state.inputs.discount,
      fecha: new Date().toISOString(),
      asesor: BRAND_CONFIG.advisorName
    });
    trackEvent('score_generated', state.result);

    state.screen='loading'; render();
    setTimeout(()=>{ state.screen='result'; render(); }, 1200);
  };
}

function renderLoading(){
  app.innerHTML = \`
  <div class="screen loading">
    <p>Calculando tu capacidad de generar ingresos…</p>
    <div class="loading-line"></div>
  </div>\`;
}

/* ============================================================
   CÁLCULO
   ============================================================ */
function computeResult(){
  const edad = parseInt(state.inputs.edad);
  const edadRetiro = parseInt(state.inputs.edadRetiro);
  const ingreso = parseFloat(state.inputs.ingreso);
  const g = parseFloat(state.inputs.growth)/100;
  const d = parseFloat(state.inputs.discount)/100;
  const n = edadRetiro - edad;

  let nominalTotal=0, pvTotal=0, nominal5=0, nominal10=0;
  for(let y=0; y<n; y++){
    const annual = ingreso*12*Math.pow(1+g, y);
    nominalTotal += annual;
    pvTotal += annual / Math.pow(1+d, y+1);
    if(y<5) nominal5 += annual;
    if(y<10) nominal10 += annual;
  }
  return { n, nominalTotal, pvTotal, nominal5, nominal10, edad, edadRetiro, ingreso };
}

function renderResult(){
  const r = state.result;
  const rows = [
    {label:\`En los próximos 5 años\`, value:r.nominal5},
    {label:\`En los próximos 10 años\`, value:r.nominal10},
    {label:\`Hasta tu retiro (\${r.n} años)\`, value:r.nominalTotal}
  ];
  const max = r.nominalTotal;
  const rowsHtml = rows.map(row=>\`
    <div class="ledger-row">
      <span class="ledger-name">\${row.label}</span>
      <span class="ledger-score">\${fmtMXN(row.value)}</span>
      <div class="ledger-bar-track"><div class="ledger-bar-fill" data-w="\${Math.round(row.value/max*100)}"></div></div>
    </div>\`).join('');

  const waMsg = encodeURIComponent(\`Hola \${BRAND_CONFIG.advisorName}, acabo de usar la Calculadora de Capacidad de Generar Ingresos y mi resultado fue \${fmtMXN(r.nominalTotal)}. Me gustaría entender mejor qué significa esto.\`);

  app.innerHTML = \`
  <div class="screen">
    <div class="result-eyebrow">Calculadora de Capacidad de Generar Ingresos</div>
    <div class="result-for">Preparado para \${escapeHtml(state.lead.nombre)} · \${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</div>

    <div class="index-block">
      <div class="index-label">Lo que ganarás si sigues trabajando hasta tu retiro</div>
      <div class="index-number" id="index-number">\${fmtMXN(0)}</div>
      <div class="index-sub">En los próximos \${r.n} años, entre los \${r.edad} y los \${r.edadRetiro} años</div>
    </div>

    <div class="ledger">
      <div class="ledger-title">Desglose por horizonte</div>
      \${rowsHtml}
    </div>

    <div class="pv-block">
      <div class="pv-label">Valor presente estimado</div>
      <div class="pv-number">\${fmtMXN(r.pvTotal)}</div>
      <p class="pv-text">Si trajéramos esos ingresos futuros a pesos de hoy, usando una tasa de descuento del \${state.inputs.discount}% anual, equivalen aproximadamente a esta cantidad.</p>
    </div>

    <div class="interp-block">
      <div class="interp-label">Lo que esto significa</div>
      <div class="interp-text">Este número no es un ahorro que ya tienes: es tu principal activo financiero, el motor detrás de todo lo demás que construyas. Y, para la mayoría de las personas, es también el que menos protegido está. La filosofía de \${BRAND_CONFIG.advisorName} parte de ahí: antes de multiplicar patrimonio, hay que proteger la base que lo hace posible.</div>
    </div>

    <p class="disclaimer">Este cálculo es una estimación con fines informativos, construida a partir de los datos y supuestos que ingresaste (crecimiento salarial e inflación). No constituye una proyección garantizada ni asesoramiento financiero, fiscal o legal.</p>

    <div class="cta-section">
      <h3>¿Qué pasaría si esto se interrumpiera antes de tiempo?</h3>
      <p>Este cálculo asume que vas a poder trabajar, sin interrupciones, hasta tu retiro.</p>
      <p>\${BRAND_CONFIG.advisorName} puede ayudarte a revisar qué tan protegido está este ingreso hoy, y qué estrategias existen para resguardarlo.</p>
      <div class="cta-highlight">Revisión personalizada con \${BRAND_CONFIG.advisorName}</div>
      <div class="cta-duration">Duración aproximada: 20–30 minutos</div>
      <div class="cta-buttons">
        \${BRAND_CONFIG.calendly ? \`<a class="btn btn-primary" id="calendly-btn" href="\${BRAND_CONFIG.calendly}" target="_blank" rel="noopener">Agendar mi revisión personalizada</a>\` : ''}
        <a class="btn \${BRAND_CONFIG.calendly ? 'btn-outline' : 'btn-primary'}" id="wa-btn" href="https://wa.me/\${BRAND_CONFIG.whatsapp}?text=\${waMsg}" target="_blank" rel="noopener">Hablar con \${BRAND_CONFIG.advisorName} por WhatsApp</a>
      </div>
    </div>
  </div>\`;

  if(document.getElementById('calendly-btn')) document.getElementById('calendly-btn').addEventListener('click', ()=>trackEvent('calendly_clicked', {total:r.nominalTotal}));
  document.getElementById('wa-btn').addEventListener('click', ()=>trackEvent('whatsapp_clicked', {total:r.nominalTotal}));

  requestAnimationFrame(()=>{
    app.querySelectorAll('.ledger-bar-fill').forEach(el=>{ el.style.width = el.dataset.w+'%'; });
    animateCount(document.getElementById('index-number'), r.nominalTotal);
  });
}

function animateCount(el, target){
  const dur=900, start=performance.now();
  function step(now){
    const p = Math.min(1, (now-start)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    const val = Math.round(eased*target);
    el.textContent = fmtMXN(val);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSetup(){
  app.innerHTML = \`
  <div class="screen portada">
    <div class="tagline">Configuración inicial</div>
    <h1 class="hero-title">Activá tu WhatsApp para este recurso</h1>
    <p class="hero-sub">Esta herramienta necesita tu número de WhatsApp para poder conectar con las personas que la usen. Ingresalo una vez y vas a tener tu link personalizado, listo para compartir.</p>
    <div class="field" style="text-align:left;max-width:340px;margin:0 auto 18px;">
      <label for="f-setup-wa">Tu WhatsApp (con código de país)</label>
      <input id="f-setup-wa" type="tel" placeholder="Ej. 5215512345678">
    </div>
    <button class="btn btn-primary" id="setup-submit" style="max-width:340px;margin:0 auto;">Generar mi link</button>
    <div id="setup-result" style="display:none;max-width:340px;margin:22px auto 0;text-align:left;">
      <p class="micro" style="margin-bottom:8px;">Este es tu link personalizado. Guardalo y usá siempre este (no el genérico):</p>
      <input id="setup-link" type="text" readonly style="width:100%;padding:12px 14px;border:1.5px solid var(--line-strong);border-radius:8px;font-family:var(--ff-mono);font-size:12px;color:var(--ink);background:var(--paper-dim);">
      <button class="btn btn-outline" id="setup-copy" style="margin-top:10px;color:var(--ink);border-color:var(--line-strong);">Copiar link</button>
      <button class="btn btn-primary" id="setup-continue" style="margin-top:10px;">Continuar a la herramienta</button>
    </div>
  </div>\`;

  document.getElementById('setup-submit').onclick = ()=>{
    const wa = document.getElementById('f-setup-wa').value.replace(/\\D/g,'');
    if(wa.length<8){ alert('Ingresá un WhatsApp válido, con código de país (ej. 521...).'); return; }
    document.getElementById('setup-link').value = buildPersonalizedUrl(wa);
    document.getElementById('setup-result').style.display = 'block';
  };

  document.getElementById('setup-copy').onclick = ()=>{
    const input = document.getElementById('setup-link');
    input.select(); input.setSelectionRange(0,9999);
    if(navigator.clipboard) navigator.clipboard.writeText(input.value).catch(()=>{});
  };

  document.getElementById('setup-continue').onclick = ()=>{
    const wa = document.getElementById('f-setup-wa').value.replace(/\\D/g,'');
    if(wa.length<8){ alert('Ingresá un WhatsApp válido, con código de país (ej. 521...).'); return; }
    BRAND_CONFIG.whatsapp = wa;
    initWaFloat();
    state.screen='portada'; render();
  };
}

render();

})();
`;
