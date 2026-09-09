import { Badge } from "@/components/ui/badge";
import { TableContainer, Td, Th, Tr } from "@/components/ui/table";
import type { SectionScoreRow } from "@/lib/admin/attempt-result";

/// The eight-section breakdown.
///
/// Scores are the persisted values the server passed in. The proportion bar is
/// a reading aid on an exact number that is printed beside it — it is never the
/// only place a value appears, and it is not a chart.
export function SectionScoreTable({
  rows,
  totalScore,
  maxScore,
}: {
  rows: SectionScoreRow[];
  totalScore: string;
  maxScore: string;
}) {
  return (
    <TableContainer label="Section score breakdown" minWidth={560}>
      <thead>
        <tr>
          <Th>Section</Th>
          <Th align="right">Score</Th>
          <Th align="right">Max</Th>
          <Th className="w-[180px]">Proportion</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const max = Number(row.maxScore);
          const achieved = Number(row.score);
          // Section 8 carries no marks, so it has no proportion to show. Any
          // ratio here would be a division by zero dressed up as a result.
          const unscored = max === 0;
          const percent = unscored ? 0 : Math.min(100, Math.max(0, (achieved / max) * 100));

          return (
            <Tr key={row.section}>
              <Td>
                <span className="font-medium text-ink">S{row.section}</span>
                <span className="text-ink-secondary"> {row.name}</span>
                {/* Section 7 is the hiring signal the requirements single out;
                    Section 8 is deliberately not scored. Both are stated in
                    words so neither depends on the row's styling. */}
                {row.section === 7 ? (
                  <span className="ml-2 text-xs text-primary">Key hiring signal</span>
                ) : null}
                {unscored ? (
                  <Badge tone="neutral" className="ml-2">
                    Not scored
                  </Badge>
                ) : null}
              </Td>
              <Td align="right" className="font-medium text-ink tabular">
                {row.score}
              </Td>
              <Td align="right" className="text-muted tabular">
                {row.maxScore}
              </Td>
              <Td>
                {unscored ? (
                  <span className="text-[13px] text-muted">Does not affect the total</span>
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-primary-subtle"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </Td>
            </Tr>
          );
        })}
        <tr className="border-t-2 border-line-strong">
          <Td className="font-semibold text-ink">Total</Td>
          <Td align="right" className="font-semibold text-ink tabular">
            {totalScore}
          </Td>
          <Td align="right" className="text-muted tabular">
            {maxScore}
          </Td>
          <Td />
        </tr>
      </tbody>
    </TableContainer>
  );
}
