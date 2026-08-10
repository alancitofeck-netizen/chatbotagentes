"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la página (router.refresh()) cuando cambia alguna de las tablas
 * indicadas para este workspace — así "Última actividad"/los conteos de las
 * pantallas de Asesorías se sienten en vivo sin recargar manualmente ni
 * agregar polling (0121_asesorias_realtime.sql suma las tablas a la
 * publicación). Mismo patrón que InboxShell.tsx (primer uso de Realtime en
 * el proyecto) — incluye el mismo fix de timing: `createBrowserClient`
 * hidrata la sesión de las cookies async, así que suscribirse antes de que
 * esté lista hace que RLS filtre todo en silencio (el join igual "funciona",
 * simplemente no llega ningún evento). Debounced 1.5s porque estas tablas
 * cambian en cada autoguardado (~400ms durante una sesión activa) — no hace
 * falta un refresh por cada uno. */
export function RealtimeRefresh({ workspaceId, tables }: { workspaceId: string; tables: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => router.refresh(), 1500);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      let ch = supabase.channel(`asesorias-live-${workspaceId}`);
      for (const table of tables) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` }, scheduleRefresh);
      }
      channel = ch.subscribe();
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return null;
}
