import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { settleArgsFromProof, type TxLineStatValidationResponseV2 } from "../src/proof.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real captured proof (Phase 0 recon): Argentina 3-1 Switzerland,
// fixtureId 18222446, seq 1306 - see docs/TXLINE_NOTES.md §9. Encoding
// correctness against real data matters more here than a synthetic fixture:
// this is the exact REST->on-chain field mapping settle() depends on.
const realProof: TxLineStatValidationResponseV2 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "..", "fixtures", "samples", "scores_stat_validation.json"), "utf8")
);

describe("settleArgsFromProof", () => {
  const args = settleArgsFromProof(realProof);

  it("maps ts and fixture summary from REST camelCase into the IDL's field names", () => {
    expect(args.ts.toString()).toBe("1783828222499");
    expect(args.fixtureSummary.fixtureId.toString()).toBe("18222446");
    expect(args.fixtureSummary.updateStats.updateCount).toBe(1);
    expect(args.fixtureSummary.updateStats.minTimestamp.toString()).toBe("1783828222499");
    // REST `summary.eventStatsSubTreeRoot` -> IDL `eventsSubTreeRoot` (name differs, not just cased).
    expect(args.fixtureSummary.eventsSubTreeRoot).toEqual(realProof.summary.eventStatsSubTreeRoot);
  });

  it("maps subTreeProof/mainTreeProof into fixtureProof/mainTreeProof proof-node arrays", () => {
    expect(args.fixtureProof).toEqual(realProof.subTreeProof.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling })));
    expect(args.mainTreeProof).toEqual(realProof.mainTreeProof.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling })));
  });

  it("passes byte-array fields through unchanged (already plain number[], not base64/hex)", () => {
    expect(args.eventStatRoot).toEqual(realProof.eventStatRoot);
    expect(args.eventStatRoot).toHaveLength(32);
  });

  it("maps statsToProve[0]/statProofs[0] to homeStat and [1] to awayStat (fixed statKeys=1,2 order)", () => {
    expect(args.homeStat.stat).toEqual({ key: 1, value: 3, period: 100 });
    expect(args.awayStat.stat).toEqual({ key: 2, value: 1, period: 100 });
    expect(args.homeStat.statProof).toHaveLength(realProof.statProofs[0].length);
    expect(args.awayStat.statProof).toHaveLength(realProof.statProofs[1].length);
  });

  it("real final score is Argentina 3 - Switzerland 1, matching docs/TXLINE_NOTES.md §9", () => {
    expect(args.homeStat.stat.value).toBe(3);
    expect(args.awayStat.stat.value).toBe(1);
    expect(args.homeStat.stat.period).toBe(100);
    expect(args.awayStat.stat.period).toBe(100);
  });
});
