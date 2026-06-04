---
description: 'Use when working on Stream Deck plugin source code (TypeScript actions, plugin runtime, SDK integration).'
paths:
  - "{plugin*,*plugin}/src/**"
---

# Stream Deck Plugin Instructions

Rules for the plugin source code

## Plugin

- Always set `streamDeck.settings.useExperimentalMessageIdentifiers = true;` in the `plugin.ts`

## Error Handling

- Only action classes should handle errors so that we can use `showAlert` providing the user with feedback. Any caught error should be logged as `error`
- Connecting services can throw errors to be handled by the action classes

## Check Logs

- After re-building the plugin, check the first 15 lines of the log file in the `*.sdPlugin/logs` to ensure there wasn't a critical error.

## Action States

- If an action has exactly 2 states, use update the `manifest.json` to reflect this and call `setState` instead of relying on `setImage`.

## `onDidReceiveSettings` and `onDidReceiveGlobalSettings`

- Settings are already stored in these events, so there is no need to call `setSettings` or `setGlobalSettings` within these events.
