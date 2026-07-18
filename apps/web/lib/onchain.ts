import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export const DEMO_MINT_DECIMALS = 6;

/**
 * Creates a fresh SPL token mint for one demo round, with the connected
 * wallet as mint authority - this demo has no backend signer (Phase 4 plan
 * decision 1/2: one connected wallet plays creator, backer, locker, and
 * settler), so minting the escrow token is a client-signed transaction too.
 */
export async function createDemoMint(connection: Connection, wallet: WalletContextState): Promise<PublicKey> {
  if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Wallet not connected");

  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mintKeypair.publicKey, DEMO_MINT_DECIMALS, wallet.publicKey, null)
  );

  const signature = await wallet.sendTransaction(tx, connection, { signers: [mintKeypair] });
  await connection.confirmTransaction(signature, "confirmed");
  return mintKeypair.publicKey;
}

/**
 * Ensures `owner`'s ATA for `mint` exists and mints `amount` (base units)
 * into it, in a single wallet-signed transaction (idempotent ATA creation +
 * mint-to, so this is safe to call even if the ATA already exists).
 */
export async function ensureFundedAta(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  owner: PublicKey,
  amount: number
): Promise<PublicKey> {
  if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Wallet not connected");

  const ata = getAssociatedTokenAddressSync(mint, owner);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, owner, mint),
    createMintToInstruction(mint, ata, wallet.publicKey, amount)
  );

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return ata;
}
