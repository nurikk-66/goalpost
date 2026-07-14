# @goalpost/sdk

TypeScript SDK for **Goalpost**, a trustless World Cup settlement engine on
Solana devnet. Wraps the `programs/goalpost` Anchor program and TxLINE's
REST/SSE API behind a small, fully-typed surface - no on-chain account
layouts or Merkle-proof plumbing to hand-roll yourself.

- Program: `6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr` (devnet)
- Trust model: `docs/TRUST_MODEL.md`. TxLINE integration details: `docs/TXLINE_NOTES.md`.

## Quickstart

```ts
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { loadProgram, createMarket, join, lockMarket, settle, claim, authenticateTxLine, TxLineClient } from "@goalpost/sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = Keypair.fromSecretKey(/* your funded devnet keypair */);
const program = loadProgram(new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" }));

const session = await authenticateTxLine(connection, wallet); // guest JWT + API token
const txline = new TxLineClient(session);

const FIXTURE_ID = 18222446; // a real, already-finished World Cup match
const mint = await createMint(connection, wallet, wallet.publicKey, null, 6);
const { market, vault } = await createMarket(program, { creator: wallet.publicKey, fixtureId: FIXTURE_ID, marketType: 0, lockTime: Math.floor(Date.now() / 1000) + 150, mint });

const ata = (await getOrCreateAssociatedTokenAccount(connection, wallet, mint, wallet.publicKey)).address;
await mintTo(connection, wallet, mint, ata, wallet.publicKey, 1_000_000);
await join(program, { participant: wallet.publicKey, market, outcome: "home", amount: 1_000_000, participantTokenAccount: ata, vault });

// ...wait for lock_time to pass...
await lockMarket(program, market);

const result = await txline.getResultWithProof(FIXTURE_ID); // fetches the real Merkle proof
await settle(program, { settler: wallet.publicKey, market, proof: result.settleArgs }); // CPIs into TxLINE's validate_stat_v2
await claim(program, { participant: wallet.publicKey, market, vault, destination: ata });
```

See `examples/quickstart.ts` in the repo root for the full runnable version
of this flow (wallet bootstrap, market_type collision avoidance, and a
`streamOdds()` demo against the local replay simulator) - run it with:

```
pnpm install
pnpm --filter @goalpost/sdk build   # examples/ imports the built dist/, not source
pnpm --filter @goalpost/quickstart start
```

Needs a devnet-funded Solana wallet at `scripts/vendor/recon-wallet.json` -
the script generates one and prints faucet instructions if it's missing.

## What each function does

| Function | Does |
|---|---|
| `loadProgram(provider)` | Builds a fully-typed `Program<Goalpost>` from the real generated IDL (`src/generated/`) |
| `createMarket(program, params)` | Creates a Market PDA + its escrow vault |
| `join(program, params)` | Backs an outcome (`"home" \| "draw" \| "away"`) with tokens |
| `lockMarket(program, market)` | Open -> Locked once `lock_time` has passed |
| `settle(program, params)` | Locked -> Settled: CPIs into TxLINE's `validate_stat_v2` and derives the outcome from the proven values. Automatically sets the 1.4M compute-unit budget the CPI needs - see `docs/OPEN_QUESTIONS.md` |
| `claim(program, params)` | Pays a winning (or, if nobody backed the winner, refunds a) position |
| `getMarket(program, market)` | Fetches and decodes a `Market` account |
| `authenticateTxLine(connection, wallet)` | Runs TxLINE's free-tier on-chain subscribe + REST activation, returns a session |
| `TxLineClient.getFixtures(competitionId?)` | `GET /fixtures/snapshot` |
| `TxLineClient.getResultWithProof(fixtureId)` | Finds a fixture's final result and fetches its real Merkle proof, pre-mapped for `settle()` |
| `TxLineClient.streamOdds()` / `.streamScores()` | Async generators over the SSE streams - point `baseUrl` at `apps/replay`'s local server instead of the real API to drive a demo off a recorded match |

## Errors

Every function throws a typed error instead of a raw Anchor/Axios exception:

- `GoalpostProgramError` (`.name`: `"NothingToClaim"`, `"AlreadyClaimed"`, `"StatValidationFailed"`, ... - see `errors.ts` for the full list mirroring `programs/goalpost/src/errors.rs`)
- `TxLineApiError` (`.kind`: `"unauthorized"`, `"forbidden"`, `"network_mismatch"`, ... - mapped from the real error modes in `docs/TXLINE_NOTES.md` §7)

## Development

```
pnpm --filter @goalpost/sdk build   # tsup -> dist/ (ESM + CJS + .d.ts)
pnpm --filter @goalpost/sdk test    # vitest: proof-mapping, PDA derivation, error-path tests
```

The real IDL (`src/generated/goalpost.{json,ts}`) is downloaded from the
`goalpost-idl` artifact produced by `.github/workflows/anchor-ci.yml`'s
`anchor build` step - there is no local Anchor toolchain in this repo (see
`docs/ARCHITECTURE.md`), so CI is the only place it's regenerated. Re-run
`gh run download <run-id> -n goalpost-idl -D packages/sdk/src/generated`
after a program change.
