import BN from "bn.js";

/** Raw shape returned by `GET /api/scores/stat-validation` (V2, 2-stat form) - see docs/TXLINE_NOTES.md §6. */
export interface TxLineStatValidationResponseV2 {
  ts: number;
  summary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    eventStatsSubTreeRoot: number[];
  };
  subTreeProof: { hash: number[]; isRightSibling: boolean }[];
  mainTreeProof: { hash: number[]; isRightSibling: boolean }[];
  eventStatRoot: number[];
  statsToProve: { key: number; value: number; period: number }[];
  statProofs: { hash: number[]; isRightSibling: boolean }[][];
}

function proofNodes(nodes: { hash: number[]; isRightSibling: boolean }[]) {
  return nodes.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling }));
}

/**
 * Maps a real `/scores/stat-validation` REST response (camelCase, field
 * names per docs/TXLINE_NOTES.md §6) into `settle()`'s instruction argument
 * shape. This mapping is real and non-obvious - the REST field names differ
 * from the on-chain IDL's (`summary.eventStatsSubTreeRoot` REST vs
 * `eventsSubTreeRoot` IDL arg; `subTreeProof` REST vs `fixtureProof` IDL
 * arg) - see docs/OPEN_QUESTIONS.md "Answered" for how this was confirmed.
 * Byte-array fields (`eventStatRoot`, proof `hash`es) already arrive as
 * plain `number[]` from this endpoint, not base64/hex - no decoding needed.
 */
export function settleArgsFromProof(proof: TxLineStatValidationResponseV2) {
  return {
    ts: new BN(proof.ts),
    fixtureSummary: {
      fixtureId: new BN(proof.summary.fixtureId),
      updateStats: {
        updateCount: proof.summary.updateStats.updateCount,
        minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: proof.summary.eventStatsSubTreeRoot,
    },
    fixtureProof: proofNodes(proof.subTreeProof),
    mainTreeProof: proofNodes(proof.mainTreeProof),
    eventStatRoot: proof.eventStatRoot,
    // statKeys=1,2 (home goals, away goals) is Goalpost's fixed request order
    // for a home/draw/away market (docs/TXLINE_NOTES.md §4) - index 0/1 here
    // are always home/away, not a general N-stat mapping.
    homeStat: {
      stat: proof.statsToProve[0],
      statProof: proofNodes(proof.statProofs[0]),
    },
    awayStat: {
      stat: proof.statsToProve[1],
      statProof: proofNodes(proof.statProofs[1]),
    },
  };
}

export type SettleArgs = ReturnType<typeof settleArgsFromProof>;
