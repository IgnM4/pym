// ESLint v9 flat config para apps/api
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  // Ignorar rutas y archivos que no queremos lint-ear
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".eslintrc.cjs",
      "*.config.cjs",
    ],
  },

  // Reglas base de JS y TS (no type-checked para evitar necesitar tsconfig project)
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Ajustes comunes del proyecto (TS/JS)
  {
    files: ["**/*.{ts,tsx,js,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tseslint.parser,
      // Globals típicos de Node para que no marque 'module', 'process', etc.
      globals: {
        console: "readonly",
        module: "readonly",
        process: "readonly",
        __dirname: "readonly",
        require: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Permitir `any` en stubs de tipos (solo .d.ts dentro de /types)
  {
    files: ["types/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // (Temporal) Relajar `any` en rutas mientras tipeamos DTOs
  {
    files: ["src/routes/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
