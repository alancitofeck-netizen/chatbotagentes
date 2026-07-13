// Vitest-only stub for the `server-only` marker package (see ycloud.test.ts's
// vitest.config.ts alias). The real package's default export condition always
// throws — it relies on Next.js's build-time `react-server` resolve condition
// to swap in a no-op, which plain Node/Vitest doesn't set. Since this is a
// build-time guard against client-bundle leakage, not runtime behavior, it's
// safe to no-op it entirely for unit tests.
export {};
