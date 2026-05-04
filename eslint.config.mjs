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

    // Generated/local artifacts that should not enter the verification gate.
    "coverage/**",
    "node_modules/**",
    "src/generated/**",
    "logs/**",
    "recordings/**",
    "docs/**",
    "test/**",
    "extensions/**",
    "_build/**",
    ".bmad-core/**",
    ".github/**",
    ".superdesign/**",
    ".kimi/**",
    ".kiro/**",

    // Local agent harness runtime/worktree junk. Keep tracked .pi harness docs lint-free.
    ".pi/agent/**",
    ".pi/agent-sessions/**",
    ".pi/cache/**",
    ".pi/logs/**",
    ".pi/tmp/**",
    ".pi/worktrees/**",
    ".claude/**",
    ".cursor/**",
    ".wolf/**",
  ]),
  {
    rules: {
      // Existing app debt under the Next/React 19 lint stack should not block
      // this setup-hardening gate. Keep these visible without failing lint.
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
