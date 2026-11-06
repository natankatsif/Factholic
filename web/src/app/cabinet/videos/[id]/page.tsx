import { LiveVideo } from "../../../../components/cabinet/Live";

export default function CabinetVideoPage({ params }: { params: { id: string } }) {
  return <LiveVideo id={params.id} />;
}
