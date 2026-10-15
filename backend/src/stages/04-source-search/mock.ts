import type { ClaimId } from "@news/contracts";
import type { Stage } from "../../pipeline/context.ts";
import { mockClaim, mockDemoClaims } from "../03-claim-extraction/mock.ts";
import type { SourceSearchInput, SourceSearchOutput } from "./types.ts";

export const mockSourceSearchInput: SourceSearchInput = {
  claim: mockClaim,
  maxSources: 5,
  searchLanguages: ["ru", "ro", "en"],
};

export const mockSourceSearchOutput: SourceSearchOutput = {
  claimId: "clm_flood_01",
  queries: [
    { text: "Албишоара затопило ливень Кишинев", language: "ru", engine: "tavily" },
    { text: "inundatie strada Albisoara Chisinau ploaie", language: "ro", engine: "tavily" },
    { text: "Chisinau Albisoara street flood", language: "en", engine: "tavily" },
  ],
  copies: [
    {
      id: "clm_flood_c1",
      url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
      title: "Intervenția serviciilor municipale pe strada Albișoara",
      publisher: "Примэрия Кишинёва",
      domain: "chisinau.md",
      sourceType: "government",
      language: "ro",
      publishedAt: "2024-09-14T15:20:00.000Z",
      dateSource: "page",
      excerpt: "În urma averselor torențiale s-au înregistrat acumulări de apă pe strada Albișoara…",
      outboundLinks: [],
      attributions: [],
      earliestSearch: true,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
    {
      id: "clm_flood_c2",
      url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
      title: "В Кишиневе из-за ливня затопило улицу Албишоара: движение затруднено",
      publisher: "NewsMaker",
      domain: "newsmaker.md",
      sourceType: "news",
      language: "ru",
      publishedAt: "2024-09-14T16:40:00.000Z",
      dateSource: "page",
      excerpt:
        "В Кишинёве после сильного ливня затопило улицу Албишоара, движение затруднено, сообщили в мэрии…",
      outboundLinks: ["https://chisinau.md/ro/press/interventie-servicii-strada-albisoara"],
      attributions: ["сообщили в мэрии"],
      earliestSearch: false,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
  ],
  sources: [
    {
      id: "src_flood_1",
      url: "https://chisinau.md/ro/press/interventie-servicii-strada-albisoara",
      title: "Intervenția serviciilor municipale pe strada Albișoara",
      publisher: "Примэрия Кишинёва",
      domain: "chisinau.md",
      sourceType: "government",
      language: "ro",
      country: "MD",
      publishedAt: "2024-09-14T15:20:00Z",
      excerpt:
        "În urma averselor torențiale s-au înregistrat acumulări de apă pe strada Albișoara. Serviciile municipale intervin pentru evacuarea apei, traficul fiind temporar restricționat pe tronsonul dintre străzile Ismail și Mihai Viteazul.",
      snippet:
        "În urma averselor torențiale, echipele Regiei Exdrupo și Apă-Canal Chișinău intervin pe strada Albișoara. Traficul este restricționat temporar.",
      domainReliability: 0.95,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
    {
      id: "src_flood_2",
      url: "https://newsmaker.md/rus/novosti/v-kishineve-iz-za-livnya-zatopilo-ulitsu-albishoara-dvizhenie-zatrudneno/",
      title: "В Кишиневе из-за ливня затопило улицу Албишоара: движение затруднено",
      publisher: "NewsMaker",
      domain: "newsmaker.md",
      sourceType: "news",
      publishedAt: "2024-09-14T16:40:00Z",
      language: "ru",
      country: "MD",
      excerpt:
        "В Кишинёве после сильного ливня затопило улицу Албишоара. Движение транспорта затруднено, коммунальные службы откачивают воду, сообщили в мэрии столицы.",
      snippet:
        "В Кишинёве после сильного ливня затопило улицу Албишоара, движение транспорта затруднено. Коммунальные службы откачивают воду, сообщили в мэрии.",
      domainReliability: 0.88,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
    {
      id: "src_flood_3",
      url: "https://point.md/ru/novosti/obschestvo/v-kishineve-zatopilo-ulitsu-albishoara-dvizhenie-paralizovano/",
      title: "В Кишинёве затопило улицу Албишоара: движение полностью парализовано",
      publisher: "Point.md",
      domain: "point.md",
      sourceType: "news",
      publishedAt: "2024-09-14T17:10:00Z",
      language: "ru",
      country: "MD",
      excerpt:
        "Мощный ливень парализовал движение на улице Албишоара в Кишинёве: десятки автомобилей застряли в воде, проехать практически невозможно.",
      snippet:
        "Мощный ливень парализовал движение на улице Албишоара. Вода залила проезжую часть, автомобили с трудом преодолевают водную преграду.",
      domainReliability: 0.75,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
    {
      id: "src_flood_4",
      url: "https://tv8.md/2024/09/14/video-strada-albisoara-sub-ape-dupa-ploaia-torentiala-masini-blocate-in-chisinau/",
      title: "Strada Albișoara sub ape după ploaia torențială",
      publisher: "TV8",
      domain: "tv8.md",
      sourceType: "news",
      publishedAt: "2024-09-14T16:15:00Z",
      language: "ro",
      country: "MD",
      excerpt:
        "Ploaia torențială a transformat din nou strada Albișoara într-un râu. Nivelul apei a crescut rapid, mai multe mașini au rămas blocate pe carosabil, iar poliția a intervenit pentru redirecționarea traficului.",
      snippet:
        "Strada Albișoara a fost inundată după ploaia torențială. Mai multe mașini au rămas blocate pe carosabil, iar transportul a fost deviat.",
      domainReliability: 0.9,
      retrievedAt: "2024-09-14T18:00:00Z",
    },
  ],
};

// ===================== ДЕМО-СЦЕНАРИИ =====================

const RETRIEVED_AT = "2024-09-14T18:00:00Z";
const { airport, population, snow, water, flood, gas, schools } = mockDemoClaims;

/**
 * Источники демо-тезисов (mockDemoClaims из мока 03). Тексты и ссылки выдуманы: у общеизвестных фактов домены
 * настоящие ради фавиконок, у местных новостей — издатели «(пример)» и домены *.example. На id источников
 * построены моки 05, 06, 08 — меняй вместе.
 */
export const mockDemoSearch: Record<ClaimId, SourceSearchOutput> = {
  [flood.id]: mockSourceSearchOutput,

  [airport.id]: {
    claimId: airport.id,
    queries: [
      { text: "аэропорт Кишинев электронные ворота", language: "ru", engine: "tavily" },
      { text: "Aeroportul Chisinau porti electronice Pax Track", language: "ro", engine: "tavily" },
    ],
    sources: [
      {
        id: "src_air_1",
        url: "https://airport.md/ro/press/sistem-porti-electronice-pax-track",
        title: "Aeroportul Chișinău a lansat un nou sistem de porți electronice Pax Track",
        publisher: "Международный аэропорт Кишинёва",
        domain: "airport.md",
        sourceType: "government",
        publishedAt: "2024-07-10T09:00:00Z",
        language: "ro",
        country: "MD",
        excerpt:
          "Aeroportul Internațional Chișinău anunță implementarea unui sistem modern de porți electronice automate (Pax Track). Pasagerii care călătoresc doar cu bagaj de mână și s-au înregistrat online pot scana direct biletul și trece spre controlul de securitate fără a mai sta la ghișee.",
        snippet:
          "Aeroportul Internațional Chișinău a implementat sistemul de porți electronice Pax Track pentru fluidizarea fluxului de pasageri.",
        domainReliability: 0.95,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_air_2",
        url: "https://tv8.md/2024/07/10/video-porti-electronice-la-aeroportul-chisinau-cum-functioneaza-noul-sistem/stiri",
        title: "Porți electronice la Aeroportul Chișinău: cum funcționează noul sistem",
        publisher: "TV8",
        domain: "tv8.md",
        sourceType: "news",
        publishedAt: "2024-07-10T12:30:00Z",
        language: "ro",
        country: "MD",
        excerpt:
          "La Aeroportul Internațional Chișinău au fost date în exploatare porțile electronice de acces. Pasagerii fără bagaj de cală pot trece direct la control.",
        snippet:
          "La Aeroportul Chișinău au fost puse în funcțiune primele porți electronice automate pentru pasagerii cu check-in online.",
        domainReliability: 0.9,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_air_3",
        url: "https://newsmaker.md/rus/novosti/v-aeroportu-kishineva-zarabotali-elektronnye-vorota-kto-mozhet-imi-vospolzovatsya/",
        title: "В аэропорту Кишинева заработали электронные ворота. Кто может ими воспользоваться",
        publisher: "NewsMaker",
        domain: "newsmaker.md",
        sourceType: "news",
        publishedAt: "2024-07-10T14:00:00Z",
        language: "ru",
        country: "MD",
        excerpt:
          "В Международном аэропорту Кишинева установили электронные турникеты. Пассажиры с посадочными талонами могут сканировать QR-код и проходить в зону контроля.",
        snippet:
          "В аэропорту Кишинева начали работать электронные турникеты: пассажиры без багажа проходят быстрее.",
        domainReliability: 0.88,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  },

  [population.id]: {
    claimId: population.id,
    queries: [
      { text: "население Земли 8 миллиардов ноябрь 2022", language: "ru", engine: "tavily" },
      { text: "world population 8 billion UN", language: "en", engine: "tavily" },
    ],
    sources: [
      {
        id: "src_pop_1",
        url: "https://www.un.org/en/dayof8billion",
        title: "Day of Eight Billion",
        publisher: "ООН",
        domain: "un.org",
        sourceType: "international_org",
        publishedAt: "2022-11-15T00:00:00Z",
        language: "en",
        excerpt: "On 15 November 2022, the world's population reached eight billion people…",
        snippet: "On 15 November 2022, the world's population reached eight billion people.",
        domainReliability: 0.95,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_pop_2",
        url: "https://www.reuters.com/world/",
        title: "World population hits 8 billion, UN says",
        publisher: "Reuters",
        domain: "reuters.com",
        sourceType: "news",
        publishedAt: "2022-11-15T10:00:00Z",
        language: "en",
        country: "GB",
        excerpt: "The world's population reached 8 billion on Tuesday, the United Nations said…",
        snippet: "The world's population reached 8 billion, the United Nations said.",
        domainReliability: 0.92,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_pop_3",
        url: "https://www.dw.com/ru/",
        title: "Население Земли достигло 8 миллиардов человек",
        publisher: "Deutsche Welle",
        domain: "dw.com",
        sourceType: "news",
        publishedAt: "2022-11-15T12:00:00Z",
        language: "ru",
        country: "DE",
        excerpt: "По данным ООН, 15 ноября численность населения Земли достигла 8 миллиардов человек…",
        snippet: "По данным ООН, население Земли достигло 8 миллиардов человек.",
        domainReliability: 0.88,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_pop_4",
        url: "https://ru.wikipedia.org/wiki/Население_Земли",
        title: "Население Земли — Википедия",
        publisher: "Википедия",
        domain: "ru.wikipedia.org",
        sourceType: "encyclopedia",
        language: "ru",
        excerpt: "По оценке ООН, 15 ноября 2022 года численность населения Земли достигла 8 млрд человек…",
        snippet: "По оценке ООН, 15 ноября 2022 года население Земли достигло 8 млрд человек.",
        domainReliability: 0.8,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  },

  [snow.id]: {
    claimId: snow.id,
    queries: [
      { text: "Кишинёв снег полметра за ночь", language: "ru", engine: "tavily" },
      { text: "ninsoare Chișinău strat de zăpadă", language: "ro", engine: "tavily" },
      { text: "Кишинёв снегопад первое упоминание", language: "ru", engine: "tavily_earliest" },
    ],
    sources: [
      {
        id: "src_snow_1",
        url: "https://meteo-md.example/2021/01/14/ninsoare-chisinau",
        title: "Ninsoare la Chișinău: stratul de zăpadă a atins 10 cm",
        publisher: "Метеослужба MD (пример)",
        domain: "meteo-md.example",
        sourceType: "government",
        publishedAt: "2021-01-14T07:30:00Z",
        language: "ro",
        excerpt:
          "În noaptea de 13 spre 14 ianuarie, la Chișinău s-a depus un strat de zăpadă de până la 10 cm…",
        snippet: "În noaptea de 13 spre 14 ianuarie la Chișinău s-a depus până la 10 cm de zăpadă.",
        domainReliability: 0.85,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_snow_2",
        url: "https://novosti-md.example/2021/01/14/sneg-kishinev",
        title: "Кишинёв засыпало снегом: до 30 см за ночь",
        publisher: "Новости MD (пример)",
        domain: "novosti-md.example",
        sourceType: "news",
        publishedAt: "2021-01-14T11:00:00Z",
        language: "ru",
        excerpt: "Этой ночью в Кишинёве выпало до 30 сантиметров снега, сообщают синоптики…",
        snippet: "Этой ночью в Кишинёве выпало до 30 сантиметров снега, сообщают синоптики.",
        domainReliability: 0.6,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_snow_3",
        url: "https://t.me/s/srochno_md_example/4821",
        title: "Кишинёв завалило снегом — полметра за ночь!",
        publisher: "Telegram-канал «Срочно MD» (пример)",
        domain: "t.me",
        sourceType: "other",
        publishedAt: "2026-10-01T19:40:00Z",
        language: "ru",
        excerpt: "Кишинёв завалило снегом — полметра за ночь! Город стоит. Фото подписчиков.",
        snippet: "Кишинёв завалило снегом — полметра за ночь!",
        domainReliability: 0.2,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_snow_4",
        url: "https://meteo-md.example/2026/10/01/prognoza",
        title: "Prognoza meteo: 1–2 octombrie fără precipitații, până la +17°C",
        publisher: "Метеослужба MD (пример)",
        domain: "meteo-md.example",
        sourceType: "government",
        publishedAt: "2026-10-01T06:00:00Z",
        language: "ro",
        excerpt:
          "Pe 1 și 2 octombrie la Chișinău vreme fără precipitații, temperaturi diurne de până la +17°C…",
        snippet: "1–2 octombrie la Chișinău: fără precipitații, până la +17°C.",
        domainReliability: 0.85,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  },

  [water.id]: {
    claimId: water.id,
    queries: [
      { text: "температура кипения воды высота", language: "ru", engine: "tavily" },
      { text: "boiling point of water altitude", language: "en", engine: "tavily" },
    ],
    sources: [
      {
        id: "src_water_1",
        url: "https://ru.wikipedia.org/wiki/Температура_кипения",
        title: "Температура кипения — Википедия",
        publisher: "Википедия",
        domain: "ru.wikipedia.org",
        sourceType: "encyclopedia",
        language: "ru",
        excerpt:
          "Температура кипения воды зависит от давления: на уровне моря — около 100 °C, на вершине Эвереста — около 70 °C…",
        snippet: "На уровне моря вода кипит при ~100 °C, на вершине Эвереста — при ~70 °C.",
        domainReliability: 0.8,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_water_2",
        url: "https://www.britannica.com/science/boiling-point",
        title: "Boiling point | Britannica",
        publisher: "Encyclopaedia Britannica",
        domain: "britannica.com",
        sourceType: "encyclopedia",
        language: "en",
        country: "US",
        excerpt:
          "The boiling point of water is 100 °C at sea level; at higher altitudes, where pressure is lower, water boils at lower temperatures…",
        snippet: "At higher altitudes water boils at lower temperatures.",
        domainReliability: 0.9,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_water_3",
        url: "https://www.usgs.gov/special-topics/water-science-school",
        title: "Boiling Point of Water and Altitude",
        publisher: "Геологическая служба США (USGS)",
        domain: "usgs.gov",
        sourceType: "government",
        language: "en",
        country: "US",
        excerpt:
          "As altitude increases, atmospheric pressure drops and so does the boiling point: at about 3 000 m water boils near 90 °C…",
        snippet: "At about 3 000 m water boils near 90 °C.",
        domainReliability: 0.95,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  },

  [gas.id]: {
    claimId: gas.id,
    queries: [
      { text: "тариф на газ Молдова 1 октября", language: "ru", engine: "tavily" },
      { text: "tarif gaze naturale 1 octombrie Moldova", language: "ro", engine: "tavily" },
    ],
    sources: [
      {
        id: "src_gas_1",
        url: "https://energie.gov.md/ro/press/precizari-privind-tariful-la-gaze-naturale",
        title: "С 1 октября тариф на природный газ для населения повышается на 13%",
        publisher: "Министерство энергетики Молдовы",
        domain: "energie.gov.md",
        sourceType: "government",
        publishedAt: "2024-09-28T09:00:00Z",
        language: "ro",
        excerpt: "С 1 октября тариф на природный газ для бытовых потребителей повышается на 13%…",
        snippet: "С 1 октября тариф на газ для бытовых потребителей повышается на 13%.",
        domainReliability: 0.95,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_gas_2",
        url: "https://point.md/ru/novosti/ekonomika/anre-utverdilo-novye-tarify-na-gaz/",
        title: "Газ подорожает на 13% с 1 октября",
        publisher: "Point.md",
        domain: "point.md",
        sourceType: "news",
        publishedAt: "2024-09-29T11:00:00Z",
        language: "ru",
        excerpt: "С 1 октября газ для населения подорожает на 13%, сообщает регулятор ANRE…",
        snippet: "С 1 октября газ для населения подорожает на 13%.",
        domainReliability: 0.75,
        retrievedAt: RETRIEVED_AT,
      },
      {
        id: "src_gas_3",
        url: "https://t.me/s/chisinau_live/1290",
        title: "С 1 октября газ дорожает на 30%!",
        publisher: "Telegram-канал «Кишинёв Live»",
        domain: "t.me",
        sourceType: "other",
        publishedAt: "2024-09-30T18:00:00Z",
        language: "ru",
        excerpt: "По данным министерства, с 1 октября газ дорожает на 30%! Готовьте кошельки.",
        snippet: "По данным министерства, с 1 октября газ дорожает на 30%!",
        domainReliability: 0.3,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  },

  [schools.id]: {
    claimId: schools.id,
    queries: [
      { text: "мэрия Кишинёва закрыла школы на ремонт", language: "ru", engine: "tavily" },
      { text: "Primăria Chișinău școli închise reparație", language: "ro", engine: "tavily" },
    ],
    sources: [
      {
        id: "src_sch_1",
        url: "https://portal-x.example/news/shkoly-remont",
        title: "Родители: в Кишинёве закрыли пять школ на ремонт",
        publisher: "Портал X (пример)",
        domain: "portal-x.example",
        sourceType: "news",
        publishedAt: "2026-09-29T09:00:00Z",
        language: "ru",
        excerpt:
          "Мэрия Кишинёва закрыла пять школ на ремонт, пишут родители в соцсетях. Официального сообщения нет…",
        snippet: "Мэрия закрыла пять школ на ремонт, пишут родители в соцсетях.",
        domainReliability: 0.4,
        retrievedAt: RETRIEVED_AT,
      },
    ],
    search: {
      rounds: 3,
      sufficient: false,
      unconfirmed: ["мэрия не сообщала о закрытии школ — есть только пересказ постов родителей"],
      gaps: ["нет официального источника"],
    },
  },
};

// ===================== MOCK-РЕАЛИЗАЦИЯ (STAGE_SOURCE_SEARCH=mock) =====================

/** Демо-тезис — его источники (mockDemoSearch); незнакомый — в моке искать негде, источников нет */
export const searchSourcesMock: Stage<SourceSearchInput, SourceSearchOutput> = async ({ claim }) => {
  return (
    mockDemoSearch[claim.id] ?? {
      claimId: claim.id,
      queries: [{ text: claim.normalized, language: claim.language, engine: "mock" }],
      sources: [],
      copies: [],
      search: {
        rounds: 1,
        sufficient: false,
        unconfirmed: [],
        gaps: ["демо-режим: источники подобраны только для примеров из подсказки"],
      },
    }
  );
};
