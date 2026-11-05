import { loadFixture } from "../../../components/cabinet/fixtures";
import { DemoProvider, LiveWatches } from "../../../components/cabinet/Live";
import { WatchesScreen } from "../../../components/cabinet/WatchesScreen";

export default function CabinetWatchesPage({ searchParams }: { searchParams: { fixture?: string } }) {
  const fixture = loadFixture(searchParams.fixture, "watch-list");
  if (!fixture) return <LiveWatches />;
  return (
    <DemoProvider fixture={fixture}>
      <WatchesScreen fixture={fixture} />
    </DemoProvider>
  );
}
