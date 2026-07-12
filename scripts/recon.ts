// Phase 0 recon script: sets up a devnet wallet, activates a free-tier TxLINE
// subscription on-chain, then hits the fixtures/odds/scores/validation
// endpoints and saves real sample payloads to fixtures/samples/.
//
// Re-running is safe and cheap: the devnet wallet and jwt/apiToken are cached
// under scripts/vendor/ (gitignored) so only the first run needs a funded
// wallet and does the on-chain subscribe + activation round trip.
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "node:fs";
import path from "node:path";

const RPC_URL = "https://api.devnet.solana.com";
const API_BASE_URL = "https://txline-dev.txodds.com/api";
const JWT_URL = "https://txline-dev.txodds.com/auth/guest/start";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");

const root = path.resolve(import.meta.dirname, "..");
const samplesDir = path.join(root, "fixtures", "samples");
const walletPath = path.join(root, "scripts", "vendor", "recon-wallet.json");
const credsPath = path.join(root, "scripts", "vendor", "recon-credentials.json");

function save(name: string, data: unknown) {
  fs.mkdirSync(samplesDir, { recursive: true });
  fs.writeFileSync(path.join(samplesDir, name), JSON.stringify(data, null, 2));
  console.log(`[saved] fixtures/samples/${name}`);
}

async function loadOrCreateWallet(): Promise<Keypair> {
  if (fs.existsSync(walletPath)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")));
    const kp = Keypair.fromSecretKey(secret);
    console.log(`[wallet] loaded existing devnet wallet ${kp.publicKey.toBase58()}`);
    return kp;
  }
  const kp = Keypair.generate();
  fs.mkdirSync(path.dirname(walletPath), { recursive: true });
  fs.writeFileSync(walletPath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`[wallet] generated new devnet wallet ${kp.publicKey.toBase58()}`);
  console.log(`[wallet] fund it manually at https://faucet.solana.com (devnet) before re-running`);
  return kp;
}

async function ensureFunded(connection: Connection, kp: Keypair) {
  let balance = await connection.getBalance(kp.publicKey);
  console.log(`[wallet] balance: ${balance / 1e9} SOL`);
  let attempts = 0;
  while (balance < 0.05 * 1e9 && attempts < 3) {
    attempts++;
    try {
      console.log(`[wallet] requesting devnet airdrop (attempt ${attempts})...`);
      const sig = await connection.requestAirdrop(kp.publicKey, 1e9);
      await connection.confirmTransaction(sig, "confirmed");
    } catch (e: any) {
      console.log(`[wallet] airdrop attempt failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
    balance = await connection.getBalance(kp.publicKey);
    console.log(`[wallet] balance now: ${balance / 1e9} SOL`);
  }
  if (balance === 0) {
    throw new Error(
      `Devnet wallet ${kp.publicKey.toBase58()} has zero SOL and the public faucet is unavailable. ` +
        `Fund it manually at https://faucet.solana.com and re-run.`
    );
  }
}

async function subscribeAndActivate(connection: Connection, kp: Keypair): Promise<{ jwt: string; apiToken: string }> {
  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(root, "scripts", "vendor", "txoracle.idl.json"), "utf8"));
  const program = new anchor.Program(idl, provider);

  const userTokenAccountAddress = getAssociatedTokenAddressSync(TOKEN_MINT, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);

  let userTokenAccount;
  try {
    userTokenAccount = await getAccount(connection, userTokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log(`[token] ATA already exists: ${userTokenAccountAddress.toBase58()}`);
  } catch {
    console.log(`[token] creating Token-2022 ATA ${userTokenAccountAddress.toBase58()}`);
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        kp.publicKey,
        userTokenAccountAddress,
        kp.publicKey,
        TOKEN_MINT,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, createAtaTx, [kp], { commitment: "confirmed" });
    userTokenAccount = await getAccount(connection, userTokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log("[token] ATA created");
  }

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], PROGRAM_ID);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TOKEN_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID);

  console.log("[subscribe] serviceLevelId=1 (World Cup free tier), weeks=4");
  const subscribeTx = await program.methods
    .subscribe(1, 4)
    .accounts({
      user: kp.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TOKEN_MINT,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  subscribeTx.recentBlockhash = latestBlockhash.blockhash;
  subscribeTx.feePayer = kp.publicKey;
  subscribeTx.sign(kp);
  const txSig = await connection.sendRawTransaction(subscribeTx.serialize());
  await connection.confirmTransaction(
    { signature: txSig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
    "confirmed"
  );
  console.log(`[subscribe] confirmed tx: ${txSig}`);
  console.log(`[subscribe] explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);

  console.log("[auth] requesting guest JWT...");
  const jwtRes = await axios.post(JWT_URL);
  const jwt = jwtRes.data.token;
  console.log("[auth] got guest JWT");

  const leagues: number[] = [];
  const messageString = `${txSig}:${leagues.join(",")}:${jwt}`;
  const messageBytes = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(messageBytes, kp.secretKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

  console.log("[auth] activating API token...");
  const activationRes = await axios.post(
    `${API_BASE_URL}/token/activate`,
    { txSig, walletSignature: signatureBase64, leagues },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  const apiToken: string = activationRes.data.token ?? activationRes.data.apiToken ?? activationRes.data;
  console.log("[auth] got API token");

  save("auth_activation_response.json", {
    txSig,
    ...(typeof activationRes.data === "object" ? activationRes.data : { token: activationRes.data }),
  });

  return { jwt, apiToken };
}

async function getCredentials(connection: Connection, kp: Keypair): Promise<{ jwt: string; apiToken: string }> {
  if (fs.existsSync(credsPath)) {
    console.log("[auth] reusing cached jwt/apiToken from scripts/vendor/recon-credentials.json");
    return JSON.parse(fs.readFileSync(credsPath, "utf8"));
  }
  const creds = await subscribeAndActivate(connection, kp);
  fs.mkdirSync(path.dirname(credsPath), { recursive: true });
  fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
  return creds;
}

function trimScores(fixtureId: number, scores: any[]) {
  const interesting = scores.filter((r) => ["game_finalised", "halftime_finalised", "goal", "kickoff"].includes(r.Action));
  const head = scores.slice(0, 3);
  const tail = scores.slice(-3);
  const seen = new Set<string>();
  const combined = [...head, ...interesting, ...tail].filter((r) => {
    const key = `${r.Id}:${r.Seq}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  combined.sort((a, b) => a.Seq - b.Seq);
  return {
    _note: `Trimmed sample: ${combined.length} of ${scores.length} total records from the real devnet /api/scores/snapshot/${fixtureId} response. Kept the first/last few plus key lifecycle events (kickoff, halftime_finalised, goal, game_finalised).`,
    records: combined,
  };
}

function trimOdds(fixtureId: number, odds: any[]) {
  const byType: Record<string, any[]> = {};
  for (const r of odds) (byType[r.SuperOddsType] ??= []).push(r);
  const sample = Object.values(byType).flatMap((arr) => [...arr.slice(0, 8), ...arr.slice(-8)]);
  return {
    _note: `Trimmed sample: ${sample.length} of ${odds.length} total records from the real devnet /api/odds/updates/${fixtureId} response. Kept the first/last 8 records of each SuperOddsType to show the shape without bloating the repo.`,
    types: Object.keys(byType),
    records: sample,
  };
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const kp = await loadOrCreateWallet();
  await ensureFunded(connection, kp);
  const { jwt, apiToken } = await getCredentials(connection, kp);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });

  console.log("[fixtures] fetching snapshot...");
  const fixturesRes = await api.get("/fixtures/snapshot");
  save("fixtures_snapshot.json", fixturesRes.data);
  const fixtures = fixturesRes.data as any[];
  console.log(`[fixtures] got ${fixtures.length} fixtures`);

  const worldCupFixtures = fixtures.filter((f) => f.Competition === "World Cup");
  const uniqueCandidates = [...new Set([...worldCupFixtures, ...fixtures].map((f) => f.FixtureId))];
  console.log(`[fixtures] candidate fixtureIds to probe for a finished match: ${uniqueCandidates.join(", ")}`);

  // /api/scores/snapshot/{fixtureId} returns the fixture's full event log on
  // this devnet (not just a live cache window, despite the endpoint name) —
  // find one that has reached action=game_finalised / statusId=100.
  let chosenFixtureId: number | undefined;
  let finalRecord: any;
  let allScores: any[] = [];

  for (const fixtureId of uniqueCandidates) {
    try {
      const res = await api.get(`/scores/snapshot/${fixtureId}`);
      const scores = res.data as any[];
      const final = Array.isArray(scores) ? scores.find((r) => r.Action === "game_finalised" && r.StatusId === 100) : undefined;
      if (final) {
        console.log(`[scores] fixtureId=${fixtureId} is finished: seq=${final.Seq}, ts=${final.Ts}`);
        chosenFixtureId = fixtureId;
        finalRecord = final;
        allScores = scores;
        break;
      }
      console.log(`[scores] fixtureId=${fixtureId}: ${Array.isArray(scores) ? scores.length : 0} records, not finished yet`);
    } catch (e: any) {
      console.log(`[scores] fixtureId=${fixtureId} failed: ${e.response?.status}`);
    }
  }

  if (!chosenFixtureId) {
    chosenFixtureId = uniqueCandidates[0];
    console.log(`[scores] no finished fixture found; falling back to fixtureId=${chosenFixtureId} for shape-only samples`);
  } else {
    save("scores_snapshot.json", trimScores(chosenFixtureId, allScores));
  }

  console.log(`[odds] fetching snapshot for fixtureId=${chosenFixtureId}...`);
  try {
    const res = await api.get(`/odds/snapshot/${chosenFixtureId}`);
    const records = res.data as any[];
    save("odds_snapshot.json", {
      _note:
        records.length === 0
          ? `Real response from devnet /api/odds/snapshot/${chosenFixtureId}: empty array. This endpoint only serves a live in-play cache window and returns [] once a fixture is over; use /odds/updates/{fixtureId} for the full historical odds log instead (see odds_updates.json).`
          : `Real response from devnet /api/odds/snapshot/${chosenFixtureId}.`,
      records,
    });
  } catch (e: any) {
    console.log(`[odds] snapshot failed: ${e.response?.status}`);
  }

  console.log(`[odds] fetching full updates history for fixtureId=${chosenFixtureId}...`);
  let firstOddsRecord: any;
  try {
    const res = await api.get(`/odds/updates/${chosenFixtureId}`);
    const odds = res.data as any[];
    console.log(`[odds] got ${odds.length} records`);
    firstOddsRecord = odds[0];
    save("odds_updates.json", trimOdds(chosenFixtureId, odds));
  } catch (e: any) {
    console.log(`[odds] updates failed: ${e.response?.status}`);
  }

  if (finalRecord) {
    console.log("[validation] fetching stat-validation proof for the real finished match (statKeys=1,2 = total goals)...");
    try {
      const res = await api.get("/scores/stat-validation", {
        params: { fixtureId: chosenFixtureId, seq: finalRecord.Seq, statKeys: "1,2" },
      });
      save("scores_stat_validation.json", res.data);
    } catch (e: any) {
      console.log(`[validation] stat-validation failed: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }

    const epochDay = Math.floor(finalRecord.Ts / 86_400_000);
    const hourOfDay = new Date(finalRecord.Ts).getUTCHours();
    console.log(`[fixtures] batch-validation epochDay=${epochDay} hourOfDay=${hourOfDay}...`);
    try {
      const res = await api.get("/fixtures/batch-validation", { params: { epochDay, hourOfDay } });
      save("fixtures_batch_validation.json", res.data);
    } catch (e: any) {
      console.log(`[fixtures] batch-validation failed: ${e.response?.status}`);
    }
  } else {
    console.log("[validation] no finished fixture available; trying documented example fixtureId=17952170 seq=941...");
    try {
      const res = await api.get("/scores/stat-validation", {
        params: { fixtureId: 17952170, seq: 941, statKeys: "1,2" },
      });
      save("scores_stat_validation_example.json", res.data);
    } catch (e: any) {
      console.log(`[validation] example stat-validation failed: ${e.response?.status}`);
    }
  }

  console.log("[fixtures] fetching validation proof...");
  try {
    const res = await api.get("/fixtures/validation", { params: { fixtureId: chosenFixtureId } });
    save("fixtures_validation.json", res.data);
  } catch (e: any) {
    console.log(`[fixtures] validation failed: ${e.response?.status}`);
  }

  if (firstOddsRecord) {
    console.log("[odds] fetching validation proof for a real odds message...");
    try {
      const res = await api.get("/odds/validation", {
        params: { messageId: firstOddsRecord.MessageId, ts: firstOddsRecord.Ts },
      });
      save("odds_validation.json", res.data);
    } catch (e: any) {
      console.log(`[odds] validation failed: ${e.response?.status}`);
    }
  }

  console.log("\n[done] recon complete.");
  console.log(`walletPublicKey=${kp.publicKey.toBase58()}`);
  if (chosenFixtureId) console.log(`chosenFixtureId=${chosenFixtureId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
