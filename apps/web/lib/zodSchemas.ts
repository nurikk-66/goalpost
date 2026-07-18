import { z } from "zod";

// Real shapes captured in Phase 0 (fixtures/samples/odds_updates.json,
// scores_snapshot.json) and documented in docs/TXLINE_NOTES.md §9. Only the
// fields this UI actually reads are required; everything else is
// passed through loosely rather than over-specified (nothing here validates
// fields we don't use).

export const OddsRecordSchema = z
  .object({
    FixtureId: z.number(),
    Ts: z.number(),
    SuperOddsType: z.string(),
    PriceNames: z.array(z.string()),
    Prices: z.array(z.number()),
    Pct: z.array(z.string()),
  })
  .passthrough();
export type OddsRecord = z.infer<typeof OddsRecordSchema>;

export const ScoreRecordSchema = z
  .object({
    Action: z.string(),
    Seq: z.number(),
    StatusId: z.number(),
    Ts: z.number(),
    Score: z
      .object({
        Participant1: z.object({ Total: z.object({ Goals: z.number() }).passthrough() }).passthrough(),
        Participant2: z.object({ Total: z.object({ Goals: z.number() }).passthrough() }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
export type ScoreRecord = z.infer<typeof ScoreRecordSchema>;
