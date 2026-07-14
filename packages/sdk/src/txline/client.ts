import axios, { type AxiosInstance } from "axios";
import { TXLINE_API_BASE_URL } from "../constants.js";
import { parseTxLineHttpError } from "../errors.js";
import { settleArgsFromProof, type SettleArgs, type TxLineStatValidationResponseV2 } from "../proof.js";

export interface TxLineClientOptions {
  /** Defaults to the real TxLINE devnet host - pass a local replay server URL (e.g. `http://localhost:4001`) to consume `apps/replay` instead. */
  baseUrl?: string;
  /** Required for real TxLINE REST calls (`getFixtures`, `getResultWithProof`). Not checked by the local replay server - omit when only streaming from it. */
  jwt?: string;
  apiToken?: string;
}

export interface Fixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: string;
  GameState: number;
  Competition?: string;
}

export interface ResultWithProof {
  fixtureId: number;
  ts: number;
  homeGoals: number;
  awayGoals: number;
  seq: number;
  /** Raw REST response, in case a caller wants the untransformed proof. */
  proof: TxLineStatValidationResponseV2;
  /** Ready to pass straight into `settle()`. */
  settleArgs: SettleArgs;
}

/**
 * Thin wrapper over the TxLINE REST/SSE API (docs/TXLINE_NOTES.md §3).
 * Requires an already-activated session - see `authenticateTxLine()` to
 * obtain one from a funded devnet wallet.
 */
export class TxLineClient {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(opts: TxLineClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? TXLINE_API_BASE_URL;
    this.http = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: opts.jwt || opts.apiToken ? { Authorization: `Bearer ${opts.jwt}`, "X-Api-Token": opts.apiToken } : undefined,
    });
  }

  /** `GET /api/fixtures/snapshot`, optionally filtered to one competition. */
  async getFixtures(competitionId?: number): Promise<Fixture[]> {
    try {
      const res = await this.http.get<Fixture[]>("/fixtures/snapshot", {
        params: competitionId !== undefined ? { competitionId } : undefined,
      });
      return res.data;
    } catch (e) {
      throw parseTxLineHttpError(e);
    }
  }

  /**
   * Finds `fixtureId`'s finalized full-time result and fetches the real
   * Merkle proof for it (`statKeys=1,2` - home/away total goals, per
   * docs/TXLINE_NOTES.md §4), pre-mapped into `settle()`'s argument shape.
   * Throws if the fixture hasn't reached `game_finalised` / `statusId=100`
   * yet - only a finished match has a final-result proof to fetch.
   */
  async getResultWithProof(fixtureId: number): Promise<ResultWithProof> {
    let finalRecord: { Seq: number; Ts: number } | undefined;
    try {
      const res = await this.http.get<any[]>(`/scores/snapshot/${fixtureId}`);
      finalRecord = res.data.find((r) => r.Action === "game_finalised" && r.StatusId === 100);
    } catch (e) {
      throw parseTxLineHttpError(e);
    }
    if (!finalRecord) {
      throw new Error(`fixtureId ${fixtureId} has not reached game_finalised yet - no final result to prove.`);
    }

    let proof: TxLineStatValidationResponseV2;
    try {
      const res = await this.http.get<TxLineStatValidationResponseV2>("/scores/stat-validation", {
        params: { fixtureId, seq: finalRecord.Seq, statKeys: "1,2" },
      });
      proof = res.data;
    } catch (e) {
      throw parseTxLineHttpError(e);
    }

    return {
      fixtureId,
      ts: finalRecord.Ts,
      homeGoals: proof.statsToProve[0].value,
      awayGoals: proof.statsToProve[1].value,
      seq: finalRecord.Seq,
      proof,
      settleArgs: settleArgsFromProof(proof),
    };
  }

  /** SSE odds stream (`GET /api/odds/stream`), yielding decoded records as they arrive. */
  streamOdds(opts: { fixtureId?: number; signal?: AbortSignal } = {}): AsyncGenerator<unknown> {
    return this.stream("/odds/stream", opts);
  }

  /** SSE scores stream (`GET /api/scores/stream`), yielding decoded records as they arrive. */
  streamScores(opts: { fixtureId?: number; signal?: AbortSignal } = {}): AsyncGenerator<unknown> {
    return this.stream("/scores/stream", opts);
  }

  private async *stream(path: string, opts: { fixtureId?: number; signal?: AbortSignal }): AsyncGenerator<unknown> {
    const response = await this.http.get(path, {
      params: opts.fixtureId !== undefined ? { fixtureId: opts.fixtureId } : undefined,
      headers: { Accept: "text/event-stream" },
      responseType: "stream",
      signal: opts.signal,
    });

    let buffer = "";
    for await (const chunk of response.data as AsyncIterable<Buffer>) {
      buffer += chunk.toString("utf8");
      let sep: number;
      // SSE frames are terminated by a blank line; the replay server (and
      // TxLINE's own stream, per docs/TXLINE_NOTES.md §3) write `data:`
      // then `event:` (order isn't significant, only both-before-blank-line).
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let eventName = "message";
        let dataLine: string | undefined;
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice("event:".length).trim();
          else if (line.startsWith("data:")) dataLine = line.slice("data:".length).trim();
        }
        if (eventName === "heartbeat" || !dataLine) continue;
        yield JSON.parse(dataLine);
      }
    }
  }
}
