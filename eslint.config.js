import js from "@eslint/js";
import tseslint from "typescript-eslint";
import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

export default tseslint.config(
  {
    ignores: ["dist/**/*", "node_modules/**/*", "build/**/*"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["firestore.rules", "DRAFT_firestore.rules"],
    ...firebaseRulesPlugin.configs['flat/recommended']
  }
);
