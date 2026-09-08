# mega-settings

[简体中文](./README.md) · **English**

A **unified settings hub** for DSH (DeepSeek Harness): gather scattered plugin settings entries into one place, organized by your own groups. It is the host of the mega family — Collect and Fold modes share the same grouping data.

## Highlights

- **Collect mode**: card hub for third-party settings; drag cards between custom groups and the ungrouped area; drag group headers to reorder;
- **Fold mode**: takes over the official settings dialog nav; third-party entries fold into groups; drag a row to the top area to release it as a top-level entry, or drag it back to fold it again;
- **Groups**: create (type the name right away, Enter to confirm), rename/delete via hover actions on the title, or use the + on the ungrouped row;
- **Drag & drop** (same in both modes): pointer-drag with the original element following the cursor (no browser ghost), a single dashed slot above/below the hovered row half, FLIP smooth reflow with a judgement lock, and edge auto-scroll;
- **Native look**: only dsh semantic tokens and official visuals, no theme branches;
- **Version self-check**: on host startup verifies the current dsh version line and warns in the console when unsupported (never blocks loading).

<!-- TODO(screenshots): fill each src once images are ready (put them under assets/, width <=1280px). Feel free to add/remove items -->
## Screenshots
### Collect mode
<div align="center">
  <img width="1200" height="1200" alt="Collect mode: grouped cards overview" src="https://github.com/user-attachments/assets/46b2b7b2-fab6-4195-a847-cc6fc0463e83" />
  <br />
  <sub>Fig. 1 · Collect mode — grouped card hub</sub>
</div>
<br />

<div align="center">
  <img width="1200" height="1200" alt="Collect mode: sub page" src="https://github.com/user-attachments/assets/c5223c23-c231-4ba7-80a1-05663d0c53a9" />
  <br />
  <sub>Fig. 2 · Collect mode — sub page preview</sub>
</div>
<br />

### Fold mode
<div align="center">
  <img width="1200" height="1200" alt="Fold mode: official settings dialog takeover" src="https://github.com/user-attachments/assets/fc126319-42a8-4ecc-883a-5870f5db4a14" />
  <br />
  <sub>Fig. 3 · Fold mode — takes over the official settings dialog</sub>
</div>
<br />

<div align="center">
  <img width="1200" height="1200" alt="Fold mode: sub page" src="https://github.com/user-attachments/assets/50d801e0-63a1-4706-bf2e-be853403d646" />
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

Requires dsh v0.1.1-*. Three sources are supported: GitHub tag, local package, and npm.

**GitHub tag**

```
dsh plugin --profile web add github:BonovaVanro/dsh-mega-settings#v0.1.1
```

**Local package**

```
dsh plugin --profile web add dsh-mega-settings-0.1.1.tgz
```

**npm (publishing on hold — not available yet)**

```
dsh plugin --profile web add dsh-mega-settings@0.1.1
```

## Getting started

1. Open settings, find mega-settings and switch between **Collect / Fold** (data is shared; switch anytime);
2. **Collect**: open the hub — cards are third-party settings entries; drop a card into a group or the ungrouped area; hover a group title to rename/delete it; drag group headers to reorder;
3. **Fold**: open the official settings dialog and expand "Fold" — drag rows to reorder; drag a row to the top nav area to release it as its own entry; drag it back into the fold body to re-host it;
4. Releasing/re-hosting only changes entry ownership — no configuration is ever deleted.

## Supported dsh versions & compatibility

- **Supported dsh versions: 0.1.1-rc.1, 0.1.1-rc.2**;
- On startup the host self-checks the version policy (default `= 0.1.1-*`, i.e. the whole dsh 0.1.1 prerelease line); other versions make the console print
  `dsh-mega-settings may not be compatible with dsh <version> — use with caution`, and the plugin still loads;
- Maintainers may tune `DSCH_COMPAT_POLICY` in `src/index.ts` (supports > / < / = with wildcard patterns and arrays).

## License

Apache-2.0