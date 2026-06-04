---
name: update-ai
description: Pull the latest shared agent config (instructions and skills) from the ChekTek/ai repo into this repo. Use when you want to update the copied .claude config to the newest version.
---

# Update AI Config

Pull the latest shared agent configuration from the `ChekTek/ai` repo into the
current repo.

## Steps

1. Ensure the `config` remote exists (idempotent — ignore the error if it's
   already added):

   ```bash
   git remote add config https://github.com/ChekTek/ai.git 2>/dev/null || true
   ```

2. Fetch and check out the latest config folder:

   ```bash
   git fetch config main && git checkout config/main -- .claude
   ```

3. Report which files changed (`git status --short -- .claude`) so the user can
   review and commit them.
