// Anchor integration tests for programs/goalpost, covering the 4 required
// cases from MASTER_PLAN.md §3.1 (happy path, wrong-result-rejected,
// double-claim-rejected, non-participant-claim-rejected).
//
// Runs directly against real devnet (see Anchor.toml - local
// solana-test-validator was abandoned after two unrelated startup crashes),
// where the real TxLINE txoracle program and the real
// daily_scores_merkle_roots PDA for epochDay 20646 already exist - so the
// happy-path settle() call verifies against genuine on-chain state, not a
// mock or a clone. The proof itself is the real one captured in Phase 0
// (fixtures/samples/scores_stat_validation.json, Argentina 3-1 Switzerland,
// fixtureId 18222446).
import * as anchor from "@coral-xyz/anchor";
// @coral-xyz/anchor re-exports BN, but under real Node ESM interop
// (root package.json has "type": "module") neither `import { BN } from
// "@coral-xyz/anchor"` (named export not statically detected) nor
// `const { BN } = anchor` (resolves to something that isn't a constructor -
// likely the bn.js module namespace, not the class) reliably works. bn.js
// is anchor's own BN implementation and a real (if previously transitive)
// dependency; importing it directly sidesteps the interop ambiguity
// entirely - a default import of a CJS module always maps to the whole
// `module.exports`, no named-property detection involved.
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// __dirname doesn't exist under real ESM (same root-package.json "type":
// "module" as above) - this is the standard replacement.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const REAL_EPOCH_DAY = 20646; // covers the real captured proof's ts

function proofNodes(nodes: { hash: number[]; isRightSibling: boolean }[]) {
  return nodes.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling }));
}

function epochDayPda(epochDay: number): PublicKey {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(epochDay, 0);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("daily_scores_roots"), buf], TXORACLE_PROGRAM_ID);
  return pda;
}

describe("goalpost", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Goalpost as anchor.Program;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const realProof = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "samples", "scores_stat_validation.json"), "utf8")
  );
  const REAL_FIXTURE_ID = new BN(realProof.summary.fixtureId); // 18222446

  const dailyScoresMerkleRoots = epochDayPda(REAL_EPOCH_DAY);

  let mint: PublicKey;

  // Devnet's public airdrop faucet is rate-limited (Phase 0 hit this
  // directly), so test wallets are funded by transferring from our own
  // already-funded provider wallet rather than requesting a fresh airdrop
  // per wallet. 0.05 SOL is plenty for a handful of transactions + one ATA's
  // rent per test wallet.
  async function fundWallet(pubkey: PublicKey, sol = 0.05) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: pubkey,
        lamports: Math.round(sol * LAMPORTS_PER_SOL),
      })
    );
    await provider.sendAndConfirm(tx, [payer]);
  }

  async function fundedAta(owner: PublicKey, amount: number): Promise<PublicKey> {
    const ata = await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, owner);
    await mintTo(provider.connection, payer, mint, ata.address, payer.publicKey, amount);
    return ata.address;
  }

  function marketPdaFor(fixtureId: BN, marketType: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), fixtureId.toArrayLike(Buffer, "le", 8), Buffer.from([marketType])],
      program.programId
    );
    return pda;
  }

  function positionPdaFor(market: PublicKey, participant: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), participant.toBuffer()],
      program.programId
    );
    return pda;
  }

  function realSettleArgs() {
    return {
      ts: new BN(realProof.ts),
      fixtureSummary: {
        fixtureId: new BN(realProof.summary.fixtureId),
        updateStats: {
          updateCount: realProof.summary.updateStats.updateCount,
          minTimestamp: new BN(realProof.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(realProof.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: realProof.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: proofNodes(realProof.subTreeProof),
      mainTreeProof: proofNodes(realProof.mainTreeProof),
      eventStatRoot: realProof.eventStatRoot,
      homeStat: {
        stat: realProof.statsToProve[0], // { key: 1, value: 3, period: 100 }
        statProof: proofNodes(realProof.statProofs[0]),
      },
      awayStat: {
        stat: realProof.statsToProve[1], // { key: 2, value: 1, period: 100 }
        statProof: proofNodes(realProof.statProofs[1]),
      },
    };
  }

  async function createLockedMarket(fixtureId: BN, marketType: number): Promise<PublicKey> {
    const market = marketPdaFor(fixtureId, marketType);
    const vault = anchor.utils.token.associatedAddress({ mint, owner: market });
    const lockTime = new BN(Math.floor(Date.now() / 1000) + 2);

    await program.methods
      .createMarket(fixtureId, marketType, lockTime)
      .accounts({
        creator: provider.wallet.publicKey,
        market,
        mint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await new Promise((r) => setTimeout(r, 3000));
    await program.methods.lockMarket().accounts({ market }).rpc();

    return market;
  }

  before(async () => {
    mint = await createMint(provider.connection, payer, provider.wallet.publicKey, null, 6);
  });

  describe("happy path", () => {
    let market: PublicKey;
    let homeBacker: Keypair;
    let awayBacker: Keypair;
    let homeTokenAccount: PublicKey;
    let awayTokenAccount: PublicKey;
    let homePosition: PublicKey;
    let awayPosition: PublicKey;
    let vault: PublicKey;

    before(async () => {
      homeBacker = Keypair.generate();
      awayBacker = Keypair.generate();
      await fundWallet(homeBacker.publicKey);
      await fundWallet(awayBacker.publicKey);

      const fixtureId = REAL_FIXTURE_ID;
      const marketType = 0;
      market = marketPdaFor(fixtureId, marketType);
      vault = anchor.utils.token.associatedAddress({ mint, owner: market });
      const lockTime = new BN(Math.floor(Date.now() / 1000) + 2);

      await program.methods
        .createMarket(fixtureId, marketType, lockTime)
        .accounts({
          creator: provider.wallet.publicKey,
          market,
          mint,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      homeTokenAccount = await fundedAta(homeBacker.publicKey, 1_000_000);
      awayTokenAccount = await fundedAta(awayBacker.publicKey, 1_000_000);

      homePosition = positionPdaFor(market, homeBacker.publicKey);
      awayPosition = positionPdaFor(market, awayBacker.publicKey);

      await program.methods
        .join({ home: {} }, new BN(1_000_000))
        .accounts({
          participant: homeBacker.publicKey,
          market,
          position: homePosition,
          participantTokenAccount: homeTokenAccount,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([homeBacker])
        .rpc();

      await program.methods
        .join({ away: {} }, new BN(1_000_000))
        .accounts({
          participant: awayBacker.publicKey,
          market,
          position: awayPosition,
          participantTokenAccount: awayTokenAccount,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([awayBacker])
        .rpc();

      await new Promise((r) => setTimeout(r, 3000));
      await program.methods.lockMarket().accounts({ market }).rpc();
    });

    it("settles with the real proof and derives the correct outcome (Argentina 3-1 Switzerland -> Home wins)", async () => {
      const args = realSettleArgs();
      await program.methods
        .settle(args.ts, args.fixtureSummary, args.fixtureProof, args.mainTreeProof, args.eventStatRoot, args.homeStat, args.awayStat)
        .accounts({
          settler: provider.wallet.publicKey,
          market,
          dailyScoresMerkleRoots,
        })
        .rpc();

      const marketAccount = await program.account.market.fetch(market);
      assert.deepEqual(marketAccount.outcome, { home: {} });
      assert.equal(marketAccount.settlementHomeGoals, 3);
      assert.equal(marketAccount.settlementAwayGoals, 1);
      assert.deepEqual(marketAccount.status, { settled: {} });
    });

    it("pays the winning backer their full proportional share and lets them claim exactly once", async () => {
      await program.methods
        .claim()
        .accounts({
          participant: homeBacker.publicKey,
          market,
          position: homePosition,
          vault,
          destination: homeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([homeBacker])
        .rpc();

      const homeAccountInfo = await getAccount(provider.connection, homeTokenAccount);
      // sole Home backer -> gets the entire pool (1_000_000 Home + 1_000_000 Away)
      assert.equal(homeAccountInfo.amount.toString(), "2000000");
    });

    it("rejects a losing position's claim (NothingToClaim)", async () => {
      try {
        await program.methods
          .claim()
          .accounts({
            participant: awayBacker.publicKey,
            market,
            position: awayPosition,
            vault,
            destination: awayTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([awayBacker])
          .rpc();
        assert.fail("expected NothingToClaim error");
      } catch (e: any) {
        assert.include(String(e), "NothingToClaim");
      }
    });

    it("rejects a double-claim from the winning backer (AlreadyClaimed)", async () => {
      try {
        await program.methods
          .claim()
          .accounts({
            participant: homeBacker.publicKey,
            market,
            position: homePosition,
            vault,
            destination: homeTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([homeBacker])
          .rpc();
        assert.fail("expected AlreadyClaimed error");
      } catch (e: any) {
        assert.include(String(e), "AlreadyClaimed");
      }
    });

    it("rejects a claim from a wallet that never joined (no Position account exists)", async () => {
      const stranger = Keypair.generate();
      await fundWallet(stranger.publicKey, 0.02);
      const strangerTokenAccount = await fundedAta(stranger.publicKey, 0);
      const strangerPosition = positionPdaFor(market, stranger.publicKey);

      try {
        await program.methods
          .claim()
          .accounts({
            participant: stranger.publicKey,
            market,
            position: strangerPosition,
            vault,
            destination: strangerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("expected an account-not-initialized error");
      } catch (e: any) {
        // Position was never created for `stranger`, so Anchor fails to
        // load the account before our handler code even runs.
        assert.match(String(e), /AccountNotInitialized|does not exist|3012/);
      }
    });
  });

  it("rejects settle() when the submitted stat value doesn't match the real Merkle proof", async () => {
    // Same real fixtureId, different market_type purely to get an
    // independent PDA - this market has no joins, it only exists to prove
    // settle() rejects a tampered value against otherwise-real proof nodes.
    const market = await createLockedMarket(REAL_FIXTURE_ID, 1);

    const args = realSettleArgs();
    const tampered = {
      ...args,
      homeStat: {
        ...args.homeStat,
        stat: { ...args.homeStat.stat, value: 99 }, // real value is 3
      },
    };

    try {
      await program.methods
        .settle(
          tampered.ts,
          tampered.fixtureSummary,
          tampered.fixtureProof,
          tampered.mainTreeProof,
          tampered.eventStatRoot,
          tampered.homeStat,
          tampered.awayStat
        )
        .accounts({
          settler: provider.wallet.publicKey,
          market,
          dailyScoresMerkleRoots,
        })
        .rpc();
      assert.fail("expected settle() to reject a tampered stat value");
    } catch (e: any) {
      assert.include(String(e), "StatValidationFailed");
    }

    const marketAccount = await program.account.market.fetch(market);
    assert.deepEqual(marketAccount.status, { locked: {} });
  });
});
