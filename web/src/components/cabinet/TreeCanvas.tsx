"use client";

/** Холст дерева: движение, масштаб, перетаскивание узлов, линии по положениям узлов */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { CanvasFooter, CanvasToolbar, gridStyle } from "./CanvasChrome";
import { EdgeDetailCard, PublicationDetailCard } from "./DetailCards";
import { useCabinetText } from "./dictionary";
import {
  ALERT_EDGE_ID,
  ALERT_ID,
  boundsOf,
  edgeShape,
  freeEdgeShape,
  layoutTree,
  NODE_WIDTH,
  ROOT_UNKNOWN_ID,
  UNLINKED_ID,
} from "./layout";
import type { Point, Rect } from "./layout";
import { SearchProgress } from "./SearchProgress";
import {
  AlertGroupCard,
  CheckedTextCard,
  MissingSourceCard,
  PlaceholderCard,
  PublicationCard,
  RootUnknownCard,
  UnlinkedCard,
} from "./TreeNodes";
import type { CheckView, EdgeKind, PublicationNode, TreeEdge, TreeNode } from "./types";

const MIN_ZOOM = 0.3;
/** Мельче подписи на карточках не читаются */
const READABLE_ZOOM = 0.6;
const ROOT_MIDDLE_Y = 100;
const FOCUS_ZOOM = 0.8;
const FOCUS_RING = "rounded-[20px] ring-4 ring-cabinet-new ring-offset-2 ring-offset-canvas";
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const CLICK_DISTANCE = 4;
const DIM_OPACITY = 0.4;
/** Поля при «Показать всё»: сверху и снизу панели холста */
const CARD_MARGIN = 16;
/** Сколько места снизу оставляем карточке */
const CARD_ROOM = 340;
const FIT_MARGIN = { top: 72, bottom: 72, side: 24 };
const PUBLICATION_CARD = { width: 276, dx: 206, dy: -242 };
const EDGE_CARD = { width: 524, dx: -265, dy: 152 };

const EDGE_STYLE: Record<EdgeKind, { color: string; width: number; dash?: string }> = {
  confirmed: { color: "#7A5C5A", width: 3 },
  probable: { color: "#7A5C5A", width: 3, dash: "8 6" },
  changed: { color: "#FF7A12", width: 4 },
  debunk: { color: "#6E1EF0", width: 3 },
};

interface View {
  x: number;
  y: number;
  zoom: number;
}

type Drag =
  | { type: "pan"; startX: number; startY: number; view: View }
  | { type: "node"; id: string; startX: number; startY: number; offset: Point; moved: boolean };

function renderNode(node: TreeNode, selected: boolean): ReactNode {
  if (node.kind === "publication") return <PublicationCard node={node} selected={selected} />;
  if (node.kind === "missing") return <MissingSourceCard node={node} />;
  return <CheckedTextCard node={node} />;
}

export interface TreeCanvasProps {
  check: CheckView;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  onSelectNode: (id?: string) => void;
  onSelectEdge: (id?: string) => void;
  highlightAlert: boolean;
  /** Блоки, к которым привело обновление из ленты */
  focusIds: string[];
  searchOpen: boolean;
  /** Без своего фона и границ: холст лежит прямо на странице, узлы не обрезаются по его краю */
  bare?: boolean;
  /** Нет — у дерева нет хода поиска (сайт, видео): кнопки на панели не будет */
  onToggleSearch?: () => void;
}

export function TreeCanvas({
  check,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  highlightAlert,
  focusIds,
  searchOpen,
  bare = false,
  onToggleSearch,
}: TreeCanvasProps) {
  const t = useCabinetText();
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const openedCheck = useRef<string>();
  const focusedKey = useRef<string>();
  const elements = useRef(new Map<string, HTMLElement>());
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [offsets, setOffsets] = useState<Record<string, Point>>({});
  const [heights, setHeights] = useState<Record<string, number>>({});

  const layout = useMemo(
    () => layoutTree(check, { heights, showAlert: highlightAlert }),
    [check, heights, highlightAlert],
  );

  const measure = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (!element) {
        elements.current.delete(id);
        return;
      }
      elements.current.set(id, element);
      const height = element.offsetHeight;
      setHeights((all) => (all[id] === height ? all : { ...all, [id]: height }));
    },
    [],
  );

  const nodeRect = useCallback(
    (id: string): Rect | undefined => {
      const base = layout.nodes[id];
      const h = heights[id];
      if (!base || h === undefined) return undefined;
      const offset = offsets[id] ?? { x: 0, y: 0 };
      return { x: base.x + offset.x, y: base.y + offset.y, w: NODE_WIDTH, h };
    },
    [layout, heights, offsets],
  );

  // высота карточки зависит от текста: линии цепляются за настоящую рамку
  useLayoutEffect(() => {
    const measured: Record<string, number> = {};
    elements.current.forEach((element, id) => (measured[id] = element.offsetHeight));
    setHeights(measured);
  }, [check]);

  const allRects = useCallback((): Rect[] => {
    const rects: Rect[] = [];
    elements.current.forEach((element, id) => {
      const base = layout.nodes[id];
      const offset = offsets[id] ?? { x: 0, y: 0 };
      if (base) {
        rects.push({
          x: base.x + offset.x,
          y: base.y + offset.y,
          w: element.offsetWidth,
          h: element.offsetHeight,
        });
      }
    });
    return rects;
  }, [layout, offsets]);

  const fit = useCallback(() => {
    const box = viewport.current;
    const rects = allRects();
    if (!box || rects.length === 0) return;
    const bounds = boundsOf(rects);
    const width = box.clientWidth - FIT_MARGIN.side * 2;
    const height = box.clientHeight - FIT_MARGIN.top - FIT_MARGIN.bottom;
    const zoom = Math.min(1, width / bounds.w, height / bounds.h);
    setView({
      zoom,
      x: FIT_MARGIN.side + (width - bounds.w * zoom) / 2 - bounds.x * zoom,
      y: FIT_MARGIN.top + (height - bounds.h * zoom) / 2 - bounds.y * zoom,
    });
  }, [allRects]);

  // если дерево не влезает в окно, сразу показываем его целиком; в размер дизайна оно влезает без сдвига
  useLayoutEffect(() => {
    const box = viewport.current;
    const rects = allRects();
    if (!box || rects.length === 0 || Object.keys(heights).length === 0) return;
    if (openedCheck.current === check.id) return;
    openedCheck.current = check.id;
    const bounds = boundsOf(rects);
    if (bounds.x + bounds.w <= box.clientWidth && bounds.y + bounds.h <= box.clientHeight) return;
    const width = box.clientWidth - FIT_MARGIN.side * 2;
    const height = box.clientHeight - FIT_MARGIN.top - FIT_MARGIN.bottom;
    if (Math.min(width / bounds.w, height / bounds.h) >= READABLE_ZOOM) return fit();
    // целиком дерево было бы нечитаемым: открываем с начала, «Показать всё» покажет его полностью
    const root = check.nodes.find((node) => node.kind === "publication" && node.role === "root");
    const start = (root && layout.nodes[root.id]) ?? bounds;
    setView({
      zoom: READABLE_ZOOM,
      x: FIT_MARGIN.side - bounds.x * READABLE_ZOOM,
      // холст без границ: от верха, иначе высокое дерево откроется поверх заголовка
      y: bare
        ? FIT_MARGIN.top - bounds.y * READABLE_ZOOM
        : box.clientHeight / 2 - (start.y + ROOT_MIDDLE_Y) * READABLE_ZOOM,
    });
    // только при открытии проверки: дальше холстом управляет сотрудник
  }, [check.id, heights]);

  // обновление из ленты: холст подъезжает к блоку. Публикация без связи лежит в общем блоке
  useLayoutEffect(() => {
    const box = viewport.current;
    const unlinked = check.unlinked.some((item) => focusIds.includes(item.id));
    const id = focusIds.find((item) => elements.current.has(item)) ?? (unlinked ? UNLINKED_ID : undefined);
    const element = id && elements.current.get(id);
    const base = id && layout.nodes[id];
    if (!box || !element || !base) return;
    const key = focusIds.join();
    if (focusedKey.current === key) return;
    focusedKey.current = key;
    const offset = offsets[id] ?? { x: 0, y: 0 };
    setView((current) => {
      const zoom = Math.max(current.zoom, FOCUS_ZOOM);
      return {
        zoom,
        x: box.clientWidth / 2 - (base.x + offset.x + element.offsetWidth / 2) * zoom,
        y: box.clientHeight / 2 - (base.y + offset.y + element.offsetHeight / 2) * zoom,
      };
    });
  }, [focusIds, heights, layout, check.unlinked, offsets]);

  const zoomAt = useCallback((next: number, center?: Point) => {
    setView((current) => {
      const box = viewport.current;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const point = center ?? { x: (box?.clientWidth ?? 0) / 2, y: (box?.clientHeight ?? 0) / 2 };
      const ratio = zoom / current.zoom;
      return { zoom, x: point.x - (point.x - current.x) * ratio, y: point.y - (point.y - current.y) * ratio };
    });
  }, []);

  // колесо: с Ctrl/Cmd или щипком масштаб, иначе сдвиг. Обработчик не пассивный, чтобы страница не прокручивалась
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = box.getBoundingClientRect();
        setView((current) => {
          const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * (1 - event.deltaY * 0.01)));
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const ratio = zoom / current.zoom;
          return { zoom, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio };
        });
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  const startPan = (event: ReactPointerEvent) => {
    drag.current = { type: "pan", startX: event.clientX, startY: event.clientY, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startNodeDrag = (event: ReactPointerEvent, id: string) => {
    event.stopPropagation();
    drag.current = {
      type: "node",
      id,
      startX: event.clientX,
      startY: event.clientY,
      offset: offsets[id] ?? { x: 0, y: 0 },
      moved: false,
    };
    viewport.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.type === "pan") {
      setView({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
      return;
    }
    if (!current.moved && Math.hypot(dx, dy) < CLICK_DISTANCE) return;
    current.moved = true;
    setOffsets((all) => ({
      ...all,
      [current.id]: { x: current.offset.x + dx / view.zoom, y: current.offset.y + dy / view.zoom },
    }));
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.type === "node" && !current.moved) {
      const node = check.nodes.find((item) => item.id === current.id);
      if (node?.kind === "publication") onSelectNode(current.id);
      return;
    }
    if (current.type === "pan") {
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (moved < CLICK_DISTANCE) {
        onSelectNode(undefined);
        onSelectEdge(undefined);
      }
    }
  };

  /** Точка на экране; карточка шириной width не уходит за край холста */
  const toScreen = (point: Point, width: number): Point => {
    const box = viewport.current;
    const x = point.x * view.zoom + view.x;
    const y = point.y * view.zoom + view.y;
    if (!box) return { x, y };
    return {
      x: Math.max(CARD_MARGIN, Math.min(x, box.clientWidth - width - CARD_MARGIN)),
      y: Math.max(FIT_MARGIN.top, Math.min(y, box.clientHeight - CARD_ROOM)),
    };
  };

  const dimmed = (id: string) => highlightAlert && id !== check.alertGroup?.parentId;

  const selectedNode = check.nodes.find(
    (node): node is PublicationNode => node.id === selectedNodeId && node.kind === "publication",
  );
  const selectedEdge = check.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedRect = selectedNode && nodeRect(selectedNode.id);

  const obstaclesExcept = (...ids: string[]): Rect[] =>
    [...elements.current.entries()].flatMap(([id, element]) => {
      const base = layout.nodes[id];
      if (!base || ids.includes(id)) return [];
      const offset = offsets[id] ?? { x: 0, y: 0 };
      return [
        { x: base.x + offset.x, y: base.y + offset.y, w: element.offsetWidth, h: element.offsetHeight },
      ];
    });

  const shapeOf = (edge: TreeEdge) => {
    const from = nodeRect(edge.from);
    const to = nodeRect(edge.to);
    if (!from || !to) return undefined;
    // сдвинутая карточка: своя дорожка больше не подходит, линия заново выбирает стороны
    if (offsets[edge.from] || offsets[edge.to]) {
      return freeEdgeShape(from, to, obstaclesExcept(edge.from, edge.to));
    }
    return edgeShape(from, to, layout.routes[edge.id]);
  };
  const selectedShape = selectedEdge && shapeOf(selectedEdge);

  const alertParent = check.alertGroup && nodeRect(check.alertGroup.parentId);
  const alertPoint = layout.nodes[ALERT_ID];
  const alertShape =
    highlightAlert && alertPoint && alertParent
      ? offsets[check.alertGroup?.parentId ?? ""]
        ? freeEdgeShape(
            alertParent,
            { ...alertPoint, w: 250, h: heights[ALERT_ID] ?? 0 },
            obstaclesExcept(check.alertGroup?.parentId ?? "", ALERT_ID),
          )
        : edgeShape(
            alertParent,
            { ...alertPoint, w: 250, h: heights[ALERT_ID] ?? 0 },
            layout.routes[ALERT_EDGE_ID],
          )
      : undefined;

  return (
    <div
      ref={viewport}
      onPointerDown={startPan}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={bare ? undefined : gridStyle(view.x, view.y, view.zoom)}
      className={cn(
        "relative h-full min-w-0 flex-1 cursor-grab touch-none select-none active:cursor-grabbing",
        !bare && "overflow-hidden",
      )}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
          {check.edges.map((edge) => {
            const shape = shapeOf(edge);
            if (!shape) return null;
            const style = EDGE_STYLE[edge.kind];
            return (
              <g
                key={edge.id}
                opacity={dimmed(edge.from) || dimmed(edge.to) || highlightAlert ? DIM_OPACITY : 1}
                fill="none"
                stroke={style.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={style.width}
              >
                <path d={shape.path} strokeDasharray={style.dash} />
                <path d={shape.arrow} />
                {edge.detail && (
                  <path
                    d={shape.path}
                    stroke="transparent"
                    strokeWidth={18}
                    className="pointer-events-auto cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onSelectEdge(edge.id)}
                  />
                )}
              </g>
            );
          })}
          {alertShape && (
            <g fill="none" stroke="#D42A7E" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}>
              <path d={alertShape.path} strokeDasharray="8 6" />
              <path d={alertShape.arrow} />
            </g>
          )}
        </svg>

        {check.nodes.map((node) => {
          const base = layout.nodes[node.id];
          if (!base) return null;
          const offset = offsets[node.id] ?? { x: 0, y: 0 };
          return (
            <div
              key={node.id}
              ref={measure(node.id)}
              onPointerDown={(event) => startNodeDrag(event, node.id)}
              className={cn(
                "absolute",
                node.kind === "publication" ? "cursor-pointer" : "cursor-grab",
                focusIds.includes(node.id) && FOCUS_RING,
              )}
              style={{
                left: base.x + offset.x,
                top: base.y + offset.y,
                opacity: dimmed(node.id) ? DIM_OPACITY : 1,
              }}
            >
              {renderNode(node, node.id === selectedNodeId)}
            </div>
          );
        })}

        {layout.placeholders.map((point, index) => (
          <div key={index} className="absolute" style={{ left: point.x, top: point.y }}>
            <PlaceholderCard />
          </div>
        ))}

        {check.unlinked.length > 0 && layout.nodes[UNLINKED_ID] && (
          <div
            ref={measure(UNLINKED_ID)}
            className={cn(
              "absolute",
              check.unlinked.some((item) => focusIds.includes(item.id)) && FOCUS_RING,
            )}
            style={{
              left: layout.nodes[UNLINKED_ID].x,
              top: layout.nodes[UNLINKED_ID].y,
              opacity: highlightAlert ? DIM_OPACITY : 1,
            }}
          >
            <UnlinkedCard items={check.unlinked} />
          </div>
        )}

        {check.rootUnknown && layout.nodes[ROOT_UNKNOWN_ID] && (
          <div
            ref={measure(ROOT_UNKNOWN_ID)}
            className="absolute"
            style={{ left: layout.nodes[ROOT_UNKNOWN_ID].x, top: layout.nodes[ROOT_UNKNOWN_ID].y }}
          >
            <RootUnknownCard />
          </div>
        )}

        {highlightAlert && check.alertGroup && alertPoint && (
          <div ref={measure(ALERT_ID)} className="absolute" style={{ left: alertPoint.x, top: alertPoint.y }}>
            <AlertGroupCard group={check.alertGroup} />
          </div>
        )}

        {check.edges
          .filter((edge) => edge.kind === "changed" || edge.id === selectedEdgeId)
          .map((edge) => {
            const shape = shapeOf(edge);
            if (!shape) return null;
            return (
              <button
                key={edge.id}
                type="button"
                aria-label={t.edgeCard.changed}
                disabled={!edge.detail}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onSelectEdge(edge.id)}
                className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-card outline outline-[3px] -outline-offset-[1.5px] outline-cabinet-inflated"
                style={{
                  left: shape.middle.x - 12,
                  top: shape.middle.y - 12,
                  opacity: highlightAlert ? DIM_OPACITY : 1,
                }}
              >
                <span className="h-2 w-2 rounded-full bg-cabinet-inflated" />
              </button>
            );
          })}
      </div>

      <div className="cursor-auto" onPointerDown={(event) => event.stopPropagation()}>
        {!bare && <CanvasToolbar stats={check.stats} status={check.status} onToggleSearch={onToggleSearch} />}
        <CanvasFooter
          legend
          zoom={view.zoom}
          onFit={fit}
          onZoomIn={() => zoomAt(view.zoom + ZOOM_STEP)}
          onZoomOut={() => zoomAt(view.zoom - ZOOM_STEP)}
        />
        {check.steps && (check.status !== "done" || searchOpen) && (
          <SearchProgress
            steps={check.steps}
            open={searchOpen}
            onToggle={onToggleSearch ?? (() => undefined)}
          />
        )}
        {selectedNode && selectedRect && (
          <PublicationDetailCard
            node={selectedNode}
            position={toScreen(
              { x: selectedRect.x + PUBLICATION_CARD.dx, y: selectedRect.y + PUBLICATION_CARD.dy },
              PUBLICATION_CARD.width,
            )}
            onClose={() => onSelectNode(undefined)}
          />
        )}
        {selectedEdge?.detail && selectedShape && (
          <EdgeDetailCard
            edge={selectedEdge}
            from={check.nodes.find((node) => node.id === selectedEdge.from)}
            to={check.nodes.find((node) => node.id === selectedEdge.to)}
            position={toScreen(
              { x: selectedShape.middle.x + EDGE_CARD.dx, y: selectedShape.middle.y + EDGE_CARD.dy },
              EDGE_CARD.width,
            )}
            onClose={() => onSelectEdge(undefined)}
          />
        )}
      </div>
    </div>
  );
}
