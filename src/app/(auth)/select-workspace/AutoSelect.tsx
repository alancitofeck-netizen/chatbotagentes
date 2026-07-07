"use client";

import { useEffect, useRef } from "react";
import { SessionLoadingScreen } from "@/components/auth/SessionLoadingScreen";
import { selectWorkspace } from "./actions";

/** Exactly one workspace exists — skip the picker and submit automatically.
 * Cookie writes only happen inside a Server Action (selectWorkspace), never
 * during a Server Component render, so this submits a real form to it. */
export function AutoSelect({ workspaceId }: { workspaceId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <>
      <SessionLoadingScreen title="Cargando tu workspace" />
      <form ref={formRef} action={selectWorkspace} hidden>
        <input type="hidden" name="workspaceId" value={workspaceId} />
      </form>
    </>
  );
}
