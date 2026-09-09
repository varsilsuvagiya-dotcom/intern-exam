import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/// Page navigation for a server-rendered list.
///
/// Both controls carry a text label as well as an icon — an icon-only pager is
/// ambiguous, and the design plan rules it out. Unavailable directions render
/// as plain text rather than disabled buttons, matching the existing behaviour
/// and keeping them out of the tab order.
export function Pagination({
  page,
  totalPages,
  hrefFor,
  summary,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /// e.g. "Showing 1–25 of 132 attempts".
  summary: string;
}) {
  const step =
    "inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink transition-colors duration-[120ms] hover:bg-subtle max-md:h-11";
  const stepDisabled =
    "inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-disabled max-md:h-11";

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-[13px] text-muted">{summary}</p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev" className={step}>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Link>
        ) : (
          <span className={stepDisabled} aria-disabled="true">
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </span>
        )}

        <span className="px-1 text-[13px] text-ink-secondary tabular">
          Page {page} of {totalPages}
        </span>

        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} rel="next" className={step}>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span className={stepDisabled} aria-disabled="true">
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
