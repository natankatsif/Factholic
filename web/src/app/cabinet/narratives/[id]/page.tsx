import { loadFixture } from "../../../../components/cabinet/fixtures";
import { DemoProvider, LiveNarrative } from "../../../../components/cabinet/Live";
import { NarrativeScreen } from "../../../../components/cabinet/NarrativeScreen";

export default function CabinetNarrativePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fixture?: string };
}) {
  const fixture = loadFixture(searchParams.fixture, "narrative");
  if (!fixture) return <LiveNarrative id={params.id} />;
  return (
    <DemoProvider fixture={fixture}>
      <NarrativeScreen fixture={fixture} />
    </DemoProvider>
  );
}
