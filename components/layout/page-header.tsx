import type { ReactNode } from "react";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/// The one page-header pattern, reused by every admin page.
///
/// Breadcrumbs appear only on detail pages — a page reachable from a list. Top
/// level pages get none, because the sidebar already shows where you are.
export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((crumb, index) => {
          const last = index === items.length - 1;

          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="rounded-sm hover:text-ink hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-ink-secondary" : ""}>
                  {crumb.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden="true" className="size-3" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  /// At most one primary action; everything else secondary or tertiary.
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-6 border-b border-line pb-4">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight text-ink">{title}</h1>
          {description ? (
            <p className="mt-1 text-[13px] leading-[18px] text-muted">{description}</p>
          ) : null}
        </div>

        {/* Actions sit beside the title on wide screens and wrap beneath it on
            narrow ones, where they stretch to full width. */}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:*:flex-1">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/// Standard content padding for an admin page. Kept here so every page shares
/// one rhythm instead of re-deciding it.
///
/// This renders the page's `<main>` landmark. The shell deliberately does not,
/// so there is exactly one per page and it wraps the actual content.
export function PageBody({
  children,
  width = "table",
}: {
  children: ReactNode;
  /// `table` fills the content area — a dense list should use the whole screen.
  /// `page` and `form` stay capped, because long prose and single-column forms
  /// become hard to read past a certain measure.
  width?: "table" | "page" | "form";
}) {
  const max = width === "form" ? "max-w-[720px]" : width === "page" ? "max-w-[1100px]" : "";

  // `min-w-0` matters: without it a wide table inside would force the whole
  // column open and the page body would scroll horizontally. Only the table's
  // own container may scroll.
  return (
    <main className={`w-full min-w-0 px-4 py-8 lg:px-6 lg:py-10 ${max}`}>{children}</main>
  );
}

/// Wraps a whole-page `EmptyState` — error, not-found — so it fills and
/// centers in the available content area instead of sitting as a small card
/// pinned to the top-left of a form-width column with dead space around it.
/// Only for a state that IS the entire page; a card inside a normal page
/// (e.g. "no questions match the filters") should use `EmptyState` directly.
export function FullPageEmptyState({ children }: { children: ReactNode }) {
  return (
    <PageBody width="table">
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-[480px]">{children}</div>
      </div>
    </PageBody>
  );
}
