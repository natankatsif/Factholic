import { LiveVideo } from "../../../../components/cabinet/Live";

export default function CabinetLinkPage({ params }: { params: { id: string } }) {
  return <LiveVideo id={params.id} kind="article" />;
}
