/** Copia server-side, NO ejecutable, de las constantes internas del Meeting
 * OS (`DEFAULT_TEMPLATE`/`THEME_PRESETS`/`DEFAULT_BRAND`/la forma exacta que
 * devuelven `blankSession()`/`blankMeetingData()`) — extraídas
 * programáticamente (evaluando el propio archivo, ver
 * scratchpad/extract_defaults.mjs de esta sesión) del original verbatim que
 * vive en meetingOsTemplate.ts, nunca transcritas a mano. Sirven únicamente
 * para construir, del lado del servidor, un `meetingProject` válido con el
 * que sembrar una Asesoría nueva (ver seed.ts) — el archivo original nunca
 * importa ni ejecuta nada de este módulo. Mismo criterio que
 * diagnosticoRetiroDefaults.ts: la lógica queda duplicada porque el cliente
 * real (el iframe) sigue siendo el JS vanilla intocado.
 *
 * Tipado deliberadamente laxo (`Record<string, unknown>`/`unknown[]`) para
 * las partes muy heterogéneas (las 39 diapositivas de DEFAULT_TEMPLATE tienen
 * formas por-tipo distintas) — este módulo solo necesita mover estos blobs
 * tal cual, nunca leer campos específicos de cada tipo de diapositiva. */

export interface MeetingOsProspect {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  name: string;
  company: string;
  source: string;
  email: string;
  whatsapp: string;
  objective: string;
}

export interface MeetingOsBrand {
  companyName: string;
  companySub: string;
  advisorName: string;
  fontHead: string;
  fontBody: string;
  contact: { email: string; whatsapp: string; calendly: string; website: string };
  assets: {
    logo: {
      sourceType: string;
      data: string;
      url: string;
      mimeType: string;
      fileName: string;
      fit: string;
      position: string;
      background: string;
    };
  };
}

export interface MeetingOsSession {
  prospect: MeetingOsProspect;
  responses: Record<string, unknown>;
  progress: number;
  status: string;
  createdAt: number | null;
  updatedAt: number | null;
  advisor: string;
  decisionCriteria: string[];
  decisionMakers: unknown[];
  nextStep: Record<string, unknown>;
  feedback: Record<string, unknown>;
  internalNotes: string;
  referrals: unknown[];
  meetingContext: { meetingType: string; route: string };
  preMeeting: Record<string, unknown>;
  referralSource: Record<string, unknown>;
  meetingData: Record<string, unknown>;
  sync: Record<string, unknown>;
  finalSnapshot: unknown;
}

export interface MeetingOsProject {
  schemaVersion: number;
  template: Record<string, unknown>;
  theme: Record<string, unknown>;
  brand: MeetingOsBrand;
  session: MeetingOsSession;
}

/** `isMaster` va en `false` acá — es la ÚNICA diferencia deliberada contra el
 * `DEFAULT_TEMPLATE` real del archivo verbatim (que trae `isMaster:true`).
 * El propio botón "Guardar" del Meeting OS, si `T().isMaster` es `true`,
 * interrumpe con un `confirm()` sobre "plantilla MAESTRA" (concepto de
 * biblioteca de plantillas reutilizables de la herramienta genérica, que no
 * existe como feature en GrowthLink — cada Asesoría es su propia instancia
 * independiente). Con `false`, "Guardar" simplemente sincroniza al servidor
 * como cualquier otro autoguardado (ver el shim de `frame/route.ts`), sin
 * diálogos confusos. */
export const MEETING_OS_DEFAULT_TEMPLATE: Record<string, unknown> = {"id":"cita-inicial","name":"Cita inicial base","isMaster":false,"settings":{"showProgress":true,"allowKeyboard":true},"slides":[{"id":"cover","type":"cover","enabled":true,"section":"Encuadre","internalName":"Portada","kicker":"Cita inicial","title":"Asesoría en <em>Protección</em> y Patrimonio","subtitle":"Una conversación para entender tus objetivos y ver qué tan cerca o lejos estás de lograrlos.","badges":["Seguro de Vida","Ahorro para el Retiro","Gastos Médicos"],"prospectLine":{"enabled":true,"prefix":"Preparada para","showProspectName":true,"suffix":"","anonymousText":"Preparada especialmente para ti"},"buttonText":"Comenzar asesoría →"},{"id":"referral-apertura","type":"statement","enabled":true,"routes":["referral"],"section":"Encuadre","internalName":"Apertura · Referido","kicker":"Gracias por estar acá","title":"{{prospect.name}}, <em>{{referral.name}}</em> me comentó que podía tener sentido que conversáramos.","body":"Hoy quiero entender tu situación para ver si realmente puedo ayudarte.","buttonText":"Empezar"},{"id":"direct-buscas","type":"textQuestion","enabled":true,"routes":["direct"],"section":"Objetivos","internalName":"¿Qué estás buscando?","kicker":"Interés directo","title":"¿Qué es lo que <em>estás buscando</em> resolver?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"direct-porahora","type":"textQuestion","enabled":true,"routes":["direct"],"section":"Objetivos","internalName":"¿Por qué ahora?","title":"¿Por qué <em>ahora</em> y no antes?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"direct-espera","type":"textQuestion","enabled":true,"routes":["direct"],"section":"Compromiso","internalName":"Qué espera de una estrategia","title":"¿Qué <em>esperás</em> de una buena estrategia?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"tiempo","type":"statement","enabled":true,"section":"Encuadre","internalName":"Encuadre · Tiempo","kicker":"El encuadre","title":"Nos reservamos el <em>tiempo adecuado</em>","body":"Normalmente ocupamos <strong>de 20 a 30 minutos</strong>, pero reservé <strong>45</strong> por si querés profundizar en algún tema.","buttonText":"Sí, perfecto"},{"id":"regalo","type":"statement","enabled":true,"routes":["discovery"],"section":"Encuadre","internalName":"Encuadre · Valor","kicker":"El valor","title":"Esta asesoría normalmente tiene un <em>valor</em>…","body":"Pero en este caso fue un <strong>regalo</strong>. Alguien decidió que valía la pena que tuvieras esta claridad.","buttonText":"Suena bien"},{"id":"mapa","type":"twostep","enabled":true,"routes":["discovery","direct","referral","follow_up"],"section":"Encuadre","internalName":"Mapa de la cita","kicker":"El plan de trabajo","title":"Hoy entendemos, la próxima <em>construimos</em>.","stepA":{"when":"Hoy","title":"Descubrimiento","desc":"Entender tu situación y tus metas"},"stepB":{"when":"Próxima cita","title":"Estrategia","desc":"La mejor opción, hecha a tu medida"},"buttonText":"Empezar descubrimiento"},{"id":"porque-hoy","type":"textQuestion","enabled":true,"section":"Objetivos","internalName":"¿Por qué hoy?","kicker":"Descubrimiento","title":"¿Qué te hizo <em>agendar y presentarte</em> hoy?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"prioridades","type":"ranking","enabled":true,"section":"Objetivos","internalName":"Prioridades","lead":"Antes de seguir, identifiquemos lo que más te importa.","title":"Ordená de <em>más</em> a <em>menos</em> importante","items":[{"id":"p1","label":"Protección familiar"},{"id":"p2","label":"Ahorro para el retiro"},{"id":"p3","label":"Gastos médicos"},{"id":"p4","label":"Educación de los hijos"},{"id":"p5","label":"Ahorro / liquidez"},{"id":"p6","label":"Patrimonio / herencia"}],"buttonText":"Continuar"},{"id":"porque-ese","type":"textQuestion","enabled":true,"section":"Objetivos","internalName":"¿Por qué ese objetivo?","title":"¿Por qué elegiste <em>ese objetivo</em> como tu prioridad?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"importancia-ahora","type":"textQuestion","enabled":true,"routes":["discovery"],"section":"Objetivos","internalName":"Importancia actual","title":"¿Qué hace que conseguirlo sea <em>importante ahora</em> y no postergarlo?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"accion-actual","type":"textQuestion","enabled":true,"section":"Situación actual","internalName":"Acción actual","title":"¿Estás haciendo <em>algo actualmente</em> para conseguirlo?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"tiempo-objetivo","type":"options","enabled":true,"section":"Situación actual","internalName":"Tiempo con el objetivo","title":"¿Hace cuánto estás <em>pensando en este objetivo</em>?","items":[{"id":"t1","label":"Menos de 6 meses"},{"id":"t2","label":"6 a 12 meses"},{"id":"t3","label":"1 a 3 años"},{"id":"t4","label":"Más de 3 años"}],"buttonText":"Continuar"},{"id":"que-cambio","type":"textQuestion","enabled":true,"routes":["discovery"],"section":"Situación actual","internalName":"Qué cambió","title":"¿Qué cambió hoy para que decidieras <em>ponerte en marcha</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"frena","type":"textQuestion","enabled":true,"section":"Situación actual","internalName":"¿Qué te frena?","title":"¿Qué sentís que te está <em>impidiendo avanzar</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"consecuencia","type":"textQuestion","enabled":true,"section":"Consecuencias","internalName":"Consecuencias","kicker":"Toma de conciencia","title":"¿Qué pasaría si <em>no lo conseguís</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"resistencia-futura","type":"textQuestion","enabled":false,"routes":["discovery"],"section":"Consecuencias","internalName":"Resistencia futura","title":"¿Qué tendría que pasar para que, aun sabiendo esto, <em>continúes sin avanzar</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"vision","type":"textQuestion","enabled":true,"section":"Visión","internalName":"Visión","lead":"Ahora imaginate que lo lográs…","title":"¿Cómo te ves una vez que <em>lo hayas conseguido</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"acuerdo","type":"statement","enabled":true,"section":"Compromiso","internalName":"Punto de giro","kicker":"El punto de giro","title":"¿Estás de acuerdo en que, si no <em>cambiamos algunas cosas</em>, estaríamos lejos del objetivo?","body":"Y si es así… ¿estás dispuesto a hacer esos cambios?","buttonText":"Sí, estoy dispuesto"},{"id":"dos-formas","type":"choice2","enabled":true,"section":"Compromiso","internalName":"Dos formas de planificar","kicker":"Cómo planificamos","title":"Existen <em>2 formas</em> de planificar. ¿Cuál te hace más sentido?","optionA":{"k":"A","text":"Definimos <strong>cuánto vas a necesitar</strong> y acomodamos el presupuesto para llegar."},"optionB":{"k":"B","text":"Empezamos <strong>con lo que puedas hoy</strong> y ajustamos con el tiempo."}},{"id":"meta-requerida","type":"money","enabled":true,"section":"Compromiso","internalName":"Meta requerida","responseKey":"requiredAmount","title":"¿Cuánto dinero <em>necesitarías</em> para lograr este objetivo?","body":"Una estimación es suficiente por ahora.","placeholder":"0","buttonText":"Continuar"},{"id":"monto","type":"money","enabled":true,"section":"Compromiso","internalName":"Capacidad actual","responseKey":"startingAmount","title":"¿Con cuánto podrías <em>comenzar</em> hoy?","body":"Sin compromiso todavía — solo para dimensionar el punto de partida.","placeholder":"0","buttonText":"Continuar"},{"id":"info-adicional","type":"textQuestion","enabled":true,"section":"Situación actual","internalName":"Información adicional","title":"¿Hay algo más que necesite saber <em>antes de preparar tu estrategia</em>?","placeholder":"Escribir respuesta…","buttonText":"Continuar"},{"id":"criterios","type":"criteria","enabled":false,"section":"Compromiso","internalName":"Criterios de decisión","title":"Para vos, ¿cuáles son los <em>tres puntos más importantes</em> que debe cumplir una buena estrategia?","buttonText":"Continuar"},{"id":"compromiso-criterios","type":"options","enabled":false,"section":"Compromiso","internalName":"Compromiso · criterios","title":"Si la estrategia cumple con esos tres puntos, ¿te haría sentido <em>avanzar</em>?","items":[{"id":"c1","label":"Sí"},{"id":"c2","label":"Probablemente"},{"id":"c3","label":"Necesito revisarlo"},{"id":"c4","label":"Depende de otro decisor"}],"buttonText":"Continuar"},{"id":"decisores","type":"decisionMakers","enabled":false,"section":"Compromiso","internalName":"Decisores","title":"¿Esta decisión la <em>tomás vos</em> o necesitamos sumar a alguien más?","buttonText":"Continuar"},{"id":"estrategia-24h","type":"stat","enabled":true,"section":"Próximo paso","internalName":"Estrategia en 24h","kicker":"El siguiente paso","title":"Tu estrategia estará lista en <em>24 horas</em>.","statValue":"200+","statCaption":"alternativas que evaluamos con el equipo para elegir la mejor para vos.","buttonText":"Continuar"},{"id":"resumen","type":"summary","enabled":true,"section":"Próximo paso","internalName":"Resumen","kicker":"Devolución","title":"Esto es lo que <em>escuché de vos</em>:","sourceSlides":["porque-hoy","consecuencia","frena","vision"],"labels":["Tu objetivo / motivo","Lo que está en juego","Lo que te frenó","Cómo te ves logrando"],"buttonText":"Continuar"},{"id":"proximo-paso","type":"nextStep","enabled":false,"section":"Próximo paso","internalName":"Próximo paso","kicker":"Entonces quedamos así","title":"Definamos el <em>siguiente paso</em>","buttonText":"Confirmar siguiente cita"},{"id":"calendly-booking","type":"calendly","enabled":true,"section":"Próximo paso","internalName":"Agendar próxima cita","kicker":"Próximo paso","title":"Agendemos nuestra <em>próxima conversación</em>","subtitle":"Elegí el día y horario que mejor te funcione para revisar juntos tu estrategia.","calendlyUrl":"","source":"brand","showFallbackButton":true,"fallbackButtonText":"Abrir agenda en otra pestaña ↗","confirmationEnabled":true,"confirmationButtonText":"Cita agendada ✓"},{"id":"valoracion-recap","type":"recapValue","enabled":true,"section":"Valoración","internalName":"Lo que trabajamos hoy","title":"Lo que <em>trabajamos hoy</em>","bullets":["Entender tu situación financiera actual","Darte claridad sobre cómo ayudarte"],"valueNote":"En mi despacho, esta asesoría normalmente tiene un valor, pero en este caso fue un <strong>regalo</strong>.","opinionTitle":"Me gustaría conocer tu opinión…","question1":"De todo lo que revisamos hoy: ¿qué fue lo que <em>más te sirvió</em> concretamente?","question2":"Y con base en tu experiencia: ¿qué hace que esta asesoría <em>tenga valor para ti</em>?","showMedia":true,"media":{"src":""},"buttonText":"Continuar"},{"id":"valoracion-util","type":"textQuestion","enabled":false,"section":"Valoración","internalName":"Valoración · lo más útil","title":"De todo lo que revisamos hoy, ¿qué fue <em>lo más útil</em> para vos?","placeholder":"Escribir respuesta…","responseKey":"feedbackMostUseful","buttonText":"Continuar"},{"id":"valoracion-valor","type":"feedback","enabled":false,"section":"Valoración","internalName":"Valoración · valor","title":"¿Qué hizo que esta conversación <em>tuviera valor</em>?","buttonText":"Continuar"},{"id":"ref-oferta","type":"referralOffer","enabled":false,"section":"Referidos","internalName":"Referidos · Oferta","kicker":"Un regalo para compartir","title":"Como te fue útil, quiero darte la posibilidad de regalársela a <em>5 colegas</em> cercanos para que también puedan tener esta claridad.","steps":["Solo necesito sus WhatsApps","Tú les avisas hoy y yo los contacto al día siguiente","Y si alguno no quiere, no pasa absolutamente nada"],"valueLead":"Por compartírmelos, mi despacho me permite <strong>REGALARTE</strong> nuestra","valueHighlight":"Inteligencia Artificial","valueBadge":"Valor habitual —","showResource":true,"resource":{"src":"","tag":"DIAGNÓSTICO FINANCIERO","title":"¿Sabes realmente dónde estás parado?","sub":"2 minutos · Sin registro · Sin trampa"},"buttonText":"Me interesa"},{"id":"ref-bonus","type":"resourceGrid","enabled":false,"section":"Referidos","internalName":"Referidos · Bonificación","kicker":"Bonificación adicional","title":"Además, por compartírmelos <em>en esta llamada</em>, me autorizan a sumarte 3 recursos más que normalmente comercializamos.","cards":[{"src":"","title":""},{"src":"","title":""},{"src":"","title":""}],"note":"Valor total del regalo: todo esto, simplemente por ayudar a colegas que aprecies.","buttonText":"Continuar"},{"id":"ref-perfil","type":"referralCapture","enabled":false,"section":"Referidos","internalName":"Referidos · Captura","kicker":"Bonificación adicional","title":"Al pensar en ellos, <em>idealmente que sean…</em>","criteria":["<strong>Profesionales entre 25–45 años</strong> que les vaya bien en estos momentos","Alguien a quien admires financieramente"],"listTitle":"Personas a las que quieres ayudar ❤️","listSubtitle":"Pueden ser colegas, compañeros de trabajo y/o familia.","minRows":5,"defaultCC":"+52","buttonText":"Enviar regalo"},{"id":"ref-mensaje","type":"referralMessage","enabled":false,"section":"Referidos","internalName":"Referidos · Mensaje WhatsApp","kicker":"Para activar tus regalos","title":"El despacho nos pide que les mandes <em>este mensaje</em> antes de cerrar.","messageTemplate":"¡Hola! Espero estés muy bien.\n\nHace un rato tuve una plática con {{advisor.name}}, asesor financiero y patrimonial, y me gustó mucho cómo trabaja. Tengo una sesión para regalar y te elegí a ti.\n\nPensé que también te podría servir para revisar opciones de protección para tus finanzas (salud, retiro, ahorro…). La sesión incluye varios regalos interesantes.\n\nEn estos días te va a escribir para ver si te sirve.","buttonText":"Continuar"},{"id":"cierre","type":"cover","enabled":true,"section":"Valoración","internalName":"Cierre","kicker":"Nos vemos en la próxima","title":"Tu <em>estrategia</em> ya está en marcha.","subtitle":"Gracias por tu tiempo y tu confianza. En 24 horas la tenés lista y la vemos juntos.","dynamicClose":true,"badges":["Cita de estrategia agendada ✓"],"buttonText":"↺ Empezar de nuevo","isRestart":true}]};

export const MEETING_OS_THEME_PRESETS: Record<string, Record<string, unknown>> = {"gl-dark":{"id":"gl-dark","name":"Growth Link Dark","mode":"dark","background":"#050817","backgroundSecondary":"#0A1230","surface":"#0D1838","surfaceSecondary":"#122250","textPrimary":"#EAF2FF","textSecondary":"#8FA3C8","textMuted":"#5E719A","accent":"#2E7BF6","accentSoft":"#5B9BFF","accentContrast":"#FFFFFF","border":"rgba(127,196,255,.18)","borderStrong":"rgba(127,196,255,.32)","inputBackground":"#0D1838","buttonText":"#FFFFFF","success":"#3DD68C","warning":"#FFB454","danger":"#FF6B6B","glow":"rgba(46,123,246,.16)","star":"180,215,255","starLine":"127,196,255","starOpacity":0.55},"patrimonial-light":{"id":"patrimonial-light","name":"Patrimonial Light","mode":"light","background":"#F3F6FA","backgroundSecondary":"#E9EEF5","surface":"#FFFFFF","surfaceSecondary":"#F7F9FC","textPrimary":"#142033","textSecondary":"#526174","textMuted":"#8390A0","accent":"#1769D2","accentSoft":"#2E7BF6","accentContrast":"#FFFFFF","border":"#DCE3EC","borderStrong":"#C5D0DD","inputBackground":"#FFFFFF","buttonText":"#FFFFFF","success":"#1FA971","warning":"#C77A16","danger":"#D14343","glow":"rgba(23,105,210,.10)","star":"120,150,190","starLine":"120,150,190","starOpacity":0.12},"corporativo-azul":{"id":"corporativo-azul","name":"Corporativo Azul","mode":"dark","background":"#0A1A2F","backgroundSecondary":"#0E2440","surface":"#123152","surfaceSecondary":"#173C63","textPrimary":"#EAF3FF","textSecondary":"#9DB6D2","textMuted":"#6E88A6","accent":"#2FA4E7","accentSoft":"#5FBEF0","accentContrast":"#04121F","border":"rgba(120,180,230,.20)","borderStrong":"rgba(120,180,230,.36)","inputBackground":"#123152","buttonText":"#04121F","success":"#3DD68C","warning":"#FFB454","danger":"#FF6B6B","glow":"rgba(47,164,231,.16)","star":"150,200,240","starLine":"120,180,230","starOpacity":0.4},"verde-proteccion":{"id":"verde-proteccion","name":"Verde Protección","mode":"dark","background":"#07160F","backgroundSecondary":"#0B2117","surface":"#0F2C1F","surfaceSecondary":"#163B2A","textPrimary":"#E8F7EE","textSecondary":"#96C4A9","textMuted":"#5F8C72","accent":"#1FB574","accentSoft":"#3FD693","accentContrast":"#04150C","border":"rgba(120,220,170,.18)","borderStrong":"rgba(120,220,170,.34)","inputBackground":"#0F2C1F","buttonText":"#04150C","success":"#3DD68C","warning":"#FFB454","danger":"#FF6B6B","glow":"rgba(31,181,116,.16)","star":"150,220,180","starLine":"120,200,160","starOpacity":0.4},"minimal-beige":{"id":"minimal-beige","name":"Minimal Beige","mode":"light","background":"#F5F1E8","backgroundSecondary":"#EDE6D6","surface":"#FFFDF8","surfaceSecondary":"#F7F2E7","textPrimary":"#2B2419","textSecondary":"#6B6151","textMuted":"#9A8F7C","accent":"#B0803A","accentSoft":"#C89A54","accentContrast":"#FFFFFF","border":"#E1D8C6","borderStrong":"#CDBFA0","inputBackground":"#FFFDF8","buttonText":"#FFFFFF","success":"#1FA971","warning":"#C77A16","danger":"#D14343","glow":"rgba(176,128,58,.10)","star":"180,160,120","starLine":"180,160,120","starOpacity":0.1},"luxury-black":{"id":"luxury-black","name":"Luxury Black","mode":"dark","background":"#0A0A0C","backgroundSecondary":"#121216","surface":"#17171C","surfaceSecondary":"#1F1F26","textPrimary":"#F4F0E6","textSecondary":"#B8B2A2","textMuted":"#7C766A","accent":"#C9A24B","accentSoft":"#DBB968","accentContrast":"#0A0A0C","border":"rgba(201,162,75,.20)","borderStrong":"rgba(201,162,75,.38)","inputBackground":"#17171C","buttonText":"#0A0A0C","success":"#3DD68C","warning":"#FFB454","danger":"#FF6B6B","glow":"rgba(201,162,75,.14)","star":"220,205,160","starLine":"201,162,75","starOpacity":0.3}};

export const MEETING_OS_DEFAULT_BRAND: MeetingOsBrand = {"companyName":"Growth Link","companySub":"PROTECCIÓN · PATRIMONIO","advisorName":"","fontHead":"Inter","fontBody":"Inter","contact":{"email":"","whatsapp":"","calendly":"","website":""},"assets":{"logo":{"sourceType":"upload","data":"","url":"","mimeType":"","fileName":"","fit":"contain","position":"center","background":"transparent"}}};

const BLANK_SESSION_SHAPE: MeetingOsSession = {"prospect":{"id":"","firstName":"","lastName":"","fullName":"","name":"","company":"","source":"","email":"","whatsapp":"","objective":""},"responses":{},"progress":0,"status":"No iniciada","createdAt":null,"updatedAt":null,"advisor":"","decisionCriteria":["","",""],"decisionMakers":[],"nextStep":{"date":"","time":"","tz":"","mode":"","participants":"","objective":"","docs":"","advisorCommit":"","prospectCommit":"","calendly":"","whatsapp":"","notes":""},"feedback":{"mostUseful":"","perceivedValue":"","rating":null},"internalNotes":"","referrals":[],"meetingContext":{"meetingType":"discovery","route":"discovery"},"preMeeting":{"hasPrevInfo":false,"sources":[],"rawContext":"","general":{"company":"","profession":"","age":"","maritalStatus":"","dependents":"","location":""},"commercial":{"source":"","referredBy":"","setter":"","productInterest":"","declaredObjective":"","meetingReason":""},"financial":{"incomeRange":"","estimatedCapacity":"","savings":"","currentCoverage":"","currentProduct":"","timeHorizon":""}},"referralSource":{"name":"","relationship":"","context":""},"meetingData":{"objective":{"primary":"","why":"","whyNow":"","importance":""},"currentSituation":{"actions":"","obstacles":"","existingSolutions":"","notes":""},"consequences":{"costOfInaction":"","concerns":""},"vision":{"desiredSituation":"","timeline":"","requiredAmount":null},"qualification":{"startingAmount":null,"currency":"","frequency":"","decisionCriteria":[],"decisionMakerStatus":"","additionalDecisionMakers":[]},"nextStep":{"date":"","time":"","participants":[],"objective":"","requirements":[]},"feedback":{"mostUseful":"","perceivedValue":"","score":null}},"sync":{"status":"local","lastAttempt":null,"lastSuccess":null,"error":null},"finalSnapshot":null};

const BLANK_MEETING_DATA_SHAPE: Record<string, unknown> = {"objective":{"primary":"","why":"","whyNow":"","importance":""},"currentSituation":{"actions":"","obstacles":"","existingSolutions":"","notes":""},"consequences":{"costOfInaction":"","concerns":""},"vision":{"desiredSituation":"","timeline":"","requiredAmount":null},"qualification":{"startingAmount":null,"currency":"","frequency":"","decisionCriteria":[],"decisionMakerStatus":"","additionalDecisionMakers":[]},"nextStep":{"date":"","time":"","participants":[],"objective":"","requirements":[]},"feedback":{"mostUseful":"","perceivedValue":"","score":null}};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Espejo exacto de `blankSession()` dentro del archivo original. */
export function blankMeetingOsSession(): MeetingOsSession {
  const session = deepClone(BLANK_SESSION_SHAPE);
  session.meetingData = deepClone(BLANK_MEETING_DATA_SHAPE);
  return session;
}

/** Arma un `meetingProject` completo y válido para sembrar una Asesoría
 * recién creada — mismo shape que produce `boot()` en el archivo original
 * cuando no hay nada guardado, pero con `prospect`/`advisor`/`brand` ya
 * completados a partir del contacto/workspace de GrowthLink. `progress`
 * arranca en 0 salvo que se pida sembrado "continuable" (ver seed.ts: crear
 * desde un contacto siembra progress:1 a propósito, para que la pantalla de
 * inicio del propio archivo muestre la tarjeta "Continuar última reunión" ya
 * con estos datos — es el único camino del archivo sin tocar donde el
 * prospecto sobrevive al primer clic; homeStart()/"Comenzar" siempre reinicia
 * session a blankSession()). */
export function buildFreshMeetingOsProject(input: {
  prospect?: Partial<MeetingOsProspect>;
  advisor?: string;
  brand?: Partial<MeetingOsBrand>;
  progress?: number;
  /** Plantilla guardada por el workspace (asesoria_templates.template, ver
   * masterTemplate.ts) — si viene, reemplaza a MEETING_OS_DEFAULT_TEMPLATE
   * como base de las preguntas/slides. theme/brand nunca vienen de acá,
   * siguen resolviéndose igual que siempre (ver el plan de esta sesión). */
  baseTemplate?: Record<string, unknown> | null;
}): MeetingOsProject {
  const now = Date.now();
  const session = blankMeetingOsSession();
  session.prospect = { ...session.prospect, ...input.prospect };
  session.advisor = input.advisor ?? "";
  session.status = "En progreso";
  session.createdAt = now;
  session.updatedAt = now;
  session.progress = input.progress ?? 0;

  const brand: MeetingOsBrand = {
    ...deepClone(MEETING_OS_DEFAULT_BRAND),
    ...input.brand,
    contact: { ...deepClone(MEETING_OS_DEFAULT_BRAND.contact), ...input.brand?.contact },
    assets: {
      logo: { ...deepClone(MEETING_OS_DEFAULT_BRAND.assets.logo), ...input.brand?.assets?.logo },
    },
  };

  return {
    schemaVersion: 2,
    template: input.baseTemplate ? deepClone(input.baseTemplate) : deepClone(MEETING_OS_DEFAULT_TEMPLATE),
    theme: deepClone(MEETING_OS_THEME_PRESETS["gl-dark"]),
    brand,
    session,
  };
}
