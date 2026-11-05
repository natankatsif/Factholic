/**
 * Автоматическая раскладка дерева. Никаких правил «этот узел всегда внизу»: положение следует только из связей.
 *
 *  1. слои: узел стоит правее всех, у кого взял;
 *  2. порядок в слое: перебор, который снижает число пересечений связей;
 *  3. высота: узел тянется к соседям, чтобы цепочки шли прямо, и карточки не накладываются;
 *  4. линии: идут по своим дорожкам между слоями. Длинная связь занимает место в промежуточных слоях,
 *     поэтому не проходит сквозь карточки.
 */
import type { CheckView } from "./types";

export const NODE_WIDTH = 190;
export const UNLINKED_ID = "layout-unlinked";
export const ROOT_UNKNOWN_ID = "layout-root-unknown";
export const ALERT_ID = "layout-alert";
export const ALERT_EDGE_ID = "layout-alert-edge";

const EXTRA_WIDTH: Record<string, number> = {
  [UNLINKED_ID]: NODE_WIDTH,
  [ROOT_UNKNOWN_ID]: 210,
  [ALERT_ID]: 250,
};

const LEFT_X = 56;
const TOP_Y = 116;
/** Пока карточка не измерена */
const DEFAULT_HEIGHT = 200;
/** На этой высоте карточки цепляются линии */
const ANCHOR_Y = 70;
const NODE_GAP = 30;
const COMPONENT_GAP = 70;
const LONG_EDGE_ROOM = 16;
const MIN_LAYER_GAP = 62;
const LANE_STEP = 12;
const LANE_PADDING = 18;
const ORDER_SWEEPS = 24;
const POSITION_SWEEPS = 12;
const EDGE_GAP = 3;
const EDGE_ARROW_GAP = 4;
const CORNER = 10;

/** До появления связей публикации встают сеткой: дерева ещё нет */
const GRID_STEP_X = 252;
const GRID_MAIN_Y = 326;
const GRID_SECOND_Y = 610;
const GRID_ROW_STEP = 284;
const GRID_COLUMNS = 4;

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

export interface EdgeRoute {
  /** Вертикальные участки: дорожка x и высота, на которую линия выходит */
  hops: Array<{ lane: number; y: number }>;
}

export interface TreeLayout {
  nodes: Record<string, Point>;
  routes: Record<string, EdgeRoute>;
  placeholders: Point[];
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

interface Item {
  id: string;
  w: number;
  h: number;
  /** Промежуточная точка длинной связи */
  virtual: boolean;
}

interface Link {
  from: string;
  to: string;
}

function components(ids: string[], edges: GraphEdge[]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    return next === id ? id : find(next);
  };
  for (const edge of edges) parent.set(find(edge.from), find(edge.to));
  const groups = new Map<string, string[]>();
  for (const id of ids) groups.set(find(id), [...(groups.get(find(id)) ?? []), id]);
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** Самый длинный путь от начала. Узлы без родителей подтягиваются к своим потомкам */
function assignLayers(ids: string[], edges: GraphEdge[]): Map<string, number> {
  const parents = new Map<string, string[]>();
  for (const edge of edges) parents.set(edge.to, [...(parents.get(edge.to) ?? []), edge.from]);
  const layer = new Map<string, number>();
  const visit = (id: string, path: Set<string>): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (path.has(id)) return 0; // связи идут от ранних к поздним; петля сюда попасть не должна
    const next = new Set(path).add(id);
    const value = Math.max(-1, ...(parents.get(id) ?? []).map((item) => visit(item, next))) + 1;
    layer.set(id, value);
    return value;
  };
  for (const id of ids) visit(id, new Set());
  for (const id of ids) {
    if (parents.has(id)) continue;
    const children = edges.filter((edge) => edge.from === id).map((edge) => layer.get(edge.to) ?? 1);
    if (children.length) layer.set(id, Math.min(...children) - 1);
  }
  return layer;
}

/** Сколько пар связей пересекается между соседними слоями */
export function countCrossings(layers: string[][], links: Link[]): number {
  const position = new Map<string, number>();
  const layerOf = new Map<string, number>();
  layers.forEach((layer, index) =>
    layer.forEach((id, order) => {
      position.set(id, order);
      layerOf.set(id, index);
    }),
  );
  let total = 0;
  for (let index = 0; index + 1 < layers.length; index++) {
    const between = links
      .filter((link) => layerOf.get(link.from) === index && layerOf.get(link.to) === index + 1)
      .map((link) => [position.get(link.from) ?? 0, position.get(link.to) ?? 0] as const);
    for (let a = 0; a < between.length; a++) {
      for (let b = a + 1; b < between.length; b++) {
        const [a1, a2] = between[a]!;
        const [b1, b2] = between[b]!;
        if ((a1 - b1) * (a2 - b2) < 0) total++;
      }
    }
  }
  return total;
}

/** Порядок в слоях: средние позиции соседей, затем обмен рядом стоящих, пока это снижает пересечения */
export function orderLayers(initial: string[][], links: Link[]): string[][] {
  const neighbours = (up: boolean) => {
    const map = new Map<string, string[]>();
    for (const link of links) {
      const [key, value] = up ? [link.to, link.from] : [link.from, link.to];
      map.set(key, [...(map.get(key) ?? []), value]);
    }
    return map;
  };
  const parents = neighbours(true);
  const children = neighbours(false);

  const sweep = (layers: string[][], down: boolean) => {
    const next = layers.map((layer) => [...layer]);
    const indexes = next.map((_, index) => index);
    for (const index of down ? indexes.slice(1) : indexes.slice(0, -1).reverse()) {
      const other = next[down ? index - 1 : index + 1]!;
      const place = new Map(other.map((id, order) => [id, order]));
      const own = new Map(next[index]!.map((id, order) => [id, order]));
      const source = down ? parents : children;
      const weight = (id: string) => {
        const rows = (source.get(id) ?? []).flatMap((item) => place.get(item) ?? []);
        if (!rows.length) return own.get(id) ?? 0;
        const sorted = [...rows].sort((a, b) => a - b);
        return (
          sorted[Math.floor((sorted.length - 1) / 2)]! / 2 + sorted[Math.ceil((sorted.length - 1) / 2)]! / 2
        );
      };
      next[index]!.sort((a, b) => weight(a) - weight(b));
    }
    return next;
  };

  const transpose = (layers: string[][]) => {
    let score = countCrossings(layers, links);
    let improved = true;
    while (improved && score > 0) {
      improved = false;
      for (const layer of layers) {
        for (let index = 0; index + 1 < layer.length; index++) {
          [layer[index], layer[index + 1]] = [layer[index + 1]!, layer[index]!];
          const next = countCrossings(layers, links);
          if (next < score) {
            score = next;
            improved = true;
          } else {
            [layer[index], layer[index + 1]] = [layer[index + 1]!, layer[index]!];
          }
        }
      }
    }
    return layers;
  };

  let best = initial;
  let bestScore = countCrossings(best, links);
  let current = initial;
  for (let round = 0; round < ORDER_SWEEPS && bestScore > 0; round++) {
    current = transpose(sweep(current, round % 2 === 0));
    const score = countCrossings(current, links);
    if (score < bestScore) {
      best = current.map((layer) => [...layer]);
      bestScore = score;
    }
  }
  return best;
}

/**
 * Ближайшие к желаемым высоты при заданном порядке и минимальных расстояниях.
 * Соседние блоки, которые мешают друг другу, сливаются и встают на общее среднее
 */
function placeInOrder(wanted: number[], gaps: number[]): number[] {
  const offset = (index: number) => gaps.slice(0, index).reduce((sum, gap) => sum + gap, 0);
  const blocks: Array<{ sum: number; size: number }> = [];
  wanted.forEach((value, index) => {
    blocks.push({ sum: value - offset(index), size: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1]!;
      const previous = blocks[blocks.length - 2]!;
      if (previous.sum / previous.size <= last.sum / last.size) break;
      blocks.pop();
      previous.sum += last.sum;
      previous.size += last.size;
    }
  });
  const result: number[] = [];
  for (const block of blocks)
    for (let index = 0; index < block.size; index++) result.push(block.sum / block.size);
  return result.map((value, index) => value + offset(index));
}

const above = (item: Item) => (item.virtual ? LONG_EDGE_ROOM / 2 : ANCHOR_Y);
const below = (item: Item) => (item.virtual ? LONG_EDGE_ROOM / 2 : item.h - ANCHOR_Y);

/** Высоты линий: цепочки выпрямляются, родитель встаёт напротив середины своих потомков */
function assignHeights(layers: string[][], items: Map<string, Item>, links: Link[]): Map<string, number> {
  const y = new Map<string, number>();
  const gapsOf = (layer: string[]) =>
    layer.slice(1).map((id, index) => below(items.get(layer[index]!)!) + NODE_GAP + above(items.get(id)!));
  for (const layer of layers) {
    let cursor = 0;
    const gaps = gapsOf(layer);
    layer.forEach((id, index) => {
      y.set(id, cursor);
      cursor += gaps[index] ?? 0;
    });
  }
  const middle = (ids: string[]) => {
    const rows = ids.map((id) => y.get(id) ?? 0).sort((a, b) => a - b);
    return (rows[0]! + rows[rows.length - 1]!) / 2;
  };
  const relax = (layer: string[], neighbours: (id: string) => string[]) => {
    const wanted = layer.map((id) => {
      const near = neighbours(id);
      return near.length ? middle(near) : (y.get(id) ?? 0);
    });
    placeInOrder(wanted, gapsOf(layer)).forEach((value, index) => y.set(layer[index]!, value));
  };
  const parents = (id: string) => links.filter((link) => link.to === id).map((link) => link.from);
  const children = (id: string) => links.filter((link) => link.from === id).map((link) => link.to);
  for (let round = 0; round < POSITION_SWEEPS; round++) {
    for (const layer of layers) relax(layer, parents);
    for (const layer of [...layers].reverse()) relax(layer, children);
  }
  return y;
}

interface Segment {
  source: string;
  fromY: number;
  toY: number;
}

/** Дорожки в промежутке: одна на источник, порядок такой, чтобы линии не резали друг друга */
function assignLanes(segments: Segment[]): Map<string, number> {
  const bySource = new Map<string, Segment[]>();
  for (const segment of segments) {
    if (Math.abs(segment.fromY - segment.toY) < 1) continue;
    bySource.set(segment.source, [...(bySource.get(segment.source) ?? []), segment]);
  }
  const groups = [...bySource.entries()].map(([source, list]) => {
    const fromY = list[0]!.fromY;
    const mean = list.reduce((sum, item) => sum + item.toY, 0) / list.length;
    return { source, fromY, down: mean > fromY };
  });
  const downs = groups.filter((group) => group.down).sort((a, b) => b.fromY - a.fromY);
  const ups = groups.filter((group) => !group.down).sort((a, b) => a.fromY - b.fromY);
  return new Map([...downs, ...ups].map((group, index) => [group.source, index]));
}

function layoutComponent(
  ids: string[],
  edges: GraphEdge[],
  size: (id: string) => { w: number; h: number },
): { nodes: Record<string, Point>; routes: Record<string, EdgeRoute>; height: number } {
  const layerOf = assignLayers(ids, edges);
  const items = new Map<string, Item>(ids.map((id) => [id, { id, ...size(id), virtual: false }]));
  const lastLayer = Math.max(...layerOf.values());
  const layers: string[][] = Array.from({ length: lastLayer + 1 }, () => []);
  for (const id of ids) layers[layerOf.get(id) ?? 0]!.push(id);

  const links: Link[] = [];
  const chains = new Map<string, string[]>();
  for (const edge of edges) {
    const start = layerOf.get(edge.from) ?? 0;
    const end = layerOf.get(edge.to) ?? 0;
    if (end <= start) continue;
    const chain = [edge.from];
    for (let layer = start + 1; layer < end; layer++) {
      const id = `${edge.id}#${layer}`;
      items.set(id, { id, w: 0, h: LONG_EDGE_ROOM, virtual: true });
      layers[layer]!.push(id);
      chain.push(id);
    }
    chain.push(edge.to);
    chains.set(edge.id, chain);
    chain.slice(1).forEach((id, index) => links.push({ from: chain[index]!, to: id }));
  }

  const ordered = orderLayers(layers, links);
  const y = assignHeights(ordered, items, links);

  // промежутки между слоями: ширина зависит от числа дорожек
  const gapLanes = ordered.slice(0, -1).map((layer, index) => {
    const inLayer = new Set(layer);
    const next = new Set(ordered[index + 1]);
    const segments: Segment[] = [];
    for (const chain of chains.values()) {
      chain.slice(0, -1).forEach((id, hop) => {
        const to = chain[hop + 1]!;
        if (inLayer.has(id) && next.has(to)) {
          segments.push({ source: id, fromY: y.get(id) ?? 0, toY: y.get(to) ?? 0 });
        }
      });
    }
    return assignLanes(segments);
  });

  const layerX: number[] = [];
  const layerWidth = ordered.map((layer) => Math.max(0, ...layer.map((id) => items.get(id)!.w)));
  const gapWidth = gapLanes.map((lanes) =>
    Math.max(MIN_LAYER_GAP, LANE_PADDING * 2 + lanes.size * LANE_STEP),
  );
  ordered.forEach((_, index) => {
    layerX[index] = index === 0 ? 0 : layerX[index - 1]! + layerWidth[index - 1]! + gapWidth[index - 1]!;
  });

  const top = Math.min(...[...items.values()].map((item) => (y.get(item.id) ?? 0) - above(item)));
  const nodes: Record<string, Point> = {};
  ordered.forEach((layer, index) => {
    for (const id of layer) {
      const item = items.get(id)!;
      if (!item.virtual) nodes[id] = { x: layerX[index]!, y: (y.get(id) ?? 0) - above(item) - top };
    }
  });

  const routes: Record<string, EdgeRoute> = {};
  for (const [edge, chain] of chains) {
    const start = layerOf.get(chain[0]!) ?? 0;
    routes[edge] = {
      hops: chain.slice(0, -1).map((id, hop) => {
        const index = start + hop;
        const lanes = gapLanes[index]!;
        const used = lanes.size * LANE_STEP;
        const gapStart = layerX[index]! + layerWidth[index]!;
        return {
          lane: gapStart + (gapWidth[index]! - used) / 2 + (lanes.get(id) ?? 0) * LANE_STEP + LANE_STEP / 2,
          y: (y.get(chain[hop + 1]!) ?? 0) - top,
        };
      }),
    };
  }

  const bottom = Math.max(...[...items.values()].map((item) => (y.get(item.id) ?? 0) + below(item))) - top;
  return { nodes, routes, height: bottom };
}

function gridSlot(index: number): Point {
  if (index < GRID_COLUMNS) return { x: LEFT_X + index * GRID_STEP_X, y: GRID_MAIN_Y };
  // первая колонка внизу занята блоком «Ход поиска»
  const rest = index - GRID_COLUMNS;
  const perRow = GRID_COLUMNS - 1;
  return {
    x: LEFT_X + ((rest % perRow) + 1) * GRID_STEP_X,
    y: GRID_SECOND_Y + Math.floor(rest / perRow) * GRID_ROW_STEP,
  };
}

/** Связей ещё нет: это просто найденные публикации, а не дерево */
function gridLayout(check: CheckView, extras: string[]): TreeLayout {
  const nodes: Record<string, Point> = {};
  const publications = check.nodes.filter((node) => node.kind === "publication");
  publications.forEach((node, index) => (nodes[node.id] = gridSlot(index)));
  for (const node of check.nodes) {
    if (node.kind !== "publication")
      nodes[node.id] = { x: LEFT_X + (GRID_COLUMNS - 1) * GRID_STEP_X, y: TOP_Y };
  }
  const bottom = Math.max(GRID_MAIN_Y, ...Object.values(nodes).map((point) => point.y)) + GRID_ROW_STEP;
  extras.forEach((id, index) => (nodes[id] = { x: LEFT_X + index * GRID_STEP_X, y: bottom }));
  return {
    nodes,
    routes: {},
    placeholders: Array.from({ length: check.placeholders }, (_, index) =>
      gridSlot(publications.length + index),
    ),
  };
}

export interface LayoutOptions {
  /** Измеренные высоты карточек */
  heights: Record<string, number>;
  showAlert: boolean;
}

export function layoutTree(check: CheckView, { heights, showAlert }: LayoutOptions): TreeLayout {
  const extras = [
    ...(check.unlinked.length ? [UNLINKED_ID] : []),
    ...(check.rootUnknown ? [ROOT_UNKNOWN_ID] : []),
  ];
  if (check.edges.length === 0) return gridLayout(check, extras);

  const known = new Set(check.nodes.map((node) => node.id));
  const edges: GraphEdge[] = check.edges.filter((edge) => known.has(edge.from) && known.has(edge.to));
  const alertParent = showAlert && check.alertGroup && known.has(check.alertGroup.parentId);
  if (alertParent) edges.push({ id: ALERT_EDGE_ID, from: check.alertGroup!.parentId, to: ALERT_ID });

  const ids = [...known, ...extras, ...(alertParent ? [ALERT_ID] : [])];
  const size = (id: string) => ({ w: EXTRA_WIDTH[id] ?? NODE_WIDTH, h: heights[id] ?? DEFAULT_HEIGHT });

  const nodes: Record<string, Point> = {};
  const routes: Record<string, EdgeRoute> = {};
  const groups = components(ids, edges);
  let cursor = TOP_Y;
  for (const group of groups.filter((list) => list.length > 1)) {
    const inside = new Set(group);
    const part = layoutComponent(
      group,
      edges.filter((edge) => inside.has(edge.from)),
      size,
    );
    for (const [id, point] of Object.entries(part.nodes)) {
      nodes[id] = { x: point.x + LEFT_X, y: point.y + cursor };
    }
    for (const [id, route] of Object.entries(part.routes)) {
      routes[id] = { hops: route.hops.map((hop) => ({ lane: hop.lane + LEFT_X, y: hop.y + cursor })) };
    }
    cursor += part.height + COMPONENT_GAP;
  }

  // узлы без единой связи встают рядом под деревом
  let x = LEFT_X;
  for (const group of groups.filter((list) => list.length === 1)) {
    const id = group[0]!;
    nodes[id] = { x, y: cursor };
    x += size(id).w + MIN_LAYER_GAP;
  }
  return { nodes, routes, placeholders: [] };
}

export interface EdgeShape {
  path: string;
  arrow: string;
  middle: Point;
}

/** Ломаная со скруглёнными углами */
function roundedPath(points: Point[]): string {
  const clean = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || Math.abs(previous.x - point.x) > 0.5 || Math.abs(previous.y - point.y) > 0.5;
  });
  let path = `M${clean[0]!.x} ${clean[0]!.y}`;
  for (let index = 1; index < clean.length - 1; index++) {
    const previous = clean[index - 1]!;
    const corner = clean[index]!;
    const next = clean[index + 1]!;
    const before = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const after = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(CORNER, before / 2, after / 2);
    const enter = {
      x: corner.x + ((previous.x - corner.x) / before) * radius,
      y: corner.y + ((previous.y - corner.y) / before) * radius,
    };
    const leave = {
      x: corner.x + ((next.x - corner.x) / after) * radius,
      y: corner.y + ((next.y - corner.y) / after) * radius,
    };
    path += `L${enter.x} ${enter.y}Q${corner.x} ${corner.y} ${leave.x} ${leave.y}`;
  }
  const last = clean[clean.length - 1]!;
  return `${path}L${last.x} ${last.y}`;
}

/** Линия между узлами. Перетащенный узел тянет за собой только свой конец линии */
export function edgeShape(from: Rect, to: Rect, route?: EdgeRoute): EdgeShape {
  const start = { x: from.x + from.w + EDGE_GAP, y: from.y + ANCHOR_Y };
  const tip = { x: to.x - EDGE_ARROW_GAP, y: to.y + ANCHOR_Y };
  const hops = route?.hops ?? [{ lane: (start.x + tip.x) / 2, y: tip.y }];
  const points: Point[] = [start];
  let y = start.y;
  hops.forEach((hop, index) => {
    const nextY = index === hops.length - 1 ? tip.y : hop.y;
    points.push({ x: hop.lane, y }, { x: hop.lane, y: nextY });
    y = nextY;
  });
  points.push(tip);
  return {
    path: roundedPath(points),
    arrow: `M${tip.x - 7.9} ${tip.y - 4.3}L${tip.x} ${tip.y}L${tip.x - 7.9} ${tip.y + 4.3}`,
    middle: { x: hops[0]!.lane, y: (start.y + (hops.length > 1 ? hops[0]!.y : tip.y)) / 2 },
  };
}

type Side = "left" | "right" | "top" | "bottom";

const SIDES: Side[] = ["right", "left", "bottom", "top"];
const OUTWARD: Record<Side, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
/** Сколько линия идёт прямо от карточки, прежде чем повернуть */
const STUB = 20;
/** Штрафы при выборе пути: сквозь карточку почти никогда, лишний поворот немного */
const CARD_PENALTY = 2000;
const BEND_PENALTY = 40;
/** При равной длине линия идёт как в дереве: от позднего края к раннему */
const NATURAL_BONUS = 30;
const OWN_CARD_INSET = 1;

function port(rect: Rect, side: Side): Point {
  if (side === "left") return { x: rect.x, y: rect.y + Math.min(ANCHOR_Y, rect.h / 2) };
  if (side === "right") return { x: rect.x + rect.w, y: rect.y + Math.min(ANCHOR_Y, rect.h / 2) };
  return { x: rect.x + rect.w / 2, y: side === "top" ? rect.y : rect.y + rect.h };
}

const away = (point: Point, side: Side, distance: number): Point => ({
  x: point.x + OUTWARD[side].x * distance,
  y: point.y + OUTWARD[side].y * distance,
});

const isHorizontal = (side: Side) => side === "left" || side === "right";

/** Варианты пути между концами отступов: один или два поворота */
function connectors(a: Point, b: Point, fromSide: Side, toSide: Side): Point[][] {
  if (isHorizontal(fromSide) && isHorizontal(toSide)) {
    const x = (a.x + b.x) / 2;
    return [
      [
        { x, y: a.y },
        { x, y: b.y },
      ],
    ];
  }
  if (!isHorizontal(fromSide) && !isHorizontal(toSide)) {
    const y = (a.y + b.y) / 2;
    return [
      [
        { x: a.x, y },
        { x: b.x, y },
      ],
    ];
  }
  return [[isHorizontal(fromSide) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }]];
}

/** Участок идёт через прямоугольник. Участки только горизонтальные и вертикальные */
function cuts(a: Point, b: Point, rect: Rect, inset = 0): boolean {
  const left = rect.x + inset;
  const right = rect.x + rect.w - inset;
  const top = rect.y + inset;
  const bottom = rect.y + rect.h - inset;
  return (
    Math.max(a.x, b.x) > left &&
    Math.min(a.x, b.x) < right &&
    Math.max(a.y, b.y) > top &&
    Math.min(a.y, b.y) < bottom
  );
}

function shapeFrom(points: Point[]): EdgeShape {
  const tip = points[points.length - 1]!;
  const before = points[points.length - 2]!;
  const length = Math.hypot(tip.x - before.x, tip.y - before.y) || 1;
  const dx = (tip.x - before.x) / length;
  const dy = (tip.y - before.y) / length;
  const wing = (side: number) => ({
    x: tip.x - dx * 7.9 - dy * 4.3 * side,
    y: tip.y - dy * 7.9 + dx * 4.3 * side,
  });
  const left = wing(1);
  const right = wing(-1);
  let longest = { a: points[0]!, b: points[1]!, size: 0 };
  points.slice(1).forEach((point, index) => {
    const a = points[index]!;
    const size = Math.hypot(point.x - a.x, point.y - a.y);
    if (size > longest.size) longest = { a, b: point, size };
  });
  return {
    path: roundedPath(points),
    arrow: `M${left.x} ${left.y}L${tip.x} ${tip.y}L${right.x} ${right.y}`,
    middle: { x: (longest.a.x + longest.b.x) / 2, y: (longest.a.y + longest.b.y) / 2 },
  };
}

/**
 * Линия для сдвинутой карточки: перебираем стороны подключения и берём самый короткий путь,
 * который не проходит сквозь карточки, в том числе свою
 */
export function freeEdgeShape(from: Rect, to: Rect, obstacles: Rect[]): EdgeShape {
  let best: { points: Point[]; cost: number } | undefined;
  for (const fromSide of SIDES) {
    for (const toSide of SIDES) {
      const start = away(port(from, fromSide), fromSide, EDGE_GAP);
      const tip = away(port(to, toSide), toSide, EDGE_ARROW_GAP);
      const startStub = away(start, fromSide, STUB);
      const tipStub = away(tip, toSide, STUB);
      for (const middle of connectors(startStub, tipStub, fromSide, toSide)) {
        const points = [start, startStub, ...middle, tipStub, tip];
        let cost = 0;
        points.slice(1).forEach((point, index) => {
          const a = points[index]!;
          cost += Math.abs(point.x - a.x) + Math.abs(point.y - a.y);
          // первый и последний участки примыкают к своим карточкам
          const inner = index > 0 && index < points.length - 2;
          if (inner && (cuts(a, point, from, OWN_CARD_INSET) || cuts(a, point, to, OWN_CARD_INSET)))
            cost += CARD_PENALTY;
          for (const rect of obstacles) if (cuts(a, point, rect)) cost += CARD_PENALTY;
        });
        cost += (middle.length + 1) * BEND_PENALTY;
        if (fromSide === "right" && toSide === "left") cost -= NATURAL_BONUS;
        if (!best || cost < best.cost) best = { points, cost };
      }
    }
  }
  return shapeFrom(best!.points);
}

/** Прямоугольник вокруг всего дерева: для кнопки «Показать всё» */
export function boundsOf(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
