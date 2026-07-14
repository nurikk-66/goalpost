# GOALPOST — Positioning Document

*(Bu hujjat Phase 6'dagi uch README, uch demo video va build day suhbatlarining xomashyosi. Ingliz tilidagi qismlar — hakamlar/jamoat ko'radigan tayyor matn; kursiv izohlar — sizga.)*

## 1\. CORE MESSAGE (hamma narsaning o'zagi)

**"Every result comes with a receipt."**

The problem: every prediction app asks you to trust someone — an admin, an oracle, a "trusted" resolver. That trust is the weakest link: it can be wrong, bribed, or offline.

Goalpost removes it. Match results arrive from TxLINE cryptographically signed and anchored on Solana. Our settlement contract doesn't ask anyone who won — it verifies the proof on-chain (a real CPI into TxLINE's validation program) and releases funds by math, not by permission. Anyone can inspect the receipt.

**Proof it's real, not a slide:** in our CI, a deliberately tampered proof is rejected by TxLINE's own on-chain program (InvalidStatProof) — not by our code taking a shortcut. The rejection comes from the sponsor's real validation logic, live on devnet, on every test run.

*Bu oxirgi xatboshi — eng kuchli qurolimiz. Har videoda, har README'da, har suhbatda shu fakt aytiladi.*

## 2\. ONE-LINER PER TRACK (har trek uchun bitta jumla)

**Prediction Markets & Settlement (asosiy trek):** "Goalpost is a trustless settlement engine for World Cup markets — outcomes are verified on-chain against TxLINE's cryptographic proofs, so funds move by verification, not by trust."

**Trading Tools & Agents:** "A trading agent whose every decision carries proof — each position it takes is logged on-chain with the exact TxLINE data snapshot that justified it. An auditable trader, not a black box."

**Consumer & Fan Experiences:** "Bet your friends, let the math referee. Create a market in one tap, share a link, and when the whistle blows the contract checks the cryptographic result and pays the winner — no arguing, no admin, no trust needed."

*Uchala jumla bitta o'zakka tayanadi (receipt/verification) — hakamlar bir loyihaning uch nusxasini emas, bitta kuchli g'oyaning uch qirrasini ko'radi.*

## 3\. DEMO VIDEO SCRIPT (5 daqiqa; har trek uchun 0:30–3:30 oralig'i mos qadoqqa almashtiriladi)

**0:00–0:30 — The problem (hook).** On screen: a simple graphic — two friends bet, a question mark in the middle: "who decides who won?" Voiceover: "Two billion people will watch the World Cup. Millions will bet on it. And every single bet has the same weak point: someone has to say who won — and you have to trust them. What if nobody had to?"

**0:30–3:30 — Live demo (the core; record with the replay simulator on Argentina 3–1 Switzerland).**

  - Create a market on the fixture; a second wallet joins. Show funds locking into the escrow PDA (explorer tab visible).
  - Start the replay: odds move, the score updates — narrate briefly: "this is real TxLINE World Cup data, replayed."
  - Final whistle → the settlement moment (THE CLIMAX — slow down here):
    1.  The keeper calls settle.
    2.  On screen, the verification receipt panel opens: fixture, stat values, Merkle proof, TxLINE signature.
    3.  Cut to Solana explorer: the settle transaction, the CPI into TxLINE's program, funds released to the winner. Voiceover: "No one told the contract who won. It verified the cryptographic proof on-chain — inside TxLINE's own validation program — and paid out by math."
  - Bonus 15 seconds: show the tampered-proof test failing with InvalidStatProof: "and if anyone tries to cheat — the sponsor's own program rejects it."

**3:30–4:30 — How TxLINE powers it.** Architecture in one simple diagram: TxLINE feed → replay/live → our program → CPI validate_stat_v2 → payout. Name the exact endpoints used (fixtures, SSE odds, scores validation). Mention the SDK: "any builder can add verified settlement with three lines of code" (show the quickstart snippet).

**4:30–5:00 — What's next + honest trust model.** "Today: devnet, one data source. The trust model is documented — TxLINE is the single oracle, and we verify rather than trust it. Next: multi-source verification and mainnet." End card: Goalpost — every result comes with a receipt.

*Qoida: video davomida kamida 2 marta Solana explorer ko'rinsin — hakamlar "real ishlayapti"ni ko'zi bilan ko'rsin. Ovoz: shoshilmasdan, klimaks joyida pauza.*

## 4\. BUILD DAY 30-SECOND PITCH (17-iyul, yodlab boring)

"Hi, I'm Nurmuhammad, building Goalpost. You know how every prediction market still needs someone you trust to say who won? Goalpost doesn't. Match results come from TxLINE cryptographically signed on Solana, and our contract verifies the proof on-chain — a real CPI into their validation program — before releasing a single lamport. It's already live on devnet with all settlement tests passing against real World Cup data. One engine, three products: the settlement core, a provable trading agent, and a fan app where the math is the referee. I'd love to show you the receipt."

*Oxirgi jumla ("show you the receipt") — suhbatga taklif. Telefonda explorer'dagi settle tranzaksiyasini ochib qo'yib yuring — so'ragan odamga darhol ko'rsatasiz.*

## 5\. NAME & VISUAL NOTES (Phase 4 dizayni shu yerdan oziqlanadi)

  - **Name:** Goalpost — qoladi (qisqa, futbol, "qat'iy belgilangan chegara" ma'nosi ham bor). Tagline: *every result comes with a receipt.*
  - **Signature visual:** the receipt/chek motivi — settlement paytida chiqadigan verification-panel chek ko'rinishida (perforatsiya, monospace raqamlar, "VERIFIED ✓ InvalidStatProof rejected for tampered inputs" uslubi). Bu ham esda qoladi, ham to'g'ridan-to'g'ri g'oyani gavdalantiradi.
  - **Rang yo'nalishi:** broadcast-scoreboard energiyasi (to'q fon + tabular raqamlar) YOKI chek-qog'ozi kontrasti — Phase 4'da frontend-dizayn bosqichida hal qilinadi, ikkala yo'nalish ham shablon-AI ko'rinishdan qochadi.

## 6\. HONESTY LINES (savol-javobda kerak bo'ladi — build day va interview'da)

  - "Isn't TxLINE still a single point of trust?" → "Yes — and we say so in TRUST_MODEL.md. The difference: we verify their signed proofs on-chain rather than trusting an API response. One verifiable source beats one trusted middleman; multi-source is the roadmap."
  - "Why devnet?" → "The hackathon accepts devnet; our engine is chain-agnostic within Solana. Mainnet needs audits — we'd rather ship honest devnet than risky mainnet."
  - "Gambling laws?" → "The consumer demo settles reputation, not money, and the money path is geo-gated by design. We documented the compliance split — the engine itself is jurisdiction-neutral settlement infrastructure."
