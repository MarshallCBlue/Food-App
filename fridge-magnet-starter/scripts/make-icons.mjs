// Draws every app icon from one description, so they can never drift
// apart from each other or from the app's own colours.
//
// Run it with:  npm run icons
//
// The mark is the horseshoe magnet from the top bar of the app, redrawn
// solid so it still reads at 32 pixels: white body, one red pole cap
// (the same red the app uses for anything urgent) and one steel cap, on
// the brand green.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')

// ── Colour ──────────────────────────────────────────────────────────
// The app's colours are written in OKLCH in src/styles.css. PNG files
// need plain sRGB, so this converts them rather than keeping a second
// hand-typed copy that could quietly fall out of step.
function oklch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  const hex = lin
    .map((c) => {
      const clamped = Math.min(1, Math.max(0, c))
      const encoded =
        clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')

  return `#${hex}`
}

const colors = {
  field: oklch(0.42, 0.075, 162), // --fm-brand
  body: '#ffffff', // --fm-slip
  // The signal red, lifted a little: at its interface value it sits too
  // close to the green field to read as a separate part at small sizes.
  redCap: oklch(0.6, 0.19, 27),
  steelCap: oklch(0.86, 0.008, 240),
}

// ── The mark ────────────────────────────────────────────────────────
// Drawn inside a 100 x 100 box. The magnet's own bounding box is
// x 16-84, y 12-100, which is why it gets nudged up when it is centred.
function magnet() {
  return `
    <g>
      <path d="M29 12 V66 A21 21 0 0 0 71 66 V12"
            fill="none" stroke="${colors.body}" stroke-width="26" />
      <rect x="16" y="12" width="26" height="23" fill="${colors.redCap}" />
      <rect x="58" y="12" width="26" height="23" fill="${colors.steelCap}" />
    </g>`
}

// size      — the finished square, in pixels
// artwork   — how TALL the magnet is, as a fraction of that square. Height
//             rather than width, because the magnet is taller than it is
//             wide and it is the taller side that decides whether an icon
//             looks cramped against its own edges.
// radius    — corner rounding, as a fraction (0 for a full-bleed square)
function icon({ size, artwork, radius }) {
  const markHeight = size * artwork
  const scale = markHeight / 88 // 88 is the mark's own height
  const offsetX = (size - 68 * scale) / 2 - 16 * scale
  const offsetY = (size - 88 * scale) / 2 - 12 * scale

  const corner = size * radius
  const ground =
    radius > 0
      ? `<rect width="${size}" height="${size}" rx="${corner}" ry="${corner}" fill="${colors.field}" />`
      : `<rect width="${size}" height="${size}" fill="${colors.field}" />`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${ground}
    <g transform="translate(${offsetX} ${offsetY}) scale(${scale})">
      ${magnet()}
    </g>
  </svg>`
}

// Three shapes of icon, for three different jobs:
//
// "any"      Android and the browser tab show this as-is, so it carries
//            its own rounded corners and transparent outside them.
// "maskable" Android crops this to whatever shape the phone uses, so it
//            runs to the edges and keeps the magnet well inside the
//            circle that every crop is guaranteed to keep.
// "apple"    iOS rounds it off itself, so it is a plain opaque square.
const outputs = [
  { file: 'icon-192.png', size: 192, artwork: 0.6, radius: 0.22, flatten: false },
  { file: 'icon-512.png', size: 512, artwork: 0.6, radius: 0.22, flatten: false },
  { file: 'icon-maskable-192.png', size: 192, artwork: 0.56, radius: 0, flatten: true },
  { file: 'icon-maskable-512.png', size: 512, artwork: 0.56, radius: 0, flatten: true },
  { file: 'apple-touch-icon.png', size: 180, artwork: 0.6, radius: 0, flatten: true },
  { file: 'favicon-32.png', size: 32, artwork: 0.68, radius: 0.22, flatten: false },
]

mkdirSync(publicDir, { recursive: true })

for (const out of outputs) {
  const svg = icon(out)
  let image = sharp(Buffer.from(svg), { density: 384 })
  if (out.flatten) image = image.flatten({ background: colors.field })
  await image.png({ compressionLevel: 9 }).toFile(join(publicDir, out.file))
  console.log(`wrote public/${out.file}  (${out.size}x${out.size})`)
}

// A copy of the mark on its own, for anywhere a vector is wanted later.
writeFileSync(
  join(publicDir, 'icon.svg'),
  icon({ size: 512, artwork: 0.6, radius: 0.22 }) + '\n'
)
console.log('wrote public/icon.svg')
