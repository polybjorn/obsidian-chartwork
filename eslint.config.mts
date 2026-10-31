import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    plugins: { obsidianmd },
    rules: {
      "obsidianmd/ui/sentence-case": ["error", { brands: ["Chartwork", "Charts", "Obsidian", "Bases", "Chart.js"] }],
    },
  },
  // The plugin runs on mobile, where Node builtins do not exist; tests only
  // ever run under Node.
  {
    files: ["tests/**"],
    rules: { "import/no-nodejs-modules": "off" },
  },
  globalIgnores([
    "node_modules",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "versions.json",
    "main.js",
  ]),
);
