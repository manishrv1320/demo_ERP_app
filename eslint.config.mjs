import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Tenant isolation, layer 3: application code can't reach the database except
 * through the tenant-scoped client (`forOrg`) and the named functions in
 * src/server/db. Type-only imports from @prisma/client stay allowed everywhere.
 */
const RAW_DATABASE_ACCESS = {
  paths: [
    {
      name: "@prisma/client",
      allowTypeImports: true,
      message:
        "Use the tenant client from the request context (ctx.db) or a named function in src/server/db. Only src/server/db and src/server/platform may import Prisma values.",
    },
  ],
  patterns: [
    {
      group: ["@/server/db/raw", "**/server/db/raw"],
      allowTypeImports: true,
      message:
        "The raw Prisma client bypasses tenant isolation. Only src/server/db and src/server/platform may import it.",
    },
  ],
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      ".pgdata/**",
      ".pgdata-*/**",
      "android/**",
      "coverage/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": ["error", RAW_DATABASE_ACCESS],
    },
  },
  {
    // The database module itself, the platform console's server code, CLI
    // scripts, migrations/seed and tests are the only places with raw access.
    files: [
      "src/server/db/**",
      "src/server/platform/**",
      "scripts/**",
      "prisma/**",
      "tests/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
