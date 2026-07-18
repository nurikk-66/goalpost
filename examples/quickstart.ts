// Runnable Phase 3 acceptance script (see MASTER_PLAN.md Phase 3): exercises
// the whole SDK surface against real devnet - creates a market for the real,
// already-finished Argentina v Switzerland fixture, joins it, locks it,
// settles it with the real captured Merkle proof (fetched live via
// TxLineClient.getResultWithProof), claims the payout, then streams a few
// ticks from the local replay simulator to show the same TxLineClient works
// unchanged against a recorded match, not just the live API.
//
// Prerequisites (see README.md "Quickstart"): a devnet-funded Solana wallet.
// Reuses the same wallet Phase 0's recon script bootstraps
// (scripts/vendor/recon-wallet.json) so this repo's existing funded wallet
// works out of the box; a genuinely clean clone will generate a new one here
// and print faucet instructions, same as scripts/recon.ts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Connection, Keypair } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  loadProgram,
  createMarket,
  join,
  lockMarket,
  settle,
  claim,
  getMarket,
  marketPda,
  authenticateTxLine,
  TxLineClient,
} from "@goalpost/sdk";
// Imported directly (not spawned as a subprocess) so the replay server runs
// in-process - simpler and more portable than shelling out to `npx tsx`.
import { startServer } from "../apps/replay/src/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const FIXTURE_ID = 18222446; // Argentina 3-1 Switzerland, already finished (docs/TXLINE_NOTES.md §9)
const REPLAY_PORT = 4001;
const LOCK_TIME_BUFFER_SECONDS = 150; // real devnet confirmation takes several seconds per tx across ~6 setup txs - see tests/goalpost.ts for why this needs to be generous, not a quick guess

function loadOrCreateWallet(): Keypair {
  const walletPath = path.join(repoRoot, "scripts", "vendor", "recon-wallet.json");
  if (fs.existsSync(walletPath)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(path.dirname(walletPath), { recursive: true });
  fs.writeFileSync(walletPath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`[wallet] generated ${kp.publicKey.toBase58()} - fund it at https://faucet.solana.com (devnet) and re-run.`);
  return kp;
}

// Tests run against real, persistent devnet state (not a resettable local
// validator - see docs/OPEN_QUESTIONS.md), so a fixed market_type risks
// colliding with a leftover market from a previous quickstart run.
async function pickUnusedMarketType(connection: Connection, fixtureId: BN): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = Math.floor(Math.random() * 256);
    const pda = marketPda(fixtureId, candidate);
    if (!(await connection.getAccountInfo(pda))) return candidate;
  }
  throw new Error("could not find an unused market_type after 20 attempts");
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = loadOrCreateWallet();
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance === 0) {
    console.error(`[wallet] ${wallet.publicKey.toBase58()} has 0 SOL. Fund it at https://faucet.solana.com (devnet) and re-run.`);
    process.exit(1);
  }

  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  const program = loadProgram(provider);

  console.log("[1/6] Authenticating with TxLINE (devnet, World Cup free tier)...");
  const session = await authenticateTxLine(connection, wallet);
  const txline = new TxLineClient({ jwt: session.jwt, apiToken: session.apiToken });

  const fixtures = await txline.getFixtures(72);
  console.log(`      Found ${fixtures.length} World Cup fixtures via getFixtures(). Using the known finished match ${FIXTURE_ID}.`);

  console.log("[2/6] Creating a market and joining it...");
  const mint = await createMint(connection, wallet, wallet.publicKey, null, 6);
  const marketType = await pickUnusedMarketType(connection, new BN(FIXTURE_ID));
  const lockTime = Math.floor(Date.now() / 1000) + LOCK_TIME_BUFFER_SECONDS;
  const { market, vault } = await createMarket(program, { creator: wallet.publicKey, fixtureId: FIXTURE_ID, marketType, lockTime, mint });

  const backerAta = (await getOrCreateAssociatedTokenAccount(connection, wallet, mint, wallet.publicKey)).address;
  await mintTo(connection, wallet, mint, backerAta, wallet.publicKey, 1_000_000);
  await join(program, { participant: wallet.publicKey, market, outcome: "home", amount: 1_000_000, participantTokenAccount: backerAta, vault });
  console.log(`      Market ${market.toBase58()} created, joined backing Home with 1.00 tokens.`);
  console.log(`      Explorer: https://explorer.solana.com/address/${market.toBase58()}?cluster=devnet`);

  console.log(`[3/6] Waiting for lock_time, then locking...`);
  await new Promise((r) => setTimeout(r, LOCK_TIME_BUFFER_SECONDS * 1000 + 2000));
  await lockMarket(program, market);

  console.log("[4/6] Fetching the real result + Merkle proof, then settling on-chain...");
  const result = await txline.getResultWithProof(FIXTURE_ID);
  console.log(`      Real, cryptographically proven result: ${result.homeGoals} - ${result.awayGoals}`);
  const settleSignature = await settle(program, { settler: wallet.publicKey, market, proof: result.settleArgs });
  const account = await getMarket(program, market);
  console.log(`      Settled. On-chain outcome: ${JSON.stringify(account.outcome)}`);
  console.log(`      Verification receipt: https://explorer.solana.com/tx/${settleSignature}?cluster=devnet`);

  console.log("[5/6] Claiming the payout...");
  await claim(program, { participant: wallet.publicKey, market, vault, destination: backerAta });
  console.log("      Claimed.");

  console.log("[6/6] Streaming odds from the local replay simulator (apps/replay, samples/match1.jsonl)...");
  const replayFile = path.join(repoRoot, "apps", "replay", "samples", "match1.jsonl");
  const replayServer = startServer(replayFile, 60, REPLAY_PORT);
  const replayClient = new TxLineClient({ baseUrl: `http://localhost:${REPLAY_PORT}` });
  let ticks = 0;
  for await (const tick of replayClient.streamOdds()) {
    console.log("      odds tick:", JSON.stringify(tick).slice(0, 120));
    if (++ticks >= 3) break;
  }
  replayServer.close();

  console.log("\nDone - full lifecycle (auth -> create -> join -> lock -> settle -> claim) plus a live replay stream all ran against real devnet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
