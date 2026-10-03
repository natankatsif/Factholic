/**
 * Справочник доменов: издатель, тип, страна, надёжность 0..1.
 *
 * Это СТАРТОВЫЙ список, а не редакционная позиция: сюда вошли международные организации, научные
 * издательства, информагентства, крупные общественные вещатели и газеты, фактчекеры (подписанты IFCN).
 * Политически спорные издания намеренно не размечены — они получают значения по умолчанию.
 *
 * Политика пополнения (с 2026-10-03). Новые записи добавляются ТОЛЬКО из проверяемых внешних списков и с
 * ЕДИНЫМ уровнем надёжности на категорию — без индивидуальных оценок организаций:
 *   - фактчекеры ("fact_checker", 0.85) — подписанты IFCN со статусом «Verified Signatory» (вкладка «Active»),
 *     https://ifcncodeofprinciples.poynter.org/signatories (данные страницы — её же API
 *     https://ifcn-cop-prod-server-8q9x7.ondigitalocean.app/api/organization/signatories), обращение 2026-10-03.
 *     Страна — из карточки IFCN. Берём только хосты, целиком посвящённые фактчекингу: если подписант — раздел
 *     новостного сайта (indiatoday.in/fact-check и т.п.), домен не добавляем, т.к. lookup идёт по хосту и
 *     оценил бы всё издание. Статусы «In Renewal» и «Expired» не берём;
 *   - национальные статведомства и центральные банки ("government", 0.9) — только те, чьи домены не ловит
 *     эвристика guess() (.gov/.gouv/.gob/.gv/.mil/.govt/.bund/.admin, .go.xx/.gub.xx, .fgov.be, .gc.ca). Источники (обращение 2026-10-03):
 *     список статведомств UNSD https://unstats.un.org/home/nso_sites/ и члены BIS
 *     https://www.bis.org/about/organisation/members; домены сверены с официальными сайтами (в т.ч. редиректы
 *     со старых доменов). Центробанки не из BIS (KZ, MD, BY, AM, AZ, UZ, KG, TJ, PK, BD, EG, KE, TZ, IR, UY, VE)
 *     — по официальным сайтам, проверено 2026-10-03;
 *   - межгосударственные организации ("international_org", 0.85 — как у эвристики для .int) — система ООН
 *     https://www.un.org/en/about-us/un-system и наблюдатели Генассамблеи ООН
 *     https://www.un.org/en/about-us/intergovernmental-and-other-organizations (обращение 2026-10-03);
 *     EBRD, EIB, BIS, IEA, OPEC, PAHO, OCHA, UNDRR — по официальным сайтам, проверено 2026-10-03;
 *   - НКО ("ngo", 0.8) — MSF, Amnesty International, Human Rights Watch (официальные сайты, 2026-10-03).
 * Новые СМИ сюда не добавляются; записи, внесённые до этой политики, оставлены как есть.
 * Открытый вопрос проекта (AGENTS.md §12): разметка СМИ из внешнего источника (MBFC / NewsGuard и т.п.).
 */
import type { SourceType } from "@news/contracts";

export interface DomainInfo {
  publisher: string;
  type: SourceType;
  country?: string;
  reliability: number;
}

type Entry = [publisher: string, type: SourceType, country: string | undefined, reliability: number];

const DOMAINS: Record<string, Entry> = {
  // международные организации
  "un.org": ["ООН", "international_org", undefined, 0.95],
  "news.un.org": ["Новости ООН", "international_org", undefined, 0.93],
  "ohchr.org": ["Управление ООН по правам человека", "international_org", undefined, 0.95],
  "who.int": ["ВОЗ", "international_org", undefined, 0.95],
  "unicef.org": ["ЮНИСЕФ", "international_org", undefined, 0.93],
  "unhcr.org": ["УВКБ ООН", "international_org", undefined, 0.93],
  "unesco.org": ["ЮНЕСКО", "international_org", undefined, 0.93],
  "fao.org": ["ФАО", "international_org", undefined, 0.93],
  "ilo.org": ["МОТ", "international_org", undefined, 0.93],
  "wmo.int": ["ВМО", "international_org", undefined, 0.95],
  "ipcc.ch": ["МГЭИК", "international_org", undefined, 0.95],
  "iaea.org": ["МАГАТЭ", "international_org", undefined, 0.93],
  "imf.org": ["МВФ", "international_org", undefined, 0.95],
  "worldbank.org": ["Всемирный банк", "international_org", undefined, 0.95],
  "oecd.org": ["ОЭСР", "international_org", undefined, 0.95],
  "wto.org": ["ВТО", "international_org", undefined, 0.93],
  "icrc.org": ["МККК", "international_org", undefined, 0.93],
  "osce.org": ["ОБСЕ", "international_org", undefined, 0.9],
  "europa.eu": ["Европейский союз", "international_org", undefined, 0.9],
  "ec.europa.eu": ["Европейская комиссия", "international_org", undefined, 0.9],
  "eurostat.ec.europa.eu": ["Евростат", "international_org", undefined, 0.95],
  "nato.int": ["НАТО", "international_org", undefined, 0.85],
  // — система ООН (un.org/en/about-us/un-system), 2026-10-03; домены .int ловит эвристика
  "wfp.org": ["UN World Food Programme (WFP)", "international_org", undefined, 0.85],
  "undp.org": ["UNDP", "international_org", undefined, 0.85],
  "unep.org": ["UN Environment Programme (UNEP)", "international_org", undefined, 0.85],
  "unfpa.org": ["United Nations Population Fund (UNFPA)", "international_org", undefined, 0.85],
  "unaids.org": ["UNAIDS", "international_org", undefined, 0.85],
  "unido.org": ["UNIDO", "international_org", undefined, 0.85],
  "ifad.org": ["IFAD", "international_org", undefined, 0.85],
  "imo.org": ["International Maritime Organization (IMO)", "international_org", undefined, 0.85],
  "unctad.org": ["UN Trade and Development (UNCTAD)", "international_org", undefined, 0.85],
  "unodc.org": ["United Nations Office on Drugs and Crime (UNODC)", "international_org", undefined, 0.85],
  "unhabitat.org": ["UN-Habitat", "international_org", undefined, 0.85],
  "unrwa.org": ["UNRWA", "international_org", undefined, 0.85],
  "unwomen.org": ["UN Women", "international_org", undefined, 0.85],
  "unops.org": ["UNOPS", "international_org", undefined, 0.85],
  "intracen.org": ["International Trade Centre (ITC)", "international_org", undefined, 0.85],
  "unwto.org": ["UN Tourism", "international_org", undefined, 0.85],
  "opcw.org": [
    "Organisation for the Prohibition of Chemical Weapons (OPCW)",
    "international_org",
    undefined,
    0.85,
  ],
  "ctbto.org": ["CTBTO", "international_org", undefined, 0.85],
  "icj-cij.org": ["International Court of Justice", "international_org", undefined, 0.85],
  "ifc.org": ["International Finance Corporation (IFC)", "international_org", undefined, 0.85],
  "unocha.org": ["OCHA", "international_org", undefined, 0.85],
  "undrr.org": ["UNDRR", "international_org", undefined, 0.85],
  "paho.org": ["PAHO/WHO", "international_org", undefined, 0.85],
  // — наблюдатели Генассамблеи ООН (un.org/en/about-us/intergovernmental-and-other-organizations), 2026-10-03
  "afdb.org": ["African Development Bank", "international_org", undefined, 0.85],
  "adb.org": ["Asian Development Bank", "international_org", undefined, 0.85],
  "aiib.org": ["Asian Infrastructure Investment Bank (AIIB)", "international_org", undefined, 0.85],
  "iadb.org": ["Inter-American Development Bank", "international_org", undefined, 0.85],
  "isdb.org": ["Islamic Development Bank", "international_org", undefined, 0.85],
  "eabr.org": ["Евразийский банк развития", "international_org", undefined, 0.85],
  "opecfund.org": ["OPEC Fund for International Development", "international_org", undefined, 0.85],
  "asean.org": ["ASEAN", "international_org", undefined, 0.85],
  "oas.org": ["Organization of American States (OAS)", "international_org", undefined, 0.85],
  "oic-oci.org": ["Organisation of Islamic Cooperation (OIC)", "international_org", undefined, 0.85],
  "lasportal.org": ["League of Arab States", "international_org", undefined, 0.85],
  "gcc-sg.org": ["Gulf Cooperation Council (GCC)", "international_org", undefined, 0.85],
  "sectsco.org": ["Shanghai Cooperation Organisation (SCO)", "international_org", undefined, 0.85],
  "e-cis.info": ["Содружество Независимых Государств (СНГ)", "international_org", undefined, 0.85],
  "eccis.org": ["Исполнительный комитет СНГ", "international_org", undefined, 0.85],
  "odkb-csto.org": [
    "Организация Договора о коллективной безопасности (ОДКБ)",
    "international_org",
    undefined,
    0.85,
  ],
  "caricom.org": ["CARICOM", "international_org", undefined, 0.85],
  "thecommonwealth.org": ["Commonwealth Secretariat", "international_org", undefined, 0.85],
  "francophonie.org": [
    "Organisation internationale de la Francophonie (OIF)",
    "international_org",
    undefined,
    0.85,
  ],
  "saarc-sec.org": ["SAARC", "international_org", undefined, 0.85],
  "cplp.org": ["Comunidade dos Países de Língua Portuguesa (CPLP)", "international_org", undefined, 0.85],
  "home.cern": ["CERN", "international_org", undefined, 0.85],
  "irena.org": ["International Renewable Energy Agency (IRENA)", "international_org", undefined, 0.85],
  "iucn.org": ["IUCN", "international_org", undefined, 0.85],
  "theglobalfund.org": [
    "The Global Fund to Fight AIDS, Tuberculosis and Malaria",
    "international_org",
    undefined,
    0.85,
  ],
  "ipu.org": ["Inter-Parliamentary Union", "international_org", undefined, 0.85],
  "ifrc.org": ["IFRC", "international_org", undefined, 0.85],
  // — прочие межгосударственные организации (официальные сайты), 2026-10-03
  "ebrd.com": [
    "European Bank for Reconstruction and Development (EBRD)",
    "international_org",
    undefined,
    0.85,
  ],
  "eib.org": ["European Investment Bank", "international_org", undefined, 0.85],
  "bis.org": ["Bank for International Settlements (BIS)", "international_org", undefined, 0.85],
  "iea.org": ["International Energy Agency (IEA)", "international_org", undefined, 0.85],
  "opec.org": ["OPEC", "international_org", undefined, 0.85],

  // НКО (официальные сайты), 2026-10-03
  "msf.org": ["Médecins Sans Frontières (MSF)", "ngo", undefined, 0.8],
  "amnesty.org": ["Amnesty International", "ngo", undefined, 0.8],
  "hrw.org": ["Human Rights Watch", "ngo", undefined, 0.8],

  // национальные статистические ведомства (unstats.un.org/home/nso_sites/), 2026-10-03;
  // домены .gov.xx / .gouv / .gob / .admin и т.п. ловит эвристика guess()
  "destatis.de": ["Statistisches Bundesamt (Destatis)", "government", "DE", 0.9],
  "insee.fr": ["Insee", "government", "FR", 0.9],
  "istat.it": ["Istat", "government", "IT", 0.9],
  "ine.es": ["Instituto Nacional de Estadística (INE)", "government", "ES", 0.9],
  "ine.pt": ["Instituto Nacional de Estatística (INE)", "government", "PT", 0.9],
  "cbs.nl": ["Centraal Bureau voor de Statistiek (CBS)", "government", "NL", 0.9],
  "statbel.fgov.be": ["Statbel", "government", "BE", 0.9],
  "statistik.at": ["Statistik Austria", "government", "AT", 0.9],
  "scb.se": ["Statistikmyndigheten SCB", "government", "SE", 0.9],
  "ssb.no": ["Statistisk sentralbyrå (SSB)", "government", "NO", 0.9],
  "stat.fi": ["Tilastokeskus", "government", "FI", 0.9],
  "dst.dk": ["Danmarks Statistik", "government", "DK", 0.9],
  "hagstofa.is": ["Hagstofa Íslands", "government", "IS", 0.9],
  "cso.ie": ["Central Statistics Office (CSO)", "government", "IE", 0.9],
  "statistics.gr": ["ELSTAT", "government", "GR", 0.9],
  "ksh.hu": ["Központi Statisztikai Hivatal (KSH)", "government", "HU", 0.9],
  "czso.cz": ["Český statistický úřad", "government", "CZ", 0.9],
  "statistics.sk": ["Štatistický úrad SR", "government", "SK", 0.9],
  "stat.si": ["Statistični urad RS (SURS)", "government", "SI", 0.9],
  "stat.ee": ["Statistikaamet", "government", "EE", 0.9],
  "insse.ro": ["Institutul Național de Statistică (INS)", "government", "RO", 0.9],
  "nsi.bg": ["Национален статистически институт (НСИ)", "government", "BG", 0.9],
  "monstat.org": ["MONSTAT", "government", "ME", 0.9],
  "statistiques.public.lu": ["STATEC", "government", "LU", 0.9],
  "statec.lu": ["STATEC", "government", "LU", 0.9],
  "statistica.md": ["Biroul Național de Statistică", "government", "MD", 0.9],
  "armstat.am": ["Statistical Committee of the Republic of Armenia (Armstat)", "government", "AM", 0.9],
  "geostat.ge": ["Geostat", "government", "GE", 0.9],
  "stat.kg": ["Национальный статистический комитет Кыргызской Республики", "government", "KG", 0.9],
  "stat.uz": ["O‘zbekiston Respublikasi Milliy statistika qo‘mitasi", "government", "UZ", 0.9],
  "stat.tj": ["Агентии омори назди Президенти Ҷумҳурии Тоҷикистон", "government", "TJ", 0.9],
  "stat.go.jp": ["総務省統計局 (Statistics Bureau of Japan)", "government", "JP", 0.9],
  "kostat.go.kr": ["국가데이터처 (Ministry of Data and Statistics)", "government", "KR", 0.9],
  "mods.go.kr": ["국가데이터처 (Ministry of Data and Statistics)", "government", "KR", 0.9],
  "bps.go.id": ["Badan Pusat Statistik (BPS)", "government", "ID", 0.9],
  "nso.go.th": ["สำนักงานสถิติแห่งชาติ (National Statistical Office)", "government", "TH", 0.9],
  "amar.org.ir": ["مرکز آمار ایران (Statistical Centre of Iran)", "government", "IR", 0.9],
  "inegi.org.mx": ["INEGI", "government", "MX", 0.9],
  "inec.go.cr": ["Instituto Nacional de Estadística y Censos (INEC)", "government", "CR", 0.9],
  "ine.gub.uy": ["Instituto Nacional de Estadística (INE)", "government", "UY", 0.9],
  "knbs.or.ke": ["Kenya National Bureau of Statistics", "government", "KE", 0.9],
  "ubos.org": ["Uganda Bureau of Statistics", "government", "UG", 0.9],
  "nbs.go.tz": ["National Bureau of Statistics", "government", "TZ", 0.9],
  "hcp.ma": ["Haut-Commissariat au Plan", "government", "MA", 0.9],
  "ins.tn": ["Institut National de la Statistique", "government", "TN", 0.9],
  "ansd.sn": ["Agence Nationale de la Statistique et de la Démographie (ANSD)", "government", "SN", 0.9],
  "ons.dz": ["Office National des Statistiques", "government", "DZ", 0.9],

  // центральные банки: члены BIS (bis.org/about/organisation/members), 2026-10-03
  "bank-of-algeria.dz": ["Bank of Algeria", "government", "DZ", 0.9],
  "oenb.at": ["Oesterreichische Nationalbank", "government", "AT", 0.9],
  "nbb.be": ["National Bank of Belgium", "government", "BE", 0.9],
  "cbbh.ba": ["Centralna banka Bosne i Hercegovine", "government", "BA", 0.9],
  "bnb.bg": ["Българска народна банка", "government", "BG", 0.9],
  "bankofcanada.ca": ["Bank of Canada", "government", "CA", 0.9],
  "bcentral.cl": ["Banco Central de Chile", "government", "CL", 0.9],
  "hnb.hr": ["Hrvatska narodna banka", "government", "HR", 0.9],
  "cnb.cz": ["Česká národní banka", "government", "CZ", 0.9],
  "nationalbanken.dk": ["Danmarks Nationalbank", "government", "DK", 0.9],
  "eestipank.ee": ["Eesti Pank", "government", "EE", 0.9],
  "suomenpankki.fi": ["Suomen Pankki", "government", "FI", 0.9],
  "banque-france.fr": ["Banque de France", "government", "FR", 0.9],
  "bundesbank.de": ["Deutsche Bundesbank", "government", "DE", 0.9],
  "bankofgreece.gr": ["Bank of Greece", "government", "GR", 0.9],
  "mnb.hu": ["Magyar Nemzeti Bank", "government", "HU", 0.9],
  "cb.is": ["Seðlabanki Íslands", "government", "IS", 0.9],
  "rbi.org.in": ["Reserve Bank of India", "government", "IN", 0.9],
  "bi.go.id": ["Bank Indonesia", "government", "ID", 0.9],
  "centralbank.ie": ["Central Bank of Ireland", "government", "IE", 0.9],
  "boi.org.il": ["Bank of Israel", "government", "IL", 0.9],
  "bancaditalia.it": ["Banca d'Italia", "government", "IT", 0.9],
  "boj.or.jp": ["日本銀行 (Bank of Japan)", "government", "JP", 0.9],
  "bok.or.kr": ["한국은행 (Bank of Korea)", "government", "KR", 0.9],
  "bank.lv": ["Latvijas Banka", "government", "LV", 0.9],
  "lb.lt": ["Lietuvos bankas", "government", "LT", 0.9],
  "bcl.lu": ["Banque centrale du Luxembourg", "government", "LU", 0.9],
  "banxico.org.mx": ["Banco de México", "government", "MX", 0.9],
  "bkam.ma": ["Bank Al-Maghrib", "government", "MA", 0.9],
  "dnb.nl": ["De Nederlandsche Bank", "government", "NL", 0.9],
  "nbrm.mk": ["Народна банка на Република Северна Македонија", "government", "MK", 0.9],
  "norges-bank.no": ["Norges Bank", "government", "NO", 0.9],
  "nbp.pl": ["Narodowy Bank Polski", "government", "PL", 0.9],
  "bportugal.pt": ["Banco de Portugal", "government", "PT", 0.9],
  "bnr.ro": ["Banca Națională a României", "government", "RO", 0.9],
  "bnro.ro": ["Banca Națională a României", "government", "RO", 0.9],
  "cbr.ru": ["Банк России", "government", "RU", 0.9],
  "nbs.rs": ["Народна банка Србије", "government", "RS", 0.9],
  "nbs.sk": ["Národná banka Slovenska", "government", "SK", 0.9],
  "bsi.si": ["Banka Slovenije", "government", "SI", 0.9],
  "resbank.co.za": ["South African Reserve Bank", "government", "ZA", 0.9],
  "bde.es": ["Banco de España", "government", "ES", 0.9],
  "riksbank.se": ["Sveriges Riksbank", "government", "SE", 0.9],
  "snb.ch": ["Schweizerische Nationalbank", "government", "CH", 0.9],
  "bot.or.th": ["ธนาคารแห่งประเทศไทย (Bank of Thailand)", "government", "TH", 0.9],
  "centralbank.ae": ["Central Bank of the UAE", "government", "AE", 0.9],
  "bankofengland.co.uk": ["Bank of England", "government", "GB", 0.9],
  // центральные банки вне BIS (официальные сайты), 2026-10-03
  "nationalbank.kz": ["Национальный Банк Казахстана", "government", "KZ", 0.9],
  "bnm.md": ["Banca Națională a Moldovei", "government", "MD", 0.9],
  "nbrb.by": ["Национальный банк Республики Беларусь", "government", "BY", 0.9],
  "cba.am": ["Central Bank of Armenia", "government", "AM", 0.9],
  "cbar.az": ["Azərbaycan Respublikasının Mərkəzi Bankı", "government", "AZ", 0.9],
  "cbu.uz": ["O‘zbekiston Respublikasi Markaziy banki", "government", "UZ", 0.9],
  "nbkr.kg": ["Национальный банк Кыргызской Республики", "government", "KG", 0.9],
  "nbt.tj": ["Бонки миллии Тоҷикистон", "government", "TJ", 0.9],
  "sbp.org.pk": ["State Bank of Pakistan", "government", "PK", 0.9],
  "bb.org.bd": ["Bangladesh Bank", "government", "BD", 0.9],
  "cbe.org.eg": ["Central Bank of Egypt", "government", "EG", 0.9],
  "centralbank.go.ke": ["Central Bank of Kenya", "government", "KE", 0.9],
  "bot.go.tz": ["Bank of Tanzania", "government", "TZ", 0.9],
  "cbi.ir": ["Central Bank of the Islamic Republic of Iran", "government", "IR", 0.9],
  "bcu.gub.uy": ["Banco Central del Uruguay", "government", "UY", 0.9],
  "bcv.org.ve": ["Banco Central de Venezuela", "government", "VE", 0.9],

  // наука и данные
  "nature.com": ["Nature", "academic", "GB", 0.95],
  "science.org": ["Science", "academic", "US", 0.95],
  "thelancet.com": ["The Lancet", "academic", "GB", 0.95],
  "nejm.org": ["NEJM", "academic", "US", 0.95],
  "bmj.com": ["BMJ", "academic", "GB", 0.93],
  "jamanetwork.com": ["JAMA", "academic", "US", 0.93],
  "pnas.org": ["PNAS", "academic", "US", 0.93],
  "cochranelibrary.com": ["Cochrane Library", "academic", "GB", 0.95],
  "sciencedirect.com": ["ScienceDirect", "academic", undefined, 0.88],
  "link.springer.com": ["Springer", "academic", undefined, 0.88],
  "onlinelibrary.wiley.com": ["Wiley", "academic", undefined, 0.88],
  "pubmed.ncbi.nlm.nih.gov": ["PubMed", "academic", "US", 0.9],
  "ncbi.nlm.nih.gov": ["NCBI", "academic", "US", 0.9],
  "arxiv.org": ["arXiv (препринты)", "academic", undefined, 0.75],
  "ourworldindata.org": ["Our World in Data", "academic", "GB", 0.9],

  // энциклопедии
  "wikipedia.org": ["Википедия", "encyclopedia", undefined, 0.75],
  "britannica.com": ["Britannica", "encyclopedia", "US", 0.85],

  // информагентства
  "reuters.com": ["Reuters", "news", "GB", 0.92],
  "apnews.com": ["Associated Press", "news", "US", 0.92],
  "afp.com": ["AFP", "news", "FR", 0.92],
  "dpa.com": ["dpa", "news", "DE", 0.9],
  "ansa.it": ["ANSA", "news", "IT", 0.88],
  "efe.com": ["EFE", "news", "ES", 0.88],
  "kyodonews.net": ["Kyodo News", "news", "JP", 0.88],
  "bloomberg.com": ["Bloomberg", "news", "US", 0.88],

  // общественные вещатели и крупные издания
  "bbc.com": ["BBC", "news", "GB", 0.88],
  "bbc.co.uk": ["BBC", "news", "GB", 0.88],
  "dw.com": ["Deutsche Welle", "news", "DE", 0.87],
  "france24.com": ["France 24", "news", "FR", 0.85],
  "rfi.fr": ["RFI", "news", "FR", 0.85],
  "euronews.com": ["Euronews", "news", "FR", 0.83],
  "nhk.or.jp": ["NHK", "news", "JP", 0.87],
  "cbc.ca": ["CBC", "news", "CA", 0.87],
  "abc.net.au": ["ABC News", "news", "AU", 0.87],
  "swissinfo.ch": ["SWI swissinfo.ch", "news", "CH", 0.85],
  "npr.org": ["NPR", "news", "US", 0.87],
  "pbs.org": ["PBS", "news", "US", 0.87],
  "theguardian.com": ["The Guardian", "news", "GB", 0.85],
  "ft.com": ["Financial Times", "news", "GB", 0.88],
  "economist.com": ["The Economist", "news", "GB", 0.88],
  "nytimes.com": ["The New York Times", "news", "US", 0.86],
  "washingtonpost.com": ["The Washington Post", "news", "US", 0.85],
  "wsj.com": ["The Wall Street Journal", "news", "US", 0.86],
  "lemonde.fr": ["Le Monde", "news", "FR", 0.86],
  "spiegel.de": ["Der Spiegel", "news", "DE", 0.85],
  "zeit.de": ["Die Zeit", "news", "DE", 0.85],
  "faz.net": ["FAZ", "news", "DE", 0.85],
  "sueddeutsche.de": ["Süddeutsche Zeitung", "news", "DE", 0.85],
  "nzz.ch": ["NZZ", "news", "CH", 0.86],
  "elpais.com": ["El País", "news", "ES", 0.85],
  "corriere.it": ["Corriere della Sera", "news", "IT", 0.84],
  "japantimes.co.jp": ["The Japan Times", "news", "JP", 0.84],
  "thehindu.com": ["The Hindu", "news", "IN", 0.83],
  "scmp.com": ["South China Morning Post", "news", "HK", 0.8],
  "aljazeera.com": ["Al Jazeera", "news", "QA", 0.8],

  // Молдова (MD) и Румыния (RO)
  "gov.md": ["Guvernul Republicii Moldova", "government", "MD", 0.95],
  "presedinte.md": ["Președinția Republicii Moldova", "government", "MD", 0.95],
  "parlament.md": ["Parlamentul Republicii Moldova", "government", "MD", 0.95],
  "moldpres.md": ["Moldpres", "government", "MD", 0.9],
  "zdg.md": ["Ziarul de Gardă", "news", "MD", 0.85],
  "newsmaker.md": ["NewsMaker", "news", "MD", 0.82],
  "agora.md": ["Agora.md", "news", "MD", 0.8],
  "tv8.md": ["TV8", "news", "MD", 0.8],
  "jurnaltv.md": ["Jurnal TV", "news", "MD", 0.78],
  "jurnal.md": ["Jurnal.md", "news", "MD", 0.78],
  "point.md": ["Point.md", "news", "MD", 0.72],
  "stiri.md": ["Știri.md", "news", "MD", 0.72],
  "diez.md": ["#diez", "news", "MD", 0.78],
  "ipn.md": ["IPN", "news", "MD", 0.85],
  "radiochisinau.md": ["Radio Chișinău", "news", "MD", 0.85],
  "trm.md": ["Teleradio-Moldova", "news", "MD", 0.85],
  "infotag.md": ["Infotag", "news", "MD", 0.85],
  "protv.md": ["Pro TV", "news", "RO", 0.8],
  "g4media.ro": ["G4Media", "news", "RO", 0.85],
  "hotnews.ro": ["HotNews.ro", "news", "RO", 0.85],
  "agerpres.ro": ["Agerpres", "news", "RO", 0.9],
  "digi24.ro": ["Digi24", "news", "RO", 0.82],

  // фактчекеры
  "factcheck.afp.com": ["AFP Fact Check", "fact_checker", "FR", 0.9],
  "fullfact.org": ["Full Fact", "fact_checker", "GB", 0.9],
  "snopes.com": ["Snopes", "fact_checker", "US", 0.87],
  "politifact.com": ["PolitiFact", "fact_checker", "US", 0.87],
  "factcheck.org": ["FactCheck.org", "fact_checker", "US", 0.88],
  "leadstories.com": ["Lead Stories", "fact_checker", "US", 0.85],
  "correctiv.org": ["CORRECTIV", "fact_checker", "DE", 0.88],
  "maldita.es": ["Maldita.es", "fact_checker", "ES", 0.87],
  "newtral.es": ["Newtral", "fact_checker", "ES", 0.86],
  "pagellapolitica.it": ["Pagella Politica", "fact_checker", "IT", 0.86],
  "demagog.org.pl": ["Demagog", "fact_checker", "PL", 0.85],
  "africacheck.org": ["Africa Check", "fact_checker", "ZA", 0.87],
  "boomlive.in": ["BOOM", "fact_checker", "IN", 0.85],
  // — подписанты IFCN «Verified Signatory» (ifcncodeofprinciples.poynter.org/signatories), 2026-10-03
  // Европа
  "demagog.cz": ["Demagog.cz", "fact_checker", "CZ", 0.85],
  "fakenews.pl": ["FakeNews.pl", "fact_checker", "PL", 0.85],
  "pravda.org.pl": ["Stowarzyszenie Pravda", "fact_checker", "PL", 0.85],
  "dpa-factchecking.com": ["dpa-factchecking", "fact_checker", "DE", 0.85],
  "medizin-transparent.at": ["Medizin transparent", "fact_checker", "AT", 0.85],
  "observers.france24.com": ["Les Observateurs – France 24", "fact_checker", "FR", 0.85],
  "lessurligneurs.eu": ["Les Surligneurs", "fact_checker", "FR", 0.85],
  "verificat.cat": ["Verificat", "fact_checker", "ES", 0.85],
  "factico.org": ["Factico", "fact_checker", "ES", 0.85],
  "info-veritas.com": ["Infoveritas", "fact_checker", "ES", 0.85],
  "poligrafo.sapo.pt": ["Polígrafo", "fact_checker", "PT", 0.85],
  "viralcheck.pt": ["Viral Check", "fact_checker", "PT", 0.85],
  "viral.sapo.pt": ["Viral Check", "fact_checker", "PT", 0.85],
  "facta.news": ["Facta", "fact_checker", "IT", 0.85],
  "factcheckni.org": ["FactCheckNI", "fact_checker", "GB", 0.85],
  "faktisk.no": ["Faktisk.no", "fact_checker", "NO", 0.85],
  "tjekdet.dk": ["TjekDet", "fact_checker", "DK", 0.85],
  "kallkritikbyran.se": ["Källkritikbyrån", "fact_checker", "SE", 0.85],
  "lakmusz.hu": ["Lakmusz", "fact_checker", "HU", 0.85],
  "factual.ro": ["Factual.ro", "fact_checker", "RO", 0.85],
  "ellinikahoaxes.gr": ["Ellinika Hoaxes", "fact_checker", "GR", 0.85],
  "factreview.gr": ["FactReview", "fact_checker", "GR", 0.85],
  "factchecker.gr": ["Greece Fact Check", "fact_checker", "GR", 0.85],
  "faktograf.hr": ["Faktograf", "fact_checker", "HR", 0.85],
  "fakenews.rs": ["FakeNews Tragač", "fact_checker", "RS", 0.85],
  "istinomer.rs": ["Istinomer", "fact_checker", "RS", 0.85],
  "raskrikavanje.rs": ["Raskrikavanje", "fact_checker", "RS", 0.85],
  "istinomjer.ba": ["Istinomjer", "fact_checker", "BA", 0.85],
  "raskrinkavanje.ba": ["Raskrinkavanje", "fact_checker", "BA", 0.85],
  "raskrinkavanje.me": ["Raskrinkavanje.me", "fact_checker", "ME", 0.85],
  "vistinomer.mk": ["Vistinomer", "fact_checker", "MK", 0.85],
  "faktoje.al": ["Faktoje", "fact_checker", "AL", 0.85],
  "hibrid.info": ["hibrid.info", "fact_checker", "XK", 0.85],
  "dogrula.org": ["Doğrula", "fact_checker", "TR", 0.85],
  "dogrulukpayi.com": ["Doğruluk Payı", "fact_checker", "TR", 0.85],
  "teyit.org": ["Teyit", "fact_checker", "TR", 0.85],
  // Восточная Европа, Кавказ, Центральная Азия
  "stopfake.org": ["StopFake", "fact_checker", "UA", 0.85],
  "stopfals.md": ["Stop Fals!", "fact_checker", "MD", 0.85],
  "provereno.media": ["Проверено.Медиа", "fact_checker", "EE", 0.85],
  "mythdetector.com": ["Myth Detector", "fact_checker", "GE", 0.85],
  "mythdetector.ge": ["Myth Detector", "fact_checker", "GE", 0.85],
  "factcheck.kz": ["Factcheck.kz", "fact_checker", "KZ", 0.85],
  // Ближний Восток и Северная Африка
  "akhbarmeter.org": ["AkhbarMeter", "fact_checker", "EG", 0.85],
  "shechecks.net": ["She Checks (Heya tatahaqaq)", "fact_checker", "LY", 0.85],
  "annir.ly": ["Annir", "fact_checker", "LY", 0.85],
  "kashif.ps": ["Kashif", "fact_checker", "PS", 0.85],
  "sawablb.com": ["Sawab", "fact_checker", "LB", 0.85],
  "t4p.co": ["Tech4Peace", "fact_checker", "IQ", 0.85],
  // Африка
  "factcheckhub.com": ["FactCheckHub", "fact_checker", "NG", 0.85],
  "ghanafact.com": ["GhanaFact", "fact_checker", "GH", 0.85],
  "haqcheck.org": ["HaqCheck", "fact_checker", "ET", 0.85],
  "balobakicheck.com": ["Balobaki Check", "fact_checker", "CD", 0.85],
  "elezafact.cd": ["Eleza Fact", "fact_checker", "CD", 0.85],
  "togocheck.com": ["TogoCheck", "fact_checker", "TG", 0.85],
  // Азия
  "factly.in": ["Factly", "fact_checker", "IN", 0.85],
  "factcrescendo.com": ["Fact Crescendo", "fact_checker", "IN", 0.85],
  "newschecker.in": ["Newschecker", "fact_checker", "IN", 0.85],
  "vishvasnews.com": ["Vishvas News", "fact_checker", "IN", 0.85],
  "digiteye.in": ["Digiteye India", "fact_checker", "IN", 0.85],
  "firstcheck.in": ["First Check", "fact_checker", "IN", 0.85],
  "thip.media": ["THIP Media", "fact_checker", "IN", 0.85],
  "sochfactcheck.com": ["Soch Fact Check", "fact_checker", "PK", 0.85],
  "mafindo.or.id": ["Mafindo", "fact_checker", "ID", 0.85],
  "verafiles.org": ["VERA Files", "fact_checker", "PH", 0.85],
  "tfc-taiwan.org.tw": ["Taiwan FactCheck Center", "fact_checker", "TW", 0.85],
  "mygopen.com": ["MyGoPen", "fact_checker", "TW", 0.85],
  "tstm.tw": ["Taiwan Society for Targeting Misinformation", "fact_checker", "TW", 0.85],
  "factchecklab.org": ["Factcheck Lab", "fact_checker", "HK", 0.85],
  "factcheckcenter.jp": ["Japan Fact-check Center", "fact_checker", "JP", 0.85],
  "infact.press": ["InFact", "fact_checker", "JP", 0.85],
  "mfcc.mn": ["Mongolian Fact-Checking Center", "fact_checker", "MN", 0.85],
  // Латинская Америка и испаноязычные США
  "chequeado.com": ["Chequeado", "fact_checker", "AR", 0.85],
  "aosfatos.org": ["Aos Fatos", "fact_checker", "BR", 0.85],
  "fastcheck.cl": ["Fast Check CL", "fact_checker", "CL", 0.85],
  "malaespinacheck.cl": ["Mala Espina Check", "fact_checker", "CL", 0.85],
  "ecuadorchequea.com": ["Ecuador Chequea", "fact_checker", "EC", 0.85],
  "verificado.com.mx": ["Verificado", "fact_checker", "MX", 0.85],
  "cazadoresdefakenews.info": ["Cazadores de Fake News", "fact_checker", "VE", 0.85],
  "cotejo.info": ["Cotejo.info", "fact_checker", "VE", 0.85],
  "factchequeado.com": ["Factchequeado", "fact_checker", "US", 0.85],
};

/** Надёжность неизвестного домена */
const DEFAULT_RELIABILITY = 0.5;

// prettier-ignore
const COUNTRY_TLD: Record<string, string> = {
  ru: "RU", ua: "UA", by: "BY", kz: "KZ", md: "MD", ge: "GE", am: "AM", az: "AZ", uz: "UZ",
  lt: "LT", lv: "LV", ee: "EE", pl: "PL", cz: "CZ", sk: "SK", hu: "HU", ro: "RO", bg: "BG",
  rs: "RS", hr: "HR", si: "SI", de: "DE", at: "AT", ch: "CH", fr: "FR", be: "BE", nl: "NL",
  lu: "LU", it: "IT", es: "ES", pt: "PT", ie: "IE", uk: "GB", dk: "DK", se: "SE", no: "NO",
  fi: "FI", is: "IS", gr: "GR", tr: "TR", il: "IL", ae: "AE", sa: "SA", qa: "QA", eg: "EG",
  za: "ZA", ng: "NG", ke: "KE", in: "IN", pk: "PK", cn: "CN", hk: "HK", tw: "TW", jp: "JP",
  kr: "KR", sg: "SG", id: "ID", my: "MY", th: "TH", vn: "VN", ph: "PH", au: "AU", nz: "NZ",
  ca: "CA", us: "US", mx: "MX", br: "BR", ar: "AR", cl: "CL", co: "CO", pe: "PE",
};

/** "www.news.bbc.co.uk" → "news.bbc.co.uk" */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function lookupDomain(host: string, fallbackType: SourceType): DomainInfo {
  const h = normalizeHost(host);
  // точное совпадение, затем родительские домены: ru.wikipedia.org → wikipedia.org
  const labels = h.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const entry = DOMAINS[labels.slice(i).join(".")];
    if (entry) {
      const [publisher, type, country, reliability] = entry;
      return { publisher, type, country: country ?? countryFromTld(h, type), reliability };
    }
  }
  return guess(h, fallbackType);
}

/** Эвристики для доменов, которых нет в справочнике */
function guess(host: string, fallbackType: SourceType): DomainInfo {
  const country = countryFromTld(host, fallbackType);
  // .go.jp / .gub.uy — только перед доменом страны: abcnews.go.com — это не госорган
  const government =
    /(^|\.)(gov|gouv|gob|gv|mil|govt|bund|admin)(\.[a-z]{2,3})*$/.test(host) ||
    /\.(go|gub)\.[a-z]{2}$/.test(host) ||
    /(^|\.)fgov\.be$/.test(host) ||
    /\.gc\.ca$/.test(host);
  if (government) return { publisher: host, type: "government", country: country ?? "US", reliability: 0.8 };
  if (/\.int$/.test(host)) return { publisher: host, type: "international_org", reliability: 0.85 };
  if (/(^|\.)(edu|ac)(\.[a-z]{2})?$/.test(host))
    return { publisher: host, type: "academic", country, reliability: 0.8 };
  return { publisher: host, type: fallbackType, country, reliability: DEFAULT_RELIABILITY };
}

function countryFromTld(host: string, type: SourceType): string | undefined {
  // у международных организаций страны нет
  if (type === "international_org") return undefined;
  return COUNTRY_TLD[host.split(".").pop() ?? ""];
}
