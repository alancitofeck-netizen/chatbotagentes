import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // worker/whatsapp-connector is a fully separate TypeScript/Node project
    // (own tsconfig.json, package.json, dependencies) — same reasoning as
    // its exclusion from the root tsconfig.json's `exclude`. It lints
    // itself; the root config has no business scanning it (or its dist/).
    "worker/**",
  ]),
]);

export default eslintConfig;
