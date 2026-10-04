import React from "react";
import { Briefcase, Building2, X, type LucideIcon } from "lucide-react";

export type Audience = "editorial" | "business";

interface AudienceInfo {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  intro: string;
  listTitle: string;
  points: string[];
  contact: { text: string; email: string };
}

/**
 * Что factholic даёт редакциям и бизнесу. Тексты — по тому, что продукт делает сейчас: историю утверждения
 * (первоисточник, кто у кого взял, что изменилось по дороге, стороны), а не вердикт «правда/ложь».
 */
const AUDIENCES: Record<Audience, AudienceInfo> = {
  editorial: {
    title: "Для редакций",
    subtitle: "factholic в работе фактчекеров и новостных команд",
    icon: Building2,
    iconBg: "#EDE4FD",
    iconColor: "#6E1EF0",
    intro:
      "Вставьте видео, пост или ссылку — factholic выделит проверяемые утверждения, найдёт все публикации о них на румынском, русском и английском и покажет историю каждого: где оно появилось впервые, кто у кого его взял и что изменилось по дороге. Вердикт «правда/ложь» мы не выносим — выводы остаются за редакцией.",
    listTitle: "Что получает редакция:",
    points: [
      "Первоисточник и дерево перепечаток со ссылками на каждую публикацию",
      "Где утверждение раздули: цифры, место, время, уверенность, кто сказал",
      "Флаг «старый контент», если событие выдают за свежее",
      "Стороны: сколько независимых источников подтверждают и возражают — перепечатки одной новости считаются за один голос",
      "Разбор видео по таймкодам — утверждения отмечены прямо на полосе плеера",
    ],
    contact: { text: "Чтобы подключить редакцию, напишите нам:", email: "press@factholic.ai" },
  },
  business: {
    title: "Для бизнеса",
    subtitle: "factholic для PR, коммуникаций и управления рисками",
    icon: Briefcase,
    iconBg: "#DDF3EA",
    iconColor: "#1DA57A",
    intro:
      "Утверждения о компании или отрасли расходятся по видео, соцсетям и СМИ и по дороге меняются. factholic показывает, откуда пошла история, как она дошла до вас и где её исказили — со ссылками на каждую публикацию, чтобы ответить по фактам, а не по слухам.",
    listTitle: "Чем полезен бизнесу:",
    points: [
      "Найти первоисточник слуха или претензии о компании",
      "Увидеть, на каком шаге перепечатки исказили цифры, место или время",
      "Отличить новую волну от старой истории, которую подали как свежую",
      "Проверить видео или пост перед реакцией, репостом или публичным ответом",
      "Показать руководству дерево источников вместо пересказа",
    ],
    contact: {
      text: "Чтобы обсудить подключение для компании, напишите нам:",
      email: "business@factholic.ai",
    },
  },
};

/** Окно «Для редакций» / «Для бизнеса» из навбара главной */
export function AudienceModal({ audience, onClose }: { audience: Audience; onClose: () => void }) {
  const info = AUDIENCES[audience];
  const Icon = info.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#4A3333]/30 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
        className="relative z-10 max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto rounded-[28px] border border-[#E2D7D4] bg-[#FBF8F7] p-6 text-[#4A3333] shadow-2xl animate-in zoom-in-95 duration-200 sm:p-8"
      >
        <div className="flex items-center justify-between border-b border-[#EADFDc] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: info.iconBg, color: info.iconColor }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black">{info.title}</h3>
              <p className="text-xs font-semibold text-[#A27C7A]">{info.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[#F1EBE9] text-[#4A3333] hover:bg-[#E3D9D6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 text-sm font-semibold leading-relaxed text-[#4A3333]">
          <p className="m-0">{info.intro}</p>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-[#F1EBE9] p-4 text-xs font-bold text-[#A27C7A]">
            <span className="text-sm font-black text-[#4A3333]">{info.listTitle}</span>
            {info.points.map((point) => (
              <span key={point}>• {point}</span>
            ))}
          </div>
          <p className="m-0 mt-1 text-xs text-[#A27C7A]">
            {info.contact.text}{" "}
            <a
              href={`mailto:${info.contact.email}`}
              className="font-black text-[#4A3333] no-underline hover:underline"
            >
              {info.contact.email}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
