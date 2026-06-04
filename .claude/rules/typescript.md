---
description: 'Use when working with TypeScript, JavaScript, TSX, JSX, frontend code, Node.js code, package scripts, and typed APIs.'
paths:
    - '**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'
---

# TypeScript Instructions

## Config

- There should be an `eslint` config at the root using the `@elgato/eslint-config` package, with `config.strict`.
- `@elgato/prettier-config` should be a dev dependency and set in the `package.json`
- The project should use pnpm instead of npm
- The project should use rolldown instead of rollup.

## Types

- Everything should have explicit types

## Connecting APIs

- When connecting to an API or service, create a dedicated service class `*-service.ts` that encapsulates all connection logic and API calls

## Error Handling

- Prefer using `try/catch/finally` for error handling over `.catch()`.

## Promises

- Use `async/await` syntax for working with promises instead of `.then()`

## Conditionals

- if/else statements exceeding 3 conditions should be refactored to use a switch statementØ
- conditionals can only be a ternary operator if they are simple and fit on one line
- if statements can only exclude {} if they fit on one line

## Functions Calls

- Do not prefix function calls with `void` even if the function returns nothing.

## Prefer Contants & Destructuring

- Use `const` for variables that are not reassigned and destructure objects when possible.

## Preferred Libraries

- Event Emitter: [@elgato/utils](https://www.npmjs.com/package/@elgato/utils)
- Image Manipulation: [@resvg/resvg-js](https://www.npmjs.com/package/@resvg/resvg-js)
