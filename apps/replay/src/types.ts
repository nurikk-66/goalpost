// One line of a recorded match JSONL file. `channel` mirrors which TxLINE SSE
// endpoint the payload came from, so replay can serve /api/scores/stream and
// /api/odds/stream separately, exactly like the real API.
export type RecordedEvent = {
  ts: number; // original TxLINE event timestamp, ms since epoch
  channel: "scores" | "odds";
  data: unknown; // raw TxLINE record, unmodified
};
