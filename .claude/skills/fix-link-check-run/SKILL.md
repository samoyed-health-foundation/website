---
name: Fix link check run
description: Fix the dead links reported by a failing Links (lychee) workflow run and open a draft PR with a before/after link table. Use when given a GitHub Actions run URL that failed the Links / check-links job, or asked to fix dead links from a link check.
---

This is the Claude Code entry point. The canonical skill lives in the cross-tool
directory so OpenCode and other harnesses read the same file.

Read and follow `.agents/skills/fix-link-check-run/SKILL.md` from the repository root
(`git rev-parse --show-toplevel` if the working directory is nested). Its supporting paths
resolve relative to `.agents/skills/fix-link-check-run/`.
