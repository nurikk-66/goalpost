# Deploying `programs/goalpost` (manual, via Solana Playground)

This environment has no local Rust/Solana/Anchor toolchain (see
`docs/TRUST_MODEL.md` "Status"), so builds/tests run in GitHub Actions
(`.github/workflows/anchor-ci.yml`) and **deploys are done manually** via
[Solana Playground](https://beta.solpg.io).

**This step is now a hard prerequisite for CI itself, not just for a
follow-up e2e check.** `anchor test` runs directly against real devnet
(`--skip-local-validator` - see `Anchor.toml` and `docs/OPEN_QUESTIONS.md`
for why the local validator was abandoned), so `.github/workflows/anchor-ci.yml`
will keep failing at `anchor test` with a program-not-found-style error
until this deploy actually happens.

## Why the program keypair matters

`declare_id!("6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr")` in
`programs/goalpost/src/lib.rs` is hardcoded to match a real keypair
committed at `programs/goalpost/keys/goalpost-keypair.json` (generated with
`@solana/web3.js`, same 64-byte secret-key array format `solana-keygen`
produces — devnet-only, holds no value, safe to commit). **Playground must
deploy using this exact keypair**, or the deployed program's address won't
match what the program's own code declares, and every CPI/PDA derivation
that assumes this program ID (including our own `Market`/`Position` PDAs,
which are seeded independently of the program ID string but resolved via
`program.programId` client-side) will be looking at the wrong address.

## Steps

1. Open [beta.solpg.io](https://beta.solpg.io), create a new Anchor project.
2. Replace the generated `programs/*/src/lib.rs` and add the rest of
   `programs/goalpost/src/` (state.rs, errors.rs, txoracle.rs,
   instructions/) — copy the files from this repo as-is.
3. Set the project's `Cargo.toml` dependencies to match
   `programs/goalpost/Cargo.toml` (`anchor-lang = "0.32.1"` with
   `init-if-needed`, `anchor-spl = "0.32.1"`).
4. In Playground's wallet/keypair panel, **import**
   `programs/goalpost/keys/goalpost-keypair.json` as the program's deploy
   keypair (Playground supports importing a custom program keypair rather
   than generating its own — use that, don't let it generate a new one).
5. Set the cluster to **devnet**.
6. Build, then deploy. Confirm the deployed program address matches
   `6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr` exactly.
7. Fund the Playground deploy wallet with devnet SOL (program deploys cost
   real rent - a few SOL for a program this size is a safe buffer).

## After deploying

Once deployed, `.github/workflows/anchor-ci.yml`'s `anchor-test` job should
go green on its next run (or `workflow_dispatch` it manually) — it already
restores the funded devnet wallet from the `DEVNET_WALLET_SECRET_KEY` repo
secret (same wallet as `scripts/vendor/recon-wallet.json` from Phase 0) and
runs `tests/goalpost.ts` directly against devnet, no local validator or
Anchor CLI cloning involved.

Separately, the same funded devnet wallet can drive a fully scripted
end-to-end run (create → two wallets join → settle with the real captured
proof → both claims) via `@solana/web3.js`/`@coral-xyz/anchor`, the same way
`scripts/recon.ts` already talks to devnet.

Record the actual deployed program's devnet USDC-equivalent mint address
here once created (`docs/ARCHITECTURE.md` §5 - we mint our own demo token
rather than depend on a shared faucet):

```
devnet program:  6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr
demo mint:       <fill in after `spl-token create-token` via Playground's terminal>
```
