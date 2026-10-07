import { DAILY_REPLY_GOAL, type ReplyActivity } from "@/lib/insights/replyActivity";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const STREAK_DOTS = 7;

/** Fecha y saludo según la hora de Buenos Aires, no la del servidor. */
export function homeGreetingParts(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
  return { greeting, dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1) };
}

function streakHint(activity: ReplyActivity) {
  if (activity.streakDays === 0) return "Respondé un lead hoy para empezar tu racha";
  if (activity.answeredToday > 0) return `Llevás ${activity.streakDays} ${activity.streakDays === 1 ? "día" : "días"} seguidos`;
  return `Respondé un lead hoy para llegar a ${activity.streakDays + 1}`;
}

/** Saludo del inicio, con la meta del día y la racha de respuestas. Todo sale de
 * datos reales: los contactos pendientes del inbox y los mensajes salientes. */
export function HomeGreeting({
  name,
  greeting,
  dateLabel,
  pendingLeads,
  activity,
}: {
  name: string;
  greeting: string;
  dateLabel: string;
  pendingLeads: number;
  activity: ReplyActivity;
}) {
  const progress = Math.min(1, activity.answeredToday / DAILY_REPLY_GOAL);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filledDots = Math.min(activity.streakDays, STREAK_DOTS);

  return (
    <section aria-label="Resumen del día" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">{dateLabel}</p>
          <h1 className="font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground sm:text-[40px]">
            {greeting}, {name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span className="rounded-md bg-accent-600 px-2 py-0.5 text-xs font-semibold text-[var(--on-accent)] tabular-nums">{pendingLeads}</span>
            {pendingLeads === 1 ? "lead espera tu primer mensaje" : "leads esperan tu primer mensaje"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-border-default bg-surface-1 p-2.5">
          <div className="relative size-16">
            <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                className="text-accent-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-[17px] font-semibold tabular-nums text-foreground">
              {activity.answeredToday}/{DAILY_REPLY_GOAL}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500">Meta de hoy</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-1 p-3.5">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STREAK_DOTS }, (_, i) => (
            <span key={i} className={`size-2.5 rounded-full ${i < filledDots ? "bg-accent-500" : "border border-border-strong"}`} />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Racha de {activity.streakDays} {activity.streakDays === 1 ? "día" : "días"}
          </p>
          <p className="text-xs text-neutral-500">{streakHint(activity)}</p>
        </div>
      </div>
    </section>
  );
}
