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
    pageUrl: "https://www.youtube.com/watch?v=13R5R5nTcsk",
    platform: "youtube",
    platformVideoId: "13R5R5nTcsk",
    title: "Новая система в аэропорту Кишинёва: электронные ворота для пассажиров без багажа",
    durationSec: 141, // 02:21 — точно соответствует ролику TV8 13R5R5nTcsk
    language: "ru",
    thumbnailUrl: "https://i.ytimg.com/vi/13R5R5nTcsk/hqdefault.jpg",
  },
  status: "completed",
  processedUntil: 141,

  /** Агрегированная сводка для верхней/нижней плашки и боковой панели «Разбор» */
  summary: {
    title: "Позиции источников по 4 утверждениям",
    subtitle: "Общего вердикта нет — смотрите каждое утверждение",
    totalClaims: 4,
    totalSources: 10,
    primarySourcesCount: 2,
    consensusBreakdown: {
      converge: 2, // 2 Сходятся (позиции совпадают: аэропорт, Албишоара)
      split: 0, //    0 Разделились
      against: 2, //  2 Большинство против (газ 30%, вода кипит везде при 100°C)
      flagged: 2, //  2 С флагами (Албишоара: раздуто; газ: раздуто)
    },
    flagBreakdown: {
      exaggerated: 2, // ~ Раздуто 2
      outdated: 0,
    },
    suggestedQuestions: ["Кто первоисточник?", "Что исказили?", "Когда это было?"],
    footerNote: "* Каждое утверждение кликабельно — откроются источники и цепочка пересказов",
  },

  factChecks: [
    {
      id: "clm_flood_01",
      status: "done",
      range: { start: 4, end: 12 }, // 00:04–00:12
      quote: "«В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано...»",
      claim: "В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано",
      category: "event",
      speaker: "Ведущий",
      consensus: "flagged",
      consensusSummary: "раздуто • подтверждено",
      sides: { for: 2, against: 0, mixed: 1 },

      flags: [
        {
          type: "exaggerated",
          label: "Раздуто",
          detail: "«затруднено» → «парализовано»",
          severity: "warning",
        },
      ],

      keyFinding: {
        title: "Движение было затруднено, а не парализовано",
        subtitle: "Мэрия и TV8 подтверждают подтопление, но в пересказах преувеличен масштаб",
      },

      provenance: {
        primarySourceCount: 1,
        totalSourcesCount: 4,
        selectedEdgeId: "edge_newsmaker_point",

        /** Мини-превью «Путь утверждения» для карточки разбора на Экране 1 */
        pathSummary: [
          {
            name: "Примэрия Кишинёва",
            date: "14.09.2024",
            tag: "первоисточник",
          },
          {
            name: "NewsMaker",
            date: "14.09.2024",
            tag: "пересказ",
          },
          {
            name: "TV8",
            date: "14.09.2024",
            tag: "репортаж с места",
          },
          {
            name: "Point.md",
            date: "14.09.2024",
            tag: "затруднено → парализовано",
            isDistortion: true,
          },
        ],

        timelineDates: [
          "14 сентября 2024, 15:20",
          "14 сентября 2024, 16:15",
          "14 сентября 2024, 16:40",
          "14 сентября 2024, 17:10",
        ],

        timelineGaps: [],

        nodes: [
          {
            id: "src_chisinau_md",
            name: "Примэрия Кишинёва",
            shortCode: "ПК",
            category: "official",
            categoryLabel: "официальный",
            role: "primary",
            isPrimary: true,
            date: "14 сентября 2024, 15:20",
            isoDate: "2024-09-14T15:20:00Z",
            quote:
              "«Serviciile municipale intervin pe strada Albișoara în urma ploilor torențiale. Traficul este restricționat temporar.»",
            url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
            },
            column: 0,
            row: 0,
          },
          {
            id: "src_newsmaker_md",
            name: "NewsMaker",
            shortCode: "NM",
            category: "media",
            categoryLabel: "СМИ",
            role: "retelling",
            date: "14 сентября 2024, 16:40",
            isoDate: "2024-09-14T16:40:00Z",
            quote:
              "«В Кишинёве из-за сильного ливня затопило улицу Албишоара: движение затруднено, коммунальные службы откачивают воду.»",
            url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
            },
            column: 1,
            row: 0,
          },
          {
            id: "src_tv8_md",
            name: "TV8",
            shortCode: "T8",
            category: "media",
            categoryLabel: "СМИ",
            role: "confirmation",
            date: "14 сентября 2024, 16:15",
            isoDate: "2024-09-14T16:15:00Z",
            quote:
              "«Strada Albișoara sub ape după ploaia torențială. Mașini blocate și trafic suspendat pe carosabil.»",
            url: "https://tv8.md/2024/09/14/video-strada-albisoara-sub-ape-dupa-ploaia-torentiala-masini-blocate-in-chisinau/",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://tv8.md/2024/09/14/video-strada-albisoara-sub-ape-dupa-ploaia-torentiala-masini-blocate-in-chisinau/",
            },
            column: 1,
            row: 1,
          },
          {
            id: "src_point_md",
            name: "Point.md",
            shortCode: "PT",
            category: "media",
            categoryLabel: "СМИ",
            role: "distortion",
            date: "14 сентября 2024, 17:10",
            isoDate: "2024-09-14T17:10:00Z",
            quote:
              "«В Кишинёве затопило улицу Албишоара: движение полностью парализовано, десятки машин ушли под воду.»",
            tags: ["✂ затруднено → парализовано", "⚡ гипербола"],
            url: "https://point.md/ru/novosti/obschestvo/v-kishineve-zatopilo-ulitsu-albishoara-dvizhenie-paralizovano/",
            action: {
              type: "open_source",
              label: "Открыть источник ↗",
              url: "https://point.md/ru/novosti/obschestvo/v-kishineve-zatopilo-ulitsu-albishoara-dvizhenie-paralizovano/",
            },
            column: 2,
            row: 0,
          },
          {
            id: "src_target_video",
            name: "Сюжет в видео",
            shortCode: "ТВ",
            category: "media",
            categoryLabel: "видео",
            role: "target",
            date: "00:04",
            isoDate: "2024-09-14T17:30:00Z",
            quote: "«В Кишинёве из-за сильного ливня затопило улицу Албишоара, движение парализовано»",
            tags: ["⚡ парализовано"],
            url: "https://www.youtube.com/watch?v=13R5R5nTcsk&t=4",
            action: {
              type: "watch_fragment",
              label: "Смотреть фрагмент ↗",
              timecodeSec: 4,
            },
            column: 3,
            row: 0,
          },
        ],

        edges: [
          {
            id: "edge_chisinau_newsmaker",
            fromNodeId: "src_chisinau_md",
            toNodeId: "src_newsmaker_md",
            relationType: "direct",
            label: "пересказ со ссылкой на примэрию",
          },
          {
            id: "edge_chisinau_tv8",
            fromNodeId: "src_chisinau_md",
            toNodeId: "src_tv8_md",
            relationType: "confirmation",
            label: "независимый репортаж с места событий",
          },
          {
            id: "edge_newsmaker_point",
            fromNodeId: "src_newsmaker_md",
            toNodeId: "src_point_md",
            relationType: "distorted",
            label: "пересказ с преувеличением",
            hasDistortion: true,
            diff: {
              before: {
                sourceName: "NewsMaker",
                date: "14 сент. 16:40",
                text: "движение транспорта затруднено, коммунальные службы откачивают воду",
              },
              after: {
                sourceName: "Point.md",
                date: "14 сент. 17:10",
                text: "движение полностью парализовано, десятки машин ушли под воду",
              },
              changes: [
                {
                  category: "numbers",
                  categoryLabel: "Масштаб",
                  description: "«движение затруднено» → «полностью парализовано»",
                },
                {
                  category: "confidence",
                  categoryLabel: "Ссылка",
                  description: "исчезла ссылка на примэрию Кишинёва",
                },
              ],
            },
          },
          {
            id: "edge_point_target",
            fromNodeId: "src_point_md",
            toNodeId: "src_target_video",
            relationType: "likely_derived",
            label: "пересказ заголовка Point.md",
          },
        ],
      },

      sources: [
        {
          id: "src_chisinau_md",
          url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
          title: "Intervenția serviciilor municipale pe strada Albișoara",
          publisher: "Примэрия Кишинёва",
          domain: "chisinau.md",
          sourceType: "government",
          publishedAt: "2024-09-14T15:20:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "În urma averselor torențiale, echipele Regiei Exdrupo și Apă-Canal Chișinău intervin pe strada Albișoara. Traficul este restricționat temporar.",
          stance: "supports",
        },
        {
          id: "src_newsmaker_md",
          url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
          title: "В Кишиневе из-за ливня затопило улицу Албишоара: движение затруднено",
          publisher: "NewsMaker",
          domain: "newsmaker.md",
          sourceType: "news",
          publishedAt: "2024-09-14T16:40:00Z",
          language: "ru",
          country: "MD",
          snippet:
            "В Кишинёве после сильного ливня затопило улицу Албишоара, движение транспорта затруднено. Коммунальные службы откачивают воду, сообщили в мэрии.",
          stance: "supports",
        },
        {
          id: "src_tv8_md",
          url: "https://tv8.md/2024/09/14/video-strada-albisoara-sub-ape-dupa-ploaia-torentiala-masini-blocate-in-chisinau/",
          title: "Strada Albișoara sub ape după ploaia torențială",
          publisher: "TV8",
          domain: "tv8.md",
          sourceType: "news",
          publishedAt: "2024-09-14T16:15:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "Strada Albișoara a fost inundată după ploaia torențială. Mai multe mașini au rămas blocate pe carosabil, iar transportul public a fost deviat.",
          stance: "supports",
        },
        {
          id: "src_point_md",
          url: "https://point.md/ru/novosti/obschestvo/v-kishineve-zatopilo-ulitsu-albishoara-dvizhenie-paralizovano/",
          title: "В Кишинёве затопило улицу Албишоара: движение парализовано",
          publisher: "Point.md",
          domain: "point.md",
          sourceType: "news",
          publishedAt: "2024-09-14T17:10:00Z",
          language: "ru",
          country: "MD",
          snippet:
            "Мощный ливень парализовал движение на улице Албишоара. Вода залила проезжую часть, автомобили с трудом преодолевают водную преграду.",
          stance: "mixed",
        },
      ],

      checkedAt: "2024-09-14T18:00:00Z",
    },

    {
      id: "clm_airport_01",
      status: "done",
      range: { start: 20, end: 35 }, // 00:20–00:35
      quote:
        "«В аэропорту Кишинёва пассажиры без багажа могут пройти прямо к контролю безопасности через новые смарт-ворота»",
      claim:
        "В аэропорту Кишинёва установили электронные ворота для пассажиров без багажа с онлайн-регистрацией.",
      category: "event",
      speaker: "TV8",
      consensus: "converge",
      consensusSummary: "позиции совпадают",
      sides: { for: 3, against: 0, mixed: 0 },
      flags: [],
      sources: [
        {
          id: "src_airport_admin",
          url: "https://airport.md/ro/press/sistem-porti-electronice-pax-track",
          title: "Sistem modern de porți electronice la Aeroportul Internațional Chișinău",
          publisher: "Аэропорт Кишинёва",
          domain: "airport.md",
          sourceType: "government",
          publishedAt: "2024-07-04T10:00:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "La Aeroportul Chișinău a fost dat în exploatare sistemul Pax Track cu 9 porți electronice pentru fluidizarea fluxului de pasageri fără bagaj.",
          stance: "supports",
        },
        {
          id: "src_tv8_airport",
          url: "https://tv8.md/2024/07/04/video-fara-cozi-la-aeroport-pasagerii-fara-bagaj-de-cala-pot-trece-direct-la-controlul-de-securitate/",
          title: "Fără cozi la aeroport: Pasagerii fără bagaj pot trece direct la control",
          publisher: "TV8",
          domain: "tv8.md",
          sourceType: "news",
          publishedAt: "2024-07-04T11:30:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "Pasagerii fără bagaje de cală pot evita cozile de la check-in scanând biletul la porțile electronice inteligente din aeroport.",
          stance: "supports",
        },
        {
          id: "src_nm_airport",
          url: "https://newsmaker.md/ro/fara-cozi-la-aeroportul-chisinau-a-fost-instalat-un-sistem-cu-porti-electronice-pentru-pasagerii-fara-bagaj/",
          title: "Fără cozi la Aeroportul Chișinău: a fost instalat un sistem cu porți electronice",
          publisher: "NewsMaker",
          domain: "newsmaker.md",
          sourceType: "news",
          publishedAt: "2024-07-04T12:00:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "În terminalul Aeroportului Chișinău au fost instalate porți inteligente care permit accesul direct la controlul de securitate.",
          stance: "supports",
        },
      ],
      checkedAt: "2024-07-04T14:00:00Z",
    },

    {
      id: "clm_gas_01",
      status: "done",
      range: { start: 50, end: 65 }, // 00:50–01:05
      quote: "«С первого октября цены на газ в Молдове выросли на тридцать процентов»",
      claim: "С 1 октября цены на газ в Молдове выросли на 30%.",
      category: "statistic",
      speaker: "Ведущий",
      consensus: "against",
      consensusSummary: "источники возражают",
      sides: { for: 0, against: 2, mixed: 0 },
      flags: [
        {
          type: "exaggerated",
          label: "Раздуто",
          detail: "13% → 30%",
          severity: "danger",
        },
      ],
      sources: [
        {
          id: "src_energie_gov",
          url: "https://energie.gov.md/ro/press/precizari-privind-tariful-la-gaze-naturale",
          title: "Precizări ale Ministerului Energiei privind tarifele la gazele naturale",
          publisher: "Министерство энергетики Молдовы",
          domain: "energie.gov.md",
          sourceType: "government",
          publishedAt: "2024-09-28T09:00:00Z",
          language: "ro",
          country: "MD",
          snippet:
            "ANRE a aprobat o ajustare a tarifului la gazele naturale de până la 13%, infirmând speculațiile despre o creștere de 30%.",
          stance: "refutes",
        },
        {
          id: "src_point_gas",
          url: "https://point.md/ru/novosti/ekonomika/anre-utverdilo-novye-tarify-na-gaz/",
          title: "НКРЭ утвердило новые тарифы на газ для потребителей",
          publisher: "Point.md",
          domain: "point.md",
          sourceType: "news",
          publishedAt: "2024-09-29T11:00:00Z",
          language: "ru",
          country: "MD",
          snippet:
            "Регулятор пересмотрел тариф на природный газ: итоговый рост составил около 13%, а не 30%, как утверждалось в соцсетях.",
          stance: "refutes",
        },
      ],
      checkedAt: "2024-10-01T10:00:00Z",
    },

    {
      id: "clm_02",
      status: "done",
      range: { start: 80, end: 95 }, // 01:20–01:35
      quote: "«Вода кипит при ста градусах везде, хоть на море, хоть в горах»",
      claim: "Вода кипит при 100 °C на любой высоте над уровнем моря.",
      category: "scientific",
      speaker: "Гость",
      consensus: "against",
      consensusSummary: "источники возражают",
      sides: { for: 0, against: 3, mixed: 0 },
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
      checkedAt: "2024-10-01T10:05:00Z",
    },
  ],
};
