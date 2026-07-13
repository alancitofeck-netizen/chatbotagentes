/** Not a "use server" module — files with that directive can only export
 * async Server Actions, so this plain synchronous check lives here instead,
 * shared by src/lib/settings/actions.ts and src/lib/ai-settings/actions.ts. */
export function requireManagerRole(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("No tenés permiso para hacer esto.");
  }
}
