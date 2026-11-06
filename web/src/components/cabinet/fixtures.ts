/**
 * Вымышленные данные со всех экранов дизайна. Открываются адресом `?fixture=<имя>` и только в разработке:
 * на рабочем сайте издания и утверждения отсюда показывать нельзя.
 */
import type {
  SearchActivity,
  AlertItem,
  CabinetSession,
  CheckView,
  EdgeDetail,
  FeedItem,
  HomeView,
  NarrativeView,
  OverlayState,
  PublicationNode,
  QuestionRow,
  RunningCheck,
  SearchStep,
  TreeEdge,
  TreeNode,
  WatchRow,
} from "./types";

const CLAIM = "«Вчера сгорел торговый центр, 200 пострадавших»";
const CLAIM_PLAIN = "Вчера сгорел торговый центр, 200 пострадавших";

const COLORS = {
  blue: "#1660D6",
  teal: "#0A93AD",
  pink: "#D42A7E",
  ink: "#4A3333",
  purple: "#6E1EF0",
  green: "#1DA57A",
  orange: "#FF7A12",
  muted: "#A27C7A",
};

const RUNNING: RunningCheck[] = [
  {
    id: "demo",
    claim: CLAIM_PLAIN,
    step: 2,
    totalSteps: 6,
    message: "ищем публикации на ro, ru, en",
    found: 5,
  },
  {
    id: "bread",
    claim: "Цены на хлеб вырастут вдвое с февраля",
    step: 4,
    totalSteps: 6,
    message: "определяем, кто у кого взял",
    found: 11,
  },
];

export const FIXTURE_SESSION: CabinetSession = {
  organization: "Центр коммуникаций",
  memberName: "Ирина К.",
  memberRole: "сотрудник",
  memberInitial: "И",
  unreadAlerts: 0,
  alerts: [],
  clarifications: [],
  running: [],
  counts: { all: 24, mine: 9, watched: 7, running: 2, ungrouped: 19, videos: 0, links: 0 },
  narratives: [
    { id: "fires", title: "Скрывают масштаб пожаров", count: 3 },
    { id: "pensions", title: "Пенсии только через приложение", count: 2 },
  ],
  suggestions: [
    {
      id: "water",
      topic: "про воду",
      claims: [
        { id: "q3", text: "Вода в Днестре опасна для питья" },
        { id: "q4", text: "В Сороках отключат воду на месяц" },
      ],
      quotes: [
        {
          outlet: "Вести Юга",
          date: "октябрь 2026",
          text: "«Воду из Днестра пить нельзя, предупреждают жители»",
        },
        { outlet: "Чат Кагул", date: "ноябрь 2026", text: "«Воду отключат, потому что она опасна»" },
      ],
    },
  ],
  limits: {
    month: "ноябре",
    resetDate: "1 декабря",
    checksUsed: 12,
    checksTotal: 100,
    watchesUsed: 7,
    watchesTotal: 20,
  },
};

const prehistory: PublicationNode = {
  id: "vesti",
  kind: "publication",
  role: "prehistory",
  outlet: "Вести Рынка",
  color: COLORS.muted,
  type: "media",
  language: "ru",
  date: "август 2019",
  quote: "«Пожар на рынке в центре, обошлось без жертв»",
};

const root: PublicationNode = {
  id: "novosti",
  kind: "publication",
  role: "root",
  outlet: "Новости MD",
  color: COLORS.blue,
  type: "media",
  language: "ru",
  date: "14 марта 2023 · подпись",
  quote: "«Пожар на складе рядом с ТЦ, 2 пострадавших»",
  stance: "partial",
};

const portal: PublicationNode = {
  id: "portal",
  kind: "publication",
  outlet: "Портал Х",
  color: COLORS.blue,
  type: "media",
  language: "ru",
  date: "март 2023",
  quote: "«Пожар на складе рядом с ТЦ, двое пострадавших»",
  stance: "partial",
};

const urgent: PublicationNode = {
  id: "srochno",
  kind: "publication",
  outlet: "Срочно MD",
  color: COLORS.teal,
  type: "channel",
  language: "ru",
  date: "сентябрь 2026",
  dateNote: "Дату взяли со страницы публикации",
  quote: "«Сгорел ТЦ рядом с рынком, 2 пострадавших»",
  changeLabel: "склад → ТЦ",
  stance: "partial",
  detail: {
    headline: "Сгорел ТЦ рядом с рынком",
    fullQuote: "«Сгорел ТЦ рядом с рынком, 2 пострадавших. Об этом сообщают очевидцы»",
    parentName: "Портала Х",
    change: { kind: "place", text: "Место: склад → торговый центр" },
    parentLink: "Вероятная: совпал текст, ссылки на странице нет.",
    url: "https://example.org/srochno",
  },
};

const city: PublicationNode = {
  id: "gorod",
  kind: "publication",
  outlet: "Город MD",
  color: COLORS.pink,
  type: "channel",
  language: "ru",
  date: "октябрь 2026 · 02:15",
  quote: "«Вчера сгорел торговый центр, 200 пострадавших»",
  changeLabel: "цифра: 2 → 200",
  stance: "for",
};

const mayor: PublicationNode = {
  id: "meria",
  kind: "publication",
  outlet: "Мэрия Кишинёва",
  color: COLORS.ink,
  type: "official",
  language: "ro",
  date: "15.03.2023",
  quote: "«На складе произошёл пожар, пострадали 2 человека»",
  stance: "against",
};

const factLab: PublicationNode = {
  id: "faktlab",
  kind: "publication",
  role: "debunk",
  outlet: "Факт-Лаб",
  color: COLORS.purple,
  type: "debunk",
  language: "ro",
  date: "2 ноября 2026",
  quote: "«Фото 2023 года выдают за новый пожар»",
  stance: "against",
};

const checked: TreeNode = { id: "checked", kind: "checked", quote: CLAIM };

const missing: TreeNode = {
  id: "ochevidcy",
  kind: "missing",
  name: "«Очевидцы» в Telegram",
  note: "На него ссылаются, страницы нет",
};

const edgeDetail: EdgeDetail = {
  beforeSource: "Срочно MD, сен 2026",
  afterSource: "Город MD, окт 2026",
  before: [
    [{ text: "Сгорел" }, { text: "ТЦ", changed: true }],
    [{ text: "рядом с рынком," }],
    [{ text: "2", changed: true }, { text: "пострадавших" }],
  ],
  after: [
    [{ text: "Вчера", changed: true }, { text: "сгорел" }],
    [{ text: "торговый центр,", changed: true }],
    [{ text: "200", changed: true }, { text: "пострадавших" }],
  ],
  changes: [
    { kind: "number", text: "Цифра: 2 → 200" },
    { kind: "place", text: "Место: рядом с рынком → ТЦ" },
    { kind: "time", text: "Время: появилось «вчера»" },
  ],
  evidence: "На странице Город MD есть ссылка на Срочно MD. Пост вышел через 3 недели.",
  fragmentUrl: "https://example.org/gorod",
};

const treeEdges: TreeEdge[] = [
  { id: "e1", from: "novosti", to: "portal", kind: "confirmed" },
  { id: "e2", from: "portal", to: "srochno", kind: "probable" },
  { id: "e3", from: "srochno", to: "gorod", kind: "changed", detail: edgeDetail },
  { id: "e4", from: "novosti", to: "meria", kind: "confirmed" },
  { id: "e5", from: "ochevidcy", to: "srochno", kind: "probable" },
  { id: "e6", from: "gorod", to: "checked", kind: "confirmed" },
  { id: "e7", from: "gorod", to: "faktlab", kind: "debunk" },
];

const SIDES = { for: 1, against: 2, partial: 3, neutral: 0 };

const readyFeed: FeedItem[] = [
  { type: "claims", time: "14:20", count: 1 },
  {
    type: "result",
    time: "14:32",
    sides: SIDES,
    earliest: { outlet: "Новости MD", date: "14 марта 2023" },
    note: "Цифра «200» появилась только в октябре 2026.",
  },
  { type: "offer", variant: "default" },
];

/** Два поиска: первый и «Найти ещё» */
const SEARCH_ACTIVITY: SearchActivity[] = [
  {
    kind: "queries",
    texts: ["сгорел торговый центр 200 пострадавших", "incendiu centru comercial Chișinău"],
  },
  {
    kind: "filtered",
    checked: 34,
    kept: 9,
    sites: ["novosti.md", "portal.md", "srochno.md", "gorod.md", "chisinau.md"],
  },
  { kind: "anchors", terms: ["склад на Мунчештской", "Служба спасателей"] },
  { kind: "tree", publications: 9, links: 4 },
  { kind: "start" },
  { kind: "queries", texts: ["Служба спасателей пожар склад Кишинёв"] },
  { kind: "filtered", checked: 12, kept: 3, sites: ["jurnal.md", "tv8.md"] },
];

const treeReady: CheckView = {
  activity: SEARCH_ACTIVITY,
  steps: [
    { key: "claims", status: "done", found: 1 },
    { key: "search", status: "done", found: 6 },
    { key: "traces", status: "done" },
    { key: "tree", status: "done" },
    { key: "stances", status: "done" },
    { key: "done", status: "done" },
  ],
  id: "demo",
  status: "done",
  claimStatus: "new",
  claim: CLAIM,
  timeLabel: "сегодня, 14:32",
  nodes: [prehistory, root, portal, missing, urgent, city, checked, mayor, factLab],
  edges: treeEdges,
  unlinked: [
    { id: "eho", outlet: "Эхо Бельц", color: COLORS.green, date: "окт 2026" },
    { id: "newssud", outlet: "News Sud", color: COLORS.purple, date: "окт 2026 · ro" },
  ],
  placeholders: 0,
  stats: { publications: 9, links: 7, changes: 2 },
  feed: readyFeed,
};

const plain = (node: PublicationNode): PublicationNode => ({
  ...node,
  role: undefined,
  stance: undefined,
  changeLabel: undefined,
  date: node.date?.replace(" · подпись", ""),
});

const STEP_KEYS: SearchStep["key"][] = ["claims", "search", "traces", "tree", "stances", "done"];
const waitingSteps = (done: SearchStep[]): SearchStep[] => [
  ...done,
  ...STEP_KEYS.slice(done.length).map((key) => ({ key, status: "waiting" as const })),
];

const search: CheckView = {
  id: "demo",
  status: "running",
  claim: CLAIM,
  timeLabel: "началась в 14:20",
  nodes: [plain(root), plain(portal), plain(urgent), plain(city), plain(mayor), checked],
  edges: [],
  unlinked: [],
  placeholders: 1,
  activity: SEARCH_ACTIVITY,
  steps: waitingSteps([
    { key: "claims", status: "done", found: 1 },
    { key: "search", status: "running", found: 6 },
    { key: "traces", status: "running", found: 2 },
  ]),
  stats: { publications: 5, traces: 2 },
  feed: [
    { type: "claims", time: "14:20", count: 2, options: [CLAIM_PLAIN, "Власти скрывают причину пожара"] },
    { type: "searching" },
  ],
};

const failed: CheckView = {
  ...search,
  status: "failed",
  timeLabel: "14:26",
  placeholders: 0,
  steps: waitingSteps([
    { key: "claims", status: "done", found: 1 },
    { key: "search", status: "failed", found: 5 },
  ]),
  stats: { publications: 5 },
  feed: [{ type: "failed" }, { type: "saved", time: "14:26", count: 5 }],
};

const fewSources: CheckView = {
  id: "demo",
  status: "done",
  claimStatus: "new",
  claim: CLAIM,
  timeLabel: "сегодня, 14:32",
  rootUnknown: true,
  nodes: [
    { ...plain(urgent), date: undefined, stance: "partial" },
    { ...plain(city), stance: "for" },
    checked,
  ],
  edges: [
    { id: "f1", from: "srochno", to: "gorod", kind: "probable" },
    { id: "f2", from: "gorod", to: "checked", kind: "confirmed" },
  ],
  unlinked: [],
  placeholders: 0,
  stats: { publications: 2, confirmedLinks: 0 },
  feed: [
    { type: "few-sources", time: "14:32", count: 2 },
    { type: "root-unknown", time: "14:32", outlet: "Срочно MD" },
    {
      type: "not-checked",
      time: "14:32",
      items: [
        "3 закрытые страницы: мы их не обходим",
        "Telegram-канал «Очевидцы»: страница не найдена",
        "Публикации на ro и en: ничего не нашли",
      ],
    },
    { type: "offer", variant: "few" },
  ],
};

const alertOnTree: CheckView = {
  ...treeReady,
  claimStatus: "spreading",
  timeLabel: undefined,
  watchFrequency: "daily",
  stats: { publications: 14, growth: 5 },
  alertGroup: {
    title: "5 новых на русском",
    parentId: "gorod",
    publications: [
      { id: "a1", outlet: "Вести Юга", color: COLORS.blue, date: "сегодня, 08:10" },
      { id: "a2", outlet: "Чат Кагул", color: COLORS.teal, date: "сегодня, 08:42" },
      { id: "a3", outlet: "Сводка 24", color: COLORS.green, date: "сегодня, 09:05" },
      { id: "a4", outlet: "Портал Юг", color: COLORS.purple, date: "сегодня, 09:30" },
      { id: "a5", outlet: "Новый Город", color: COLORS.orange, date: "сегодня, 10:12" },
    ],
  },
  feed: [
    {
      type: "alert",
      title: "история растёт",
      time: "10:30",
      text: "За сутки появились 5 публикаций на русском языке. Обычно бывает 1–2 в день.",
    },
    {
      type: "debunk",
      title: "Появился разбор",
      time: "2 ноя",
      text: "Факт-Лаб опубликовал разбор: фото 2023 года выдают за новый пожар.",
    },
    { type: "watch-on", time: "1 ноя", text: "Проверяем раз в день, до 1 декабря. Сигналы: 8 из 9." },
    {
      type: "result-short",
      time: "1 ноя",
      text: "Источники расходятся: за 1, против 2, частично 3. Самая ранняя из найденных: Новости MD, 14 марта 2023.",
    },
  ],
};

const SUGGESTIONS = [CLAIM, "https://gorod.md/novosti/pozhar-tc"];
const RECENT = [
  { id: "q1", text: CLAIM_PLAIN, date: "сегодня" },
  { id: "q2", text: "С января пенсии будут выплачивать только через приложение", date: "сегодня" },
  { id: "q3", text: "Вода в Днестре опасна для питья", date: "вчера" },
];

const QUESTIONS: QuestionRow[] = [
  {
    id: "q1",
    checkId: "demo",
    ageDays: 0,
    text: CLAIM,
    author: "Ирина К.",
    date: "1 ноября",
    language: "ru",
    narrative: "Скрывают масштаб пожаров",
    checks: 3,
    last: "сегодня, 10:30",
    status: "spreading",
    scopes: ["all", "mine", "watched"],
  },
  {
    id: "q2",
    checkId: "demo",
    ageDays: 0,
    text: "«С января пенсии будут выплачивать только через приложение»",
    author: "Марк Д.",
    date: "30 октября",
    language: "ru",
    narrative: "Пенсии только через приложение",
    checks: 2,
    last: "сегодня, 09:15",
    status: "spreading",
    scopes: ["all", "watched"],
  },
  {
    id: "q3",
    checkId: "demo",
    ageDays: 1,
    text: "«Вода в Днестре опасна для питья»",
    author: "Анна В.",
    date: "29 октября",
    language: "ro",
    checks: 4,
    last: "вчера, 18:40",
    status: "debunked",
    scopes: ["all", "watched", "ungrouped"],
  },
  {
    id: "q4",
    checkId: "demo",
    ageDays: 1,
    text: "«В Сороках отключат воду на месяц»",
    author: "Анна В.",
    date: "3 ноября",
    language: "ru",
    checks: 1,
    last: "вчера, 12:05",
    status: "new",
    scopes: ["all", "ungrouped"],
  },
  {
    id: "q5",
    checkId: "demo",
    ageDays: 0,
    text: "«Школы переведут на четырёхдневную неделю»",
    author: "Ирина К.",
    date: "22 октября",
    language: "ru",
    checks: 5,
    last: "сегодня, 08:00",
    status: "stable",
    scopes: ["all", "mine", "watched", "ungrouped"],
  },
  {
    id: "q6",
    checkId: "demo",
    ageDays: 4,
    text: "«Мост в Унгенах закрывают на год»",
    author: "Марк Д.",
    date: "15 октября",
    language: "ro",
    checks: 3,
    last: "1 ноября, 08:00",
    status: "fading",
    scopes: ["all", "watched", "ungrouped"],
  },
  {
    id: "q7",
    checkId: "demo",
    ageDays: 4,
    text: "«Власти скрывают причину пожара»",
    author: "Ирина К.",
    date: "1 ноября",
    language: "ru",
    narrative: "Скрывают масштаб пожаров",
    checks: 1,
    last: "1 ноября, 14:20",
    status: "new",
    scopes: ["all", "mine"],
  },
];

const WATCHES: WatchRow[] = [
  {
    id: "w1",
    claimId: "demo",
    checkId: "demo",
    text: CLAIM,
    claimStatus: "spreading",
    fresh: 5,
    last: "сегодня, 10:30",
    status: "active",
  },
  {
    id: "w2",
    claimId: "demo",
    checkId: "demo",
    text: "«С января пенсии будут выплачивать только через приложение»",
    claimStatus: "spreading",
    fresh: 2,
    last: "сегодня, 09:15",
    status: "active",
  },
  {
    id: "w3",
    claimId: "demo",
    checkId: "demo",
    text: "«Школы переведут на четырёхдневную неделю»",
    claimStatus: "stable",
    fresh: 0,
    last: "сегодня, 08:00",
    status: "active",
  },
  {
    id: "w4",
    claimId: "demo",
    checkId: "demo",
    text: "«Вода в Днестре опасна для питья»",
    claimStatus: "debunked",
    fresh: 1,
    last: "вчера, 18:40",
    status: "active",
  },
  {
    id: "w5",
    claimId: "demo",
    checkId: "demo",
    text: "«Мост в Унгенах закрывают на год»",
    claimStatus: "fading",
    fresh: 0,
    last: "1 ноября, 08:00",
    status: "active",
  },
  {
    id: "w6",
    claimId: "demo",
    checkId: "demo",
    text: "«Цены на газ вырастут втрое с декабря»",
    claimStatus: "stable",
    fresh: 0,
    last: "28 октября, 08:00",
    status: "paused",
  },
  {
    id: "w7",
    claimId: "demo",
    checkId: "demo",
    text: "«Междугородние автобусы отменят с нового года»",
    claimStatus: "fading",
    fresh: 0,
    last: "20 октября, 08:00",
    status: "finished",
  },
];

const NARRATIVE: NarrativeView = {
  id: "fires",
  title: "Скрывают масштаб пожаров",
  status: "spreading",
  description:
    "Общая мысль публикаций: власти якобы занижают число пострадавших. Описание написал сотрудник, это не вывод системы.",
  confirmedBy: "Ирина К.",
  confirmedAt: "2 ноября",
  publications: 17,
  languages: 2,
  lastChange: "1 ноября",
  questions: [
    {
      id: "n1",
      checkId: "demo",
      text: CLAIM,
      status: "spreading",
      sides: { for: 1, against: 2, partial: 3, neutral: 2 },
    },
    {
      id: "n2",
      checkId: "demo",
      text: "«Власти скрывают причину пожара»",
      status: "new",
      sides: { for: 2, against: 1, partial: 1, neutral: 1 },
    },
    {
      id: "n3",
      checkId: "demo",
      text: "«На складе погибли люди, но об этом молчат»",
      status: "fading",
      sides: { for: 1, against: 1, partial: 0, neutral: 1 },
    },
  ],
  quotes: [
    {
      id: "c1",
      outlet: "Город MD",
      color: COLORS.pink,
      date: "октябрь 2026",
      text: "«Вчера сгорел торговый центр, 200 пострадавших, власти молчат»",
    },
    {
      id: "c2",
      outlet: "Срочно MD",
      color: COLORS.teal,
      date: "сентябрь 2026",
      text: "«Об этом сообщают очевидцы, официальных данных нет»",
    },
    {
      id: "c3",
      outlet: "Эхо Бельц",
      color: COLORS.green,
      date: "октябрь 2026",
      text: "«Настоящее число пострадавших нам не называют»",
    },
  ],
};

const DEMO_ALERTS: AlertItem[] = [
  {
    id: "al1",
    checkId: "demo",
    claimId: "q1",
    claim: CLAIM_PLAIN,
    title: "История растёт",
    text: "За сутки появились 5 публикаций на русском языке.",
    time: "сегодня, 10:30",
    unread: true,
  },
  {
    id: "al2",
    checkId: "demo",
    claimId: "q1",
    claim: CLAIM_PLAIN,
    title: "Появился разбор",
    text: "Факт-Лаб опубликовал разбор.",
    time: "2 ноября, 09:00",
    unread: true,
  },
];

const withRunning = (running: RunningCheck[]): Partial<CabinetSession> => ({ running });

interface Fixture {
  session?: Partial<CabinetSession>;
  check?: CheckView;
  home?: HomeView;
  overlay?: OverlayState;
}

const home = (state: HomeView["state"], input?: string): HomeView => ({
  state,
  input,
  suggestions: SUGGESTIONS,
  recent: RECENT,
});

/** Имена — из заметок экранов в obsidian/15_Кабинет_структур_Дизайн/notes */
const FIXTURES: Record<string, Fixture> = {
  empty: { home: home("empty") },
  "limit-reached": {
    home: home("limit"),
    session: { limits: { ...FIXTURE_SESSION.limits, checksUsed: 100 } },
  },
  "no-claims": { home: home("no-claims", "Как же всё надоело, когда это закончится?") },
  search: { check: search, session: withRunning(RUNNING.slice(0, 1)) },
  "tree-ready": { check: treeReady },
  "publication-card": { check: treeReady, overlay: { selectedNodeId: "srochno" } },
  "edge-card": { check: treeReady, overlay: { selectedEdgeId: "e3" } },
  "watch-settings": { check: treeReady, overlay: { settingsOpen: true } },
  "alert-on-tree": {
    check: alertOnTree,
    session: { unreadAlerts: 2, alerts: DEMO_ALERTS },
    overlay: { highlightAlert: true },
  },
  "search-failed": { check: failed },
  "few-sources": { check: fewSources },
  "left-menu": { check: treeReady, session: withRunning(RUNNING), overlay: { menuOpen: true } },
  questions: { session: withRunning(RUNNING), overlay: { selectedQuestionIds: ["q3", "q4"] } },
  "running-checks": {
    session: withRunning(RUNNING),
    overlay: { runningOpen: true, selectedQuestionIds: ["q3", "q4"] },
  },
  "watch-list": { session: { unreadAlerts: 2, alerts: DEMO_ALERTS } },
  narrative: { session: withRunning(RUNNING) },
};

export interface CabinetFixture extends Fixture {
  session: CabinetSession;
  questions: QuestionRow[];
  watches: WatchRow[];
  narrative: NarrativeView;
}

/** Fixture по имени. На рабочем сайте всегда undefined */
export function loadFixture(name: string | undefined, fallback: string): CabinetFixture | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  // кабинет подключён к API: демо открывается только явным ?fixture=
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "backend" && !name) return undefined;
  const fixture = FIXTURES[name ?? fallback] ?? FIXTURES[fallback];
  return {
    ...fixture,
    session: { ...FIXTURE_SESSION, ...fixture.session },
    questions: QUESTIONS,
    watches: WATCHES,
    narrative: NARRATIVE,
  };
}
