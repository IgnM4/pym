import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  // Ignorar rutas (reemplaza lo que tengas en .eslintignore)
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // Reglas recomendadas de ESLint para JS
  js.configs.recommended,

  // Reglas recomendadas de TypeScript (sin type-check para ir simple)
  ...tseslint.configs.recommended,

  // Reglas / overrides del proyecto
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];