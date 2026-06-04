---
description: 'Use when editing project-level config (package.json, tsconfig.json, rollup/vite config, etc.) for a Stream Deck plugin project.'
paths:
    - '{plugin*,*plugin}/*'
---

# Stream Deck Config Instructions

- If a native dependencies is added to the project, update the configuration so the files are copied to the `*.sdPlugin` folder so it is distributed in the plugin package
