"use client";

import { useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";

/**
 * Drives the connection status pill (Live / Reconnecting / Replay) per
 * MASTER_PLAN §3.1. "Replay" here doubles as the demo's "Live" - it's
 * always the replay simulator's feed, framed as live match data the way the
 * real product would show it.
 */
export type StreamStatus = "connecting" | "live" | "reconnecting";

const REPLAY_BASE_URL = process.env.NEXT_PUBLIC_REPLAY_URL ?? "http://localhost:4001";
const FLUSH_INTERVAL_MS = 250; // batch SSE-driven state updates, MASTER_PLAN §3.2
const MAX_HISTORY = 50;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15_000;

/**
 * Subscribes to the local replay simulator's SSE stream (native browser
 * `EventSource`, not the SDK's Node-only `streamOdds`/`streamScores` - see
 * Phase 4 plan decision 4). Malformed events are zod-validated, logged, and
 * dropped without touching UI state (reliability gate); a bounded rolling
 * history is kept as last-known-good data rather than blanking on
 * disconnect.
 */
export function useReplayChannel<T>(channel: "odds" | "scores", fixtureId: number, schema: ZodType<T>) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [history, setHistory] = useState<T[]>([]);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    let es: EventSource | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setInterval> | undefined;
    let backoffMs = BASE_BACKOFF_MS;
    let batch: T[] = [];
    let stopped = false;

    function connect() {
      if (stopped) return;
      setStatus((prev) => (prev === "live" ? prev : "connecting"));
      const url = `${REPLAY_BASE_URL}/api/${channel}/stream?fixtureId=${fixtureId}`;
      es = new EventSource(url);

      es.addEventListener("data", (event) => {
        const messageEvent = event as MessageEvent<string>;
        try {
          const parsed = schemaRef.current.parse(JSON.parse(messageEvent.data));
          batch.push(parsed);
        } catch (e) {
          console.warn(`[replayStream:${channel}] dropped a malformed event`, e);
        }
      });

      es.addEventListener("heartbeat", () => {
        backoffMs = BASE_BACKOFF_MS;
        setStatus("live");
      });

      es.onopen = () => {
        backoffMs = BASE_BACKOFF_MS;
        setStatus("live");
      };

      es.onerror = () => {
        es?.close();
        if (stopped) return;
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      };
    }

    flushTimer = setInterval(() => {
      if (batch.length === 0) return;
      const toFlush = batch;
      batch = [];
      setHistory((prev) => [...prev, ...toFlush].slice(-MAX_HISTORY));
    }, FLUSH_INTERVAL_MS);

    connect();

    return () => {
      stopped = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearInterval(flushTimer);
    };
  }, [channel, fixtureId]);

  return { status, history, latest: history[history.length - 1] };
}
