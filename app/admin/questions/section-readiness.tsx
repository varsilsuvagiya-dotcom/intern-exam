import { Badge } from "@/components/ui/badge";
import { Th, Td, Tr, TableContainer } from "@/components/ui/table";
import type { BankReadiness } from "@/lib/question-bank/readiness-summary";

/// Section-level readiness: whether each of the seven sections can supply the
/// questions the blueprint asks of it.
///
/// A section with no questions reports "No source data" and is never counted as
/// ready. The four missing sections are a real blocker, and the summary's job is
/// to show that rather than to soften it.

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular text-ink">{value}</p>
    </div>
  );
}

export function BankTotals({ totals }: { totals: BankReadiness["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Total" value={totals.total} />
      <Stat label="Active" value={totals.active} />
      <Stat label="Inactive" value={totals.inactive} />
      <Stat label="Not ready" value={totals.notReady} />
      <Stat label="Ready to activate" value={totals.readyToActivate} />
      <Stat label="Drawable" value={totals.drawable} />
    </div>
  );
}

export function SectionReadinessTable({ sections }: { sections: BankReadiness["sections"] }) {
  return (
    <TableContainer label="Section readiness table" minWidth={920}>
      <thead>
        <tr>
          <Th>Section</Th>
          <Th align="right">Required</Th>
          <Th align="right">Total</Th>
          <Th align="right">Not ready</Th>
          <Th align="right">Inactive</Th>
          <Th align="right">Drawable</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <Tr key={section.code}>
            <Td>
              <p className="font-medium text-ink">
                {section.name} &middot; {section.code}
              </p>
              {section.marksMismatch ? (
                <p className="mt-1 text-xs text-warning">
                  Source marks {section.distinctMarks.join(", ")} — blueprint expects{" "}
                  {section.marksPerQuestion}
                </p>
              ) : null}
            </Td>
            <Td align="right" className="tabular text-ink-secondary">
              {section.requiredPerPaper}
            </Td>
            <Td align="right" className="tabular text-ink-secondary">
              {section.total}
            </Td>
            <Td align="right" className="tabular text-ink-secondary">
              {section.notReady}
            </Td>
            <Td align="right" className="tabular text-ink-secondary">
              {section.inactive}
            </Td>
            <Td align="right" className="tabular text-ink-secondary">
              {section.drawable}
            </Td>
            <Td>
              {section.missing ? (
                <Badge tone="danger">No source data</Badge>
              ) : section.sufficient ? (
                <Badge tone="success">Sufficient</Badge>
              ) : (
                <Badge tone="warning">
                  {section.drawable} of {section.requiredPerPaper} drawable
                </Badge>
              )}
            </Td>
          </Tr>
        ))}
      </tbody>
    </TableContainer>
  );
}
