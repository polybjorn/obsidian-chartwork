import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
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
      "obsidianmd/ui/sentence-case": ["error", {
        brands: ["Chartwork", "Charts", "Obsidian", "Bases", "Chart.js", "Markdown"],
        // The series colors placeholder is a list of CSS colors, not prose
        ignoreRegex: ["^(#[0-9a-fA-F]{3,8}|var\\(--[\\w-]+\\))(\\n(#[0-9a-fA-F]{3,8}|var\\(--[\\w-]+\\)))*$"],
      }],
    },
  },
  // The plugin runs on mobile, where Node builtins do not exist; tests only
  // ever run under Node.
  {
    files: ["tests/**"],
    rules: { "obsidianmd/no-nodejs-modules": "off" },
  },
  globalIgnores([
    "node_modules",
    "esbuild.config.mjs",
    "scripts",
    "version-bump.mjs",
    "versions.json",
    "main.js",
  ]),
);
