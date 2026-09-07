import tseslint from "typescript-eslint";

/**
 * Shared flat-config base for the internal packages (packages/* and
 * apps/worker). apps/web keeps its own Next.js-specific config since it
 * needs eslint-config-next's rules; every other workspace package re-
 * exports this file unchanged as its own eslint.config.mjs.
 */
export default tseslint.config(
  { ignores: ["dist/**", ".turbo/**", "node_modules/**", "generated/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
