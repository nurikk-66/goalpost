/**
 * Bundled, not fetched live: this repo has one fixture with a real recorded
 * replay feed and a real captured settlement proof (18222446). A live,
 * authenticated `getFixtures()` call on every page load would add a flaky
 * external dependency for a page that's otherwise just static (reliability
 * gate, MASTER_PLAN §3.1) - see Phase 4 plan decision 7. Real data, trimmed
 * from fixtures/samples/fixtures_snapshot.json (Phase 0 recon).
 */
export interface DemoFixture {
  fixtureId: number;
  competition: string;
  participant1: string;
  participant2: string;
  startTime: string;
  /** Has a recorded replay feed (apps/replay/samples/match1.jsonl) + a real captured settlement proof - the only one with an interactive market page. */
  interactive: boolean;
  finalScore?: { home: number; away: number };
}

export const FIXTURES: DemoFixture[] = [
  {
    fixtureId: 18222446,
    competition: "World Cup",
    participant1: "Argentina",
    participant2: "Switzerland",
    startTime: "2026-07-12T01:00:00Z",
    interactive: true,
    finalScore: { home: 3, away: 1 },
  },
  {
    fixtureId: 18237038,
    competition: "World Cup",
    participant1: "France",
    participant2: "Spain",
    startTime: "2026-07-14T19:00:00Z",
    interactive: false,
  },
  {
    fixtureId: 18241006,
    competition: "World Cup",
    participant1: "England",
    participant2: "Argentina",
    startTime: "2026-07-15T19:00:00Z",
    interactive: false,
  },
  {
    fixtureId: 18143850,
    competition: "Friendlies",
    participant1: "Vietnam",
    participant2: "Myanmar",
    startTime: "2026-07-18T15:00:00Z",
    interactive: false,
  },
];

export function getFixture(fixtureId: number): DemoFixture | undefined {
  return FIXTURES.find((f) => f.fixtureId === fixtureId);
}
