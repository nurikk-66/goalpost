import { PublicKey } from "@solana/web3.js";

/** Goalpost program, deployed on devnet (see docs/DEPLOY.md). */
export const GOALPOST_PROGRAM_ID = new PublicKey("6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr");

/** TxLINE's real txoracle program, devnet (see docs/TXLINE_NOTES.md §1). */
export const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

/** Devnet TxLINE API host (see docs/TXLINE_NOTES.md §1). */
export const TXLINE_API_BASE_URL = "https://txline-dev.txodds.com";

/**
 * `validate_stat_v2`'s real on-chain compute cost, confirmed against live
 * devnet (docs/OPEN_QUESTIONS.md): the default 200,000 CU budget fails with
 * "exceeded CUs meter at BPF instruction" partway through the CPI. `settle()`
 * sets this automatically so callers never have to think about it.
 */
export const SETTLE_COMPUTE_UNIT_LIMIT = 1_400_000;
