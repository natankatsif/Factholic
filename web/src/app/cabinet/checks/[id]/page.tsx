import { CheckScreen } from "../../../../components/cabinet/CheckScreen";
import { loadFixture } from "../../../../components/cabinet/fixtures";
import { DemoProvider, LiveCheck } from "../../../../components/cabinet/Live";

export default function CabinetCheckPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fixture?: string; alert?: string };
}) {
  const fixture = loadFixture(searchParams.fixture, "tree-ready");
  if (!fixture?.check) return <LiveCheck id={params.id} showAlert={searchParams.alert === "1"} />;
  return (
    <DemoProvider fixture={fixture}>
      <CheckScreen key={searchParams.fixture} fixture={fixture} check={fixture.check} />
    </DemoProvider>
  );
}
