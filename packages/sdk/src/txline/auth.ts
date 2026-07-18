import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import idl from "../generated/txoracle.idl.json";
import type { Txoracle } from "../generated/txoracle.js";
import { parseTxLineHttpError } from "../errors.js";

const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT_DEVNET = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");

export interface TxLineSession {
  jwt: string;
  apiToken: string;
}

/**
 * Runs TxLINE's World Cup free-tier activation flow (docs/TXLINE_NOTES.md
 * §2): create a Token-2022 ATA for the TxL mint if needed, call the
 * on-chain `subscribe(serviceLevelId, weeks)` (free tier costs 0 tokens but
 * the on-chain call is still required), fetch a guest JWT, sign the
 * activation message, and exchange it for a long-lived API token.
 *
 * `wallet` only needs devnet SOL for transaction fees + the ATA's rent - no
 * token balance is required for the free tier. Safe to call every time
 * (`subscribe` is idempotent per the reference implementation); cache the
 * returned session yourself if you want to skip the on-chain round trip on
 * subsequent runs.
 */
export async function authenticateTxLine(
  connection: Connection,
  wallet: Keypair,
  opts: { baseUrl?: string; jwtUrl?: string; serviceLevelId?: number; weeks?: number; leagues?: number[] } = {}
): Promise<TxLineSession> {
  const baseUrl = opts.baseUrl ?? "https://txline-dev.txodds.com/api";
  const jwtUrl = opts.jwtUrl ?? "https://txline-dev.txodds.com/auth/guest/start";
  const serviceLevelId = opts.serviceLevelId ?? 1;
  const weeks = opts.weeks ?? 4;
  const leagues = opts.leagues ?? [];

  // Built by hand instead of `new anchor.Wallet(wallet)` - that class only
  // exists in Anchor's Node build (it wraps a raw Keypair via `fs`-style
  // signing), so importing it as a runtime value breaks bundling for any
  // consumer of this package that runs in a browser (e.g. apps/web), even
  // though this function itself is Node-only and never called there.
  const anchorWallet: anchor.Wallet = {
    publicKey: wallet.publicKey,
    payer: wallet,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
      if (tx instanceof VersionedTransaction) tx.sign([wallet]);
      else tx.sign(wallet);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) tx.sign([wallet]);
        else tx.sign(wallet);
      }
      return txs;
    },
  };
  const provider = new anchor.AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
  const program = new anchor.Program<Txoracle>(idl as Txoracle, provider);

  const userTokenAccountAddress = getAssociatedTokenAddressSync(TXL_MINT_DEVNET, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
  let userTokenAccount;
  try {
    userTokenAccount = await getAccount(connection, userTokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch {
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccountAddress,
        wallet.publicKey,
        TXL_MINT_DEVNET,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await anchor.web3.sendAndConfirmTransaction(connection, createAtaTx, [wallet], { commitment: "confirmed" });
    userTokenAccount = await getAccount(connection, userTokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
  }

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], TXORACLE_PROGRAM_ID);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], TXORACLE_PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT_DEVNET, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID);

  const subscribeTx = await program.methods
    .subscribe(serviceLevelId, weeks)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_MINT_DEVNET,
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
  subscribeTx.feePayer = wallet.publicKey;
  subscribeTx.sign(wallet);
  const txSig = await connection.sendRawTransaction(subscribeTx.serialize());
  await connection.confirmTransaction(
    { signature: txSig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
    "confirmed"
  );

  try {
    const jwtRes = await axios.post(jwtUrl);
    const jwt = jwtRes.data.token;

    const messageString = `${txSig}:${leagues.join(",")}:${jwt}`;
    const signatureBytes = nacl.sign.detached(new TextEncoder().encode(messageString), wallet.secretKey);
    const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

    const activationRes = await axios.post(
      `${baseUrl}/token/activate`,
      { txSig, walletSignature: signatureBase64, leagues },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    const apiToken: string = activationRes.data.token ?? activationRes.data.apiToken ?? activationRes.data;

    return { jwt, apiToken };
  } catch (e) {
    throw parseTxLineHttpError(e);
  }
}
