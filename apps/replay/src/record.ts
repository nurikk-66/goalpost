// Records a real, finished TxLINE match to a JSONL file: one full sweep of
// its scores + odds history, merged and sorted by timestamp. This is the
// "record" half of the replay simulator - the other half (server.ts) plays
// the file back as a local SSE server at a configurable speed.
//
// Reuses the devnet credentials from Phase 0's recon (scripts/vendor/) so we
// don't repeat the on-chain subscribe/activate flow here. packages/sdk
// (Phase 3) will formalize this into a proper TxLINE client; this stays
// deliberately small since its only job is producing samples/*.jsonl.
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import type { RecordedEvent } from "./types.js";

const API_BASE_URL = "https://txline-dev.txodds.com/api";
const root = path.resolve(import.meta.dirname, "../../..");
const credsPath = path.join(root, "scripts", "vendor", "recon-credentials.json");

function loadCredentials(): { jwt: string; apiToken: string } {
  if (!fs.existsSync(credsPath)) {
    throw new Error(
      `No cached TxLINE credentials at ${credsPath}. Run "npx tsx scripts/recon.ts" from the repo root first ` +
        `(Phase 0) to complete the on-chain subscribe + activation flow.`
    );
  }
  return JSON.parse(fs.readFileSync(credsPath, "utf8"));
}

export async function record(fixtureId: number, outFile: string): Promise<void> {
  const { jwt, apiToken } = loadCredentials();
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });

  console.log(`[record] fetching scores for fixtureId=${fixtureId}...`);
  const scoresRes = await api.get(`/scores/snapshot/${fixtureId}`);
  const scores = scoresRes.data as any[];
  console.log(`[record] got ${scores.length} score events`);

  console.log(`[record] fetching odds for fixtureId=${fixtureId}...`);
  const oddsRes = await api.get(`/odds/updates/${fixtureId}`);
  const allOdds = oddsRes.data as any[];
  console.log(`[record] got ${allOdds.length} odds events total (includes multi-day pre-match drift)`);

  // Both the scores and odds feeds carry multi-day pre-match noise (jersey
  // colors, coverage setup, market drift). For a "watch the match live" demo
  // we only want the actual live window: scheduled kickoff (StartTime) minus
  // a short pre-match buffer, through full-time (the game_finalised record)
  // plus a short buffer.
  const finalEvent = scores.find((s) => s.Action === "game_finalised" && s.StatusId === 100);
  const startTime = scores[0]?.StartTime;
  if (!finalEvent || !startTime) {
    throw new Error(`fixtureId=${fixtureId} has no game_finalised record yet or is missing StartTime - not a finished match`);
  }
  const windowStart = startTime - 15 * 60_000;
  const windowEnd = finalEvent.Ts + 5 * 60_000;
  const liveScores = scores.filter((s) => s.Ts >= windowStart && s.Ts <= windowEnd);
  // Goalpost only offers a home/draw/away market (MASTER_PLAN section 1), so
  // only the 1X2 odds line matters - the feed also carries Asian handicap and
  // over/under ticks at a much higher frequency that would triple the file
  // size for a market we don't use.
  const odds = allOdds.filter((o) => o.Ts >= windowStart && o.Ts <= windowEnd && o.SuperOddsType === "1X2_PARTICIPANT_RESULT");
  console.log(
    `[record] windowed to live match window [${new Date(windowStart).toISOString()}, ${new Date(windowEnd).toISOString()}]: ${liveScores.length} scores, ${odds.length} 1X2 odds`
  );

  const events: RecordedEvent[] = [
    ...liveScores.map((data): RecordedEvent => ({ ts: data.Ts, channel: "scores", data })),
    ...odds.map((data): RecordedEvent => ({ ts: data.Ts, channel: "odds", data })),
  ].sort((a, b) => a.ts - b.ts);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const lines = events.map((e) => JSON.stringify(e));
  fs.writeFileSync(outFile, lines.join("\n") + "\n");
  console.log(
    `[record] wrote ${events.length} events (${liveScores.length}/${scores.length} scores + ${odds.length}/${allOdds.length} odds) to ${outFile}`
  );
  console.log(
    `[record] match spans ${new Date(events[0].ts).toISOString()} -> ${new Date(events[events.length - 1].ts).toISOString()}`
  );
}
