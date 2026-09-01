"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/toast/toast";
import type { ContentCalendarData, PieceStatus } from "@/lib/miniApps/contentCalendar";
import { updateContentPieceAction, updateContentStoryAction } from "@/lib/miniApps/contentCalendar";

/**
 * Panel interno editable del "Cronograma de Contenido — Sujey Urías" —
 * mismo diseño/paleta/tipografía del HTML original adjunto por el usuario
 * (azul marino/dorado/crema, Fraunces + Inter + IBM Plex Mono), con los
 * hooks/guiones y estados ahora persistidos en Supabase (mini_app_content_*,
 * ver contentCalendar.ts) en vez de solo en memoria del navegador como el
 * HTML original. Todo bajo un ".cc-root" para no filtrar estilos al resto
 * de Growth Link (los nombres de clase del original — .card, .day-card,
 * etc. — son genéricos).
 */

const STATUS_META: Record<PieceStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "cc-st-pendiente" },
  produccion: { label: "En producción", className: "cc-st-produccion" },
  listo: { label: "Listo para publicar", className: "cc-st-listo" },
  publicado: { label: "Publicado", className: "cc-st-publicado" },
};

const CSS = `
.cc-root{
  --cc-azul:#1B2A4A; --cc-azul-suave:#EDF0F5; --cc-dorado:#C9A227; --cc-crema:#F5F1E6;
  --cc-blanco:#FFFFFF; --cc-texto:#1B2A4A; --cc-texto-suave:#7A7F8C; --cc-verde-pub:#7C9473;
  --cc-radius:14px;
  font-family:'Inter',sans-serif; color:var(--cc-texto); background:var(--cc-crema);
  border-radius:16px; overflow:hidden;
}
.cc-root *{box-sizing:border-box;}
.cc-hero{background:var(--cc-azul);padding:36px 24px 26px;text-align:center;}
.cc-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--cc-dorado);margin-bottom:10px;}
.cc-wordmark{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(28px,5vw,44px);color:var(--cc-blanco);line-height:1;margin:0;}
.cc-hero-sub{font-family:'Fraunces',serif;font-weight:500;font-size:15px;color:var(--cc-dorado);margin:8px 0 3px;}
.cc-hero-meta{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#AEB4C4;}
.cc-nav{position:sticky;top:0;z-index:5;background:var(--cc-blanco);border-bottom:1px solid rgba(27,42,74,.1);display:flex;gap:4px;padding:0 16px;overflow-x:auto;}
.cc-nav button{font-family:'Inter',sans-serif;font-weight:600;font-size:13px;background:none;border:none;color:var(--cc-texto-suave);padding:14px 12px 11px;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;}
.cc-nav button.active{color:var(--cc-azul);border-bottom-color:var(--cc-dorado);}
.cc-main{padding:24px 20px 40px;}
.cc-section-title{font-family:'Fraunces',serif;font-weight:600;font-size:22px;margin:0 0 6px;}
.cc-section-note{color:var(--cc-texto-suave);font-size:13.5px;margin:0 0 20px;max-width:660px;}
.cc-card{background:var(--cc-blanco);border-radius:var(--cc-radius);padding:18px;border:1px solid rgba(27,42,74,.08);margin-bottom:16px;}
.cc-card h3{font-family:'Fraunces',serif;font-weight:600;font-size:16px;margin:0 0 8px;}
.cc-card p{font-size:13.5px;line-height:1.6;color:var(--cc-texto-suave);margin:0;}
.cc-card ul{margin:6px 0 0;padding-left:18px;} .cc-card li{font-size:13px;line-height:1.7;color:var(--cc-texto);}
.cc-week-block{margin-bottom:22px;}
.cc-week-head h4{font-family:'Fraunces',serif;font-weight:600;font-size:15px;margin:0 0 10px;}
.cc-days-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;}
.cc-day-card{background:var(--cc-blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:12px;display:flex;flex-direction:column;gap:9px;min-height:110px;}
.cc-day-card.empty{background:transparent;border-style:dashed;min-height:50px;align-items:center;justify-content:center;}
.cc-day-date{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--cc-texto-suave);}
.cc-pieza{border-top:1px dashed rgba(27,42,74,.12);padding-top:8px;}
.cc-pieza:first-child{border-top:none;padding-top:0;}
.cc-pieza-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;}
.cc-tipo-tag{font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;}
.cc-tipo-HERO{background:var(--cc-azul);color:var(--cc-blanco);}
.cc-tipo-Support{background:var(--cc-azul-suave);color:var(--cc-azul);}
.cc-hora-tag{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--cc-texto-suave);}
.cc-formato-txt{font-size:12px;font-weight:600;color:var(--cc-texto);margin-bottom:2px;}
.cc-funcion-txt{font-size:10.5px;color:var(--cc-texto-suave);margin-bottom:4px;}
.cc-idea{font-size:12.5px;line-height:1.45;outline:none;border-radius:6px;padding:4px;margin:0 -4px;min-height:20px;color:var(--cc-texto);}
.cc-idea:empty:before{content:"Hook / guión — completar";color:#B8BCC8;font-style:italic;}
.cc-idea[contenteditable="true"]:focus{background:var(--cc-azul-suave);}
.cc-status{font-family:'IBM Plex Mono',monospace;font-size:10.5px;border:none;border-radius:999px;padding:6px 8px;cursor:pointer;width:100%;text-align:center;margin-top:2px;}
.cc-st-pendiente{background:var(--cc-azul-suave);color:var(--cc-texto-suave);}
.cc-st-produccion{background:#EFE3C0;color:#7A5E10;}
.cc-st-listo{background:#DCE7DC;color:#3E5F3E;}
.cc-st-publicado{background:var(--cc-verde-pub);color:var(--cc-blanco);}
.cc-descanso{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--cc-texto-suave);text-align:center;}
.cc-hist-tipo{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;background:var(--cc-azul);color:var(--cc-blanco);padding:3px 8px;border-radius:999px;align-self:flex-start;text-transform:uppercase;}
.cc-hist-story{font-size:12px;line-height:1.5;outline:none;border-radius:6px;padding:3px 4px;margin:0 -4px;border-top:1px dashed rgba(27,42,74,.12);padding-top:6px;color:var(--cc-texto);}
.cc-hist-story:first-of-type{border-top:none;padding-top:0;}
.cc-hist-story[contenteditable="true"]:focus{background:var(--cc-azul-suave);}
.cc-ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
.cc-ref-card{background:var(--cc-blanco);border-radius:12px;border:1px solid rgba(27,42,74,.08);padding:14px;display:flex;flex-direction:column;gap:7px;}
.cc-ref-top{display:flex;justify-content:space-between;align-items:center;}
.cc-ref-creador{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--cc-texto-suave);}
.cc-ref-vistas{font-family:'Fraunces',serif;font-weight:600;font-size:14px;color:var(--cc-dorado);}
.cc-ref-producto{font-size:10.5px;background:var(--cc-azul-suave);color:var(--cc-azul);padding:2px 8px;border-radius:999px;display:inline-block;align-self:flex-start;}
.cc-ref-formato{font-size:11.5px;color:var(--cc-texto-suave);}
.cc-ref-hook{font-size:12.5px;color:var(--cc-texto);line-height:1.5;font-style:italic;}
.cc-ref-card a{font-size:12px;color:var(--cc-azul);text-decoration:none;font-weight:600;}
.cc-ref-card a:hover{text-decoration:underline;}
`;

type View = "resumen" | "feed" | "historias" | "referencias";
const TABS: { key: View; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "feed", label: "Feed & Reels" },
  { key: "historias", label: "Historias" },
  { key: "referencias", label: "Referencias" },
];

export function ContentCalendarTab({ initialData, canEdit }: { initialData: ContentCalendarData; canEdit: boolean }) {
  const [view, setView] = useState<View>("resumen");
  const [data, setData] = useState(initialData);
  const [, startTransition] = useTransition();

  function saveIdea(pieceId: string, idea: string) {
    setData((prev) => ({
      ...prev,
      feedWeeks: prev.feedWeeks.map((w) => ({
        ...w,
        days: w.days.map((d) => ({ ...d, pieces: d.pieces.map((p) => (p.id === pieceId ? { ...p, idea } : p)) })),
      })),
    }));
    startTransition(async () => {
      try {
        await updateContentPieceAction(pieceId, { idea });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el hook.");
      }
    });
  }

  function saveStatus(pieceId: string, status: PieceStatus) {
    setData((prev) => ({
      ...prev,
      feedWeeks: prev.feedWeeks.map((w) => ({
        ...w,
        days: w.days.map((d) => ({ ...d, pieces: d.pieces.map((p) => (p.id === pieceId ? { ...p, status } : p)) })),
      })),
    }));
    startTransition(async () => {
      try {
        await updateContentPieceAction(pieceId, { status });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el estado.");
      }
    });
  }

  function saveStory(storyId: string, text: string) {
    setData((prev) => ({
      ...prev,
      historiaWeeks: prev.historiaWeeks.map((w) => ({
        ...w,
        days: w.days.map((d) => ({ ...d, stories: d.stories.map((s) => (s.id === storyId ? { ...s, text } : s)) })),
      })),
    }));
    startTransition(async () => {
      try {
        await updateContentStoryAction(storyId, { text });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la historia.");
      }
    });
  }

  return (
    <div className="cc-root">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- mismo criterio que los Mini Apps públicos con diseño autocontenido (ver DiagnosticoSolidezApp.tsx): esta tab tiene su propia tipografía (Fraunces/IBM Plex Mono), no la del resto de Growth Link. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{CSS}</style>

      <div className="cc-hero">
        <span className="cc-eyebrow">Grilla de contenido · Instagram</span>
        <h1 className="cc-wordmark">Sujey Urías</h1>
        <p className="cc-hero-sub">Asesora Patrimonial · PPR &amp; Protección</p>
        <p className="cc-hero-meta">MÉXICO — CONTENIDO: GROWTH LINK</p>
      </div>

      <div className="cc-nav">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={view === t.key ? "active" : ""} onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="cc-main">
        {view === "resumen" && (
          <>
            <h2 className="cc-section-title">Resumen de estrategia</h2>
            <p className="cc-section-note">Septiembre 2026.</p>

            <div className="cc-card">
              <h3>El patrón que mejor funciona</h3>
              <p>
                <strong>PPR + SAT + beneficio fiscal + números concretos + hook que habla de dinero = descubrimiento.</strong> No es una
                corazonada: se repite en los virales de la competencia (5M, 3.6M, 2.5M, 2M vistas). Los números también son parte del
                formato, no solo del argumento — hacen tangible un producto financiero abstracto. Por eso el eje comercial de la cuenta
                debería ser PPR/retiro, no &quot;tips financieros generales&quot;.
              </p>
            </div>

            <div className="cc-card">
              <h3>Estructura semanal (7 piezas)</h3>
              <p>
                <strong>4 Reels HERO</strong> — mayor producción, hook trabajado, guion, edición, potencial de anuncio.
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>3 contenidos Support</strong> — carruseles o reels simples, menor producción, profundizan o capitalizan lo que
                abrió un HERO.
              </p>
              <p style={{ marginTop: 8 }}>
                Pensado así porque en el onboarding de Sujey apareció como preocupación que el proceso le demande demasiado tiempo.
              </p>
            </div>

            <div className="cc-card">
              <h3>Los 4 formatos HERO</h3>
              <ul>
                <li>
                  <strong>Sketch / doble personaje</strong> — mayor techo de alcance (SAT, AFORE, cliente vs. asesora)
                </li>
                <li>
                  <strong>Talking Head + números/simulación</strong> — aprovecha sus 16 años de experiencia
                </li>
                <li>
                  <strong>Reacción / actualidad financiera</strong> — solo si hay noticia real, no fabricar por calendario
                </li>
                <li>
                  <strong>Storytelling / opinión / confrontación</strong> — &quot;16 años asesorando personas&quot;, lo que la competencia no
                  puede copiar
                </li>
              </ul>
            </div>

            <div className="cc-card">
              <h3>Por qué el sábado libre y el domingo doble</h3>
              <p>
                Sábado sin publicar. El domingo lleva dos piezas (12:00 y 20:00) para mantener el sábado completamente limpio y separar
                ambas publicaciones por varias horas. Nunca dos formatos iguales consecutivos.
              </p>
            </div>
          </>
        )}

        {view === "feed" && (
          <>
            <h2 className="cc-section-title">Feed &amp; Reels — Septiembre 2026</h2>
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
                            <div
                              className="cc-idea"
                              contentEditable={canEdit}
                              suppressContentEditableWarning
                              onBlur={(e) => canEdit && saveIdea(p.id, e.currentTarget.textContent ?? "")}
                            >
                              {p.idea}
                            </div>
                            <select
                              className={`cc-status ${STATUS_META[p.status].className}`}
                              value={p.status}
                              disabled={!canEdit}
                              onChange={(e) => saveStatus(p.id, e.target.value as PieceStatus)}
                            >
                              {(Object.keys(STATUS_META) as PieceStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_META[s].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {view === "historias" && (
          <>
            <h2 className="cc-section-title">Historias — Septiembre 2026</h2>
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
                        <div
                          key={s.id}
                          className="cc-hist-story"
                          contentEditable={canEdit}
                          suppressContentEditableWarning
                          onBlur={(e) => canEdit && saveStory(s.id, e.currentTarget.textContent ?? "")}
                        >
                          {s.text}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {view === "referencias" && (
          <>
            <h2 className="cc-section-title">Referencias — Research de competencia</h2>
            <p className="cc-section-note">
              Swipe file de reels virales de la competencia (PPR, seguro de vida, GMM, educación financiera), con hook, formato y
              métricas de cada uno.
            </p>
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
          </>
        )}
      </div>
    </div>
  );
}
