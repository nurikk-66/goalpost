import { settleArgsFromProof, type TxLineStatValidationResponseV2 } from "@goalpost/sdk";
// The real captured Merkle proof for Argentina 3-1 Switzerland (Phase 0
// recon; docs/TXLINE_NOTES.md §9). Bundled rather than fetched live at
// settle time - see the Phase 4 plan, decision 3: it's still the real,
// unmodified proof the on-chain CPI verifies, just not re-fetched over the
// network on every demo run (reliability gate).
import proofJson from "../../../fixtures/samples/scores_stat_validation.json";

const proof = proofJson as unknown as TxLineStatValidationResponseV2;

export function getBundledResult() {
  return {
    homeGoals: proof.statsToProve[0].value,
    awayGoals: proof.statsToProve[1].value,
    settleArgs: settleArgsFromProof(proof),
  };
}
