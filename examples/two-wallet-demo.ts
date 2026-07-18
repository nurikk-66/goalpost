// Phase 4 acceptance evidence: the two-party version of quickstart.ts. One
// wallet creates the market (like a UI's "connect wallet -> create market"
// step), a genuinely separate second wallet joins and later claims (the
// "second wallet joins" / "claim payout" steps of the demo script in
// docs/POSITIONING.md) - proving the protocol doesn't secretly require the
// same signer throughout, only that this script drives it instead of two
// browser tabs (no Playwright/Chromium available on this machine - see
// docs/OPEN_QUESTIONS.md).
//
// Everything here is real: real devnet transactions, the real finished
// Argentina v Switzerland fixture, and the real captured Merkle proof via
// TxLineClient.getResultWithProof(). Every signature below resolves on
// https://explorer.solana.com/?cluster=devnet.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { loadProgram, createMarket, join, lockMarket, settle, claim, getMarket, marketPda, authenticateTxLine, TxLineClient } from "@goalpost/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const FIXTURE_ID = 18222446; // Argentina 3-1 Switzerland, already finished (docs/TXLINE_NOTES.md §9)
const LOCK_TIME_BUFFER_SECONDS = 150; // matches examples/quickstart.ts - real devnet confirmation across several setup txs needs headroom, not a quick guess
const BACKER_FUNDING_LAMPORTS = 0.05 * LAMPORTS_PER_SOL; // rent for the backer's ATA + a handful of tx fees

function loadOrCreateWallet(filename: string): Keypair {
  const walletPath = path.join(repoRoot, "scripts", "vendor", filename);
  if (fs.existsSync(walletPath)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(path.dirname(walletPath), { recursive: true });
  fs.writeFileSync(walletPath, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function pickUnusedMarketType(connection: Connection, fixtureId: BN): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = Math.floor(Math.random() * 256);
    const pda = marketPda(fixtureId, candidate);
    if (!(await connection.getAccountInfo(pda))) return candidate;
  }
  throw new Error("could not find an unused market_type after 20 attempts");
}

const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const explorerAddr = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const creator = loadOrCreateWallet("recon-wallet.json"); // reuses this repo's already-funded wallet, same as quickstart.ts
  const backer = loadOrCreateWallet("backer-wallet.json"); // a genuinely separate keypair - the "second wallet"

  const creatorBalance = await connection.getBalance(creator.publicKey);
  if (creatorBalance === 0) {
    console.error(`[creator] ${creator.publicKey.toBase58()} has 0 SOL. Fund it at https://faucet.solana.com (devnet) and re-run.`);
    process.exit(1);
  }

  console.log(`[setup] creator: ${creator.publicKey.toBase58()}`);
  console.log(`[setup] backer:  ${backer.publicKey.toBase58()} (second wallet)`);

  const backerBalance = await connection.getBalance(backer.publicKey);
  if (backerBalance < BACKER_FUNDING_LAMPORTS) {
    // Devnet's public faucet is frequently rate-limited, especially during a
    // hackathon - a direct transfer from the already-funded creator wallet
    // is far more reliable than requestAirdrop() for a repeatable demo.
    console.log(`[setup] funding backer with ${BACKER_FUNDING_LAMPORTS / LAMPORTS_PER_SOL} SOL from creator (devnet faucet is unreliable under load)...`);
    const provider = new AnchorProvider(connection, new Wallet(creator), { commitment: "confirmed" });
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: creator.publicKey, toPubkey: backer.publicKey, lamports: BACKER_FUNDING_LAMPORTS })
    );
    const sig = await provider.sendAndConfirm(tx);
    console.log(`      funded. ${explorerTx(sig)}`);
  }

  const provider = new AnchorProvider(connection, new Wallet(creator), { commitment: "confirmed" });
  const program = loadProgram(provider);

  console.log("[1/6] Authenticating with TxLINE (devnet, World Cup free tier)...");
  const session = await authenticateTxLine(connection, creator);
  const txline = new TxLineClient({ jwt: session.jwt, apiToken: session.apiToken });

  console.log("[2/6] Creator creates the market...");
  const mint = await createMint(connection, creator, creator.publicKey, null, 6);
  const marketType = await pickUnusedMarketType(connection, new BN(FIXTURE_ID));
  const lockTime = Math.floor(Date.now() / 1000) + LOCK_TIME_BUFFER_SECONDS;
  const { market, vault } = await createMarket(program, { creator: creator.publicKey, fixtureId: FIXTURE_ID, marketType, lockTime, mint });
  console.log(`      Market ${market.toBase58()} created by creator.`);
  console.log(`      ${explorerAddr(market.toBase58())}`);

  console.log("[3/6] Second wallet (backer) joins, backing Home...");
  const backerAta = (await getOrCreateAssociatedTokenAccount(connection, creator, mint, backer.publicKey)).address;
  await mintTo(connection, creator, mint, backerAta, creator.publicKey, 1_000_000);
  const backerProvider = new AnchorProvider(connection, new Wallet(backer), { commitment: "confirmed" });
  const backerProgram = loadProgram(backerProvider);
  const { signature: joinSignature } = await join(backerProgram, {
    participant: backer.publicKey,
    market,
    outcome: "home",
    amount: 1_000_000,
    participantTokenAccount: backerAta,
    vault,
  });
  console.log(`      Backer joined with their own wallet, backing Home with 1.00 tokens.`);
  console.log(`      ${explorerTx(joinSignature)}`);

  console.log("[4/6] Waiting for lock_time, then locking...");
  await new Promise((r) => setTimeout(r, LOCK_TIME_BUFFER_SECONDS * 1000 + 2000));
  await lockMarket(program, market);

  console.log("[5/6] Fetching the real result + Merkle proof, then settling on-chain...");
  const result = await txline.getResultWithProof(FIXTURE_ID);
  console.log(`      Real, cryptographically proven result: ${result.homeGoals} - ${result.awayGoals}`);
  const settleSignature = await settle(program, { settler: creator.publicKey, market, proof: result.settleArgs });
  const account = await getMarket(program, market);
  console.log(`      Settled. On-chain outcome: ${JSON.stringify(account.outcome)}`);
  console.log(`      Verification receipt: ${explorerTx(settleSignature)}`);

  console.log("[6/6] Second wallet (backer) claims their payout...");
  const claimSignature = await claim(backerProgram, { participant: backer.publicKey, market, vault, destination: backerAta });
  console.log(`      Backer claimed with their own wallet.`);
  console.log(`      ${explorerTx(claimSignature)}`);

  console.log("\nDone - two genuinely separate wallets (creator, backer) drove the full lifecycle against real devnet:");
  console.log(`  market:  ${explorerAddr(market.toBase58())}`);
  console.log(`  join:    ${explorerTx(joinSignature)}`);
  console.log(`  settle:  ${explorerTx(settleSignature)}`);
  console.log(`  claim:   ${explorerTx(claimSignature)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
