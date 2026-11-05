import React from "react";
import { Briefcase, Building2, X, type LucideIcon } from "lucide-react";
import { useSiteText } from "../../i18n/site";

export type Audience = "editorial" | "business";

/** Почта для заявок и оформление окна. Тексты — в словаре (t.audience): что продукт делает сейчас, без вердикта */
const CONTACT_EMAIL = "natankatsif@gmail.com";
const STYLES: Record<Audience, { icon: LucideIcon; iconBg: string; iconColor: string }> = {
  editorial: { icon: Building2, iconBg: "#EDE4FD", iconColor: "#6E1EF0" },
  business: { icon: Briefcase, iconBg: "#DDF3EA", iconColor: "#1DA57A" },
};

/** Окно «Для редакций» / «Для бизнеса» из навбара главной */
export function AudienceModal({ audience, onClose }: { audience: Audience; onClose: () => void }) {
  const t = useSiteText();
  const info = t.audience[audience];
  const style = STYLES[audience];
  const Icon = style.icon;
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
              style={{ backgroundColor: style.iconBg, color: style.iconColor }}
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
            aria-label={t.common.close}
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
            {info.contact}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-black text-[#4A3333] no-underline hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
