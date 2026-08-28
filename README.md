<div align="center">

<img src="https://raw.githubusercontent.com/Mnemosyne-OS/Mnemosyne-Neural-OS/main/assets/banner-mnemosyne-os.png" width="100%" alt="Mnemosyne OS — Your memory. Your machine. Your rules." />

🌐 [**mnemosyne-os.io**](https://mnemosyne-os.io) — the product&ensp;·&ensp;[**mnemosyne-os.com**](https://mnemosyne-os.com) — for organizations&ensp;·&ensp;📖 [**docs.mnemosyne-os.io**](https://docs.mnemosyne-os.io) — the documentation

</div>

# Muse <img src="icon.svg" width="28" align="top" alt=""> — neural coding for Mnemosyne OS

![Version](https://img.shields.io/badge/version-1.0.0--beta.3-blue)
![Status](https://img.shields.io/badge/status-beta-7dd3fc)
![Platform](https://img.shields.io/badge/platform-Mnemosyne%20OS-8b7cf0)

> **Create by intention, not by plumbing.** Describe an app in plain words; Muse frames
> it with you, designs it, scaffolds a real project on disk and hands it to your IDE
> agent — grounded in your own memory.

> [!IMPORTANT]
> Muse is a **cartridge**: it runs inside [Mnemosyne OS](https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS).
> Download the host from the [latest release](https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS/releases/latest), then install Muse from MnemoHub or link this repo.

## What it does

1. **Frame** — a scoping coach asks one question at a time and shrinks your idea to a
   v0 of at most 3 features, recapped and confirmed before anything is written.
2. **Route** — three lanes: **document** (generated in Muse, grounded in your vaults),
   **website** and **cartridge** (scaffolded on disk for your IDE agent). You can
   always force a lane; the human governs.
3. **Design** — pick a style with faithful live previews, a color-harmony palette, and
   optionally your own design libraries; Muse writes a `design-tokens.json` contract.
4. **Hand off** — a real project folder (`BRIEF.md`, `app-spec.json`, optional
   `docs/SPEC.md` + diagrams) plus a ready-made prompt and one-click MCP setup for
   VS Code, Cursor or Antigravity.
5. **Verify** — the truth pass re-reads what the agent delivered: free deterministic
   heuristics plus an adversarial review of every promised feature, written to
   `docs/VERITY.md` with a one-click repair prompt. An alert detector, not a proof.
6. **Run** — Muse detects the built v0 and renders it live, in-app.

Everything is local-first: your memory stays on your machine, and the model tiers
(eco · local / standard · auto / max · cloud) are always your choice.

## Beta

Muse is in **beta** — the pre-release tag in `mnemo-plugin.json` (`1.0.0-beta.N`) is
what drives the Beta badge in the app. See [CHANGELOG.md](CHANGELOG.md) for the
version history and the versioning rules.

## Development

From the monorepo root (dependencies installed):

```bash
pnpm --filter @mnemosyne-plugins/muse dev
```

Port **5205** (declared in `apps/dev-ports.json` + `mnemo-plugin.json`, base `./`).
Checks: `pnpm --filter @mnemosyne-plugins/muse i18n` (EN/FR/ES locales aligned),
`check:version` (manifest ↔ package.json), `test` (pure-helper smoke tests) — all
three run as part of `build`.

## License

[Mnemosyne OS Cartridge License](LICENSE.md) — source-available: the full `src/` ships
in this repo and modifications are welcome, as long as the cartridge runs within the
Mnemosyne OS ecosystem. Standalone hosting or redistribution outside a Mnemosyne OS
instance requires written consent.

## Which Mnemosyne is this?

Several unrelated projects share the name. This cartridge runs inside **Mnemosyne OS**, the sovereign, local-first memory operating system published by XPACEGEMS LLC. Its only official addresses:

- Product site: <https://mnemosyne-os.io>
- Organizations: <https://mnemosyne-os.com>
- Documentation: <https://docs.mnemosyne-os.io>
- Host source: <https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS>
- Packages: the npm scope `@mnemosyne_os`

It is not the Mnemosyne spaced-repetition flashcard software, and it is not the `mnemosyne-oss` GitHub organization. Those are different projects by different authors.

---

<sub>**[Mnemosyne OS](https://mnemosyne-os.io)** — the sovereign, local-first memory OS this cartridge runs in.
Get it at [mnemosyne-os.io/download](https://mnemosyne-os.io/download), install cartridges from the built-in MnemoHub store, or [build your own](https://mnemosyne-os.io/dev).</sub>
