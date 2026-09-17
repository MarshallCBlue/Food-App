# Fridge Magnet — design direction

This is the one place the look of the app is decided. Anything built later
should be checked against it rather than re-invented, because an app that
redesigns itself every few weeks ends up looking like several apps stitched
together.

## Step 1 — where the look comes from

**What does someone open this for, in under ten words?**
"What do we still need, and what have we already got."

**Where is it actually opened?**
One hand, phone in the other, halfway down a supermarket aisle under bright
strip lighting. Or standing at an open fridge with cold, wet hands. Never at a
desk. That decides everything about size and contrast: big touch targets, very
high contrast, no thin grey text, no hover-only affordances.

**What is the dominant content?**
Short lists of names with a number beside them, grouped under headings, and a
scattering of dates. Not prose, not images, not charts.

**What tone would be actively wrong?**
Two of them. Clinical and medical, because this is a kitchen. And the cosy
recipe-blog look — cream paper, a serif headline, a hand-written accent —
because that is a look for reading, and this is a tool for doing something in
under ten seconds while pushing a trolley.

**What physical object does it replace?**
The fridge door: a cool steel panel with a torn-off paper list held on by a
magnet, and a biro line through everything already in the trolley.

### The instinct that was discarded

The obvious answer for a food app is warm cream, a friendly serif, a soft
grocery green, and rounded cards for everything. That is the category default,
it is what the app looked like before, and arriving there again would have been
an accident rather than a decision. The fridge door was used instead, because it
is the object this app actually replaces.

## The six decisions

| Decision | What was decided |
|---|---|
| **Anchor** | The fridge door — brushed steel, a white paper slip under a magnet, one red magnet cap |
| **Palette** | Cool steel greys instead of warm cream; near-black ink; the icon's own green kept for structure; the magnet's red kept for anything urgent. Steel and paper come straight off the door, which is why nothing here is warm |
| **Type** | One family, IBM Plex Sans, bundled with the app so it works offline. Slightly industrial, like the lettering on an appliance. Scale ratio 1.25. Numbers are tabular, so quantities line up down a column |
| **Density** | 4 of 5. It is a list app read at arm's length in a hurry, so rows are compact but never below a 44px touch target |
| **Signature move** | **The rail.** Every group of rows sits under a sticky heading: the name in tight capitals on the left, the count on the right, a 2px ink rule underneath running the full width of the screen. The same 2px rule marks the active tab in the bottom bar, so the mark that says "you are in this section" is the same mark in both places |
| **Deliberate omission** | **No cards around list rows.** Rows run edge to edge, separated by hairlines. Cards are kept for things that are genuinely a single object — a form, a settings panel. And no emoji used as interface icons; the icons are drawn |

## Palette

Defined in OKLCH in `src/styles.css` so the lightness steps stay even.

| Token | Value | Used for |
|---|---|---|
| `--fm-paper` | `oklch(96.5% 0.005 235)` | The page. Cool, like the steel |
| `--fm-slip` | `oklch(100% 0 0)` | Forms and panels — the paper slip |
| `--fm-ink` | `oklch(22% 0.015 240)` | All body text |
| `--fm-muted` | `oklch(45% 0.012 240)` | Secondary text. Dark enough to read in sun |
| `--fm-line` | `oklch(90% 0.005 240)` | Hairlines between rows |
| `--fm-rule` | `oklch(22% 0.015 240)` | The 2px rail rule |
| `--fm-brand` | `oklch(42% 0.075 162)` | The green from the app icon: primary buttons, active tab |
| `--fm-signal` | `oklch(52% 0.18 27)` | The magnet's red cap: overdue, delete, out of stock |
| `--fm-warn` | `oklch(47% 0.11 65)` | Use soon |

Every text colour is checked against the surface behind it at 4.5:1 or better.
Colour is never the only signal: every urgency tier also says what it means in
words.

## Rules that follow from the anchor

- Rows are full width, hairline separated, with the name on the left and the
  number on the right in tabular figures.
- A group heading is a rail, and it sticks to the top of the screen while you
  scroll through that group, so you always know which aisle or which shelf you
  are looking at.
- Nothing is more than one level deep in a container. No card inside a card.
- Corner radius never exceeds 14px, except for pills.
- Every destructive action names the thing it will destroy, in a proper dialog,
  not a browser alert.
- Loading shows the shape of what is coming (grey skeleton rows), not the word
  "Loading".
- The bottom bar clears the iPhone home indicator with `env(safe-area-inset-*)`,
  and the header clears the notch.
- Motion is 150ms ease-out and nothing else, and it is switched off entirely for
  anyone who has asked their phone for reduced motion.

## The four tabs

List, Inventory, Recipes, Scan. Recipes was a text link at the top of the
inventory page, which made a whole feature invisible. It is now its own tab.
Anything secondary — expiring, aisles, locations, household settings — is
reached from the screen it belongs to, not from the bottom bar.
