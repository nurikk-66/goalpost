import { notFound } from "next/navigation";
import { getFixture } from "@/lib/fixtures-data";
import { MarketExperience } from "@/components/MarketExperience";

export default async function FixturePage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const fixture = getFixture(Number(fixtureId));

  if (!fixture || !fixture.interactive) notFound();

  return <MarketExperience fixture={fixture} />;
}
