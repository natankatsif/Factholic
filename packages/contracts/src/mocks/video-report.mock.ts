/**
 * МОК ДЛЯ ДИЗАЙНА И РАЗРАБОТКИ ФРОНТЕНДА (factholic).
 * В точности воспроизводит данные с макетов экранов:
 * 1. Экран 1: Главный экран разбора видео (плеер, сводная плашка консенсуса, боковая панель «Разбор», путь пересказов)
 * 2. Экран 2: Детальный вид («Дерево источников», таймлайн с разрывом 3,5 года, бейджи искажений, панель diff)
 */
import type { VideoReport } from "../fact-check.ts";

export const MOCK_VIDEO_REPORT: VideoReport = {
  jobId: "job_factholic_01",
  video: {
    pageUrl: "https://www.youtube.com/watch?v=MOCK123",
    platform: "youtube",
    platformVideoId: "MOCK123",
    title: "Экстренный выпуск: происшествия в городе, экономика и наука",
    durationSec: 1860, // 31:00
    language: "ru",
    thumbnailUrl: "https://i.ytimg.com/vi/MOCK123/hqdefault.jpg",
  },
  status: "processing",
  processedUntil: 1530, // 25:30

  /** Агрегированная сводка для верхней/нижней плашки и боковой панели «Разбор» */
  summary: {
    title: "Позиции источников по 4 утверждениям",
    subtitle: "Общего вердикта нет - смотрите каждое утверждение",
    totalClaims: 4,
    totalSources: 11,
    primarySourcesCount: 1,
    consensusBreakdown: {
      converge: 1, // 1 Сходятся (позиции совпадают)
      split: 1, //    1 Разделились (мнения расходятся)
      against: 1, //  1 Большинство против (источники возражают)
      flagged: 1, //  1 С флагами (раздуто • старое)
    },
    flagBreakdown: {
      exaggerated: 1, // ~ Раздуто 1
      outdated: 1, //    Старый контент 1
    },
    suggestedQuestions: ["Кто первоисточник?", "Что исказили?", "Когда это было?"],
    footerNote: "* Каждое утверждение кликабельно — откроются источники и цепочка пересказов",
  },

  factChecks: [
    {
      id: "clm_fire_01",
      status: "done",
      range: { start: 135, end: 145 }, // 02:15
      quote: "«Вчера сгорел торговый центр, 200 пострадавших...»",
      claim: "Вчера сгорел торговый центр, 200 пострадавших",
      category: "event",
      speaker: "Город MD",
      consensus: "flagged",
      consensusSummary: "раздуто • старое",

      flags: [
        {
          type: "outdated",
          label: "Старый контент",
          detail: "первоисточник от 14.03.2023",
          severity: "warning",
        },
        {
          type: "exaggerated",
          label: "Раздуто",
          detail: "2 → 200 пострадавших",
          severity: "danger",
        },
      ],

      keyFinding: {
        title: "Событию 3,5 года",
        subtitle: "в видео подано как вчерашнее",
      },

      provenance: {
        primarySourceCount: 1,
        totalSourcesCount: 5,
        selectedEdgeId: "edge_srochno_gorod",

        /** Мини-превью «Путь утверждения» для карточки разбора на Экране 1 */
        pathSummary: [
          {
            name: "Новости MD",
            date: "14.03.2023",
            tag: "оригинал",
          },
          {
            name: "Портал Х",
            date: "2023",
            tag: "пересказ",
          },
          {
            name: "Срочно MD",
            date: "сен 2026",
            tag: "склад → ТЦ",
            isDistortion: true,
          },
          {
            name: "Город MD",
            date: "окт 2026",
            tag: "2 → 200",
            isDistortion: true,
          },
        ],

        timelineDates: ["14 марта 2023", "март 2023", "сентябрь 2026", "октябрь 2026"],

        timelineGaps: [
          {
            afterNodeId: "src_city_hall",
            beforeNodeId: "src_srochno_md",
            label: "3,5 года тишины",
          },
        ],

        nodes: [
          {
            id: "src_news_md",
            name: "Новости MD",
            shortCode: "HM",
            category: "media",
            categoryLabel: "СМИ",
            role: "primary",
            isPrimary: true,
            date: "14 марта 2023",
            isoDate: "2023-03-14T08:00:00Z",
            quote: "«Пожар на складе рядом с ТЦ, 2 пострадавших»",
            url: "https://novosti-md.example/fire-warehouse-2023",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://novosti-md.example/fire-warehouse-2023",
            },
            column: 0,
            row: 0,
          },
          {
            id: "src_portal_x",
            name: "Портал Х",
            shortCode: "СМИ",
            category: "media",
            categoryLabel: "СМИ",
            role: "retelling",
            date: "март 2023",
            isoDate: "2023-03-16T12:30:00Z",
            quote: "«Пожар на складе рядом с ТЦ, двое пострадавших»",
            url: "https://portal-x.example/fire-warehouse",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://portal-x.example/fire-warehouse",
            },
            column: 1,
            row: 0,
          },
          {
            id: "src_city_hall",
            name: "Мэрия Кишинёва",
            shortCode: "MK",
            category: "official",
            categoryLabel: "официальный",
            role: "confirmation",
            date: "15.03.2023",
            isoDate: "2023-03-15T09:15:00Z",
            quote: "«На складе произошёл пожар, пострадали 2 человека»",
            url: "https://chisinau.md/press/warehouse-incident",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://chisinau.md/press/warehouse-incident",
            },
            column: 1,
            row: 1,
          },
          {
            id: "src_srochno_md",
            name: "Срочно MD",
            shortCode: "CM",
            category: "official",
            categoryLabel: "официальный",
            role: "distortion",
            date: "сентябрь 2026",
            isoDate: "2026-09-12T14:20:00Z",
            quote: "«Сгорел ТЦ рядом с рынком, 2 пострадавших»",
            tags: ["@ дата убрана", "✂ склад → ТЦ"],
            url: "https://t.me/srochno_md/4921",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://t.me/srochno_md/4921",
            },
            column: 2,
            row: 0,
          },
          {
            id: "src_gorod_md",
            name: "Город MD",
            shortCode: "ГМ",
            category: "official",
            categoryLabel: "официальный",
            role: "target",
            date: "октябрь 2026 • 02:15",
            isoDate: "2026-10-02T02:15:00Z",
            quote: "«Вчера сгорел торговый центр, 200 пострадавших»",
            tags: ["@ вчера", "⚡ 2 → 200"],
            url: "https://www.youtube.com/watch?v=MOCK123&t=135",
            action: {
              type: "watch_fragment",
              label: "Смотреть фрагмент ↗",
              timecodeSec: 135,
            },
            column: 3,
            row: 0,
          },
        ],

        edges: [
          {
            id: "edge_news_portal",
            fromNodeId: "src_news_md",
            toNodeId: "src_portal_x",
            relationType: "direct",
            label: "пересказ без изменений",
          },
          {
            id: "edge_news_city",
            fromNodeId: "src_news_md",
            toNodeId: "src_city_hall",
            relationType: "confirmation",
            label: "подтверждает: 2 пострадавших",
          },
          {
            id: "edge_portal_srochno",
            fromNodeId: "src_portal_x",
            toNodeId: "src_srochno_md",
            relationType: "likely_derived",
            label: "вероятно взято отсюда",
          },
          {
            id: "edge_srochno_gorod",
            fromNodeId: "src_srochno_md",
            toNodeId: "src_gorod_md",
            relationType: "distorted",
            label: "сен 2026 → окт 2026 • пересказ с изменениями",
            hasDistortion: true,
            diff: {
              before: {
                sourceName: "Срочно MD",
                date: "сен 2026",
                text: "Сгорел ТЦ рядом с рынком, 2 пострадавших",
              },
              after: {
                sourceName: "Город MD, 02:15",
                date: "окт 2026",
                text: "Вчера сгорел торговый центр, 200 пострадавших",
              },
              changes: [
                {
                  category: "numbers",
                  categoryLabel: "Цифры",
                  description: "«2» → «200», в 100 раз больше",
                },
                {
                  category: "location",
                  categoryLabel: "Место",
                  description: "«рядом с рынком» — убрано",
                },
                {
                  category: "time",
                  categoryLabel: "Время",
                  description: "даты не было → «вчера»",
                },
                {
                  category: "confidence",
                  categoryLabel: "Уверенность",
                  description: "подано от себя, без ссылки на канал",
                },
              ],
            },
          },
        ],
      },

      sources: [
        {
          id: "src_news_md",
          url: "https://novosti-md.example/fire-warehouse-2023",
          title: "Пожар на складе возле торгового центра",
          publisher: "Новости MD",
          domain: "novosti.md",
          sourceType: "news",
          publishedAt: "2023-03-14T08:00:00Z",
          language: "ru",
          country: "MD",
          snippet:
            "В Кишинёве ликвидирован пожар на складе стройматериалов рядом с ТЦ. Пострадали два человека.",
          stance: "refutes",
        },
        {
          id: "src_portal_x",
          url: "https://portal-x.example/fire-warehouse",
          title: "Склад возле ТЦ: подробности пожара",
          publisher: "Портал Х",
          domain: "portal-x.md",
          sourceType: "news",
          publishedAt: "2023-03-16T12:30:00Z",
          language: "ru",
          country: "MD",
          snippet: "По уточненным данным экстренных служб, двое работников склада госпитализированы.",
          stance: "refutes",
        },
        {
          id: "src_city_hall",
          url: "https://chisinau.md/press/warehouse-incident",
          title: "Официальное заявление примэрии Кишинёва",
          publisher: "Мэрия Кишинёва",
          domain: "chisinau.md",
          sourceType: "government",
          publishedAt: "2023-03-15T09:15:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "Pe depozitul din sectorul Rîșcani a avut loc un incendiu. Două persoane au fost rănite ușor.",
          stance: "refutes",
        },
        {
          id: "src_srochno_md",
          url: "https://t.me/srochno_md/4921",
          title: "Пожар у рынка",
          publisher: "Срочно MD",
          domain: "t.me",
          sourceType: "news",
          publishedAt: "2026-09-12T14:20:00Z",
          language: "ru",
          snippet: "Сгорел ТЦ рядом с рынком, 2 пострадавших.",
          stance: "mixed",
        },
        {
          id: "src_gorod_md",
          url: "https://www.youtube.com/watch?v=MOCK123&t=135",
          title: "Фрагмент видеосюжета",
          publisher: "Город MD",
          domain: "youtube.com",
          sourceType: "news",
          publishedAt: "2026-10-02T02:15:00Z",
          language: "ru",
          snippet: "Вчера сгорел торговый центр, 200 пострадавших.",
          stance: "supports",
        },
      ],

      checkedAt: "2026-10-03T10:00:12Z",
    },

    {
      id: "clm_02",
      status: "done",
      range: { start: 290, end: 300 }, // 04:50–05:00
      quote: "«Вода кипит при ста градусах везде, хоть на море, хоть в горах»",
      claim: "Вода кипит при 100 °C на любой высоте над уровнем моря.",
      category: "scientific",
      speaker: "Гость",
      consensus: "against",
      consensusSummary: "источники возражают",
      flags: [],
      sources: [
        {
          id: "src_02_1",
          url: "https://www.britannica.com/science/boiling-point",
          title: "Boiling point | Definition & Temperature",
          publisher: "Encyclopaedia Britannica",
          domain: "britannica.com",
          sourceType: "encyclopedia",
          language: "en",
          country: "GB",
          snippet: "The boiling point of water is 100 °C only at standard atmospheric pressure.",
          stance: "refutes",
        },
        {
          id: "src_02_2",
          url: "https://www.usgs.gov/water-science-school/boiling-point-altitude",
          title: "Boiling Point of Water and Altitude",
          publisher: "U.S. Geological Survey",
          domain: "usgs.gov",
          sourceType: "government",
          publishedAt: "2019-06-05T00:00:00Z",
          language: "en",
          country: "US",
          snippet: "At higher altitudes the air pressure is lower, so water boils at a lower temperature.",
          stance: "refutes",
        },
        {
          id: "src_02_3",
          url: "https://ru.wikipedia.org/wiki/Температура_кипения",
          title: "Температура кипения — Википедия",
          publisher: "Википедия",
          domain: "ru.wikipedia.org",
          sourceType: "encyclopedia",
          language: "ru",
          snippet: "При понижении давления температура кипения воды снижается.",
          stance: "refutes",
        },
      ],
      checkedAt: "2026-10-03T10:05:00Z",
    },

    {
      id: "clm_03",
      status: "done",
      range: { start: 420, end: 432 }, // 07:00–07:12
      quote: "«Инфляция в стране упала до четырёх процентов к началу осени»",
      claim: "Уровень годовой инфляции снизился до 4,2% к началу осени.",
      category: "statistic",
      speaker: "Ведущий",
      consensus: "split",
      consensusSummary: "мнения расходятся",
      flags: [],
      sources: [
        {
          id: "src_03_1",
          url: "https://statistica.gov.md/cpi-2026",
          title: "Индекс потребительских цен",
          publisher: "Национальное бюро статистики",
          domain: "statistica.gov.md",
          sourceType: "government",
          publishedAt: "2026-09-15T00:00:00Z",
          language: "ru",
          country: "MD",
          snippet: "Годовая инфляция в августе составила 4,8%, с тенденцией к замедлению.",
          stance: "mixed",
        },
        {
          id: "src_03_2",
          url: "https://bnm.md/press/inflation-report-q3",
          title: "Отчёт по денежной политике",
          publisher: "Национальный банк",
          domain: "bnm.md",
          sourceType: "government",
          publishedAt: "2026-09-20T00:00:00Z",
          language: "ro",
          country: "MD",
          snippet: "Rata inflației de bază a atins 4,2% în luna septembrie.",
          stance: "supports",
        },
      ],
      checkedAt: "2026-10-03T10:08:00Z",
    },

    {
      id: "clm_04",
      status: "done",
      range: { start: 610, end: 625 }, // 10:10–10:25
      quote: "«Новый мост в столице открыли точно в срок в августе»",
      claim: "Открытие нового моста состоялось в запланированный срок в августе.",
      category: "event",
      speaker: "Корреспондент",
      consensus: "converge",
      consensusSummary: "позиции совпадают",
      flags: [],
      sources: [
        {
          id: "src_04_1",
          url: "https://gov.md/press/bridge-opening-2026",
          title: "Мост сдан в эксплуатацию в установленный графиком срок",
          publisher: "Министерство инфраструктуры",
          domain: "gov.md",
          sourceType: "government",
          publishedAt: "2026-08-30T10:00:00Z",
          language: "ru",
          country: "MD",
          snippet: "Строительство моста завершено 28 августа в строгом соответствии с графиком проекта.",
          stance: "supports",
        },
      ],
      checkedAt: "2026-10-03T10:12:00Z",
    },
  ],
};
