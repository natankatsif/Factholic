/**
 * Все постоянные тексты кабинета. Русский — здесь, он задаёт форму; ro и en — в dictionary.ro.ts и dictionary.en.ts.
 * Новый язык — ещё один объект той же формы в `dictionaries`: лишний или пропущенный ключ не пройдёт проверку типов.
 * Числа и имена подставляются функциями: порядок слов в другом языке может быть другим.
 * Данные (названия изданий, цитаты, даты) сюда не входят: они приходят с бэкенда или из fixtures.ts.
 */
import { useLocale } from "../../i18n/LocaleProvider";
import { DEFAULT_LOCALE, pluralWord as selectForm, type Locale, type PluralForms } from "../../i18n/locale";
import { en } from "./dictionary.en";
import { ro } from "./dictionary.ro";

const pluralWord = (count: number, forms: PluralForms) => selectForm(count, forms, "ru");

export type { PluralForms };

const ru = {
  locale: "ru" as Locale,
  plural: pluralWord,
  meta: {
    title: "Кабинет — factholic",
    description: "История утверждений для государственных учреждений",
  },
  nav: {
    cabinet: "Кабинет",
  },
  brand: {
    name: "factholic",
    badge: "Кабинет",
    homeTitle: "В кабинет",
  },
  topBar: {
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    newCheck: "Новая проверка",
    notifications: "Уведомления",
    language: "Язык",
    runningChecks: "Проверки в процессе",
    step: (step: number, total: number) => `шаг ${step} из ${total}`,
    more: (count: number) => `+${count}`,
    member: (name: string, role: string) => `${name} · ${role}`,
  },
  running: {
    title: (count: number, word: string) => `В процессе: ${count} ${word}`,
    checks: { one: "проверка", few: "проверки", many: "проверок", other: "проверки" } as PluralForms,
    step: (step: number, total: number, message: string) => `Шаг ${step} из ${total}: ${message}`,
    found: (count: number) => `найдено ${count}`,
    openCanvas: "Открыть холст",
    hint: "Можно заниматься другим: когда проверка закончится, придёт уведомление.",
  },
  menu: {
    all: "Все вопросы",
    mine: "Мои",
    watched: "На слежении",
    running: "В процессе",
    ungrouped: "Без группы",
    narratives: "Нарративы",
    addNarrative: "Добавить нарратив",
    suggestionTitle: "Похоже на одну историю",
    suggestionAction: "Посмотреть цитаты",
  },
  canvas: {
    tree: "Дерево",
    timeline: "Хронология",
    searchDone: "Ход поиска: готово",
    fit: "Показать всё",
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    zoom: (percent: number) => `${percent}%`,
    legendConfirmed: "подтверждена",
    legendProbable: "вероятная",
    legendChanged: "с изменениями",
    publications: {
      one: "публикация",
      few: "публикации",
      many: "публикаций",
      other: "публикации",
    } as PluralForms,
    publicationsFound: {
      one: "публикация найдена",
      few: "публикации найдено",
      many: "публикаций найдено",
      other: "публикации найдено",
    } as PluralForms,
    links: { one: "связь", few: "связи", many: "связей", other: "связи" } as PluralForms,
    confirmedLinks: {
      one: "подтверждённая связь",
      few: "подтверждённые связи",
      many: "подтверждённых связей",
      other: "подтверждённые связи",
    } as PluralForms,
    changes: {
      one: "изменение в тексте",
      few: "изменения в тексте",
      many: "изменений в тексте",
      other: "изменения в тексте",
    } as PluralForms,
    traces: {
      one: "след проверен",
      few: "следа проверено",
      many: "следов проверено",
      other: "следа проверено",
    } as PluralForms,
    perDay: "за сутки",
    growth: (count: number) => `+${count}`,
  },
  node: {
    earliest: "Самая ранняя из найденных",
    prehistory: "Предыстория",
    debunk: "Разбор",
    checkedText: "Проверяемый текст",
    missingSource: "Источник не найден",
    noDate: "дата не указана",
    outletLabel: (type: string, language: string) => (language ? `${type} · ${language}` : type),
    outletTypes: { media: "СМИ", channel: "канал", official: "офиц.", debunk: "разбор" },
    stances: { for: "подтверждает", against: "возражает", partial: "частично", neutral: "нейтрально" },
    unlinkedTitle: "Связь не найдена",
    unlinkedHint: "Это не ошибка: система не нашла подтверждения",
    rootUnknownTitle: "Корень не определён",
    rootUnknownHint: "Ни одну из публикаций нельзя назвать самой ранней",
    newBadge: "новое",
    moreItems: (count: number) => `Ещё ${count}`,
  },
  search: {
    title: "Ход поиска",
    collapse: "Свернуть",
    expand: "Развернуть",
    failedStep: "Поиск не ответил",
    steps: {
      claims: "Выделяем утверждения",
      search: "Ищем публикации на ro, ru, en",
      traces: "Проверяем ссылки и названные источники",
      tree: "Определяем, кто у кого взял",
      stances: "Смотрим, кто подтверждает и кто возражает",
      done: "Дерево построено",
    },
  },
  publicationCard: {
    close: "Закрыть",
    quote: "ЦИТАТА",
    stance: "Позиция",
    changesAfter: (parent: string) => `ИЗМЕНЕНИЯ ПОСЛЕ ${parent.toLocaleUpperCase("ru")}`,
    parentLink: "СВЯЗЬ С РОДИТЕЛЕМ",
    openSource: "Открыть источник",
  },
  edgeCard: {
    close: "Закрыть",
    changed: "с изменениями",
    confirmed: "подтверждена",
    probable: "вероятная",
    before: (source: string) => `БЫЛО · ${source}`,
    after: (source: string) => `СТАЛО · ${source}`,
    whatChanged: "Что изменилось",
    evidence: "Чем подтверждена",
    differences: "Чем отличается",
    whyLinked: "Почему соединены",
    similarOnly: "Это самая близкая по смыслу из найденных публикаций. Что текст взят отсюда, не доказано.",
    openFragment: "Смотреть фрагмент",
  },
  panel: {
    selectedClaim: "Выбранный тезис",
    feedTitle: "Лента тезиса",
    noClaim: "Тезис пока не выбран",
    noClaims: "Утверждений не найдено",
    settingsTitle: "Настройки слежения",
    disclaimer: "Система показывает историю утверждения, а не вердикт. Решение об ответе принимает человек.",
    afterCheck: "После проверки здесь появится:",
    previews: [
      {
        key: "result",
        title: "Итог",
        text: "кто подтверждает, кто возражает и какая публикация самая ранняя из найденных",
      },
      { key: "watch", title: "Предложение следить", text: "система сама сообщит, если история начнёт расти" },
      { key: "alerts", title: "Уведомления", text: "с кнопкой «Показать на дереве»" },
    ],
    checksThisMonth: (month: string) => `Проверки в ${month}`,
    watchesLimit: "Слежения",
    usage: (used: number, total: number) => `${used} из ${total}`,
    limitHint: (date: string) => `Обновится ${date}. Поднять лимит может администратор организации.`,
    recentQuestions: "Недавние вопросы",
    allQuestions: "Все вопросы",
    startedAt: (time: string) => `началась в ${time}`,
    watchingDaily: "следим раз в день",
    watchingWeekly: "следим раз в неделю",
    checkRunning: "Идёт проверка",
    checkFailed: "Ошибка поиска",
  },
  feed: {
    claimsFoundTitle: "Найдены утверждения",
    claimsFoundOne: "В тексте одно проверяемое утверждение. Взяли его в работу.",
    claimsFoundMany: (count: number) => `В тексте ${count} утверждения. Выберите, какое вести дальше.`,
    searchingTitle: "Ищем публикации",
    searchingText:
      "Публикации появляются на холсте сразу. Связи дорисуем после разбора: раньше времени их не показываем.",
    now: "сейчас",
    resultTitle: "Итог проверки",
    sidesDiverge: "Источники расходятся.",
    sideFor: "за",
    sideAgainst: "против",
    sidePartial: "частично",
    sideNeutral: "нейтрально",
    earliest: (outlet: string, date: string) => `Самая ранняя из найденных: ${outlet}, ${date}.`,
    offerTitle: "Поставить этот тезис на слежение?",
    offerText: "Сообщим, если история вырастет, пойдёт на другом языке или изменятся факты.",
    fewOfferTitle: "Следить за тезисом?",
    fewOfferText: "Сообщим, когда появятся новые публикации и дерево можно будет достроить.",
    watch: "Следить",
    notNow: "Не сейчас",
    showOnTree: "Показать на дереве",
    moreUpdates: (count: number) => `и ещё ${count}`,
    configure: "Настроить",
    newAlert: (title: string) => `Новое: ${title}`,
    watchOnTitle: "Слежение включено",
    searchFailedTitle: "Поиск недоступен",
    searchFailedText: "Поисковый сервис не отвечает. Дерево не достроено: связей пока нет.",
    retry: "Повторить",
    savedTitle: "Найденное сохранили",
    savedText: (count: number, word: string) =>
      `${count} ${word} остались на холсте. При повторе начнём с места сбоя. Из лимита проверка не спишется.`,
    fewSourcesTitle: "Источников мало",
    noPublicationsTitle: "Публикаций не нашли",
    noPublicationsText:
      "По этому утверждению поиск ничего не нашёл. Это не вывод о нём: возможно, его пока не публиковали или страницы закрыты.",
    fewSourcesText: (count: number, word: string) =>
      `Нашли только ${count} ${word}. Этого мало, чтобы делать выводы об истории утверждения.`,
    rootUnknownTitle: "Корень не определён",
    rootUnknownText: (outlet: string) =>
      `У ${outlet} нет даты на странице, поэтому мы не называем ни одну публикацию самой ранней.`,
    notCheckedTitle: "Что не проверено",
  },
  watchForm: {
    frequency: "Как часто проверять",
    frequencies: { daily: "Раз в день", weekly: "Раз в неделю" },
    signals: "Какие сигналы присылать",
    signalLabels: {
      new_publications: "Появились новые публикации",
      growth: "История растёт",
      new_language: "Пошла на другом языке",
      new_outlet: "Подхватило крупное издание",
      changed_detail: "Изменились цифра, место или дата",
      debunk_found: "Появился разбор",
      sides_changed: "Изменился итог",
      earlier_found: "Нашлась более ранняя публикация",
      quiet: "История затихла",
    },
    duration: "Как долго следить",
    durations: { d7: "7 дней", d30: "30 дней", forever: "Пока не выключат" },
    channels: "Куда присылать",
    channelLabels: { cabinet: "Кабинет", email: "Почта" },
    submit: "Включить слежение",
    cancel: "Отмена",
  },
  home: {
    title: "С чего начнём проверку?",
    text: "Вставьте текст или ссылку в поле ниже. Здесь появится дерево: откуда пошла история, как менялась и кто её подхватил.",
    placeholder: "Вставьте текст, ссылку или утверждение",
    submit: "Проверить",
    submitting: "Смотрим текст",
    suggestions: "Предложения: с чего можно начать",
    noClaimsTitle: "Проверять здесь нечего",
    noClaimsText:
      "В тексте есть мнение, но нет утверждения о факте. Добавьте текст с событием, цифрой, датой или именем.",
    noClaimsSuggestions: "Или попробуйте на примере",
    limitTitle: "Лимит проверок исчерпан",
    limitText: (month: string, used: number, total: number, date: string) =>
      `В ${month} использовано ${used} из ${total} проверок. Лимит обновится ${date}. Слежения и готовые деревья работают как обычно.`,
    limitPlaceholder: (date: string) => `Проверки недоступны до ${date}`,
    openWatches: "Открыть слежения",
  },
  status: {
    new: "Только проверили",
    spreading: "Растёт",
    stable: "Спокойно",
    debunked: "Есть разборы",
    fading: "Затухает",
  },
  questions: {
    subtitle: (count: number, word: string) =>
      `${count} ${word}. К любому можно вернуться: дерево и прошлые проверки остаются.`,
    saved: {
      one: "вопрос сохранён",
      few: "вопроса сохранены",
      many: "вопросов сохранены",
      other: "вопроса сохранены",
    } as PluralForms,
    search: "Найти по тексту вопроса",
    filters: { period: "Период", author: "Автор", language: "Язык", state: "Состояние" },
    columns: {
      claim: "Вопрос",
      narrative: "Нарратив",
      checks: "Проверок",
      last: "Последняя",
      state: "Состояние",
    },
    none: "нет",
    author: (name: string, date: string, language: string) =>
      [name, date, language].filter(Boolean).join(" · "),
    runningSubtitle: (count: number) =>
      `Проверок в работе: ${count}. Когда закончится, вопрос появится в общем списке.`,
    select: (text: string) => `Выбрать: ${text}`,
    selected: (count: number, word: string) =>
      `${pluralWord(count, { one: "Выбран", few: "Выбрано", many: "Выбрано", other: "Выбрано" })} ${count} ${word}`,
    watch: "Следить",
    alreadyWatched: "Выбранные вопросы уже на слежении.",
    watchedBadge: "На слежении",
    watchLimit: (need: number, left: number, total: number) =>
      `Нужно мест: ${need}, свободно: ${left} из ${total}. Снимите часть выбора или выключите слежения.`,
    selectedWord: { one: "вопрос", few: "вопроса", many: "вопросов", other: "вопроса" } as PluralForms,
    collect: "Собрать в нарратив",
    clear: "Снять выбор",
  },
  watches: {
    title: "Слежения",
    subtitle: (used: number, total: number, month: string, checksUsed: number, checksTotal: number) =>
      `${used} из ${total} слежений занято · проверок в ${month} ${checksUsed} из ${checksTotal}`,
    filters: { all: "Все", spreading: "Растёт", withNew: "С новым", paused: "На паузе" },
    filterLabel: (label: string, count: number) => `${label} · ${count}`,
    columns: {
      claim: "Тезис",
      state: "Состояние",
      fresh: "Новое",
      last: "Последняя проверка",
      watch: "Слежение",
    },
    none: "нет",
    fresh: (count: number) => `+${count}`,
    toggle: { active: "Вкл", paused: "Пауза", finished: "Выкл" },
    more: "Ещё",
  },
  narrative: {
    back: "Все вопросы",
    badge: "Нарратив",
    confirmed: (name: string, date: string) => `подтвердила ${name}, ${date}`,
    questions: "Вопросы",
    questionsWord: { one: "вопрос", few: "вопроса", many: "вопросов", other: "вопроса" } as PluralForms,
    publicationsWord: {
      one: "публикация",
      few: "публикации",
      many: "публикаций",
      other: "публикации",
    } as PluralForms,
    languagesWord: { one: "язык", few: "языка", many: "языков", other: "языка" } as PluralForms,
    lastChange: "последнее изменение",
    addQuestion: "Добавить вопрос",
    tree: "Дерево",
    quotes: "Цитаты из публикаций",
    note: "Нарратив собран человеком только из реальных цитат. Это группа вопросов, а не оценка правды.",
  },
  dates: {
    today: "сегодня",
    yesterday: "вчера",
    /** Для «Проверки в ноябре» */
    months: [
      "январе",
      "феврале",
      "марте",
      "апреле",
      "мае",
      "июне",
      "июле",
      "августе",
      "сентябре",
      "октябре",
      "ноябре",
      "декабре",
    ],
  },
  roles: { member: "сотрудник", admin: "администратор" },
  alerts: {
    menuTitle: "Уведомления",
    empty: "Пока тихо. Уведомления появятся, когда поставите тезис на слежение.",
    titles: {
      new_publications: "Новые публикации",
      growth: "История растёт",
      new_language: "Пошла на другом языке",
      new_outlet: "Подхватило крупное издание",
      changed_detail: "Изменились детали",
      debunk_found: "Появился разбор",
      sides_changed: "Изменился итог",
      earlier_found: "Нашлась более ранняя публикация",
      quiet: "История затихла",
    },
    text: (
      type: string,
      params: {
        count?: number;
        usual?: number;
        language?: string;
        outlet?: string;
        date?: string;
        after?: string;
      },
    ) => {
      const count = params.count ?? 0;
      const publications = pluralWord(count, {
        one: "новая публикация",
        few: "новые публикации",
        many: "новых публикаций",
        other: "новые публикации",
      });
      if (type === "growth")
        return `Появилось ${count} ${publications}. ${
          params.usual ? `Обычно бывает около ${params.usual} в день.` : "Обычно бывает меньше одной в день."
        }`;
      if (type === "new_publications") return `Нашли ${count} ${publications}.`;
      if (type === "new_language") return `Первые публикации на языке ${params.language ?? ""}: ${count}.`;
      if (type === "new_outlet") return `О тезисе написал ${params.outlet ?? ""}.`;
      if (type === "changed_detail") return `${params.outlet ?? ""}: ${params.after ?? ""}.`;
      if (type === "debunk_found") return `${params.outlet ?? ""} опубликовал разбор.`;
      if (type === "sides_changed") return "Позиции источников изменились с прошлой проверки.";
      if (type === "earlier_found")
        return `Самая ранняя из найденных теперь: ${params.outlet ?? ""}, ${params.date ?? ""}.`;
      return "Новых публикаций давно не было.";
    },
    groupTitle: (count: number) =>
      `${count} ${pluralWord(count, { one: "новая", few: "новые", many: "новых", other: "новые" })}`,
    watchSummary: (frequency: "daily" | "weekly", signals: number, until?: string) =>
      `Проверяем ${frequency === "daily" ? "раз в день" : "раз в неделю"}${until ? `, до ${until}` : ""}. Сигналы: ${signals} из 9.`,
  },
  clarify: {
    title: "Ждёт ответа",
    more: (count: number) => `+${count}`,
    original: "Вы написали",
    rewritten: "Станет так",
    yes: "Да, так",
    no: "Нет, оставить как есть",
    other: "Другое",
    otherPlaceholder: "Напишите, как проверить",
    send: "Проверить",
  },
  filters: {
    all: "Все",
    period: { today: "Сегодня", week: "За неделю", month: "За месяц" },
  },
  rowMenu: {
    checkNow: "Проверить сейчас",
    openTree: "Открыть дерево",
    remove: "Удалить слежение",
  },
  suggestion: {
    text: (count: number, word: string, topic?: string) =>
      `${count} ${word}${topic ? ` ${topic}` : ""} опираются на похожие цитаты. Собрать их решает человек.`,
    questions: { one: "вопрос", few: "вопроса", many: "вопросов", other: "вопроса" } as PluralForms,
    dialogTitle: "Похоже на одну историю",
    dialogHint: "Система только показывает сходство. Группу собирает человек, из реальных цитат.",
    questionsTitle: "Вопросы",
    quotesTitle: "Цитаты",
    collect: "Собрать в нарратив",
    dismiss: "Не предлагать",
    close: "Закрыть",
  },
  narrativeForm: {
    createTitle: "Новый нарратив",
    addTitle: "Добавить вопрос",
    name: "Название",
    namePlaceholder: "Короткое название группы",
    description: "Общая мысль публикаций",
    descriptionPlaceholder: "Опишите своими словами. Система этот текст не пишет.",
    questions: "Вопросы",
    noQuestions: "Сначала проверьте хотя бы один тезис.",
    save: "Собрать",
    add: "Добавить",
    cancel: "Отмена",
  },
  errors: {
    CHECK_LIMIT: "Лимит проверок на месяц исчерпан.",
    WATCH_LIMIT: "Лимит слежений исчерпан. Выключите одно из слежений.",
    RATE_LIMITED: "Слишком много проверок подряд. Подождите немного.",
    generic: "Не получилось. Попробуйте ещё раз.",
    close: "Закрыть",
  },
  demo: {
    unavailable: "Сервер кабинета не отвечает, проверки сейчас недоступны",
  },
};

export type CabinetDictionary = typeof ru;
const dictionaries: Record<Locale, CabinetDictionary> = { ru, ro, en };

export function getCabinetDictionary(locale: Locale = DEFAULT_LOCALE): CabinetDictionary {
  return dictionaries[locale];
}

/** Хук для компонентов: тексты на выбранном языке */
export function useCabinetText(): CabinetDictionary {
  return getCabinetDictionary(useLocale().locale);
}
