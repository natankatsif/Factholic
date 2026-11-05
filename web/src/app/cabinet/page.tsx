import { loadFixture } from "../../components/cabinet/fixtures";
import { HomeScreen } from "../../components/cabinet/HomeScreen";
import { DemoProvider, LiveHome } from "../../components/cabinet/Live";

export default function CabinetPage({
  searchParams,
}: {
  searchParams: { fixture?: string; noClaims?: string };
}) {
  const fixture = loadFixture(searchParams.fixture, "empty");
  if (!fixture) return <LiveHome noClaimsCheck={searchParams.noClaims} />;
  return (
    <DemoProvider fixture={fixture}>
      <HomeScreen fixture={fixture} />
    </DemoProvider>
  );
}
