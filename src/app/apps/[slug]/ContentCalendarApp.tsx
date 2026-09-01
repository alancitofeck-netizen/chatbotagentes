import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { getPublicContentCalendarData } from "@/lib/miniApps/contentCalendar";
import type { PieceStatus } from "@/lib/miniApps/contentCalendar";

/** Versión pública, solo lectura, del "Cronograma de Contenido — Sujey
 * Urías" — mismo diseño que el panel interno (ContentCalendarTab.tsx) pero
 * sin contenteditable ni selects de estado (badges estáticos en su lugar).
 * Server Component: trae los datos con service-role (visitante anónimo,
 * mismo criterio que getPublicMiniAppBySlug) — nunca respeta is_private,
 * a propósito (mismo comportamiento público que las 13 plantillas
 * existentes). */

const STATUS_LABEL: Record<PieceStatus, string> = {
  pendiente: "Pendiente",
  produccion: "En producción",
  listo: "Listo para publicar",
  publicado: "Publicado",
};
const STATUS_CLASS: Record<PieceStatus, string> = {
  pendiente: "cc-st-pendiente",
  produccion: "cc-st-produccion",
  listo: "cc-st-listo",
  publicado: "cc-st-publicado",
};

const CSS = `
.cc-root{
  --cc-azul:#1B2A4A; --cc-azul-suave:#EDF0F5; --cc-dorado:#C9A227; --cc-crema:#F5F1E6;
  --cc-blanco:#FFFFFF; --cc-texto:#1B2A4A; --cc-texto-suave:#7A7F8C; --cc-verde-pub:#7C9473;
  font-family:'Inter',sans-serif; color:var(--cc-texto); background:var(--cc-crema); min-height:100vh;
}
.cc-root *{box-sizing:border-box;}
.cc-hero{background:var(--cc-azul);padding:52px 24px 34px;text-align:center;}
.cc-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--cc-dorado);margin-bottom:14px;}
.cc-wordmark{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(38px,7vw,64px);color:var(--cc-blanco);line-height:1;margin:0;}
.cc-hero-sub{font-family:'Fraunces',serif;font-weight:500;font-size:17px;color:var(--cc-dorado);margin:10px 0 4px;}
.cc-hero-meta{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:#AEB4C4;}
.cc-main{max-width:1080px;margin:0 auto;padding:34px 20px 60px;}
.cc-section-title{font-family:'Fraunces',serif;font-weight:600;font-size:28px;margin:0 0 6px;}
.cc-section-note{color:var(--cc-texto-suave);font-size:14.5px;margin:0 0 26px;max-width:660px;}
.cc-week-block{margin-bottom:28px;}
.cc-week-head h4{font-family:'Fraunces',serif;font-weight:600;font-size:17px;margin:0 0 12px;}
.cc-days-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}
.cc-day-card{background:var(--cc-blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:14px;display:flex;flex-direction:column;gap:10px;min-height:120px;}
.cc-day-card.empty{background:transparent;border-style:dashed;min-height:56px;align-items:center;justify-content:center;}
.cc-day-date{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--cc-texto-suave);}
.cc-pieza{border-top:1px dashed rgba(27,42,74,.12);padding-top:8px;}
.cc-pieza:first-child{border-top:none;padding-top:0;}
.cc-pieza-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;}
.cc-tipo-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;}
.cc-tipo-HERO{background:var(--cc-azul);color:var(--cc-blanco);}
.cc-tipo-Support{background:var(--cc-azul-suave);color:var(--cc-azul);}
.cc-hora-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--cc-texto-suave);}
.cc-formato-txt{font-size:12.5px;font-weight:600;color:var(--cc-texto);margin-bottom:2px;}
.cc-funcion-txt{font-size:11px;color:var(--cc-texto-suave);margin-bottom:4px;}
.cc-idea{font-size:13px;line-height:1.45;color:var(--cc-texto);}
.cc-idea.empty{color:#B8BCC8;font-style:italic;}
.cc-status-badge{font-family:'IBM Plex Mono',monospace;font-size:11px;border-radius:999px;padding:7px 8px;width:100%;text-align:center;display:block;margin-top:4px;}
.cc-st-pendiente{background:var(--cc-azul-suave);color:var(--cc-texto-suave);}
.cc-st-produccion{background:#EFE3C0;color:#7A5E10;}
.cc-st-listo{background:#DCE7DC;color:#3E5F3E;}
.cc-st-publicado{background:var(--cc-verde-pub);color:var(--cc-blanco);}
.cc-descanso{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--cc-texto-suave);text-align:center;}
.cc-hist-tipo{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;background:var(--cc-azul);color:var(--cc-blanco);padding:3px 8px;border-radius:999px;align-self:flex-start;text-transform:uppercase;}
.cc-hist-story{font-size:12.5px;line-height:1.5;color:var(--cc-texto);border-top:1px dashed rgba(27,42,74,.12);padding-top:6px;}
.cc-hist-story:first-of-type{border-top:none;padding-top:0;}
.cc-ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.cc-ref-card{background:var(--cc-blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:16px;display:flex;flex-direction:column;gap:8px;}
.cc-ref-top{display:flex;justify-content:space-between;align-items:center;}
.cc-ref-creador{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--cc-texto-suave);}
.cc-ref-vistas{font-family:'Fraunces',serif;font-weight:600;font-size:15px;color:var(--cc-dorado);}
.cc-ref-producto{font-size:11px;background:var(--cc-azul-suave);color:var(--cc-azul);padding:2px 8px;border-radius:999px;display:inline-block;align-self:flex-start;}
.cc-ref-formato{font-size:12px;color:var(--cc-texto-suave);}
.cc-ref-hook{font-size:13px;color:var(--cc-texto);line-height:1.5;font-style:italic;}
.cc-ref-card a{font-size:12.5px;color:var(--cc-azul);text-decoration:none;font-weight:600;}
.cc-footer{text-align:center;padding:40px 20px 10px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--cc-texto-suave);}
`;

export async function ContentCalendarApp({ app }: { app: PublicMiniAppView<"content_calendar"> }) {
  const data = await getPublicContentCalendarData(app.id);

  return (
    <div className="cc-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- mismo criterio que DiagnosticoSolidezApp.tsx: fuente cargada por ruta, no next/font, porque este Mini App tiene su propio sistema tipográfico autocontenido. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cc-hero">
        <span className="cc-eyebrow">Grilla de contenido · Instagram</span>
        <h1 className="cc-wordmark">Sujey Urías</h1>
        <p className="cc-hero-sub">Asesora Patrimonial · PPR &amp; Protección</p>
        <p className="cc-hero-meta">MÉXICO — CONTENIDO: GROWTH LINK</p>
      </div>

      <div className="cc-main">
        <h2 className="cc-section-title">Feed &amp; Reels — Septiembre 2026</h2>
        <p className="cc-section-note">Cronograma de contenido de Instagram, solo lectura.</p>
        {data.feedWeeks.map((week) => (
          <div key={week.order} className="cc-week-block">
            <div className="cc-week-head">
              <h4>{week.label}</h4>
            </div>
            <div className="cc-days-row">
              {week.days.map((day) =>
                day.pieces.length === 0 ? (
                  <div key={day.id} className="cc-day-card empty">
                    <div>
                      <span className="cc-day-date">{day.dateLabel}</span>
                      <div className="cc-descanso">Descanso — no se publica</div>
                    </div>
                  </div>
                ) : (
                  <div key={day.id} className="cc-day-card">
                    <span className="cc-day-date">{day.dateLabel}</span>
                    {day.pieces.map((p) => (
                      <div key={p.id} className="cc-pieza">
                        <div className="cc-pieza-top">
                          <span className={`cc-tipo-tag cc-tipo-${p.tipo}`}>{p.tipo}</span>
                          {p.hora && <span className="cc-hora-tag">{p.hora}</span>}
                        </div>
                        <div className="cc-formato-txt">{p.formato}</div>
                        <div className="cc-funcion-txt">{p.funcion}</div>
                        <div className={`cc-idea ${p.idea ? "" : "empty"}`}>{p.idea || "Hook / guión — completar"}</div>
                        <span className={`cc-status-badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
        ))}

        <h2 className="cc-section-title" style={{ marginTop: 32 }}>
          Historias — Septiembre 2026
        </h2>
        {data.historiaWeeks.map((week) => (
          <div key={week.order} className="cc-week-block">
            <div className="cc-week-head">
              <h4>{week.label}</h4>
            </div>
            <div className="cc-days-row">
              {week.days.map((day) => (
                <div key={day.id} className="cc-day-card">
                  <span className="cc-day-date">{day.dateLabel}</span>
                  {day.stories[0] && <span className="cc-hist-tipo">{day.stories[0].tipo}</span>}
                  {day.stories.map((s) => (
                    <div key={s.id} className="cc-hist-story">
                      {s.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        <h2 className="cc-section-title" style={{ marginTop: 32 }}>
          Referencias — Research de competencia
        </h2>
        <div className="cc-ref-grid" style={{ marginTop: 16 }}>
          {data.references.map((r) => (
            <div key={r.id} className="cc-ref-card">
              <div className="cc-ref-top">
                <span className="cc-ref-creador">@{r.creador}</span>
                <span className="cc-ref-vistas">{r.vistas}</span>
              </div>
              {r.producto && <span className="cc-ref-producto">{r.producto}</span>}
              <div className="cc-ref-formato">{r.formato}</div>
              <div className="cc-ref-hook">“{(r.hook ?? "").replace(/^[“”"]+|[“”"]+$/g, "")}”</div>
              <div className="cc-ref-formato">{r.comentarios} comentarios</div>
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  Ver en Instagram →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cc-footer">SUJEY URÍAS · GRILLA DE CONTENIDO · SEPTIEMBRE 2026 — GROWTH LINK</div>
    </div>
  );
}
