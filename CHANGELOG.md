# Changelog

All notable changes to Muse are documented here.

Versions follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`, with a
`-beta.N` pre-release tag while Muse is in beta. The version lives in one place —
`mnemo-plugin.json` — and everything derives from it: the footer, the Beta badge
(shown whenever the version carries a pre-release tag), and the `generator: muse@x.y.z`
stamp written into every scaffolded project. `package.json` must carry the same value;
the build fails on drift (`scripts/check-version.mjs`).

## [1.0.0-beta.5] — 2026-08-20

The language, the theme and the keyboard.

- **The design studio spoke French to everyone.** It was written before Muse
  had i18n and never came back: its tabs, colour wheel, style descriptions,
  effect labels, trends panel and save row were hardcoded — including the eight
  live style previews, the largest thing on the screen. Everything visible now
  resolves through `t()` in EN/FR/ES.
- **Muse follows the shell's theme.** A cartridge iframe inherits nothing from
  the host's stylesheets, so the host broadcasts its computed design tokens
  instead — Muse simply was not listening. It subscribes once now, and a
  `--mu-*` layer of twenty semantic roles reads the host's token first and
  falls back to Muse's own dark palette when there is none. Design *content*
  (the style presets and their previews, the colour wheel, the brand marks)
  stays literal on purpose: it shows a fixed design and must not follow a theme.
- **Every control states its name, every overlay releases the keyboard.**
  Seventeen icon-only buttons had no accessible name and fifteen fields were
  named only by a placeholder, which stops existing the moment you type.
  Overlays closed on a backdrop click and nothing else — Escape works now. The
  dimmest text level and the primary button both failed WCAG AA contrast; the
  worst text in the app went from 3.02:1 to 4.37:1 dark and 4.63:1 light.
- **A status line no longer freezes in the language it was born in.** Messages
  were stored already translated, so a banner kept speaking the old language
  after a switch. They now store the key and render at display time — while a
  raw error from the host passes through untranslated, because it is not ours
  to translate.
- **The app catalogue survives a language switch.** `CATALOG.md` was detected
  by its translated column header, so a catalogue written in another language
  read as "no catalogue" and was silently rebuilt — every row lost. It is
  detected by the table separator now, and prose written under the table is
  carried over untouched.
- **The repair contract speaks your language.** It demanded the French words
  `CORRIGÉ` / `IMPOSSIBLE` in every language while telling the agent to answer
  in yours; an English or Spanish reply parsed as nothing and the round was
  lost. Both words follow the language now, and the parser accepts every
  spelling of either.
- **Fixed: the Open Design loader could not settle.** A system that failed to
  load — deleted folder, truncated clone — re-triggered the effect that had
  just run, looping over the disk indefinitely.
- Also: `<html lang>` follows the shell (a screen reader was pronouncing
  English pages as French), amounts are formatted per locale (`$1.23` in
  English, `1,23 $` in French), and the clone modal shows its progress instead
  of a spinner that had not moved in four minutes.

## [1.0.0-beta.4] — 2026-08-04

The first-launch fix.

- **First-run authorization no longer kills the session** — on a fresh install
  the host opens its native "Security Authorization Required" dialog and waits
  for the human; the memory bridge used to give up after 30 seconds, booting
  Muse into a dead session even when the permission was granted moments later
  (reported by a beta user). The bridge now waits at human speed (canonical
  SDK fix, up to 5 minutes), the error banner grew a Retry button, and
  finishing onboarding re-ensures the vault so the choice is never silently
  dropped again.
- **Every error message speaks the shell language** — six French-only error
  prefixes (memory unavailable, design, file view, folder open, artifact,
  delete) moved to i18n keys in EN/FR/ES.

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
