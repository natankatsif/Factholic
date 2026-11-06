"use client";

/** Экран проверки: холст и правая панель. Состояния 02–07, 09, 11, 15 */
import { useState } from "react";
import { useCabinetActions } from "./actions";
import { CabinetShell } from "./CabinetShell";
import type { CabinetFixture } from "./fixtures";
import { CheckFeedPanel } from "./RightPanel";
import { TreeCanvas } from "./TreeCanvas";
import type { CheckView } from "./types";
import { WatchSettings } from "./WatchSettings";

export function CheckScreen({
  fixture,
  check,
  onChooseClaim,
  initialFocusIds = [],
}: {
  fixture: Pick<CabinetFixture, "session" | "overlay">;
  check: CheckView;
  /** Несколько утверждений в тексте: сотрудник выбирает, какое показать */
  onChooseClaim?: (index: number) => void;
  /** Открыли из уведомления: сразу показать эти блоки */
  initialFocusIds?: string[];
}) {
  const actions = useCabinetActions();
  const overlay = fixture.overlay;
  const [selectedNodeId, setSelectedNodeId] = useState(overlay?.selectedNodeId);
  const [selectedEdgeId, setSelectedEdgeId] = useState(overlay?.selectedEdgeId);
  const [settingsOpen, setSettingsOpen] = useState(Boolean(overlay?.settingsOpen));
  const [offerHidden, setOfferHidden] = useState(false);
  const [focusIds, setFocusIds] = useState(initialFocusIds);
  const [highlightAlert, setHighlightAlert] = useState(Boolean(overlay?.highlightAlert));
  const [searchOpen, setSearchOpen] = useState(false);
  const [claimChoice, setClaimChoice] = useState(0);

  // блок новых публикаций стоит вместо их отдельных узлов
  const hidden = new Set(highlightAlert ? (check.alertGroup?.nodeIds ?? []) : []);
  const shown: CheckView =
    hidden.size === 0
      ? check
      : {
          ...check,
          nodes: check.nodes.filter((node) => !hidden.has(node.id)),
          edges: check.edges.filter((edge) => !hidden.has(edge.from) && !hidden.has(edge.to)),
          unlinked: check.unlinked.filter((item) => !hidden.has(item.id)),
        };

  const selectNode = (id?: string) => {
    setFocusIds([]);
    setSelectedNodeId(id);
    if (id) setSelectedEdgeId(undefined);
  };
  const selectEdge = (id?: string) => {
    setSelectedEdgeId(id);
    if (id) setSelectedNodeId(undefined);
  };

  return (
    <CabinetShell session={fixture.session} scope="all" tree overlay={overlay}>
      <TreeCanvas
        check={shown}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onSelectNode={selectNode}
        onSelectEdge={selectEdge}
        highlightAlert={highlightAlert}
        focusIds={focusIds}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((open) => !open)}
      />
      {settingsOpen ? (
        <WatchSettings
          check={check}
          onCancel={() => setSettingsOpen(false)}
          onSubmit={(form) => {
            setSettingsOpen(false);
            if (check.claimId !== undefined || !onChooseClaim)
              void actions.createWatch(check.claimId ?? "", form);
          }}
        />
      ) : (
        <CheckFeedPanel
          check={check}
          offerHidden={offerHidden}
          actions={{
            onWatch: () => setSettingsOpen(true),
            onDismissOffer: () => setOfferHidden(true),
            onShowAlert: (target, nodeId) => {
              if (target?.alertId) void actions.readAlert(target.alertId);
              const ids = nodeId ? [nodeId] : (target?.nodeIds ?? []);
              if (ids.length) setFocusIds(ids);
              else if (!target?.alertId) setHighlightAlert((value) => !value);
            },
            onConfigure: () => setSettingsOpen(true),
            onRetry: () => void actions.retryCheck(check.id),
            onFindMore: () => {
              if (check.factCheckId) void actions.searchMore(check.id, check.factCheckId);
            },
            claimChoice,
            onChooseClaim: (index) => {
              setClaimChoice(index);
              onChooseClaim?.(index);
            },
          }}
        />
      )}
    </CabinetShell>
  );
}
