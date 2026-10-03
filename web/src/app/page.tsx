"use client";

import React, { useState } from "react";
import type { VideoReport, FactCheck } from "@news/contracts";
import { MOCK_VIDEO_REPORT } from "@news/contracts/mocks";
import { HomeHero } from "../components/home/HomeHero";
import { Header } from "../components/Header";
import { AnalysisScreen } from "../components/AnalysisScreen";
import { ProvenanceTreeScreen } from "../components/ProvenanceTreeScreen";

export default function HomePage() {
  const [report, setReport] = useState<VideoReport>(MOCK_VIDEO_REPORT);
  const [activeScreen, setActiveScreen] = useState<"home" | "screen1" | "screen2">("home");
  const [selectedClaimId, setSelectedClaimId] = useState<string>("clm_fire_01");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Handle incoming link or text submission
  const handleCheck = async (urlOrText: string, isUrl: boolean) => {
    setIsLoading(true);

    try {
      // Connect to backend if available
      const backendPort = 3001;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const resp = await fetch(`http://localhost:${backendPort}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: {
            pageUrl: isUrl ? urlOrText : "https://factcheck.example/custom-text",
            platform: isUrl ? "youtube" : "other",
            title: isUrl ? urlOrText : urlOrText.slice(0, 60) + "...",
          },
          mode: "remote",
          startFrom: 0,
          uiLanguage: "ru",
        }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (resp && resp.ok) {
        const data = await resp.json();
        console.log("Job created on backend:", data.jobId);
      }
    } catch {
      // Backend not reached, proceed with mock data
    }

    setTimeout(() => {
      if (!isUrl && urlOrText.length > 30) {
        // Custom text parsing into claims
        const sentences = urlOrText
          .split(/(?<=[.?!])\s+/)
          .filter((s) => s.trim().length > 10);

        if (sentences.length > 0) {
          const customFactChecks: FactCheck[] = sentences.slice(0, 4).map((s, idx) => ({
            id: `custom_clm_${idx + 1}`,
            status: "done",
            range: { start: idx * 60, end: (idx + 1) * 60 },
            quote: `«${s.trim()}»`,
            claim: s.trim(),
            category: "event",
            consensus:
              idx === 0
                ? "flagged"
                : idx === 1
                  ? "against"
                  : idx === 2
                    ? "split"
                    : "converge",
            consensusSummary:
              idx === 0
                ? "раздуто • старое"
                : idx === 1
                  ? "источники возражают"
                  : idx === 2
                    ? "мнения расходятся"
                    : "позиции совпадают",
            flags:
              idx === 0
                ? [
                    {
                      type: "outdated",
                      label: "Старый контент",
                      detail: "первоисточник от 14.03.2023",
                      severity: "warning",
                    },
                    {
                      type: "exaggerated",
                      label: "Раздуто",
                      detail: "числа завышены относительно первоисточника",
                      severity: "danger",
                    },
                  ]
                : [],
            keyFinding:
              idx === 0
                ? {
                    title: "Событию более 3 лет",
                    subtitle: "в тексте подано как недавнее происшествие",
                  }
                : undefined,
            provenance: MOCK_VIDEO_REPORT.factChecks[0].provenance,
            sources: MOCK_VIDEO_REPORT.factChecks[0].sources,
          }));

          setReport({
            ...MOCK_VIDEO_REPORT,
            video: {
              ...MOCK_VIDEO_REPORT.video,
              title: urlOrText.slice(0, 80) + "...",
            },
            factChecks: customFactChecks,
          });
          setSelectedClaimId(customFactChecks[0].id);
        }
      } else {
        // Mock report (fire in Chișinău + 4 claims)
        setReport(MOCK_VIDEO_REPORT);
        setSelectedClaimId("clm_fire_01");
      }

      setIsLoading(false);
      setActiveScreen("screen1");
    }, 400);
  };

  const currentFactCheck =
    report.factChecks.find((fc) => fc.id === selectedClaimId) ||
    report.factChecks[0];

  return (
    <div
      className={`bg-[#F1EBE9] flex flex-col font-sans text-[#4A3333] ${
        activeScreen === "home" ? "min-h-screen lg:h-screen w-screen overflow-x-hidden lg:overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* If in screen 1 or 2, show the top navigation bar */}
      {activeScreen !== "home" && (
        <Header
          activeScreen={activeScreen}
          onGoHome={() => setActiveScreen("home")}
          onGoToScreen1={() => setActiveScreen("screen1")}
          onNewCheck={() => setActiveScreen("home")}
        />
      )}

      {/* Screen Router */}
      {activeScreen === "home" && (
        <main className="w-full h-full flex-1 flex items-center justify-center overflow-x-hidden lg:overflow-hidden">
          <HomeHero
            onCheck={handleCheck}
            isLoading={isLoading}
            onLogin={() => alert("Авторизация для редакций скоро будет доступна!")}
          />
        </main>
      )}

      {activeScreen === "screen1" && (
        <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
          <AnalysisScreen
            report={report}
            selectedClaimId={selectedClaimId}
            onSelectClaimId={(id) => setSelectedClaimId(id)}
            onOpenProvenanceTree={() => setActiveScreen("screen2")}
          />
        </main>
      )}

      {activeScreen === "screen2" && (
        <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
          <ProvenanceTreeScreen
            factCheck={currentFactCheck}
            onBack={() => setActiveScreen("screen1")}
          />
        </main>
      )}
    </div>
  );
}
