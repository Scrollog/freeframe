import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src/js/lib/cep/**", "src/jsx/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "src/js/lib/freeframe/{review,review.test}.ts",
      "src/js/lib/freeframe/{comment-attachments,comment-attachments.test}.ts",
      "src/js/main/hooks/**/*.ts",
      "src/js/main/components/AssetView.tsx",
      "src/js/main/components/comments/**/*.tsx",
      "src/js/main/components/player/**/*.{ts,tsx}",
      "src/js/main/components/share/**/*.tsx",
    ],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  }
);
