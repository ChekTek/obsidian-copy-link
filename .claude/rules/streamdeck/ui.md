---
description: 'Use when working on Stream Deck property inspector UI (HTML/JS/CSS in the .sdPlugin/ui folder).'
paths:
  - "**/*.sdPlugin/ui/**"
---

# Stream Deck UI Instructions

- Favor using elements from [SDPI Components](https://sdpi-components.dev/docs/components)
- Settings that depend on other settings should be hidden until the parent setting is selected
- When communicating with the plugin use `const { streamDeckClient } = SDPIComponents;` rather than creating websocket connections directly
- Event listeners attached to SDPI Components need to be created through the `focusElement` (i.e. `const displayElement = document.getElementById('display-select').focusElement.value;`)
