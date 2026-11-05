/** Скелетоны загрузки: повторяют форму экранов, текстов в них нет */
import { cn } from "../../lib/utils";

export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-border", className)} />;
}

function PanelSkeleton() {
  return (
    <aside className="-ml-px flex h-full w-[381px] shrink-0 flex-col gap-[18px] border-l-2 border-border bg-card p-[22px]">
      <Bone className="h-3 w-24" />
      <Bone className="h-5 w-56" />
      <Bone className="mt-4 h-4 w-48" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3">
          <Bone className="h-[34px] w-[34px] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-3.5 w-28" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-2/3" />
          </div>
        </div>
      ))}
      <Bone className="h-24 w-full rounded-[20px]" />
    </aside>
  );
}

export function HomeSkeleton() {
  return (
    <>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden" aria-busy="true">
        <div className="absolute left-1/2 top-[214px] flex w-[640px] max-w-[90%] -translate-x-1/2 flex-col items-center gap-3.5">
          <Bone className="h-16 w-16 rounded-full" />
          <Bone className="h-9 w-[420px] max-w-full" />
          <Bone className="h-4 w-[520px] max-w-full" />
          <Bone className="h-4 w-[360px] max-w-full" />
          <Bone className="h-[60px] w-full rounded-full" />
        </div>
      </div>
      <PanelSkeleton />
    </>
  );
}

function NodeBone({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute flex w-[190px] flex-col gap-2.5 rounded-[20px] bg-card p-3.5 outline outline-2 -outline-offset-1 outline-border"
      style={{ left: x, top: y }}
    >
      <Bone className="h-7 w-7 rounded-full" />
      <Bone className="h-3.5 w-[110px]" />
      <Bone className="h-3 w-[80px]" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-[120px]" />
    </div>
  );
}

const TREE_BONES = [
  { x: 56, y: 300 },
  { x: 308, y: 180 },
  { x: 308, y: 420 },
  { x: 560, y: 300 },
];

export function CheckSkeleton() {
  return (
    <>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden" aria-busy="true">
        <Bone className="absolute left-6 top-5 h-10 w-[230px] rounded-full" />
        {TREE_BONES.map((bone) => (
          <NodeBone key={`${bone.x}-${bone.y}`} {...bone} />
        ))}
      </div>
      <PanelSkeleton />
    </>
  );
}

export function ListSkeleton() {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col items-start gap-4 px-8 py-7" aria-busy="true">
      <Bone className="h-10 w-64" />
      <Bone className="h-4 w-96 max-w-full" />
      <Bone className="h-10 w-full rounded-full" />
      <div className="flex w-full flex-1 flex-col gap-6 rounded-3xl bg-card p-6 outline outline-2 -outline-offset-1 outline-border">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4">
            <Bone className="h-5 w-5 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-4 w-3/5" />
              <Bone className="h-3 w-1/4" />
            </div>
            <Bone className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
