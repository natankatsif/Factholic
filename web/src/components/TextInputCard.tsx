import React, { useState } from "react";
import { Sparkles, FileText, Link2, RotateCcw, ArrowRight } from "lucide-react";

export const DEMO_TEXT =
  "В Кишинёве обсуждают главные городские события. Вчера сгорел торговый центр, 200 пострадавших на месте происшествия. Спасатели продолжают ликвидацию последствий. В научной рубрике эксперты напомнили, что вода кипит при ста градусах везде, хоть на море, хоть в горах. В экономической сводке сообщается, что инфляция в стране упала до четырёх процентов к началу осени. Также отметим городскую инфраструктуру: новый мост в столице открыли точно в срок в августе.";

interface TextInputCardProps {
  onAnalyze: (text: string, isUrl: boolean) => void;
  isLoading?: boolean;
}

export function TextInputCard({ onAnalyze, isLoading }: TextInputCardProps) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [inputText, setInputText] = useState(DEMO_TEXT);

  const handleClear = () => {
    setInputText("");
  };

  const handleSetDemo = () => {
    setMode("text");
    setInputText(DEMO_TEXT);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAnalyze(inputText.trim(), mode === "url");
  };

  return (
    <div className="bg-[#FBF8F7] border border-stone-200/90 rounded-2xl shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Приём текста для проверки фактов
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Проверка утверждений, поиск первоисточника, выявление раздуваний и анализ согласованности
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-200/70 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                mode === "text"
                  ? "bg-white text-stone-900 shadow-xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Текст
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                mode === "url"
                  ? "bg-white text-stone-900 shadow-xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Ссылка / Видео
            </button>
          </div>

          <button
            type="button"
            onClick={handleSetDemo}
            className="text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 px-2.5 py-1.5 rounded-md transition-colors"
          >
            Демо из макета
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "text" ? (
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              placeholder="Вставьте текст статьи, новостного сюжета или поста..."
              className="w-full bg-white border border-stone-200 rounded-xl p-3.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all font-sans leading-relaxed resize-y"
            />
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-600 p-1"
                title="Очистить"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              type="url"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... или ссылка на новость"
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-stone-200/50">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>Модель: Поиск первоисточника + дерево цитат + оценка</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-medium text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-md hover:bg-stone-100 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Очистить
            </button>

            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                  Анализируем...
                </>
              ) : (
                <>
                  Проверить факты
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
