# Goalpost — Web Demo Design Plan (Phase 4)

Source of truth for the demo web app's visual language, copy tone, and
interaction model. Written against `docs/POSITIONING.md` ("every result
comes with a receipt") and MASTER_PLAN §3.3's design quality gate, which
requires a self-critique against known AI-template anti-patterns before
coding — that critique is included below, not just the final tokens.

## Direction update (2026-07-16)

Revised, by explicit user decision, toward a more serious "protocol-grade"
dark aesthetic, referencing **telegraphprotocol.com** for concrete tokens
only — not its imagery. Fetched and inspected that site's compiled CSS
directly (`_next/static/chunks/*.css`) rather than guessing from a
screenshot-level impression; the tokens below under "near-black / hairline
system / monospace" are adapted from what was actually found there:

- Background: true/near-black (`#000`, `#0c0c0c`, `#111`) rather than a
  single flat value.
- Foreground: a 3-tier off-white system (`#e9e9e9` primary / `#b5b5b5` dim /
  `#6b6b6b` faint) instead of one muted-text color.
- Hairlines: a 3-tier gray system (`#1c1c1c` soft / `#2a2a2a` regular /
  `#3a3a3a` strong) — genuinely neutral, not color-tinted.
- Typography: monospace (Roboto Mono there; IBM Plex Mono here) as the
  dominant voice everywhere, not just for tabular data — tight
  letter-spacing on labels (`.04em`–`.14em` observed there).

**What was deliberately NOT adopted:** the engraving/statue photographic
imagery. That's their signature move, not ours, and copying it would be
exactly the kind of derivative reuse the anti-pattern self-critique exists
to catch. Our own imagery direction (below) borrows only the *technique*
(monochrome line-art, fragments assembling on scroll) applied to original
subject matter (anonymous football motion), never real photography or any
recognizable person.

**What stays unchanged from the original brief:** the verification receipt
is still the signature element; amber is still Goalpost's own identity
color (vs. their orange) so the two products read as related-in-craft but
distinct-in-identity; green is still reserved strictly for the "verified"
signal (their own accent inventory happens to include a near-identical
green used the same way — a good sign this instinct was right, not a
reason to copy it wholesale).

## Signature element

**The verification receipt panel.** Everything else in the UI supports it.
Styled as a thermal-printer receipt: perforated top edge, monospace tabular
content, a rotated "VERIFIED ✓" rubber-stamp badge, a real devnet Solana
Explorer transaction link, and a small decorative (non-scannable) barcode
accent. On settlement, it **assembles line-by-line, as if being printed** —
see Motion below. It's the moment the app's whole thesis — trustless,
on-chain, provable settlement — becomes a single concrete artifact the user
can point at.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--gp-bg` | `#000000` | Page background — true black, protocol-grade restraint |
| `--gp-surface` | `#0c0c0c` | Card backgrounds |
| `--gp-surface-raised` | `#141414` | Elevated panels (receipt, modals) |
| `--gp-line-soft` | `#1c1c1c` | Subtle dividers, inactive card edges |
| `--gp-line` | `#2a2a2a` | Standard hairline borders |
| `--gp-line-strong` | `#3a3a3a` | Emphasized borders (active/focused cards) |
| `--gp-amber` | `#ffb000` | Primary/scoreboard-LED accent — the dominant identity color |
| `--gp-verified` | `#2bd97c` | Status-only — the "VERIFIED" stamp/pill. Never a general UI accent |
| `--gp-danger` | `#ff5c5c` | Errors, rejected transactions |
| `--gp-text` | `#e9e9e9` | Primary text |
| `--gp-text-dim` | `#b5b5b5` | Secondary text — labels, body copy |
| `--gp-text-faint` | `#6b6b6b` | Tertiary text — timestamps, disabled state, fine print |

`--gp-text-muted` from the original draft is retired in favor of the
two-tier `dim`/`faint` split above — the reference's 3-tier foreground
system is genuinely more useful than one muted color and costs nothing
extra to implement.

## Type pairing

- **Mono** — IBM Plex Mono, the dominant voice everywhere: body copy,
  labels, addresses, the receipt panel, UI chrome. `font-variant-numeric:
  tabular-nums` throughout for odds/scores/countdowns. Tight letter-spacing
  (`0.04em`–`0.12em`) on uppercase micro-labels, matching the reference's
  technical/terminal feel.
- **Display** — Big Shoulders, reserved for exactly **one** place: the live
  score numeral in the scoreboard header. Not a general headline face
  anymore — the "protocol-grade" direction calls for typographic restraint,
  so the one deliberate exception has to earn its place rather than
  spreading across headlines the way the original brief allowed.
- IBM Plex Sans (body) is **retired** — collapsing to two families instead
  of three is itself part of the restraint this direction asks for.

Both self-hosted as local variable-font files (`app/fonts/*.woff2`, `next/
font/local`) rather than fetched from Google's CDN at compile time — see
the Phase 4 build notes for why (dev-server font fetches were racing
against webpack's own CPU usage on the reference machine and timing out).

## Imagery

Large-scale background line-art on section edges, in the spirit of the
reference site's assembling-engraving effect but with original subject
matter: **anonymous football motion**, never real players.

- **Subjects**: bicycle kick mid-air, sprinting dribbler, goalkeeper
  full-stretch dive, celebration pose. Faceless, anonymous silhouettes —
  no recognizable likeness of any real player (image-rights risk, and
  beside the point — the point is the *motion*, not who's making it).
- **Style**: monochrome, etched/halftone line-art texture. Stylized
  silhouette construction (a handful of path fragments per figure), not
  photographic, not full-color illustration.
- **Format**: hand-authored SVG only — no rasters, no third-party stock
  art, no icon-font tricks. Each figure is a handful of `<path>`/`<g>`
  fragments so the scroll-assembly effect (below) has something real to
  animate between.
- **Placement**: large, positioned at section edges (bleeding off-canvas
  is fine — these are atmosphere, not content), behind/around card content,
  never obscuring text or interactive elements, never central-column.
- **Performance**: inline SVG (no network request), sized to what's
  actually rendered, `aria-hidden="true"` (decorative), no filter-heavy
  CSS (blur/drop-shadow stacks are a Lighthouse mobile cost). This is a
  hard constraint, not a nice-to-have — see the Lighthouse ≥85 mobile gate.

## Layout

- Persistent "score bug" broadcast-style header: competition/fixture id,
  connection status pill, team names, live tabular score.
- Card sections with hard edges — no soft neumorphism, no large border
  radii.
- Hairlines use the 3-tier gray system above (`--gp-line-soft/--gp-line/
  --gp-line-strong`) as section dividers and card borders — genuinely
  neutral now, not amber-tinted (see the revised self-critique below for
  why that's still safe).
- Football silhouette line-art at section edges per Imagery above — the
  one recurring decorative motif, deliberately singular in *kind* (always
  the same technique/style) even though it appears more than once, so it
  reads as a consistent visual system rather than repeated clutter.

## Motion

Two motion moments, both CSS-first, both respecting `prefers-reduced-motion`:

1. **Settlement receipt, line-by-line print** (the signature moment,
   unchanged in importance from the original brief, refined in technique):
   each receipt row (fixture, stat values, Merkle root, tx link, honesty
   statement) reveals in sequence via staggered `animation-delay` on a
   per-row clip/opacity keyframe, like a thermal printer producing them one
   at a time. The "VERIFIED ✓" stamp bounces in once the last row has
   printed. Fires once per settlement, on the receipt's mount.
2. **Football silhouette scroll-assembly**: each figure's path fragments
   start slightly offset and faded, snapping to their assembled position
   the first time the section scrolls into view. Implemented with
   `IntersectionObserver` toggling one class per figure (not a scroll-linked
   JS library — no GSAP/ScrollTrigger, that's real bundle weight for a
   background effect) plus a CSS transition on `transform`/`opacity`.
   Fires once per figure (first intersection only), not on every scroll.

Both motions are disabled outright under `prefers-reduced-motion: reduce`
(fragments render pre-assembled, receipt rows render in their final state
immediately) via one global media-query override.

## Self-critique against AI-template anti-patterns

MASTER_PLAN calls out specific failure modes to check against before
writing code, not just admire in retrospect:

- **"Cream + serif + terracotta"** — clear miss. Still true after the
  direction update: black background, monospace type, amber accent.
- **"Near-black + acid-green"** — the real risk, more so now that the
  background is literally black rather than navy-tinted. Mitigated the
  same way as before: amber stays the dominant accent everywhere (buttons,
  focus states, the sparkline), green stays locked to the one "verified"
  semantic signal. Enforced file-by-file during implementation, not just
  at the token level.
- **"Hairline-rule broadsheet"** — the mitigation approach changed with
  this direction update, worth stating explicitly. The original plan
  avoided this by tinting hairlines amber; this revision uses genuinely
  neutral grays instead (matching the reference's own 3-tier line system),
  which risks reading as a plain newspaper/spreadsheet grid if done
  carelessly. What actually prevents that here: a true-black background
  (not white/cream), monospace-technical voice throughout, and the
  football silhouette art breaking up any section that would otherwise be
  pure hairline-and-text. The combination reads as "engineering
  protocol/terminal," not "broadsheet" — but this is a judgment call to
  revisit visually once implemented, not something the token choice alone
  guarantees.
- **Derivative imagery** (new check, specific to this revision) — the risk
  of visually copying telegraphprotocol.com's actual signature move
  (engraving/statue photography) rather than just being inspired by its
  restraint. Mitigated by using wholly original subject matter (anonymous
  football motion, not classical imagery), original technique execution
  (hand-authored SVG line-art, not photographic halftone), and by not
  reusing any of their actual color values beyond the near-black family
  (a near-black background is not a proprietary choice).

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
  keyframes, `IntersectionObserver` (not a scroll library) for the
  silhouette reveal.
- Football silhouette art is inline SVG, sized to actual render dimensions,
  no raster fallback, no heavy CSS filters — a direct requirement of the
  Lighthouse ≥85 mobile gate, not a suggestion.

## Architecture reference

See the Phase 4 build plan for the full `apps/web/` file layout and the
underlying product decisions (single-wallet demo model, bundled real proof
for settlement, browser `EventSource` vs the SDK's Node-only stream
helpers, in-process replay server via `instrumentation.ts`).
