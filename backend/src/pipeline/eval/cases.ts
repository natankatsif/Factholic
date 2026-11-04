/**
 * Кейсы сквозного eval: реальные политические утверждения из молдавского инфопространства.
 * Тексты — утверждения в том виде, как они ходили в сети: это проверяемый материал, а не позиция проекта.
 *
 * Эталон (gold) взят из разборов фактчекеров и отчёта центра StratCom, ссылки — в references.
 * Конкретные URL выдачи не сравниваем: поиск меняется. Сравниваем дату корня, найденные домены и итог.
 *
 * goal — к какой цели программы относится кейс:
 *   1 — госучреждения могут лучше реагировать на цифровую дезинформацию;
 *   2 — информационная и образовательная работа с учётом гендерной проблематики.
 */
import type { ClaimConsensus, LanguageCode } from "@news/contracts";

export interface PipelineCase {
  id: string;
  goal: 1 | 2;
  /** Зачем кейс нужен учреждению */
  about: string;
  language: LanguageCode;
  /** Материал, как его вставляет пользователь */
  text: string;
  gold: {
    /** Слова, по которым среди утверждений материала выбираем главное */
    keywords: string[];
    /** Утверждение ложно или искажено; тогда итог converge считается вредной ошибкой */
    misleading: boolean;
    /** Допустимые итоги карточки */
    acceptable: ClaimConsensus[];
    /** Когда появился первоисточник (включительно), YYYY-MM-DD; нет — дата не известна точно */
    rootWindow?: { from: string; to: string };
    /** Хотя бы один из доменов должен появиться в отчёте: разбор или официальный ответ */
    expectDomains: string[];
    /** Что должен понять читатель */
    note: string;
    references: string[];
  };
}

export const CASES: PipelineCase[] = [
  {
    id: "migrants-300k",
    goal: 1,
    about:
      "Реальная фраза министра превращена в угрозу: типичная мутация, на которую должно ответить ведомство",
    language: "ro",
    text: "Ministrul Economiei Eugeniu Osmochescu a anunțat că Guvernul va aduce 300 de mii de imigranți în Republica Moldova ca să înlocuiască populația.",
    gold: {
      keywords: ["300", "imigran", "mii"],
      misleading: true,
      acceptable: ["against", "flagged", "split"],
      rootWindow: { from: "2026-04-01", to: "2026-05-15" },
      expectDomains: ["stopfals.md", "logos-pres.md", "capital.ro", "stratcom.md"],
      note: "Министр говорил о нехватке около 300 тысяч работников для производительности, а не о завозе людей",
      references: [
        "https://logos-pres.md/?p=80788",
        "https://www.capital.ro/cum-sunt-manipulati-cetatenii-din-republica-moldova-stiri-false-despre-migrantii-din-asia-si-ajutoarele-de-stat.html",
        "https://stratcom.md/wp-content/uploads/2026/06/Raport-pentru-constientizarea-publica-a-manipularii-informationale.pdf",
      ],
    },
  },
  {
    id: "dereneu-church",
    goal: 1,
    about: "Судебный спор подан как нападение государства на веру: нужен первоисточник спора",
    language: "ru",
    text: "В селе Деренеу государство силой отобрало храм у верующих: власти Молдовы начали атаку на православие и повторяют украинский сценарий.",
    gold: {
      keywords: ["деренеу", "храм", "церк"],
      misleading: true,
      acceptable: ["against", "flagged", "split"],
      rootWindow: { from: "2025-06-01", to: "2026-02-11" },
      expectDomains: ["stratcom.md", "stopfals.md", "veridica.ro", "moldpres.md", "zdg.md", "newsmaker.md"],
      note: "В основе решение Высшей судебной палаты от 12 июня 2025 о юрисдикции храма",
      references: [
        "https://stratcom.md/wp-content/uploads/2026/06/Raport-pentru-constientizarea-publica-a-manipularii-informationale.pdf",
      ],
    },
  },
  {
    id: "transnistria-mines",
    goal: 1,
    about: "Реальный факт (мины на границе) используется как доказательство подготовки войны",
    language: "ru",
    text: "Украина заминировала границу с Приднестровьем, а значит Молдову извне подталкивают к войне против Приднестровья.",
    gold: {
      keywords: ["мин", "приднестров", "войн"],
      misleading: true,
      acceptable: ["against", "flagged", "split"],
      rootWindow: { from: "2026-03-20", to: "2026-04-09" },
      expectDomains: ["veridica.ro", "kp.md", "kp.ru", "protv.md"],
      note: "Подоляк объяснял мины российским присутствием; Кишинёв говорит о мирном урегулировании",
      references: [
        "https://www.veridica.ro/en/fake-news-disinformation-propaganda/fake-news-moldova-is-being-pushed-toward-a-war-with-transnistria",
      ],
    },
  },
  {
    id: "usaid-sandu",
    goal: 1,
    about: "Обвинение во внешнем управлении выборами: нужны разбор и данные о явке",
    language: "ro",
    text: "USAID a asigurat victoria Maiei Sandu la alegerile prezidențiale din 2024 prin finanțarea votului din diaspora.",
    gold: {
      keywords: ["usaid"],
      misleading: true,
      acceptable: ["against", "flagged", "split", "unverifiable"],
      expectDomains: ["veridica.ro", "stopfals.md", "euvsdisinfo.eu"],
      note: "Доказательств финансирования Санду через USAID нет, высокая явка диаспоры держится годами",
      references: [
        "https://www.veridica.ro/en/fake-news-disinformation-propaganda/republic-of-moldova-2025-top-fake-news-disinformation-debunked-by-veridica",
      ],
    },
  },
  {
    id: "gas-blocked",
    goal: 1,
    about: "Перенос ответственности за энергокризис: нужны даты и официальные заявления",
    language: "ru",
    text: "Кишинёв заблокировал поставки российского газа в Приднестровье в январе 2025 года.",
    gold: {
      keywords: ["газ"],
      misleading: true,
      acceptable: ["against", "flagged", "split"],
      rootWindow: { from: "2024-12-01", to: "2025-02-28" },
      expectDomains: ["veridica.ro", "stopfals.md", "euvsdisinfo.eu", "gov.md", "reuters.com", "moldpres.md"],
      note: "Поставки прекратил Газпром, Кишинёв их не блокировал",
      references: [
        "https://www.veridica.ro/en/fake-news-disinformation-propaganda/republic-of-moldova-2025-top-fake-news-disinformation-debunked-by-veridica",
      ],
    },
  },
  {
    id: "nato-70k",
    goal: 1,
    about: "Громкое число о НАТО: проверка, находит ли движок разбор и откуда взялась цифра",
    language: "ru",
    text: "В Румынию переброшено 70 000 солдат НАТО, чтобы вместе с Молдовой оккупировать Одессу.",
    gold: {
      keywords: ["нато", "70"],
      misleading: true,
      acceptable: ["against", "flagged", "split", "unverifiable"],
      rootWindow: { from: "2025-05-01", to: "2025-07-31" },
      expectDomains: ["veridica.ro", "stopfals.md", "euvsdisinfo.eu"],
      note: "Veridica разбирала утверждение в июне 2025",
      references: [
        "https://www.veridica.ro/en/fake-news-disinformation-propaganda/republic-of-moldova-2025-top-fake-news-disinformation-debunked-by-veridica",
      ],
    },
  },
  {
    id: "soros-lgbt",
    goal: 2,
    about: "Гендерная дезинформация с фальшивым сайтом: корень — сайт, созданный неделей раньше",
    language: "ru",
    text: "Фонд Сороса пообещал Молдове 10 миллионов евро на программу прав ЛГБТ, а Майя Санду объявила план с блокаторами полового созревания за счёт государства.",
    gold: {
      keywords: ["сорос", "лгбт", "10"],
      misleading: true,
      acceptable: ["against", "flagged", "split", "unverifiable"],
      rootWindow: { from: "2025-07-15", to: "2025-08-05" },
      expectDomains: ["cotidianul.md", "france24.com", "observers.france24.com", "soros.md", "stopfals.md"],
      note: "Запущено с поддельного сайта Proud Europe 21 июля 2025, фонд это опроверг",
      references: [
        "https://cotidianul.md/en/10116/Soros-allegedly-promised-10-million-euros-to-Moldova-for-LGBT-rights--a-hoax-promoted-by-pro-Russian-influencers/",
      ],
    },
  },
  {
    id: "sandu-sperm",
    goal: 2,
    about: "Сексистская атака на женщину-президента через клон журнала и украденное имя журналистки",
    language: "ru",
    text: "Майя Санду незаконно купила сперму Элтона Джона и Рики Мартина за 400 000 долларов, сообщил журнал OK! Magazine.",
    gold: {
      keywords: ["сперм", "400"],
      misleading: true,
      acceptable: ["against", "flagged", "split", "unverifiable"],
      rootWindow: { from: "2025-07-20", to: "2025-08-04" },
      expectDomains: ["mythdetector.com", "cotidianul.md", "stopfals.md"],
      note: "Источник — клон сайта OK! Magazine; журналистка подтвердила, что статья не её",
      references: [
        "https://mythdetector.com/en/fake-document-targeting-maia-sandu/",
        "https://cotidianul.md/en/10916/Russian-propaganda-launches-a-new-hoax-about-Maia-Sandu-expert--the-goal-is-to-fuel-phobias-related-to-sexuality--gender-and-social-status/",
      ],
    },
  },
  {
    id: "istanbul-convention",
    goal: 2,
    about: "Смешаны реальные факты и ложный вывод: нужна хронология подписания и ратификации",
    language: "ru",
    text: "Майя Санду единолично решила присоединить Молдову к Стамбульской конвенции и фактически легализовала нетрадиционные семьи.",
    gold: {
      keywords: ["стамбульск"],
      misleading: true,
      acceptable: ["against", "flagged", "split"],
      expectDomains: ["euvsdisinfo.eu", "stopfals.md", "coe.int", "parlament.md"],
      note: "Подписана в 2017 при другой власти, ратифицирована парламентом в 2021; брак конвенция не определяет",
      references: [
        "https://euvsdisinfo.eu/report/maia-sandu-decided-on-moldovas-accession-to-the-istanbul-convention-essentially-legalising-non-traditional-families/",
      ],
    },
  },
  {
    id: "control-ratification",
    goal: 2,
    about: "Контроль: верный факт. Движок не должен помечать его как спорный",
    language: "ru",
    text: "Парламент Молдовы 14 октября 2021 года окончательно проголосовал за ратификацию Стамбульской конвенции.",
    gold: {
      keywords: ["ратифик", "стамбульск"],
      misleading: false,
      acceptable: ["converge"],
      rootWindow: { from: "2021-10-01", to: "2021-10-31" },
      expectDomains: ["eurointegration.com.ua", "parlament.md", "coe.int", "moldpres.md", "newsmaker.md"],
      note: "Подтверждается сообщениями того времени",
      references: ["https://www.eurointegration.com.ua/rus/news/2021/10/29/7129622/"],
    },
  },
  {
    id: "control-sandu-speech",
    goal: 1,
    about: "Контроль: заявление реально сделано. Проверяем факт заявления, а не сумму",
    language: "ro",
    text: "Maia Sandu a declarat pe 22 septembrie 2025 că Kremlinul cheltuie sute de milioane de euro pentru a cumpăra voturi în Republica Moldova.",
    gold: {
      keywords: ["kremlin", "milioane"],
      misleading: false,
      acceptable: ["converge", "split"],
      rootWindow: { from: "2025-09-20", to: "2025-09-24" },
      expectDomains: [
        "kyivindependent.com",
        "presedinte.md",
        "reuters.com",
        "moldpres.md",
        "theglobeandmail.com",
      ],
      note: "Заявление сделано 22 сентября 2025, независимой проверки общей суммы нет",
      references: [
        "https://kyivindependent.com/moldovas-president-warns-of-kremlin-interference-urges-citizens-to-defend-european-path/",
      ],
    },
  },
];
