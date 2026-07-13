# Deploying `programs/goalpost`

**Status as of 2026-07-13: already deployed, live on devnet.** No manual
Playground deploy is needed. This happened automatically as a side effect of
CI: `anchor test` performs its own deploy step against whatever cluster is
configured (`[provider] cluster = "devnet"` in `Anchor.toml`) *regardless* of
`--skip-local-validator` — that flag only skips spinning up a local
validator, not the deploy step. The first devnet-direct CI run deployed the
program using the funded CI wallet (restored from the `DEVNET_WALLET_SECRET_KEY`
repo secret, same wallet as `scripts/vendor/recon-wallet.json` from Phase 0)
as its upgrade authority.

Confirmed live:

```
devnet program:   6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr
executable:       true
owner:            BPFLoaderUpgradeab1e11111111111111111111111
upgrade authority: 4oRVRLrWtBAV9QVZSLXhb1edW9JTzMBBvz4uhiU4rRky (the CI/Phase-0 devnet wallet)
```

**Implication for anyone who wants to upgrade the deployed code later**: only
the wallet above (or whoever holds `scripts/vendor/recon-wallet.json` /
the `DEVNET_WALLET_SECRET_KEY` secret) can push an upgrade to this program
ID. This does **not** affect normal usage — `create_market`/`join`/`settle`/
`claim` have no admin/authority requirement (see `docs/TRUST_MODEL.md`), only
redeploying new program *code* needs this specific key.

## If a manual deploy is ever needed again (e.g. a different environment,
## or CI's auto-deploy is disabled)

This environment has no local Rust/Solana/Anchor toolchain (see
`docs/TRUST_MODEL.md` "Status"), so the natural manual fallback is
[Solana Playground](https://beta.solpg.io):

### Why the program keypair matters

`declare_id!("6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr")` in
`programs/goalpost/src/lib.rs` is hardcoded to match a real keypair
committed at `programs/goalpost/keys/goalpost-keypair.json` (generated with
`@solana/web3.js`, same 64-byte secret-key array format `solana-keygen`
produces — devnet-only, holds no value, safe to commit). Any deploy tool
must use this exact keypair (or already-matching on-chain state, as is now
the case) — importing a *different* keypair would either fail (since the
program ID is already occupied and its real upgrade authority is the
Phase 0 wallet, not a fresh Playground-generated one) or, if targeting a
fresh address, produce a program ID that doesn't match `declare_id!`.

### Steps (only if redeploying from scratch to a *new* address, or if CI's
### auto-deploy path is unavailable)

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
   To *upgrade* the existing live deployment instead, Playground's deploy
   wallet must be the upgrade authority above, not this program keypair.
5. Set the cluster to **devnet**.
6. Build, then deploy. Confirm the deployed program address matches
   `6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr` exactly.
7. Fund the Playground deploy wallet with devnet SOL if deploying fresh.

## Devnet USDC-equivalent mint

Record the actual demo mint address here once created (`docs/ARCHITECTURE.md`
§5 - we mint our own demo token rather than depend on a shared faucet):

```
devnet program:  6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr
demo mint:       <not yet created>
```
