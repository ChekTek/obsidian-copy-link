---
name: config-strict-typescript
description: Update a TypeScript project's tooling config to match the team standards (eslint strict, prettier, pnpm, rolldown). Use when setting up or aligning a repo's config to the preferred TypeScript setup.
---

# Config Strict TypeScript

Update the current repository so its tooling config matches the team's standard
TypeScript setup.

## Target state

- ESLint config at the root using `@elgato/eslint-config` with `config.strict`.
- `@elgato/prettier-config` as a dev dependency, referenced in `package.json`.
- The project uses **pnpm** instead of npm.
- The project uses **rolldown** instead of rollup.

## Steps

1. **Inspect** the repo to see what already exists:
   - Root ESLint config (`eslint.config.*`, `.eslintrc*`).
   - `package.json` (`devDependencies`, `prettier`, `packageManager`, scripts).
   - Bundler config and lockfiles (`rollup.config.*`, `package-lock.json`,
     `pnpm-lock.yaml`).

2. **ESLint** — ensure a root config uses `@elgato/eslint-config` with the
   strict preset:

   ```js
   // eslint.config.js
   import config from "@elgato/eslint-config";

   export default config.strict;
   ```

   Add `@elgato/eslint-config` as a dev dependency if missing.

3. **Prettier** — add `@elgato/prettier-config` as a dev dependency and
   reference it in `package.json`:

   ```jsonc
   {
     "prettier": "@elgato/prettier-config"
   }
   ```

4. **pnpm** — migrate off npm:
   - Remove `package-lock.json` if present.
   - Set `"packageManager": "pnpm@<version>"` in `package.json`.
   - Reinstall with `pnpm install` to generate `pnpm-lock.yaml`.

5. **rolldown** — migrate off rollup:
   - Replace the `rollup` dependency with `rolldown`.
   - Convert `rollup.config.*` to a `rolldown.config.*` and update build
     scripts in `package.json` to call `rolldown`.

6. **Verify** the changes:

   ```bash
   pnpm install
   pnpm exec eslint .
   pnpm run build
   ```

7. **Report** which files changed (`git status --short`) so the user can review
   and commit them.
