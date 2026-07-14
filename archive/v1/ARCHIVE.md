# Blink v1 (archived 2026-07-14)

The original Blink: Tauri v2 + React 18 + TypeScript. Superseded by the native
Swift/AppKit v2 that now lives at the repo root.

- Last state at root: tag `v1-final`
- Why the rewrite and what carried over: `../../docs/v2-plan.md`
- What v1 did (accurate inventory): `../../docs/functionality-v1.md`

Known state when archived: dormant since Aug 2025; `main` did not compile
(`uuid` crate missing the `v5` feature); notes-metadata lived in a write-only
SQLite index; two parallel frontend state systems. See the v2 plan's "lessons"
section — every v1 data-loss bug became a v2 hard requirement.
