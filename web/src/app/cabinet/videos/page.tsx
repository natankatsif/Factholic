import { loadFixture } from "../../../components/cabinet/fixtures";
import { DemoProvider, LiveVideos } from "../../../components/cabinet/Live";
import { VideosScreen } from "../../../components/cabinet/VideosScreen";

export default function CabinetVideosPage({ searchParams }: { searchParams: { fixture?: string } }) {
  const fixture = loadFixture(searchParams.fixture, "questions");
  if (!fixture) return <LiveVideos />;
  return (
    <DemoProvider fixture={fixture}>
      <VideosScreen fixture={fixture} />
    </DemoProvider>
  );
}
