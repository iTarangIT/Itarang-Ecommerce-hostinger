/**
 * Generates the on-brand SVG product illustrations used across the storefront.
 *
 * Phase 1 has no product photography, and shipping generic stock imagery would
 * misrepresent the catalogue. These illustrations are deliberately schematic:
 * clearly drawings, on-brand, and consistent at every size the grid uses.
 *
 * Run with: npm run gen:images
 * Output:   public/art/{kind}-{variant}-{view}.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/art');

const KINDS = ['inverter', 'battery', 'ups', 'combo'];
const VARIANTS = [1, 2, 3];
const VIEWS = ['front', 'angle', 'detail', 'panel', 'box'];

/**
 * Three colourways so same-category grids stay visually distinguishable.
 *
 * SVG cannot read the CSS tokens, so these are literals and always will be —
 * but they are the same identity, hand-resolved from `globals.css`:
 *
 *   body/face/line   the ink ramp (--ink-900 … --ink-400)
 *   accents          --azure-500 / --azure-600
 *   text             --ink-50
 *
 * Colourway 2 stays the light one, so a grid of three variants still reads as
 * three products rather than three shades of the same one.
 *
 * KEEP IN STEP WITH THE TOKENS IN `src/app/globals.css`. Re-run `npm run
 * gen:images` after any change here — the 60 files under `public/art/` are
 * build output, not source.
 */
const PALETTES = {
  1: { body: '#1d2a33', bodyDark: '#12181d', face: '#26363f', line: '#4a6270', text: '#f2f4f6' },
  2: { body: '#e7ecef', bodyDark: '#ced6db', face: '#f4f7f8', line: '#93a7b1', text: '#1d2a33' },
  3: { body: '#12181d', bodyDark: '#0b1013', face: '#1d2a33', line: '#3d5560', text: '#f2f4f6' },
};

/** The brand azure, replacing the amber that used to carry these highlights. */
const ACCENT = '#107eb1';
const ACCENT_DEEP = '#0b6a94';
const BG = '#f7f9fa';
const BG_EDGE = '#e7ecef';
const SHADOW = '#12181d';

const W = 800;
const H = 800;

const header = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${id}">`;

function defs(p) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG}"/>
      <stop offset="1" stop-color="${BG_EDGE}"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.face}"/>
      <stop offset="1" stop-color="${p.body}"/>
    </linearGradient>
    <linearGradient id="bodySide" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.bodyDark}"/>
      <stop offset="1" stop-color="${p.body}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="${SHADOW}" flood-opacity="0.16"/>
    </filter>
  </defs>`;
}

const backdrop = `
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W / 2}" cy="${H / 2 - 30}" r="300" fill="url(#glow)" opacity="0.35"/>
  <ellipse cx="${W / 2}" cy="678" rx="230" ry="26" fill="${SHADOW}" opacity="0.1"/>`;

const grille = (x, y, w, rows, colour, gap = 16) =>
  Array.from({ length: rows }, (_, i) =>
    `<rect x="${x}" y="${y + i * gap}" width="${w}" height="5" rx="2.5" fill="${colour}" opacity="0.32"/>`,
  ).join('');

const led = (x, y, colour, r = 7) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/><circle cx="${x}" cy="${y}" r="${r + 5}" fill="${colour}" opacity="0.18"/>`;

const screw = (x, y, colour) =>
  `<circle cx="${x}" cy="${y}" r="5" fill="${colour}" opacity="0.35"/>`;

/**
 * The family named here is the one a viewer's browser resolves when it renders
 * the SVG, so it has to track the storefront's own face — it was still asking
 * for Sora after the site had moved on.
 */
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

const wordmark = (x, y, colour, size = 22) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700" letter-spacing="1.5" fill="${colour}" opacity="0.85">iTarang</text>`;

const caption = (text, colour) =>
  `<text x="${W / 2}" y="742" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="500" letter-spacing="0.6" fill="${colour}" opacity="0.5">${text}</text>`;

/* --------------------------------------------------------------- inverter */

function inverterFront(p) {
  return `
  <g filter="url(#soft)">
    <rect x="215" y="170" width="370" height="450" rx="34" fill="url(#body)"/>
    <rect x="215" y="170" width="370" height="450" rx="34" fill="none" stroke="${p.line}" stroke-width="2" opacity="0.5"/>
    <rect x="248" y="212" width="304" height="120" rx="16" fill="${p.bodyDark}" opacity="0.75"/>
    <rect x="272" y="240" width="150" height="16" rx="8" fill="${ACCENT}" opacity="0.9"/>
    <rect x="272" y="270" width="220" height="10" rx="5" fill="${p.line}" opacity="0.6"/>
    <rect x="272" y="292" width="110" height="10" rx="5" fill="${p.line}" opacity="0.4"/>
    ${led(505, 250, ACCENT)}
    ${led(505, 292, '#3fbf7f', 5)}
    ${grille(268, 372, 264, 9, p.line)}
    <rect x="248" y="540" width="304" height="52" rx="16" fill="${p.bodyDark}" opacity="0.55"/>
    ${wordmark(276, 574, p.text)}
    <rect x="470" y="556" width="58" height="20" rx="10" fill="url(#accent)"/>
    ${screw(238, 194, p.line)}${screw(562, 194, p.line)}${screw(238, 596, p.line)}${screw(562, 596, p.line)}
  </g>`;
}

function inverterAngle(p) {
  return `
  <g filter="url(#soft)">
    <path d="M250 200 L520 160 L620 200 L620 590 L520 640 L250 600 Z" fill="url(#bodySide)"/>
    <path d="M250 200 L520 160 L520 610 L250 600 Z" fill="url(#body)"/>
    <path d="M520 160 L620 200 L620 590 L520 640 Z" fill="${p.bodyDark}"/>
    <rect x="282" y="238" width="204" height="96" rx="14" fill="${p.bodyDark}" opacity="0.7"/>
    <rect x="302" y="262" width="110" height="14" rx="7" fill="${ACCENT}"/>
    <rect x="302" y="290" width="150" height="9" rx="4.5" fill="${p.line}" opacity="0.6"/>
    ${grille(292, 386, 190, 8, p.line)}
    ${led(462, 262, ACCENT, 6)}
    ${wordmark(296, 566, p.text, 20)}
    <path d="M540 210 L600 232 L600 262 L540 240 Z" fill="${ACCENT}" opacity="0.75"/>
  </g>`;
}

function inverterDetail(p) {
  return `
  <g filter="url(#soft)">
    <rect x="150" y="200" width="500" height="380" rx="30" fill="url(#body)"/>
    <rect x="190" y="244" width="420" height="180" rx="18" fill="${p.bodyDark}"/>
    <rect x="222" y="278" width="230" height="26" rx="13" fill="${ACCENT}"/>
    <rect x="222" y="322" width="330" height="14" rx="7" fill="${p.line}" opacity="0.7"/>
    <rect x="222" y="352" width="180" height="14" rx="7" fill="${p.line}" opacity="0.45"/>
    ${led(556, 290, ACCENT, 12)}
    ${led(556, 350, '#3fbf7f', 9)}
    <rect x="190" y="462" width="130" height="58" rx="14" fill="${p.bodyDark}" opacity="0.6"/>
    <rect x="336" y="462" width="130" height="58" rx="14" fill="${p.bodyDark}" opacity="0.6"/>
    <rect x="482" y="462" width="128" height="58" rx="14" fill="url(#accent)" opacity="0.9"/>
  </g>`;
}

function inverterPanel(p) {
  return `
  <g filter="url(#soft)">
    <rect x="180" y="230" width="440" height="330" rx="26" fill="url(#body)"/>
    <circle cx="290" cy="330" r="34" fill="${p.bodyDark}"/>
    <circle cx="290" cy="330" r="18" fill="#c1483f"/>
    <circle cx="400" cy="330" r="34" fill="${p.bodyDark}"/>
    <circle cx="400" cy="330" r="18" fill="#1f2b3d"/>
    <rect x="470" y="298" width="110" height="64" rx="14" fill="${p.bodyDark}"/>
    <rect x="486" y="320" width="78" height="8" rx="4" fill="${ACCENT}"/>
    <rect x="486" y="338" width="52" height="8" rx="4" fill="${p.line}" opacity="0.6"/>
    <rect x="220" y="418" width="360" height="4" rx="2" fill="${p.line}" opacity="0.4"/>
    <rect x="220" y="452" width="150" height="60" rx="14" fill="${p.bodyDark}" opacity="0.7"/>
    <rect x="392" y="452" width="188" height="60" rx="14" fill="${p.bodyDark}" opacity="0.7"/>
    ${led(258, 486, ACCENT, 8)}${led(300, 486, '#3fbf7f', 8)}${led(342, 486, p.line, 8)}
  </g>`;
}

function boxArt(p, label) {
  return `
  <g filter="url(#soft)">
    <path d="M230 250 L400 190 L570 250 L570 570 L400 630 L230 570 Z" fill="${p.body}"/>
    <path d="M230 250 L400 310 L400 630 L230 570 Z" fill="${p.bodyDark}"/>
    <path d="M400 310 L570 250 L570 570 L400 630 Z" fill="${p.face}" opacity="0.92"/>
    <path d="M230 250 L400 190 L570 250 L400 310 Z" fill="${p.line}" opacity="0.55"/>
    <rect x="264" y="368" width="104" height="14" rx="7" fill="${ACCENT}" opacity="0.9"/>
    <rect x="264" y="400" width="80" height="10" rx="5" fill="${p.text}" opacity="0.4"/>
    <text x="440" y="416" font-family="${FONT}" font-size="24" font-weight="700" fill="${p.text}" opacity="0.75">${label}</text>
    <rect x="440" y="440" width="96" height="8" rx="4" fill="${p.text}" opacity="0.3"/>
    <path d="M400 310 L400 630" stroke="${p.line}" stroke-width="2" opacity="0.4"/>
  </g>`;
}

/* ---------------------------------------------------------------- battery */

function batteryFront(p) {
  return `
  <g filter="url(#soft)">
    <rect x="200" y="230" width="400" height="360" rx="26" fill="url(#body)"/>
    <rect x="200" y="230" width="400" height="360" rx="26" fill="none" stroke="${p.line}" stroke-width="2" opacity="0.5"/>
    <rect x="248" y="186" width="70" height="52" rx="12" fill="${p.bodyDark}"/>
    <rect x="482" y="186" width="70" height="52" rx="12" fill="${p.bodyDark}"/>
    <rect x="262" y="168" width="42" height="26" rx="8" fill="#c1483f"/>
    <rect x="496" y="168" width="42" height="26" rx="8" fill="#26364d"/>
    <rect x="236" y="278" width="200" height="18" rx="9" fill="${ACCENT}"/>
    <rect x="236" y="312" width="260" height="12" rx="6" fill="${p.line}" opacity="0.55"/>
    <rect x="236" y="338" width="150" height="12" rx="6" fill="${p.line}" opacity="0.35"/>
    ${grille(236, 400, 328, 6, p.line, 22)}
    <rect x="236" y="530" width="150" height="34" rx="10" fill="${p.bodyDark}" opacity="0.6"/>
    ${wordmark(252, 554, p.text, 18)}
    <rect x="420" y="530" width="144" height="34" rx="10" fill="url(#accent)" opacity="0.85"/>
  </g>`;
}

function batteryAngle(p) {
  return `
  <g filter="url(#soft)">
    <path d="M240 250 L520 210 L640 262 L640 578 L520 626 L240 586 Z" fill="url(#bodySide)"/>
    <path d="M240 250 L520 210 L520 596 L240 586 Z" fill="url(#body)"/>
    <path d="M520 210 L640 262 L640 578 L520 626 Z" fill="${p.bodyDark}"/>
    <rect x="278" y="176" width="64" height="48" rx="12" fill="${p.bodyDark}"/>
    <rect x="432" y="158" width="64" height="48" rx="12" fill="${p.bodyDark}"/>
    <rect x="272" y="300" width="150" height="16" rx="8" fill="${ACCENT}"/>
    <rect x="272" y="332" width="196" height="10" rx="5" fill="${p.line}" opacity="0.55"/>
    ${grille(272, 396, 208, 5, p.line, 24)}
    ${wordmark(276, 552, p.text, 18)}
  </g>`;
}

function batteryDetail(p) {
  return `
  <g filter="url(#soft)">
    <rect x="160" y="210" width="480" height="360" rx="28" fill="url(#body)"/>
    <circle cx="300" cy="330" r="60" fill="${p.bodyDark}"/>
    <circle cx="300" cy="330" r="34" fill="#c1483f"/>
    <rect x="288" y="300" width="24" height="60" rx="6" fill="#fff" opacity="0.55"/>
    <rect x="270" y="318" width="60" height="24" rx="6" fill="#fff" opacity="0.55"/>
    <circle cx="500" cy="330" r="60" fill="${p.bodyDark}"/>
    <circle cx="500" cy="330" r="34" fill="#26364d"/>
    <rect x="470" y="318" width="60" height="24" rx="6" fill="#fff" opacity="0.5"/>
    <rect x="220" y="450" width="360" height="16" rx="8" fill="${ACCENT}" opacity="0.9"/>
    <rect x="220" y="486" width="250" height="12" rx="6" fill="${p.line}" opacity="0.5"/>
  </g>`;
}

function batteryPanel(p) {
  return `
  <g filter="url(#soft)">
    <rect x="180" y="220" width="440" height="350" rx="26" fill="url(#body)"/>
    <rect x="216" y="258" width="368" height="60" rx="14" fill="${p.bodyDark}"/>
    <rect x="236" y="280" width="180" height="16" rx="8" fill="${ACCENT}"/>
    ${[0, 1, 2].map((i) => `<g><rect x="216" y="${344 + i * 64}" width="368" height="48" rx="12" fill="${p.bodyDark}" opacity="0.5"/><rect x="238" y="${362 + i * 64}" width="${230 - i * 44}" height="12" rx="6" fill="${p.line}" opacity="0.7"/><rect x="510" y="${362 + i * 64}" width="52" height="12" rx="6" fill="${ACCENT}" opacity="${0.85 - i * 0.2}"/></g>`).join('')}
  </g>`;
}

/* -------------------------------------------------------------------- ups */

function upsFront(p) {
  return `
  <g filter="url(#soft)">
    <rect x="280" y="150" width="240" height="490" rx="26" fill="url(#body)"/>
    <rect x="280" y="150" width="240" height="490" rx="26" fill="none" stroke="${p.line}" stroke-width="2" opacity="0.5"/>
    <rect x="308" y="186" width="184" height="96" rx="14" fill="${p.bodyDark}"/>
    <rect x="328" y="212" width="90" height="18" rx="9" fill="${ACCENT}"/>
    <rect x="328" y="242" width="130" height="10" rx="5" fill="${p.line}" opacity="0.6"/>
    ${led(468, 220, '#3fbf7f', 6)}
    <circle cx="400" cy="330" r="30" fill="${p.bodyDark}"/>
    <path d="M400 314 L400 340" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="400" cy="330" r="16" fill="none" stroke="${ACCENT}" stroke-width="4" stroke-dasharray="60 30" transform="rotate(-90 400 330)"/>
    ${grille(320, 396, 160, 6, p.line, 20)}
    ${[0, 1].map((r) => [0, 1].map((c) => `<rect x="${322 + c * 90}" y="${522 + r * 54}" width="72" height="40" rx="10" fill="${p.bodyDark}" opacity="0.7"/>`).join('')).join('')}
    ${wordmark(324, 508, p.text, 17)}
  </g>`;
}

function upsAngle(p) {
  return `
  <g filter="url(#soft)">
    <path d="M290 190 L470 154 L570 200 L570 610 L470 650 L290 614 Z" fill="url(#bodySide)"/>
    <path d="M290 190 L470 154 L470 622 L290 614 Z" fill="url(#body)"/>
    <path d="M470 154 L570 200 L570 610 L470 650 Z" fill="${p.bodyDark}"/>
    <rect x="316" y="226" width="128" height="76" rx="12" fill="${p.bodyDark}" opacity="0.75"/>
    <rect x="334" y="248" width="66" height="14" rx="7" fill="${ACCENT}"/>
    <circle cx="378" cy="366" r="24" fill="${p.bodyDark}"/>
    <path d="M378 352 L378 374" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
    ${grille(320, 424, 122, 5, p.line, 20)}
    ${wordmark(322, 566, p.text, 16)}
    <path d="M492 236 L552 262 L552 292 L492 266 Z" fill="${ACCENT}" opacity="0.7"/>
  </g>`;
}

function upsDetail(p) {
  return `
  <g filter="url(#soft)">
    <rect x="170" y="220" width="460" height="360" rx="28" fill="url(#body)"/>
    <rect x="212" y="258" width="376" height="150" rx="18" fill="${p.bodyDark}"/>
    <rect x="240" y="290" width="150" height="26" rx="13" fill="${ACCENT}"/>
    <rect x="240" y="334" width="240" height="14" rx="7" fill="${p.line}" opacity="0.65"/>
    <rect x="240" y="362" width="160" height="14" rx="7" fill="${p.line}" opacity="0.4"/>
    ${led(534, 302, '#3fbf7f', 11)}
    ${led(534, 358, ACCENT, 11)}
    ${[0, 1, 2].map((i) => `<rect x="${216 + i * 128}" y="452" width="112" height="82" rx="16" fill="${p.bodyDark}" opacity="0.62"/><circle cx="${252 + i * 128}" cy="493" r="9" fill="${p.line}" opacity="0.8"/><circle cx="${292 + i * 128}" cy="493" r="9" fill="${p.line}" opacity="0.8"/>`).join('')}
  </g>`;
}

function upsPanel(p) {
  return `
  <g filter="url(#soft)">
    <rect x="160" y="250" width="480" height="300" rx="24" fill="url(#body)"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${196 + i * 112}" y="292" width="92" height="66" rx="14" fill="${p.bodyDark}" opacity="0.7"/><circle cx="${226 + i * 112}" cy="325" r="8" fill="${p.line}"/><circle cx="${258 + i * 112}" cy="325" r="8" fill="${p.line}"/>`).join('')}
    ${[0, 1, 2, 3].map((i) => `<rect x="${196 + i * 112}" y="392" width="92" height="66" rx="14" fill="${p.bodyDark}" opacity="0.45"/><circle cx="${226 + i * 112}" cy="425" r="8" fill="${p.line}" opacity="0.7"/><circle cx="${258 + i * 112}" cy="425" r="8" fill="${p.line}" opacity="0.7"/>`).join('')}
    <rect x="196" y="486" width="180" height="14" rx="7" fill="${ACCENT}" opacity="0.85"/>
    <rect x="404" y="486" width="240" height="14" rx="7" fill="${p.line}" opacity="0.35"/>
  </g>`;
}

/* ------------------------------------------------------------------ combo */

function comboFront(p) {
  return `
  <g filter="url(#soft)">
    <rect x="140" y="200" width="270" height="300" rx="26" fill="url(#body)"/>
    <rect x="172" y="238" width="206" height="90" rx="14" fill="${p.bodyDark}"/>
    <rect x="192" y="262" width="88" height="14" rx="7" fill="${ACCENT}"/>
    <rect x="192" y="288" width="130" height="9" rx="4.5" fill="${p.line}" opacity="0.6"/>
    ${led(352, 268, ACCENT, 6)}
    ${grille(180, 374, 190, 5, p.line, 20)}
    ${wordmark(178, 476, p.text, 16)}

    <rect x="430" y="300" width="270" height="280" rx="24" fill="url(#body)"/>
    <rect x="462" y="266" width="56" height="42" rx="10" fill="${p.bodyDark}"/>
    <rect x="612" y="266" width="56" height="42" rx="10" fill="${p.bodyDark}"/>
    <rect x="474" y="252" width="32" height="20" rx="6" fill="#c1483f"/>
    <rect x="624" y="252" width="32" height="20" rx="6" fill="#26364d"/>
    <rect x="462" y="338" width="150" height="15" rx="7.5" fill="${ACCENT}"/>
    <rect x="462" y="366" width="190" height="10" rx="5" fill="${p.line}" opacity="0.5"/>
    ${grille(462, 418, 206, 4, p.line, 22)}
    ${wordmark(462, 552, p.text, 16)}

    <path d="M410 400 L430 400" stroke="${ACCENT}" stroke-width="8" stroke-linecap="round"/>
    <path d="M398 372 C 420 372 420 428 442 428" stroke="${ACCENT}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/>
  </g>`;
}

function comboAngle(p) {
  return `
  <g filter="url(#soft)">
    <path d="M170 230 L360 200 L440 236 L440 500 L360 534 L170 506 Z" fill="url(#bodySide)"/>
    <path d="M170 230 L360 200 L360 520 L170 506 Z" fill="url(#body)"/>
    <rect x="200" y="266" width="128" height="72" rx="12" fill="${p.bodyDark}" opacity="0.75"/>
    <rect x="218" y="288" width="62" height="12" rx="6" fill="${ACCENT}"/>
    ${grille(204, 380, 122, 4, p.line, 20)}

    <path d="M440 320 L620 292 L700 328 L700 572 L620 604 L440 578 Z" fill="url(#bodySide)"/>
    <path d="M440 320 L620 292 L620 590 L440 578 Z" fill="url(#body)"/>
    <rect x="468" y="270" width="48" height="36" rx="9" fill="${p.bodyDark}"/>
    <rect x="560" y="256" width="48" height="36" rx="9" fill="${p.bodyDark}"/>
    <rect x="468" y="358" width="112" height="13" rx="6.5" fill="${ACCENT}"/>
    ${grille(468, 408, 122, 4, p.line, 22)}
    <path d="M362 400 C 396 400 400 436 438 436" stroke="${ACCENT}" stroke-width="7" fill="none" stroke-linecap="round"/>
  </g>`;
}

function comboDetail(p) {
  return `
  <g filter="url(#soft)">
    <rect x="150" y="230" width="500" height="340" rx="30" fill="url(#body)"/>
    <rect x="192" y="272" width="230" height="152" rx="18" fill="${p.bodyDark}"/>
    <rect x="220" y="304" width="120" height="22" rx="11" fill="${ACCENT}"/>
    <rect x="220" y="344" width="170" height="12" rx="6" fill="${p.line}" opacity="0.6"/>
    <rect x="220" y="372" width="120" height="12" rx="6" fill="${p.line}" opacity="0.4"/>
    <circle cx="510" cy="330" r="52" fill="${p.bodyDark}"/>
    <path d="M516 300 L488 336 L508 336 L502 366 L532 328 L512 328 Z" fill="${ACCENT}"/>
    <rect x="192" y="470" width="180" height="16" rx="8" fill="${ACCENT}" opacity="0.9"/>
    <rect x="192" y="504" width="280" height="12" rx="6" fill="${p.line}" opacity="0.45"/>
  </g>`;
}

function comboPanel(p) {
  return `
  <g filter="url(#soft)">
    <rect x="170" y="230" width="460" height="340" rx="26" fill="url(#body)"/>
    <rect x="206" y="268" width="388" height="76" rx="16" fill="${p.bodyDark}"/>
    <rect x="230" y="296" width="150" height="18" rx="9" fill="${ACCENT}"/>
    <rect x="440" y="296" width="130" height="18" rx="9" fill="${p.line}" opacity="0.6"/>
    ${[0, 1, 2].map((i) => `<rect x="206" y="${374 + i * 66}" width="388" height="52" rx="14" fill="${p.bodyDark}" opacity="${0.55 - i * 0.12}"/><circle cx="${240}" cy="${400 + i * 66}" r="12" fill="${ACCENT}" opacity="${0.9 - i * 0.25}"/><rect x="272" y="${393 + i * 66}" width="${220 - i * 40}" height="14" rx="7" fill="${p.line}" opacity="0.6"/>`).join('')}
  </g>`;
}

/* ------------------------------------------------------------------ build */

const RENDERERS = {
  inverter: {
    front: inverterFront,
    angle: inverterAngle,
    detail: inverterDetail,
    panel: inverterPanel,
    box: (p) => boxArt(p, 'INVERTER'),
  },
  battery: {
    front: batteryFront,
    angle: batteryAngle,
    detail: batteryDetail,
    panel: batteryPanel,
    box: (p) => boxArt(p, 'BATTERY'),
  },
  ups: {
    front: upsFront,
    angle: upsAngle,
    detail: upsDetail,
    panel: upsPanel,
    box: (p) => boxArt(p, 'UPS'),
  },
  combo: {
    front: comboFront,
    angle: comboAngle,
    detail: comboDetail,
    panel: comboPanel,
    box: (p) => boxArt(p, 'COMBO'),
  },
};

const CAPTIONS = {
  front: 'Front view',
  angle: 'Three-quarter view',
  detail: 'Control panel detail',
  panel: 'Connections',
  box: 'What arrives',
};

const KIND_LABELS = {
  inverter: 'inverter',
  battery: 'battery',
  ups: 'UPS',
  combo: 'inverter and battery combo',
};

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const kind of KINDS) {
  for (const variant of VARIANTS) {
    const palette = PALETTES[variant];
    for (const view of VIEWS) {
      const id = `${kind}-${variant}-${view}-title`;
      const title = `Illustration of an iTarang ${KIND_LABELS[kind]} — ${CAPTIONS[view].toLowerCase()}`;
      const svg = [
        header(id),
        `<title id="${id}">${title}</title>`,
        defs(palette),
        backdrop,
        RENDERERS[kind][view](palette),
        caption(CAPTIONS[view], '#16294a'),
        '</svg>',
      ].join('\n');
      writeFileSync(resolve(OUT_DIR, `${kind}-${variant}-${view}.svg`), svg, 'utf8');
      written += 1;
    }
  }
}

console.log(`Wrote ${written} SVG illustrations to public/art`);
