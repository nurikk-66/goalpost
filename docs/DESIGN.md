# Goalpost — Web Demo Design Plan (Phase 4)

Source of truth for the demo web app's visual language, copy tone, and
interaction model. Written against `docs/POSITIONING.md` ("every result
comes with a receipt") and MASTER_PLAN §3.3's design quality gate, which
requires a self-critique against known AI-template anti-patterns before
coding — that critique is included below, not just the final tokens.

## Signature element

**The verification receipt panel.** Everything else in the UI supports it.
Styled as a thermal-printer receipt: perforated top edge, monospace tabular
content, a rotated "VERIFIED ✓" rubber-stamp badge, a real devnet Solana
Explorer transaction link, and a small decorative (non-scannable) barcode
accent. It's the moment the app's whole thesis — trustless, on-chain,
provable settlement — becomes a single concrete artifact the user can point
at.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--gp-bg` | `#0B0E14` | Page background — "stadium at night," not pure black |
| `--gp-surface` | `#151A24` | Card backgrounds |
| `--gp-surface-raised` | `#1C2230` | Elevated panels (receipt, modals) |
| `--gp-amber` | `#FFB000` | Primary/scoreboard-LED accent — the dominant identity color |
| `--gp-verified` | `#2BD97C` | Status-only — the "VERIFIED" stamp/pill. Never a general UI accent |
| `--gp-danger` | `#FF5C5C` | Errors, rejected transactions |
| `--gp-text` | `#F5F1E8` | Primary text (warm off-white, not pure white) |
| `--gp-text-muted` | `#8A93A6` | Secondary text, timestamps, hints |

## Type pairing

- **Display** — Big Shoulders Display (condensed, bold, broadcast-scoreboard
  energy). Used sparingly: scores, headlines only. Never body text.
- **Body** — IBM Plex Sans.
- **Mono** — IBM Plex Mono. Tabular numerals, addresses, and the entire
  receipt panel content (`font-variant-numeric: tabular-nums` throughout for
  odds/scores/countdowns).

All loaded via `next/font/google` (self-hosted/subset at build time — no
render-blocking third-party font requests, which also helps the Lighthouse
performance gate).

## Layout

- Persistent "score bug" broadcast-style header: competition/fixture id,
  connection status pill, team names, live tabular score.
- Card sections with hard edges — no soft neumorphism, no large border
  radii.
- 1px amber-at-8%-opacity hairlines as section dividers (not black-on-white
  rules).
- Exactly **one** angled/diagonal accent shape, on the header only. Not
  repeated as a motif elsewhere in the page — a deliberate constraint (see
  self-critique below).

## Motion

One orchestrated settlement sequence, CSS keyframes only (no
framer-motion — keeps the bundle small, a performance-gate concern):

1. Numerals lock with a brief flash when the on-chain status flips to Settled.
2. Receipt prints up from below (`clip-path` reveal — `receipt-print`).
3. Stamp bounces in with overshoot (`stamp-bounce`).
4. Brief amber glow pulse (`glow-pulse`).

Fires once per settlement, on the receipt's mount. Respects
`prefers-reduced-motion` via a global override that disables all of the
above.

## Self-critique against AI-template anti-patterns

MASTER_PLAN calls out specific failure modes to check against before
writing code, not just admire in retrospect:

- **"Cream + serif + terracotta"** — clear miss. This is dark background,
  sans/mono type, amber accent. Not a risk here.
- **"Near-black + acid-green"** — the real risk, since the background *is*
  near-black. Mitigated by making amber the dominant accent everywhere
  (buttons, borders, focus states, the sparkline) and reserving green
  (`--gp-verified`) strictly for the one semantic "verified" signal — the
  stamp and a matching status pill state. This is an implementation
  discipline I enforced file-by-file while building components, not just a
  token-level fix.
- **"Hairline-rule broadsheet"** — mitigated two ways: hairlines are
  amber-tinted rather than black-on-white, and actual surface-color card
  boundaries (not just rules) separate sections; the one diagonal accent
  shape is capped to the header instead of becoming a repeated decorative
  motif.

## Reliability-gate UI consequences (MASTER_PLAN §3.1)

- The odds/score SSE hook auto-reconnects with exponential backoff and
  drives the connection status pill (Live / Reconnecting / Replay), keeping
  the last-known-good data on screen instead of blanking it.
- Every on-chain action (create, join, lock, settle, claim) goes through an
  explicit `idle → signing → confirming → confirmed | failed` state machine
  with a timeout path — no spinner-forever, no silent failure.
- Malformed stream payloads are zod-validated, logged, and dropped without
  touching UI state.
- `app/error.tsx` is a designed route-level error boundary — the app must
  never white-screen.

## Performance-gate UI consequences (MASTER_PLAN §3.2)

- Fixture list (`app/page.tsx`) is a server component — no client JS needed
  for a static list.
- Market account state uses `connection.onAccountChange` (websocket
  subscription), never polling.
- SSE-driven state updates are batched, flushed at most every 250ms.
- No chart or animation library — hand-rolled SVG sparkline, CSS-only
  keyframes.

## Architecture reference

See the Phase 4 build plan for the full `apps/web/` file layout and the
underlying product decisions (single-wallet demo model, bundled real proof
for settlement, browser `EventSource` vs the SDK's Node-only stream
helpers, in-process replay server via `instrumentation.ts`).
