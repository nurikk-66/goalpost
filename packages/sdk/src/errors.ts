/**
 * Typed program errors, mirroring `programs/goalpost/src/errors.rs`
 * (`GoalpostError`). Kept as a plain string-literal union rather than
 * generating from the IDL's error list, since the IDL only carries
 * name/code/msg - the grouping below (which errors are "expected" outcomes
 * a caller should branch on, e.g. `NothingToClaim`, vs internal bugs) is
 * domain knowledge, not something codegen can express.
 */
export const GOALPOST_ERROR_NAMES = [
  "ZeroAmount",
  "InvalidLockTime",
  "MarketNotOpen",
  "MarketAlreadyLocked",
  "LockTimeNotReached",
  "MarketNotLocked",
  "MarketNotSettled",
  "OutcomeMismatch",
  "FixtureMismatch",
  "NotFinalResult",
  "UnexpectedStatKey",
  "InvalidMerkleRootAccount",
  "StatValidationFailed",
  "AlreadyClaimed",
  "NothingToClaim",
  "Overflow",
] as const;

export type GoalpostErrorName = (typeof GOALPOST_ERROR_NAMES)[number];

export class GoalpostProgramError extends Error {
  constructor(
    public readonly name: GoalpostErrorName | "Unknown",
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
  }
}

/**
 * Anchor surfaces on-chain errors inconsistently depending on whether they
 * came from our own program or a CPI target (see `docs/OPEN_QUESTIONS.md` -
 * a genuine TxLINE proof rejection can show up as either our own
 * `StatValidationFailed` wrapper or TxLINE's own `InvalidStatProof`,
 * depending on how far execution got before failing). This walks every
 * place a name plausibly appears - `error.error.errorCode.code` (typed
 * AnchorError), `error.message`, and `error.logs` (real devnet failures
 * often truncate the top-level message and only include the program logs) -
 * rather than trusting a single field.
 */
export function parseGoalpostError(error: unknown): GoalpostProgramError {
  const anchorCode: string | undefined = (error as any)?.error?.errorCode?.code;
  const logs: string[] = Array.isArray((error as any)?.logs) ? (error as any).logs : [];
  const haystack = [anchorCode, String((error as any)?.message ?? error), ...logs].join("\n");

  const matched = GOALPOST_ERROR_NAMES.find((name) => haystack.includes(name));
  return new GoalpostProgramError(matched ?? "Unknown", matched ? `Goalpost: ${matched}` : haystack.slice(0, 500), error);
}

/**
 * TxLINE REST/SSE error modes, per docs/TXLINE_NOTES.md §7 (from the
 * sponsor's own troubleshooting doc) - mapped to a typed, human-readable
 * error instead of a generic "request failed" per MASTER_PLAN §3.1's
 * reliability requirement.
 */
export type TxLineErrorKind =
  | "network_mismatch"
  | "signature_verification_failed"
  | "unauthorized"
  | "forbidden"
  | "no_live_data"
  | "invalid_proof"
  | "invalid_seq"
  | "incomplete_stat_coverage"
  | "unknown";

export class TxLineApiError extends Error {
  constructor(
    public readonly kind: TxLineErrorKind,
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
  }
}

export function parseTxLineHttpError(error: unknown): TxLineApiError {
  const status: number | undefined = (error as any)?.response?.status;
  const body = (error as any)?.response?.data;
  const bodyText = typeof body === "string" ? body : JSON.stringify(body ?? "");

  if (status === 504) {
    return new TxLineApiError(
      "network_mismatch",
      "TxLINE activation timed out - check that the RPC cluster, program ID, JWT host, and activation URL are all the same network (mainnet vs devnet).",
      status,
      error
    );
  }
  if (status === 403 && /signature/i.test(bodyText)) {
    return new TxLineApiError(
      "signature_verification_failed",
      "TxLINE rejected the activation signature - verify the signed message is exactly `${txSig}:${leagues}:${jwt}` and signed by the subscription wallet.",
      status,
      error
    );
  }
  if (status === 401) {
    return new TxLineApiError("unauthorized", "TxLINE guest JWT missing or expired - fetch a fresh one from /auth/guest/start.", status, error);
  }
  if (status === 403) {
    return new TxLineApiError(
      "forbidden",
      "TxLINE API token invalid, subscription expired, or network mismatch - re-verify token and subscription network.",
      status,
      error
    );
  }
  if (bodyText.includes("IncompleteStatCoverage")) {
    return new TxLineApiError(
      "incomplete_stat_coverage",
      "TxLINE rejected the stat strategy - every stat referenced by `statKeys` must appear exactly once in the predicate list, in the same order.",
      status,
      error
    );
  }
  return new TxLineApiError("unknown", (error as Error)?.message ?? String(error), status, error);
}
