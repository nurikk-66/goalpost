import { describe, expect, it } from "vitest";
import { parseGoalpostError, parseTxLineHttpError } from "../src/errors.js";

describe("parseGoalpostError", () => {
  it("matches a typed AnchorError's errorCode.code", () => {
    const err = { error: { errorCode: { code: "NothingToClaim" } }, message: "AnchorError..." };
    expect(parseGoalpostError(err).name).toBe("NothingToClaim");
  });

  it("falls back to scanning message + logs for a real devnet failure whose top-level message is generic", () => {
    // Real shape observed against devnet (docs/OPEN_QUESTIONS.md): a failed
    // CPI often surfaces as "Simulation failed" with the real error only in
    // program logs, not the top-level message.
    const err = {
      message: "Simulation failed.",
      logs: ["Program log: Instruction: Settle", "Program log: AnchorError thrown: StatValidationFailed"],
    };
    expect(parseGoalpostError(err).name).toBe("StatValidationFailed");
  });

  it("recognizes TxLINE's own error name as equally valid evidence (see docs/OPEN_QUESTIONS.md)", () => {
    // InvalidStatProof isn't one of ours (it's TxLINE's), so it should not
    // match any GoalpostErrorName - confirming the union stays scoped to
    // our own program's errors rather than silently absorbing TxLINE's.
    const err = { message: "AnchorError ... Error Code: InvalidStatProof" };
    expect(parseGoalpostError(err).name).toBe("Unknown");
  });

  it("returns Unknown for an unrelated error without swallowing it", () => {
    const err = new Error("network timeout");
    const parsed = parseGoalpostError(err);
    expect(parsed.name).toBe("Unknown");
    expect(parsed.cause).toBe(err);
  });
});

describe("parseTxLineHttpError", () => {
  it("maps 504 to network_mismatch", () => {
    expect(parseTxLineHttpError({ response: { status: 504 } }).kind).toBe("network_mismatch");
  });

  it("maps 403 with a signature-related body to signature_verification_failed", () => {
    const err = { response: { status: 403, data: "signature verification failed" } };
    expect(parseTxLineHttpError(err).kind).toBe("signature_verification_failed");
  });

  it("maps a bare 403 (no signature mention) to forbidden", () => {
    expect(parseTxLineHttpError({ response: { status: 403, data: "expired subscription" } }).kind).toBe("forbidden");
  });

  it("maps 401 to unauthorized", () => {
    expect(parseTxLineHttpError({ response: { status: 401 } }).kind).toBe("unauthorized");
  });

  it("maps an IncompleteStatCoverage body to incomplete_stat_coverage regardless of status", () => {
    const err = { response: { status: 400, data: { error: "IncompleteStatCoverage" } } };
    expect(parseTxLineHttpError(err).kind).toBe("incomplete_stat_coverage");
  });

  it("falls back to unknown for anything else", () => {
    expect(parseTxLineHttpError(new Error("ECONNRESET")).kind).toBe("unknown");
  });
});
