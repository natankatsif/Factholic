import { loadFixture } from "../../../components/cabinet/fixtures";
import { DemoProvider, LiveQuestions } from "../../../components/cabinet/Live";
import { QuestionsScreen } from "../../../components/cabinet/QuestionsScreen";
import type { ClaimScope } from "../../../components/cabinet/types";

const SCOPES: ClaimScope[] = ["all", "mine", "watched", "running", "ungrouped"];

export default function CabinetQuestionsPage({
  searchParams,
}: {
  searchParams: { fixture?: string; scope?: string };
}) {
  const scope = SCOPES.find((item) => item === searchParams.scope) ?? "all";
  const fixture = loadFixture(searchParams.fixture, "questions");
  if (!fixture) return <LiveQuestions scope={scope} />;
  return (
    <DemoProvider fixture={fixture}>
      <QuestionsScreen fixture={fixture} scope={scope} />
    </DemoProvider>
  );
}
