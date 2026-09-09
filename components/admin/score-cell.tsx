import { Badge } from "@/components/ui/badge";
import type { AttemptScoring } from "@/lib/admin/query-attempts";

/// The score column.
///
/// The three scoring states are deliberately encoded differently, because
/// conflating them is how an admin ends up reading "0.00" as a real result:
///
///   scored        → the persisted number, the heaviest thing in the row
///   pending       → finalized, but scoring has not stored a result yet
///   not-finalized → still running; there is no score to have an opinion about
///
/// A number is shown only in the first case. Nothing here recomputes a score —
/// the value comes from the columns the scoring engine persisted.
export function ScoreCell({ scoring }: { scoring: AttemptScoring }) {
  if (scoring.kind === "scored") {
    return (
      <span className="tabular whitespace-nowrap">
        {/* Achieved reads stronger than the maximum: the maximum is context,
            the achieved value is the decision-relevant number. */}
        <span className="font-semibold text-ink">{scoring.totalScore}</span>
        <span className="text-muted"> / {scoring.maxScore}</span>
      </span>
    );
  }

  if (scoring.kind === "pending") {
    return <Badge tone="warning">Scoring pending</Badge>;
  }

  return <span className="text-[13px] whitespace-nowrap text-muted">Not finalized</span>;
}
