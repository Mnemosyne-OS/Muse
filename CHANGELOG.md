# Changelog

All notable changes to Muse are documented here.

Versions follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`, with a
`-beta.N` pre-release tag while Muse is in beta. The version lives in one place —
`mnemo-plugin.json` — and everything derives from it: the footer, the Beta badge
(shown whenever the version carries a pre-release tag), and the `generator: muse@x.y.z`
stamp written into every scaffolded project. `package.json` must carry the same value;
the build fails on drift (`scripts/check-version.mjs`).

## [1.0.0-beta.3] — 2026-08-04

The document release.

- **Advanced document mode** — build a document instead of receiving it in one
  shot: an editable **plan** (proposed by Muse from your intent and your memory,
  or started from scratch at zero cost), then **blocks** — each section generated
  alone under a shared style contract, regenerable alone with a note that outranks
  everything, with manual text blocks and image blocks in between (video/audio
  announced as coming, never faked) — then a deterministic, zero-credit
  **assembly** into the same self-contained HTML as the quick mode.
- **The door stays open** — a generated document reopens in the studio from its
  own screen: edit a section, regenerate it alone, save the next version of the
  same document. Builder state is checkpointed per document (crash-safe, resumable).
- **Documents-only Muse** — the onboarding welcome asks what you create: choosing
  "documents only" skips the IDE / app-space / repo steps entirely and strips the
  dashboard down to the studio (one lane, no app tiles). Reversible both ways,
  persisted.
- The advanced mode is reachable straight from the dashboard (Document chip),
  seeded with whatever intent is typed.
- Per-block cost is metered into one summed figure on the saved version.
- Fixed on the way: declining the resume banner could reuse the previous
  document's id — a brand-new document would have appended its versions to the
  old one.

## [1.0.0-beta.2] — 2026-08-03

- The vault tile counts **Projects** (localized EN/FR/ES), no longer "Apps" — a Muse
  row is a project; apps are only one of its lanes. Counting itself was repaired
  host-side the same evening (custom app spines survive ingest).

## [1.0.0-beta.1] — 2026-08-03

First public beta.

- **Framing chat** — one question at a time, an anti-over-ambition coach that shrinks
  your idea to a v0 of at most 3 features, with a recap gate before concluding.
  Crash-safe: every turn is checkpointed, resumable from the dashboard.
- **Three lanes** — document (generated in Muse, grounded in your memory), website and
  cartridge (scaffolded on disk, handed off to your IDE agent). An intent router picks
  the lane; forcing a mode always wins over the model.
- **Project board** — per-project dashboard with a clickable timeline whose phase
  statuses are computed from what is actually on disk, a live file tree, and the
  hand-off prompt living inside its step.
- **Design studio** — style presets with faithful live previews, chromatic wheel with
  color-harmony palettes, effects, personal design libraries imported from kits, and a
  `design-tokens.json` contract the IDE prompt applies strictly.
- **Artifacts** — optional `docs/SPEC.md` + `docs/DIAGRAMS.md` (Mermaid) generation with
  eco/standard/max model tiers.
- **Truth pass** — free deterministic heuristics plus an adversarial agent that judges
  every promised v0 feature (ok / doubtful / missing) into `docs/VERITY.md`, with a
  one-click repair prompt. An alert detector, not a proof.
- **Memory grounding** — pick none, all, or a mix of your vaults; a grounding badge
  shows exactly how many memories reached the model.
- **IDE hand-off** — scaffold with `BRIEF.md` + `app-spec.json`, one-click MCP
  configuration per IDE, built-app detection, and “View my app” rendering the built v0
  inside Muse.
- **EN / FR / ES**, hairline design language, per-project measured cost.
