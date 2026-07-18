// Serves a recorded match JSONL file as a local SSE server, mirroring
// TxLINE's real /api/scores/stream and /api/odds/stream endpoints so the SDK
// (and anything built on it) can point at this server instead of the real
// TxLINE host and see no difference in shape or framing - just a compressed,
// repeatable timeline instead of waiting for a real match.
//
// Frame format matches what Phase 0's recon observed on the real API for
// heartbeats (`data: {...}` then `event: heartbeat`, blank line). Data-frame
// framing (`event: data`) is our best-effort match to the same style, since
// recon didn't catch a live data frame from a real in-progress match - see
// docs/OPEN_QUESTIONS.md.
import http from "node:http";
import fs from "node:fs";
import type { RecordedEvent } from "./types.js";

const HEARTBEAT_INTERVAL_MS = 15_000;
const LOOP_GAP_MS = 3_000;

function loadEvents(file: string): RecordedEvent[] {
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const events = lines.map((line) => JSON.parse(line) as RecordedEvent);
  events.sort((a, b) => a.ts - b.ts);
  return events;
}

function sseHeaders(res: http.ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // apps/web's browser client connects cross-port (Next.js dev server on
    // :3000, this replay server on :4001) via native EventSource, which is
    // subject to CORS unlike the SDK's Node-side stream consumption.
    "Access-Control-Allow-Origin": "*",
  });
}

function writeEvent(res: http.ServerResponse, eventName: string, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n`);
  res.write(`event: ${eventName}\n\n`);
}

function serveChannel(res: http.ServerResponse, channelEvents: RecordedEvent[], speed: number) {
  sseHeaders(res);

  const heartbeat = setInterval(() => {
    writeEvent(res, "heartbeat", { Ts: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);

  let closed = false;
  res.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
  });

  async function playOnce() {
    if (channelEvents.length === 0) return;
    const t0 = channelEvents[0].ts;
    let prevTs = t0;
    for (const event of channelEvents) {
      if (closed) return;
      const gapMs = (event.ts - prevTs) / speed;
      if (gapMs > 0) await sleep(gapMs);
      if (closed) return;
      writeEvent(res, "data", event.data);
      prevTs = event.ts;
    }
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  (async () => {
    while (!closed) {
      await playOnce();
      if (closed) return;
      await sleep(LOOP_GAP_MS);
    }
  })();
}

export function startServer(file: string, speed: number, port: number) {
  const events = loadEvents(file);
  const fixtureIds = new Set(events.map((e) => (e.data as any).FixtureId));
  console.log(`[replay] loaded ${events.length} events for fixtureId(s) ${[...fixtureIds].join(", ")} from ${file}`);
  console.log(`[replay] speed=${speed}x`);

  const byChannel = {
    scores: events.filter((e) => e.channel === "scores"),
    odds: events.filter((e) => e.channel === "odds"),
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/scores/stream") {
      console.log(`[replay] client connected: scores stream`);
      return serveChannel(res, byChannel.scores, speed);
    }
    if (url.pathname === "/api/odds/stream") {
      console.log(`[replay] client connected: odds stream`);
      return serveChannel(res, byChannel.odds, speed);
    }
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, events: events.length, fixtureIds: [...fixtureIds] }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found", available: ["/api/scores/stream", "/api/odds/stream", "/health"] }));
  });

  server.listen(port, () => {
    console.log(`[replay] serving on http://localhost:${port}`);
    console.log(`[replay]   GET /api/scores/stream`);
    console.log(`[replay]   GET /api/odds/stream`);
  });

  return server;
}
