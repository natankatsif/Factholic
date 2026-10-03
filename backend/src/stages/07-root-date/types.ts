import type { ClaimId, ISODateString } from "@news/contracts";
import type { Claim } from "../03-claim-extraction/types.ts";
import type { ProvenanceTree } from "../05-provenance/types.ts";

// ===================== ВХОД =====================

export interface RootDateInput {
  /** claim.structure: timeMarkers («вчера», «сегодня») и eventTime — какую дату заявляет видео */
  claim: Claim;
  tree: ProvenanceTree;
  /** От этой даты считаются «вчера», «сегодня»; нет — от момента анализа */
  videoPublishedAt?: ISODateString;
  /** Момент анализа — когда нет videoPublishedAt; не задан — текущее время (поле для тестов) */
  now?: ISODateString;
}

// ===================== ВЫХОД =====================

export interface OldContentFlag {
  type: "old_content";
  rootPublishedAt: ISODateString;
  claimedAt: ISODateString;
  note: string;
}

export interface RootDateOutput {
  claimId: ClaimId;
  /** Когда, по словам видео, произошло событие; null — видео не привязывает его ко времени */
  claimedAt: ISODateString | null;
  /** Дата корня дерева; null — корня нет */
  rootPublishedAt: ISODateString | null;
  /** «Старый контент» — корень сильно раньше заявленной даты; null — всё сходится или сравнивать не с чем */
  flag: OldContentFlag | null;
}
