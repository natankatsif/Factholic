"use client";

import React, { useState } from "react";
import type { VideoReport, FactCheck } from "@news/contracts";
import { MOCK_VIDEO_REPORT } from "@news/contracts/mocks";
import { Header } from "../components/Header";
import { TextInputCard, DEMO_TEXT } from "../components/TextInputCard";
import { AnalysisScreen } from "../components/AnalysisScreen";
import { ProvenanceTreeScreen } from "../components/ProvenanceTreeScreen";

export default function HomePage() {
  const [report, setReport] = useState<VideoReport>(MOCK_VIDEO_REPORT);
  const [activeScreen, setActiveScreen] = useState<"screen1" | "screen2">("screen1");
  const [selectedClaimId, setSelectedClaimId] = useState<string>("clm_fire_01");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showInputSection, setShowInputSection] = useState<boolean>(true);

  // Handle incoming text or URL analysis
  const handleAnalyze = async (text: string, isUrl: boolean) => {
    setIsLoading(true);

    try {
      // Check if backend is available
      const backendPort = 3001;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const resp = await fetch(`http://localhost:${backendPort}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: {
            pageUrl: isUrl ? text : "https://text.factcheck.example",
            platform: isUrl ? "youtube" : "other",
            title: isUrl ? text : text.slice(0, 60) + "...",
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
        // If backend responds, poll or connect WS
        console.log("Job created on backend:", data.jobId);
      }
    } catch {
      // Backend not running, use mock
    }

    // Simulate analysis delay for realistic UX if new text entered
    setTimeout(() => {
      if (text !== DEMO_TEXT && !isUrl) {
        // Adapt report for custom user text
        const sentences = text
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
            consensus: idx === 0 ? "flagged" : idx === 1 ? "against" : idx === 2 ? "split" : "converge",
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
              title: text.slice(0, 80) + "...",
            },
            factChecks: customFactChecks,
          });
          setSelectedClaimId(customFactChecks[0].id);
        }
      } else {
        // Reset to original mock
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
    <div className="min-h-screen bg-[#F1EBE9] flex flex-col font-sans">
      <Header
        activeScreen={activeScreen}
        onGoToScreen1={() => setActiveScreen("screen1")}
        onNewCheck={() => setShowInputSection((prev) => !prev)}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* Toggleable Text Input Bar */}
        {showInputSection && (
          <TextInputCard onAnalyze={handleAnalyze} isLoading={isLoading} />
        )}

        {/* Screen 1 or Screen 2 */}
        {activeScreen === "screen1" ? (
          <AnalysisScreen
            report={report}
            selectedClaimId={selectedClaimId}
            onSelectClaimId={(id) => setSelectedClaimId(id)}
            onOpenProvenanceTree={() => setActiveScreen("screen2")}
          />
        ) : (
          <ProvenanceTreeScreen
            factCheck={currentFactCheck}
            onBack={() => setActiveScreen("screen1")}
          />
        )}
      </main>
    </div>
  );
}
