/** Настройки слежения в правой панели */
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useCabinetText } from "./dictionary";
import { EyeIcon } from "./icons";
import { BUTTON_DARK, BUTTON_OUTLINE, PanelHeader, PanelShell } from "./RightPanel";
import type { CheckView, SignalType, WatchChannel, WatchDuration, WatchForm, WatchFrequency } from "./types";
import { CheckBox, StatusPill } from "./ui";

const SIGNALS: SignalType[] = [
  "new_publications",
  "growth",
  "new_language",
  "new_outlet",
  "changed_detail",
  "debunk_found",
  "sides_changed",
  "earlier_found",
  "quiet",
];
/** «История затихла» по умолчанию выключена: так на экране дизайна */
const DEFAULT_SIGNALS = SIGNALS.filter((signal) => signal !== "quiet");
/** Настройки, с которыми вопрос ставится на слежение из списка */
export const DEFAULT_WATCH_FORM: WatchForm = {
  frequency: "daily",
  signals: DEFAULT_SIGNALS,
  duration: "d30",
  channels: ["cabinet"],
};
const FREQUENCIES: WatchFrequency[] = ["daily", "weekly"];
const DURATIONS: WatchDuration[] = ["d7", "d30", "forever"];
const CHANNELS: WatchChannel[] = ["cabinet", "email"];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  stretch?: boolean;
}) {
  return (
    <div className="flex w-full gap-0.5 rounded-full bg-canvas p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "flex h-[34px] items-center justify-center whitespace-nowrap rounded-full text-[13px] font-extrabold",
            stretch ? "flex-1" : "px-3.5",
            option === value ? "bg-primary text-white" : "text-cabinet-ink-mid",
            !stretch && option === "forever" && "flex-1",
          )}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="whitespace-nowrap text-[15px] font-black">{title}</div>
      {children}
    </div>
  );
}

function toggled<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...list, item] : list.filter((value) => value !== item);
}

export function WatchSettings({
  check,
  onSubmit,
  onCancel,
}: {
  check: CheckView;
  onSubmit: (form: WatchForm) => void;
  onCancel: () => void;
}) {
  const t = useCabinetText();
  const form = t.watchForm;
  const [frequency, setFrequency] = useState<WatchFrequency>("daily");
  const [duration, setDuration] = useState<WatchDuration>("d30");
  const [signals, setSignals] = useState<SignalType[]>(DEFAULT_SIGNALS);
  const [channels, setChannels] = useState<WatchChannel[]>(["cabinet"]);

  return (
    <PanelShell
      footer={
        <div className="-mt-px flex h-[66px] shrink-0 gap-2 border-t-2 border-border px-[22px] py-3.5">
          <button
            type="button"
            onClick={() => onSubmit({ frequency, signals, duration, channels })}
            className={cn(BUTTON_DARK, "flex-1")}
          >
            <EyeIcon className="h-[15px] w-[15px]" />
            {form.submit}
          </button>
          <button type="button" onClick={onCancel} className={BUTTON_OUTLINE}>
            {form.cancel}
          </button>
        </div>
      }
    >
      <PanelHeader label={t.panel.settingsTitle} title={check.claim}>
        {check.claimStatus && (
          <StatusPill status={check.claimStatus} className="bg-cabinet-old-soft text-cabinet-old" />
        )}
      </PanelHeader>
      <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-4 overflow-y-auto overscroll-none p-[22px]">
        <Section title={form.frequency}>
          <Segmented
            stretch
            options={FREQUENCIES}
            value={frequency}
            onChange={setFrequency}
            label={(value) => form.frequencies[value]}
          />
        </Section>
        <Section title={form.signals}>
          {SIGNALS.map((signal) => (
            <div key={signal} className="flex items-center gap-2">
              <CheckBox
                checked={signals.includes(signal)}
                onChange={(on) => setSignals((list) => toggled(list, signal, on))}
                label={form.signalLabels[signal]}
              />
              <span className="whitespace-nowrap text-[14px] font-bold">{form.signalLabels[signal]}</span>
            </div>
          ))}
        </Section>
        <Section title={form.duration}>
          <Segmented
            options={DURATIONS}
            value={duration}
            onChange={setDuration}
            label={(value) => form.durations[value]}
          />
        </Section>
        <Section title={form.channels}>
          <div className="flex items-start gap-5">
            {CHANNELS.map((channel) => (
              <div key={channel} className="flex items-center gap-2">
                <CheckBox
                  checked={channels.includes(channel)}
                  onChange={(on) => setChannels((list) => toggled(list, channel, on))}
                  label={form.channelLabels[channel]}
                />
                <span className="whitespace-nowrap text-[14px] font-bold">{form.channelLabels[channel]}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PanelShell>
  );
}
