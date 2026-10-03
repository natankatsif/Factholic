import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ClaimFlag,
  FactCheck,
  MutationChange,
  ProvenanceEdge,
  ProvenanceNode,
  ProvenanceTree,
} from "@news/contracts";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Hash,
  History,
  Hourglass,
  MapPin,
  Megaphone,
  MousePointerClick,
  Pencil,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { plural } from "./filters";
import { hasProvenanceTree, materialNode, publicationNodes, type MaterialKind } from "./material";

export interface TreeViewProps {
  factCheck: FactCheck;
  /** Что проверяем — подпись и ссылка узла самого материала («Это видео» / «Этот текст» / …) */
  material: MaterialKind;
  onBack: () => void;
}

// ---------- раскладка холста ----------
const CARD_W = 180;
/** Минимальное и максимальное расстояние между колонками; фактическое растягивает холст на всю ширину */
const MIN_COL_GAP = 78;
const MAX_COL_GAP = 260;
const ROW_H = 287;
/** Минимальная высота карточки: до неё доходит вертикальный отрезок связи «вниз» */
const CARD_MIN_H = 215;
/** Отступ сверху под бейдж «Первоисточник» */
const TOP_PAD = 18;
/** На какой высоте карточки цепляются горизонтальные связи (уровень аватарки) */
const ANCHOR_Y = 32;

const colX = (col: number, gap: number) => col * (CARD_W + gap);

/** «Ещё N публикаций»: старые карточки уезжают на новые места, новые быстро втекают слева по одной */
const MOVE_MS = 320;
const ENTER_MS = 300;
const ENTER_STAGGER_MS = 40;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rowY = (row: number) => TOP_PAD + row * ROW_H;

/**
 * Страница дерева первоисточника (макет «Дерево»): кто у кого взял, где исказили, сколько времени прошло.
 * На холсте — узлы со связями, первоисточник и исследуемый материал. Публикации без установленной связи
 * (у настоящего бэкенда их большинство) — под кнопкой «Ещё N…», чтобы не превращать дерево в ленту.
 */
export function TreeView({ factCheck, material, onBack }: TreeViewProps) {
  const tree = useMemo(() => {
    const raw = factCheck.provenance;
    // нет ни одной связи — рисовать нечего: одинокий «этот материал» и «Ещё N публикаций без связи»
    if (!hasProvenanceTree(raw)) return undefined;
    return { ...raw, nodes: raw.nodes.map((n) => materialNode(n, material)) };
  }, [factCheck.provenance, material]);
  const [showAll, setShowAll] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(
    tree?.selectedEdgeId ?? tree?.edges.find((e) => e.hasDistortion)?.id ?? tree?.edges[0]?.id ?? null,
  );

  const layout = useMemo(() => (tree ? buildLayout(tree, showAll) : null), [tree, showAll]);
  const selectedEdge = tree?.edges.find((e) => e.id === selectedEdgeId) ?? null;

  // сам материал — не источник
  const totalSources = publicationNodes(tree).length || factCheck.sources.length;
  const primaryCount = tree?.primarySourceCount ?? tree?.nodes.filter((n) => n.isPrimary).length ?? 0;
  const changesCount = tree?.edges.reduce((n, e) => n + (e.diff?.changes.length ?? 0), 0) ?? 0;

  // Область холста: её ширина задаёт расстояние между колонками (карточки растягиваются на всю ширину)
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [tree]);
  // раскрыли скрытые публикации — новые появились слева, возвращаем холст к началу
  useLayoutEffect(() => {
    if (!showAll) return;
    areaRef.current?.scrollTo({ left: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [showAll]);
  const fitted = useMemo(() => {
    if (!layout) return null;
    const free = layout.cols > 1 ? (areaWidth - layout.cols * CARD_W) / (layout.cols - 1) : MIN_COL_GAP;
    return { ...layout, gap: Math.round(Math.min(MAX_COL_GAP, Math.max(MIN_COL_GAP, free))) };
  }, [layout, areaWidth]);

  return (
    // На десктопе — ровно в высоту экрана: прокручиваются только холст и панель, а не страница
    <div className="flex flex-col gap-4 text-[#4A3333] lg:min-h-0 lg:flex-1">
      {/* Назад + цитата с флагами */}
      <div className="flex shrink-0 flex-col items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-[#4A3333] bg-transparent px-4 py-1.5 text-[15px] font-extrabold text-[#4A3333] transition-colors hover:bg-[#4A3333] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />К разбору
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="m-0 text-[24px] font-black leading-tight tracking-[-0.5px] sm:text-[28px]">
            {factCheck.quote}
          </h1>
          {uniqueFlags(factCheck.flags).map((f) => (
            <FlagBadge key={f.type} flag={f} />
          ))}
        </div>
      </div>

      {!tree || !fitted ? (
        <div className="rounded-[28px] bg-[#FBF8F7] p-8 text-[15px] font-semibold text-[#A27C7A]">
          {publicationNodes(factCheck.provenance).length > 0
            ? "Дерево первоисточника не построено: найденные публикации пишут на ту же тему, но не повторяют это утверждение. Позиции источников — в разборе."
            : "Дерево первоисточника для этого утверждения не построено: по нему не нашлось публикаций."}
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          {/* Левая колонка: вывод и счётчики, холст с таймлайном, скрытые публикации */}
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
              {factCheck.keyFinding ? <KeyFinding finding={factCheck.keyFinding} /> : <span />}
              <div className="flex flex-wrap gap-5 text-[14px] font-semibold text-[#A27C7A]">
                <Stat n={totalSources} words={["источник", "источника", "источников"]} />
                <Stat n={primaryCount} words={["первоисточник", "первоисточника", "первоисточников"]} />
                <Stat
                  n={changesCount}
                  words={["изменение в тексте", "изменения в тексте", "изменений в тексте"]}
                  accent
                />
              </div>
            </div>

            {/* холст и таймлайн в одной прокрутке — даты стоят под своими карточками */}
            <div ref={areaRef} className="flex flex-col gap-4 overflow-auto pb-2 lg:min-h-0 lg:flex-1">
              <Canvas layout={fitted} selectedEdgeId={selectedEdgeId} onSelectEdge={setSelectedEdgeId} />
              <Timeline layout={fitted} tree={tree} />
            </div>

            {fitted.hiddenCount > 0 || showAll ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-fit shrink-0 cursor-pointer rounded-full border border-[#E3D9D6] bg-[#FBF8F7] px-4 py-2 text-[13px] font-extrabold text-[#755D5C] hover:bg-white"
              >
                {showAll
                  ? "Показать только связанные публикации"
                  : `Ещё ${fitted.hiddenCount} ${plural(fitted.hiddenCount, ["публикация", "публикации", "публикаций"])} без установленной связи`}
              </button>
            ) : null}
          </div>

          <EdgePanel edge={selectedEdge} nodes={tree.nodes} onClose={() => setSelectedEdgeId(null)} />
        </div>
      )}

      <Legend />
    </div>
  );
}

function KeyFinding({ finding }: { finding: NonNullable<FactCheck["keyFinding"]> }) {
  return (
    <div className="flex items-center gap-4">
      <SadFace />
      <div className="flex items-center gap-3 rounded-[18px] bg-[#E8DCFD] py-2.5 pl-3 pr-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6E1EF0]">
          <History className="h-5 w-5 text-white" />
        </span>
        <span className="flex flex-col">
          <span className="text-[17px] font-black text-[#6E1EF0]">{finding.title}</span>
          {finding.subtitle && (
            <span className="text-[13px] font-semibold text-[#4A3333]">{finding.subtitle}</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Раскладка

interface Layout {
  /** Расстояние между колонками, px — подбирается под ширину области (см. TreeView) */
  gap: number;
  nodes: Array<ProvenanceNode & { col: number; rowIdx: number }>;
  edges: ProvenanceEdge[];
  cols: number;
  rows: number;
  hiddenCount: number;
}

function buildLayout(tree: ProvenanceTree, showAll: boolean): Layout {
  const linked = new Set(tree.edges.flatMap((e) => [e.fromNodeId, e.toNodeId]));
  const important = (n: ProvenanceNode) =>
    linked.has(n.id) || n.isPrimary || n.role === "primary" || n.role === "target";
  const visible = showAll ? tree.nodes : tree.nodes.filter(important);
  const shown = visible.length ? visible : tree.nodes.slice(0, 4);

  // Колонки бэкенда (хронология) сжимаем до 0..k, сохраняя порядок; строки — как есть
  const colOf = (n: ProvenanceNode, i: number) => n.column ?? i;
  const cols = [...new Set(shown.map(colOf))].sort((a, b) => a - b);
  const nodes = shown.map((n, i) => ({ ...n, col: cols.indexOf(colOf(n, i)), rowIdx: n.row ?? 0 }));
  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: tree.edges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId)),
    gap: MIN_COL_GAP,
    cols: cols.length,
    rows: Math.max(1, ...nodes.map((n) => n.rowIdx + 1)),
    hiddenCount: tree.nodes.length - shown.length,
  };
}

// ---------------------------------------------------------------------------
// Холст: карточки + связи

function Canvas({
  layout,
  selectedEdgeId,
  onSelectEdge,
}: {
  layout: Layout;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string) => void;
}) {
  const width = colX(layout.cols - 1, layout.gap) + CARD_W;
  // Карточки разной высоты (теги, длинные цитаты) — высоту холста меряем по самой нижней
  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(rowY(layout.rows - 1) + CARD_MIN_H);
  useLayoutEffect(() => {
    const cards = boxRef.current?.querySelectorAll<HTMLElement>("[data-node-card]") ?? [];
    setHeight(Math.max(0, ...[...cards].map((c) => c.offsetTop + c.offsetHeight)) + 8);
  }, [layout]);

  // Новые карточки (не было в прошлой раскладке) — въезжают слева по очереди; связи проявляются,
  // когда карточки встали на места. Первый показ дерева — без анимации.
  const svgRef = useRef<SVGSVGElement>(null);
  const prevIds = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    const prev = prevIds.current;
    prevIds.current = new Set(layout.nodes.map((n) => n.id));
    if (!prev || reducedMotion()) return;
    const cards = [...(boxRef.current?.querySelectorAll<HTMLElement>("[data-node-card]") ?? [])];
    cards
      .filter((c) => !prev.has(c.dataset.nodeCard ?? ""))
      .sort((a, b) => a.offsetLeft - b.offsetLeft)
      .forEach((c, i) =>
        c.animate(
          [
            { opacity: 0, transform: "translateX(-48px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: ENTER_MS, delay: i * ENTER_STAGGER_MS, easing: EASE, fill: "backwards" },
        ),
      );
    svgRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      delay: MOVE_MS - 60,
      fill: "backwards",
    });
  }, [layout]);
  // смайлик — только если правый нижний угол свободен (в последней колонке нет карточек нижнего ряда)
  const cornerFree =
    layout.rows > 1 && !layout.nodes.some((n) => n.col === layout.cols - 1 && n.rowIdx === layout.rows - 1);
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const distortedTargets = new Set(layout.edges.filter((e) => e.hasDistortion).map((e) => e.toNodeId));

  return (
    <div className="relative shrink-0">
      <div ref={boxRef} className="relative" style={{ width, height }}>
        <svg
          ref={svgRef}
          className="absolute inset-0 overflow-visible"
          width={width}
          height={height}
          aria-hidden
        >
          <defs>
            {Object.entries(EDGE_COLORS).map(([key, color]) => (
              <marker
                key={key}
                id={`arrow-${key}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={color} />
              </marker>
            ))}
          </defs>
          {layout.edges.map((e) => {
            const from = byId.get(e.fromNodeId);
            const to = byId.get(e.toNodeId);
            return from && to ? (
              <EdgePath
                key={e.id}
                edge={e}
                from={from}
                to={to}
                gap={layout.gap}
                selected={e.id === selectedEdgeId}
                onSelect={() => onSelectEdge(e.id)}
              />
            ) : null;
          })}
        </svg>

        {layout.nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            gap={layout.gap}
            distorted={distortedTargets.has(n.id) || n.role === "distortion"}
          />
        ))}

        {cornerFree && <SurprisedFace />}
      </div>
    </div>
  );
}

const EDGE_COLORS = { direct: "#8C7471", confirmation: "#8C7471", likely: "#FF7A12", distorted: "#FF7A12" };

function EdgePath({
  edge,
  from,
  to,
  gap,
  selected,
  onSelect,
}: {
  edge: ProvenanceEdge;
  gap: number;
  from: Layout["nodes"][number];
  to: Layout["nodes"][number];
  selected: boolean;
  onSelect: () => void;
}) {
  const kind =
    edge.hasDistortion || edge.relationType === "distorted"
      ? "distorted"
      : edge.relationType === "likely_derived"
        ? "likely"
        : edge.relationType === "confirmation"
          ? "confirmation"
          : "direct";
  const color = EDGE_COLORS[kind];
  const label = kind === "distorted" ? "искажено" : edge.label;

  let d: string;
  let labelX: number;
  let labelY: number;
  let mid: [number, number];
  const down = to.rowIdx > from.rowIdx;
  if (down) {
    // вниз и вправо: из середины карточки-источника, вертикаль прячется под карточкой
    const x1 = colX(from.col, gap) + CARD_W / 2;
    const y1 = rowY(from.rowIdx) + CARD_MIN_H;
    const y2 = rowY(to.rowIdx) + ANCHOR_Y;
    const x2 = colX(to.col, gap) - 4;
    d = `M${x1} ${y1} L${x1} ${y2 - 10} Q${x1} ${y2} ${x1 + 10} ${y2} L${x2} ${y2}`;
    labelX = x1 + 14;
    labelY = y2 - 26;
    mid = [(x1 + x2) / 2, y2];
  } else {
    const leftToRight = to.col > from.col;
    const x1 = colX(from.col, gap) + (leftToRight ? CARD_W + 4 : 0);
    const x2 = colX(to.col, gap) + (leftToRight ? -4 : CARD_W);
    const y1 = rowY(from.rowIdx) + ANCHOR_Y;
    const y2 = rowY(to.rowIdx) + ANCHOR_Y;
    d = `M${x1} ${y1} L${x2} ${y2}`;
    mid = [(x1 + x2) / 2, (y1 + y2) / 2];
    labelX = mid[0];
    labelY = mid[1] + 16;
  }

  return (
    <g className="cursor-pointer" onClick={onSelect} style={{ pointerEvents: "auto" }}>
      <path d={d} stroke="transparent" strokeWidth={22} fill="none" />
      <path
        d={d}
        stroke={color}
        strokeWidth={kind === "distorted" ? 3 : 2}
        strokeDasharray={kind === "likely" ? "6 5" : undefined}
        fill="none"
        markerEnd={`url(#arrow-${kind})`}
        opacity={selected || kind !== "distorted" ? 1 : 0.75}
      />
      {kind === "distorted" && (
        <>
          <circle cx={mid[0]} cy={mid[1]} r={11} fill="#FBF8F7" stroke={color} strokeWidth={3} />
          <circle cx={mid[0]} cy={mid[1]} r={4} fill={color} />
        </>
      )}
      <foreignObject x={labelX - (down ? 0 : 40)} y={labelY} width={down ? 150 : 110} height={44}>
        <div
          className={`text-[10.5px] font-extrabold leading-tight ${down ? "text-left" : "text-center"}`}
          style={{
            color: kind === "direct" || kind === "confirmation" ? "#A27C7A" : color,
            width: down ? 140 : 80,
          }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
}

const AVATAR_COLORS = ["#1660D6", "#0AA6C2", "#E0368A", "#4A3333", "#1DA57A", "#6E1EF0", "#FF7A12"];

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(node: ProvenanceNode): string {
  if (node.shortCode) return node.shortCode.slice(0, 2).toUpperCase();
  const words = node.name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

const MAX_TAGS = 2;

/** «@ дата убрана» → «дата убрана»: значок рисуем сами */
function cleanTag(tag: string): string {
  return tag.replace(/^[^\p{L}\p{N}«"−-]+\s*/u, "");
}

function NodeCard({
  node,
  distorted,
  gap,
}: {
  node: Layout["nodes"][number];
  distorted: boolean;
  gap: number;
}) {
  const primary = node.isPrimary || node.role === "primary";
  const isMedia = node.category === "media";
  const href = node.action?.url ?? node.url;
  const border = primary
    ? "border-[2.5px] border-[#4A3333]"
    : distorted
      ? "border-[2.5px] border-[#FF7A12]"
      : "border border-[#E3D9D6]";

  return (
    <div
      data-node-card={node.id}
      className={`absolute flex flex-col rounded-[22px] bg-[#FBF8F7] p-4 ${border}`}
      style={{
        left: colX(node.col, gap),
        top: rowY(node.rowIdx),
        width: CARD_W,
        minHeight: CARD_MIN_H,
        transition: `left ${MOVE_MS}ms ${EASE}, top ${MOVE_MS}ms ${EASE}`,
      }}
    >
      {primary && (
        <span className="absolute -top-[14px] left-3 flex items-center gap-1 rounded-full bg-[#4A3333] px-2.5 py-1 text-[11px] font-extrabold text-white">
          <Anchor className="h-3 w-3" />
          Первоисточник
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black text-white"
          style={{ backgroundColor: avatarColor(node.name) }}
        >
          {initials(node)}
        </span>
        {node.categoryLabel && (
          <span
            className={`truncate rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              isMedia ? "bg-[#E3EEFD] text-[#1660D6]" : "bg-[#EEE8E6] text-[#4A3333]"
            }`}
          >
            {node.categoryLabel}
          </span>
        )}
      </div>
      <span className="mt-3 line-clamp-2 break-words text-[15px] font-black" title={node.name}>
        {node.name}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#A27C7A]">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {node.date || "дата неизвестна"}
      </span>
      <span className="mt-2.5 line-clamp-4 text-[12.5px] font-semibold leading-snug">{node.quote}</span>
      {node.tags && node.tags.length > 0 && (
        <span className="mt-2.5 flex flex-col items-start gap-1.5">
          {node.tags.slice(0, MAX_TAGS).map((t) => (
            <span
              key={t}
              className="flex max-w-full items-center gap-1 truncate rounded-full bg-[#FFE7D3] px-2.5 py-1 text-[11px] font-extrabold text-[#FF7A12]"
            >
              <Pencil className="h-3 w-3 shrink-0" />
              {cleanTag(t)}
            </span>
          ))}
          {node.tags.length > MAX_TAGS && (
            <span className="px-1 text-[11px] font-extrabold text-[#FF7A12]">
              ещё {node.tags.length - MAX_TAGS}
            </span>
          )}
        </span>
      )}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`mt-auto flex items-center gap-1 pt-3 text-[12px] font-extrabold no-underline hover:underline ${
            distorted ? "text-[#FF7A12]" : "text-[#A27C7A]"
          }`}
        >
          {(node.action?.label ?? "Открыть источник").replace(/\s*↗$/, "")}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Таймлайн

function Timeline({ layout, tree }: { layout: Layout; tree: ProvenanceTree }) {
  // одна точка на колонку: самая ранняя публикация колонки
  const points = Array.from({ length: layout.cols }, (_, col) => {
    const inCol = layout.nodes.filter((n) => n.col === col).sort((a, b) => a.rowIdx - b.rowIdx);
    const node = inCol[0];
    return {
      col,
      node,
      x: colX(col, layout.gap) + CARD_W / 2,
      distorted: inCol.some((n) => n.role !== "primary" && n.tags?.length),
    };
  });
  const width = colX(layout.cols - 1, layout.gap) + CARD_W;

  // разрыв между соседними точками: из бэкенда (если его узлы видны), иначе — по датам (от полугода)
  const gapBetween = (i: number): string | null => {
    const a = layout.nodes.filter((n) => n.col === points[i].col).map((n) => n.id);
    const b = layout.nodes.filter((n) => n.col === points[i + 1].col).map((n) => n.id);
    const fromBackend = tree.timelineGaps?.find(
      (g) => a.includes(g.afterNodeId) && b.includes(g.beforeNodeId),
    );
    if (fromBackend) return fromBackend.label;
    const t1 = Date.parse(points[i].node?.isoDate ?? "");
    const t2 = Date.parse(points[i + 1].node?.isoDate ?? "");
    if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
    const years = (t2 - t1) / (365.25 * 24 * 3600 * 1000);
    if (years < 0.5) return null;
    const rounded = Math.round(years * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
    return `${text} ${Number.isInteger(rounded) ? plural(rounded, ["год", "года", "лет"]) : "года"} тишины`;
  };

  return (
    <div className="shrink-0">
      <div className="relative h-[58px]" style={{ width }}>
        <div className="absolute left-0 right-0 top-[10px] h-[2px] bg-[#E3D9D6]" />
        {points.slice(0, -1).map((p, i) => {
          const label = gapBetween(i);
          if (!label) return null;
          const next = points[i + 1];
          return (
            <React.Fragment key={`gap-${i}`}>
              <div
                className="absolute top-[9px] h-[4px] rounded-full bg-[#6E1EF0]"
                style={{ left: p.x, width: next.x - p.x }}
              />
              <span
                className="absolute top-[-2px] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-[#6E1EF0] px-2.5 py-1 text-[11px] font-extrabold text-white"
                style={{ left: (p.x + next.x) / 2 }}
              >
                <Hourglass className="h-3 w-3" />
                {label}
              </span>
            </React.Fragment>
          );
        })}
        {points.map((p) => (
          <React.Fragment key={p.node?.id ?? p.col}>
            <span
              className="absolute top-[2px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] bg-[#FBF8F7]"
              style={{
                left: p.x,
                borderColor: p.distorted ? "#FF7A12" : "#4A3333",
                transition: `left ${MOVE_MS}ms ${EASE}`,
              }}
            />
            <span
              className="absolute top-[28px] -translate-x-1/2 whitespace-nowrap text-[12.5px] font-extrabold text-[#A27C7A]"
              style={{ left: p.x, transition: `left ${MOVE_MS}ms ${EASE}` }}
            >
              {p.node?.date && p.node.date !== "—" ? p.node.date : ""}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Правая панель: связь между источниками

function EdgePanel({
  edge,
  nodes,
  onClose,
}: {
  edge: ProvenanceEdge | null;
  nodes: ProvenanceNode[];
  onClose: () => void;
}) {
  const from = nodes.find((n) => n.id === edge?.fromNodeId);
  const to = nodes.find((n) => n.id === edge?.toNodeId);

  return (
    <aside className="flex flex-col rounded-[28px] border border-[#E3D9D6] bg-[#FBF8F7] p-6 lg:min-h-0 lg:overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-extrabold text-[#A27C7A]">
          <span className="h-[3px] w-4 rounded-full bg-[#FF7A12]" />
          Связь между источниками
        </span>
        {edge && (
          <button
            type="button"
            onClick={onClose}
            title="Закрыть"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] hover:bg-[#E3D9D6]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!edge || !from || !to ? (
        <p className="mt-5 text-[14px] font-semibold leading-relaxed text-[#A27C7A]">
          {nodes.length > 1
            ? "Нажми на связь между карточками, чтобы увидеть, что изменилось при пересказе."
            : "Связей между публикациями не найдено."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[19px] font-black">
            <MiniAvatar node={from} />
            {from.name}
            <ArrowRight className="h-5 w-5 text-[#FF7A12]" />
            <MiniAvatar node={to} />
            {to.name}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-[#A27C7A]">{edge.label}</div>

          {edge.diff ? (
            <>
              <DiffCards before={edge.diff.before} after={edge.diff.after} />
              {edge.diff.changes.length > 0 && (
                <div className="mt-5 border-t border-[#E3D9D6] pt-5">
                  <div className="text-[15px] font-black">Что изменилось</div>
                  <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                    {edge.diff.changes.map((c, i) => (
                      <ChangeRow key={i} change={c} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-[14px] font-semibold text-[#A27C7A]">
              Подробного сравнения текстов для этой связи нет.
            </p>
          )}
        </>
      )}
    </aside>
  );
}

function MiniAvatar({ node }: { node: ProvenanceNode }) {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white"
      style={{ backgroundColor: avatarColor(node.name) }}
    >
      {initials(node)}
    </span>
  );
}

type DiffSide = { sourceName: string; date?: string; text: string };

/** «Было» и «Стало»: слова, которых нет в другой версии, подсвечены */
function DiffCards({ before, after }: { before: DiffSide; after: DiffSide }) {
  const { removed, added } = wordDiff(before.text, after.text);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <DiffCard label="Было" side={before} words={removed} tone="before" />
      <DiffCard label="Стало" side={after} words={added} tone="after" />
    </div>
  );
}

function DiffCard({
  label,
  side,
  words,
  tone,
}: {
  label: string;
  side: DiffSide;
  words: Array<{ text: string; changed: boolean }>;
  tone: "before" | "after";
}) {
  return (
    <div className="rounded-[18px] bg-[#F1EBE9] p-4">
      <div className="text-[11.5px] font-extrabold uppercase text-[#A27C7A]">
        {label} · <span className="normal-case">{side.sourceName}</span>
      </div>
      <p className="m-0 mt-2 text-[17px] font-bold leading-[1.9]">
        {groupRuns(words).map((w, i) => (
          <React.Fragment key={i}>
            {w.changed ? (
              <span
                className={`rounded-md px-1 py-0.5 ${
                  tone === "after" ? "bg-[#FFE7D3] font-black text-[#FF7A12]" : "bg-[#E3D9D6] text-[#A27C7A]"
                }`}
              >
                {w.text}
              </span>
            ) : (
              w.text
            )}{" "}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

/** «рядом» «с» «рынком» → «рядом с рынком»: соседние изменённые слова в одну плашку */
function groupRuns(words: Array<{ text: string; changed: boolean }>) {
  const out: Array<{ text: string; changed: boolean }> = [];
  for (const w of words) {
    const last = out.at(-1);
    if (last && last.changed === w.changed) last.text += ` ${w.text}`;
    else out.push({ ...w });
  }
  return out;
}

/** Пословное сравнение (наибольшая общая подпоследовательность): что убрали и что добавили */
function wordDiff(a: string, b: string) {
  const A = a.split(/\s+/).filter(Boolean);
  const B = b.split(/\s+/).filter(Boolean);
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = norm(A[i]) === norm(B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keepA = new Set<number>();
  const keepB = new Set<number>();
  for (let i = 0, j = 0; i < A.length && j < B.length;) {
    if (norm(A[i]) === norm(B[j])) {
      keepA.add(i++);
      keepB.add(j++);
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return {
    removed: A.map((text, i) => ({ text, changed: !keepA.has(i) })),
    added: B.map((text, j) => ({ text, changed: !keepB.has(j) })),
  };
}

const CHANGE_STYLE: Record<string, { icon: LucideIcon; bg: string; fg: string }> = {
  numbers: { icon: Hash, bg: "#FFE7D3", fg: "#FF7A12" },
  location: { icon: MapPin, bg: "#E3EEFD", fg: "#1660D6" },
  time: { icon: Clock, bg: "#E8DCFD", fg: "#6E1EF0" },
  confidence: { icon: Megaphone, bg: "#EEE8E6", fg: "#4A3333" },
};

function ChangeRow({ change }: { change: MutationChange }) {
  const st = CHANGE_STYLE[change.category] ?? { icon: Pencil, bg: "#EEE8E6", fg: "#4A3333" };
  const Icon = st.icon;
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: st.bg }}
      >
        <Icon className="h-4 w-4" style={{ color: st.fg }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-extrabold text-[#A27C7A]">{change.categoryLabel}</span>
        <span className="text-[13.5px] font-semibold">{change.description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#A27C7A]" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Мелочи

function uniqueFlags(flags: ClaimFlag[]): ClaimFlag[] {
  const seen = new Set<string>();
  return flags.filter((f) => !seen.has(f.type) && seen.add(f.type));
}

function FlagBadge({ flag }: { flag: ClaimFlag }) {
  const outdated = flag.type === "outdated";
  const Icon = outdated ? History : TrendingUp;
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-extrabold ${
        outdated ? "bg-[#E8DCFD] text-[#6E1EF0]" : "bg-[#FFE7D3] text-[#FF7A12]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {flag.label}
    </span>
  );
}

function Stat({ n, words, accent }: { n: number; words: [string, string, string]; accent?: boolean }) {
  return (
    <span>
      <b className={`mr-1.5 text-[19px] font-black ${accent ? "text-[#FF7A12]" : "text-[#4A3333]"}`}>{n}</b>
      {plural(n, words)}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-[#E3D9D6] pt-3 text-[12.5px] font-semibold text-[#A27C7A]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <b className="font-black text-[#4A3333]">Как читать</b>
        <LegendLine color="#8C7471" /> прямая связь
        <LegendLine color="#8C7471" dashed /> вероятно взято отсюда
        <LegendLine color="#FF7A12" thick /> искажение
        <span className="inline-block h-4 w-5 rounded-md border-2 border-[#4A3333]" /> первоисточник
        <span className="rounded-full bg-[#E3EEFD] px-2.5 py-0.5 font-extrabold text-[#1660D6]">СМИ</span>
        <span className="rounded-full bg-[#EEE8E6] px-2.5 py-0.5 font-extrabold text-[#4A3333]">
          официальный
        </span>
      </div>
      <span className="flex items-center gap-1.5">
        <MousePointerClick className="h-4 w-4" />
        нажми на связь
      </span>
    </div>
  );
}

function LegendLine({ color, dashed, thick }: { color: string; dashed?: boolean; thick?: boolean }) {
  return (
    <span
      className="-mr-4 inline-block w-6"
      style={{ borderTop: `${thick ? 3 : 2}px ${dashed ? "dashed" : "solid"} ${color}` }}
    />
  );
}

/** Грустный синий смайлик рядом с ключевым выводом (как в макете) */
function SadFace() {
  return (
    <span
      aria-hidden
      className="relative hidden h-16 w-16 shrink-0 rounded-full bg-[#1660D6] sm:block"
      style={{ animation: "blob-breathe-1 4s ease-in-out infinite" }}
    >
      <span className="absolute left-[14px] top-[24px] h-[8px] w-[14px] rounded-b-full border-b-[3px] border-[#00000059]" />
      <span className="absolute right-[14px] top-[24px] h-[8px] w-[14px] rounded-b-full border-b-[3px] border-[#00000059]" />
      <span className="absolute left-[24px] top-[42px] h-[8px] w-[16px] rounded-t-full border-t-[3px] border-[#00000059]" />
    </span>
  );
}

/** Удивлённый оранжевый смайлик в углу холста */
function SurprisedFace() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 hidden h-[86px] w-[86px] rounded-full bg-[#FF7A12] xl:block"
      style={{ animation: "blob-breathe-2 5s ease-in-out infinite" }}
    >
      <span className="absolute left-[26px] top-[30px] h-[12px] w-[8px] rounded-full bg-[#00000059]" />
      <span className="absolute right-[26px] top-[30px] h-[12px] w-[8px] rounded-full bg-[#00000059]" />
      <span className="absolute left-[37px] top-[52px] h-[14px] w-[12px] rounded-full bg-[#00000059]" />
    </span>
  );
}
