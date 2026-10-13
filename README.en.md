# mega-settings

[简体中文](https://github.com/BonovaVanro/dsh-mega-settings/blob/main/README.md) · **English**

A **unified settings hub** for DSH (DeepSeek Harness): gather scattered plugin settings entries into one place, organized by your own groups. It is the host of the mega family — Collect and Fold modes share the same grouping data.

## Highlights

- **Collect mode**: card hub for third-party settings; drag cards between custom groups and the ungrouped area; drag group headers to reorder;
- **Fold mode**: takes over the official settings dialog nav; third-party entries fold into groups; drag a row to the top area to release it as a top-level entry, or drag it back to fold it again;
- **Groups**: create (type the name right away, Enter to confirm), rename/delete via hover actions on the title, or use the + on the ungrouped row;
- **Drag & drop** (same in both modes): pointer-drag with the original element following the cursor (no browser ghost), a single dashed slot above/below the hovered row half, FLIP smooth reflow with a judgement lock, and edge auto-scroll;
- **Native look**: only dsh semantic tokens and official visuals, no theme branches;
- **Settings shell aligned with the official one**: title / trigger / action row (e.g. "open settings document") / close button / first-run onboarding all render the official slot entries, and a broken connection can be reconnected in place; the nav has a search box;
- **Settings-page switches**: the compatibility self-check (mega family contract) and the nav search box can be turned on or off, and unread tips are dismissed with one click;
- **mega Optimize**: a hub of optimization toggles for dsh and third-party plugins — rightbar fullscreen zero track / fullscreen background transparency (slider; larger = more transparent) / hide the conversation toolbar in fullscreen / left sidebar footer actions layout / `Ctrl+Shift+S` to open settings; third-party entries get one panel per plugin (dsh-better-sidebar, dsh-cost-meter, skill explorer) and are hidden (and not injected) when the plugin is not installed or not enabled; adding an optimization is just appending a registry def;
- **Version self-check**: on host startup verifies the current dsh version line and warns in the console when unsupported (never blocks loading).

## mega Optimize

"mega Optimize" is a mega member page of this plugin (a card in the mega group in Collect mode / a row in the mega section in Fold mode) hosting optimization toggles for dsh and third-party plugins. All toggles apply **immediately and are reversible**.

### dsh group

Grouped into four sub-sections: **Desktop app** (desktop shell only) → **Content** → **Left sidebar** → **Rightbar**.

#### Desktop app (official DSH desktop application only)

- **Titlebar background follows the left sidebar**: the window titlebar matches the sidebar in color and transparency, and the three **native window buttons** (minimize/maximize/close) get a transparent background (the official color probe is redirected; the theme variable stays untouched);
- **Remove frame top padding**: drops the 40px top padding the app reserves for the Windows drag titlebar (off by default — content then sits level with the window buttons).

#### Content

- **Unify background color**: both the conversation centre column and the conversation root paint the theme background; this keeps only the selected layer (the other is cleared);
- **Background transparency**: blends the selected layer toward transparent; with unification off, both layers are blended;
- **File preview background transparency**: blends the file preview card background with the theme layer-1 color;
- **Remove conversation header background**: removes the conversation header background so it matches the body.

#### Left sidebar

- **Unify background color**: both the sidebar column and the sidebar root paint a background; this keeps only the selected layer;
- **Background transparency**: blends the kept layer toward transparent (higher = more transparent, default 30);
- **Footer actions layout**: stacks the footer actions vertically; buttons go full width and entry text is centered.

#### Rightbar

- **Rightbar fullscreen zero track**: forces the grid placeholder track to 0 while the right sidebar is fullscreen so the center column keeps its width (restored correctly on exit/close);
- **Rightbar fullscreen background transparency**: slider 0-100, larger = more transparent (default 25); re-blends the fullscreen panel background with the current theme color;
- **Hide conversation toolbar in fullscreen**: hides the conversation header utilities while the right sidebar is fullscreen;
- **Fullscreen by default on open** / **fullscreen z-index** / **fullscreen padding** / **close fullscreen with Esc** / **open in a tab**, and more.

#### General

- **Frame background transparency**: blends the content frame background toward transparent;
- **Markdown table max width**, **hover copy card theme adaptation**, **Settings shortcut** (`Ctrl+Shift+S` opens the settings dialog, intercepting the browser "Save as"), and more.

### Third-party plugins

Each plugin gets its own panel (plugin name + version in the header); **plugins that are not installed or not enabled are hidden and their effects are not injected**. Currently:

- **dsh-better-sidebar**: hide the bottom-panel toggle;
- **dsh-cost-meter**: peak/valley pricing theme adaptation (weekend and peak markers/labels follow the theme; the peak-hour color is selectable: warning / danger / error); the bottom cost bar also gained **background transparency** and **remove border**.

> The Skill explorer (`@linxin666/dsh-client-ui-skill-explorer`) theme adaptation has been **removed**: that plugin now handles theme/skin adaptation itself, so this plugin no longer overrides its styles.

### Extensibility

Optimizations use a registry: each optimization is one def in `src/client/optimize.ts` (id / group / target plugin / locale keys / effect); toggles live in `optToggles`, numeric values in `optValues`; effects support static CSS, slider-driven CSS, and JS effects. Adding an optimization is just appending a def — the page places it into the dsh group or the matching plugin panel automatically.
<!-- TODO(screenshots): fill each src once images are ready (put them under assets/, width <=1280px). Feel free to add/remove items -->
## Screenshots
### Collect mode
<div align="center">
  <img width="600" height="600" alt="Collect mode: grouped cards overview" src="https://github.com/user-attachments/assets/46b2b7b2-fab6-4195-a847-cc6fc0463e83" />
  <br />
  <sub>Fig. 1 · Collect mode — grouped card hub</sub>
</div>
<br />

<div align="center">
  <img width="600" height="600" alt="Collect mode: sub page" src="https://github.com/user-attachments/assets/c5223c23-c231-4ba7-80a1-05663d0c53a9" />
  <br />
  <sub>Fig. 2 · Collect mode — sub page preview</sub>
</div>
<br />

### Fold mode
<div align="center">
  <img width="600" height="600" alt="Fold mode: official settings dialog takeover" src="https://github.com/user-attachments/assets/fc126319-42a8-4ecc-883a-5870f5db4a14" />
  <br />
  <sub>Fig. 3 · Fold mode — takes over the official settings dialog</sub>
</div>
<br />

<div align="center">
  <img width="600" height="600" alt="Fold mode: sub page" src="https://github.com/user-attachments/assets/50d801e0-63a1-4706-bf2e-be853403d646" />
  <br />
  <sub>Fig. 4 · Fold mode — sub page preview</sub>
</div>
<br />

## Tutorials
### Collect mode
<div align="center">
  <video autoplay loop muted playsinline src="https://github.com/user-attachments/assets/a27461b1-2056-47fa-abbb-cb10efb8a1dd"/>
  <br />
  <sub>Video 1 · Collect mode — tutorial</sub>
</div>
<br />

### Fold mode
<div align="center">
  <video autoplay loop muted playsinline src="https://github.com/user-attachments/assets/48821b38-de39-41f0-b1a3-052c16dbd2f8"/>
  <br />
  <sub>Video 2 · Fold mode — tutorial</sub>
</div>

## Install

Adapted to dsh **`> 0.2.0-rc.2`**. For older lines use the corresponding branch release (0.1.1 / 0.1.2 / 0.1.5 / 0.1.7).
Three sources are supported: npm, GitHub tag, and local package. **The desktop app and the CLI use two separate profiles, so the plugin must be installed once per profile** (see below).

**npm**

```
dsh plugin --profile web add dsh-mega-settings@0.2.0-rc.2
```

**GitHub tag**

```
dsh plugin --profile web add github:BonovaVanro/dsh-mega-settings#v0.2.0-rc.2
```

**Local package**

```
dsh plugin --profile web add dsh-mega-settings-0.2.0-rc.2.tgz
```

### Desktop app (official DSH desktop application)

The desktop app **keeps no plugin roster of its own**: it mounts an ordinary `dsh-base` + `dsh-web-app` profile, and third-party plugins load through the regular `dsh.bundle` + `dsh.client(platform: "web")` contract — **no desktop-specific build is needed**, so one package and one build serve both the desktop app and web.

It does, however, use a **separate profile** from the CLI (with its own configuration), so the plugin must be installed once per profile:

| How you run dsh | Profile directory | How to install |
| --- | --- | --- |
| Desktop app (default `desktop`) | `~/.dsh/profiles/desktop` | **the in-app plugin management UI** |
| CLI `dsh web` | `~/.dsh/profiles/web` | `dsh plugin --profile web add …` |

The `desktop` profile is **managed exclusively by the Electron application**: `dsh plugin --profile desktop …` is refused (`profile "desktop" is managed exclusively by the Electron application`), so install/update/remove it from inside the app.

After installing, you can confirm which build is running from the page console: look for the `[mgs-build]` log line or read `window.__MGS_BUILD__`.

## Getting started

1. Open settings, find mega-settings and switch between **Collect / Fold** (data is shared; switch anytime);
2. **Collect**: open the hub — cards are third-party settings entries; drop a card into a group or the ungrouped area; hover a group title to rename/delete it; drag group headers to reorder;
3. **Fold**: open the official settings dialog and expand "Fold" — drag rows to reorder; drag a row to the top nav area to release it as its own entry; drag it back into the fold body to re-host it;
4. Releasing/re-hosting only changes entry ownership — no configuration is ever deleted;
5. Toggle optimizations on the mega Optimize page (rightbar fullscreen, etc.); third-party panels appear only when the plugin is installed and enabled;
6. The settings nav has a search box; on the mega settings page you can turn the compatibility self-check off, hide the search box, and dismiss unread tips with one click.

## Supported dsh versions & compatibility

- **Adapted to dsh version: `>= 0.2.0-rc.1`** (this build takes 0.2.0-rc.1 as its floor; 0.2.0-rc.2 / the 0.2.0 release / 0.3.0 and newer are all compatible);
- Older lines (dsh 0.1.1 / 0.1.2 / 0.1.5-rc.\* / 0.1.7-rc.\* / 0.2.0-alpha) should use the corresponding branch release;
- On startup the host self-checks the version policy (default `>= 0.2.0-rc.1`); a mismatch makes the console print
  `dsh-mega-settings may not be compatible with dsh <version> — use with caution`, and the plugin still loads;
- The same floor is declared through `peerDependencies` (`@deepseek-ai/dsh-settings`, `dsh-client-ui-settings`, `dsh-client-ui-renderer` and `dsh-client-locale` are all `>=0.2.0-rc.1`); when the runtime is below it, dsh blocks the install and it can be accepted explicitly with `dsh plugin allow-version … --accept-risk` or the plugin manager (**note**: dsh evaluates the *runtime* version against the peer range, so a strict `>` would force a per-version exemption for the version equal to the floor — hence `>=`);
- Maintainers may tune `DSCH_COMPAT_POLICY` in `src/index.ts` (supports > / < / = with wildcard patterns and arrays).

## FAQ

**A third-party plugin panel (e.g. dsh-better-sidebar) is missing from mega Optimize?**

Third-party panels only show when the plugin is **installed and enabled** — not installed, or installed but disabled, and the panel is hidden and its effects are not injected. Make sure the plugin is installed and enabled (an enabled plugin registers its settings section).

**A toggle is on but nothing changes?**

All toggles apply immediately; a few UI tweaks (e.g. rightbar fullscreen zero track) fully apply after a page refresh. If it still does not work, confirm the target plugin is enabled, or hard-refresh (Ctrl+F5).

**Will switching between Collect and Fold modes lose my groups?**

No. Both modes share the same grouping data (groups / navOrder); switch anytime and everything is preserved.

**Does mega Optimize modify third-party plugin data?**

No. Optimizations only inject UI styles/behaviors (CSS/JS) and never read or write third-party plugin config; toggles and values live only in this plugin's own config (optToggles / optValues).

**Why isn't mega Optimize published as a separate plugin?**

To avoid maintaining another release line. mega Optimize ships as a mega member page of mega-settings, sharing one version number and release flow; adding an optimization only touches the registry (append a def), so a separate package would only add maintenance burden.

## License

Apache-2.0