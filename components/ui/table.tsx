import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/// The CloudUS admin table.
///
/// Tables stay tables at every width — an admin comparing scores needs columns.
/// Below the point where the columns stop fitting, the *container* scrolls
/// horizontally; the page never does.

export function TableContainer({
  children,
  label,
  minWidth = 880,
}: {
  children: ReactNode;
  /// Names the scroll region for assistive tech. Required, because a keyboard
  /// user landing on a bare scrollable region is told nothing about it.
  label: string;
  /// Width below which the container scrolls rather than squeezing columns.
  minWidth?: number;
}) {
  // Border, radius and scrolling all live on the same element. Splitting them
  // across a wrapper and an inner div lets the table's min-width escape the
  // wrapper and push the page into horizontal scroll.
  //
  // tabIndex makes the scroll region reachable by keyboard, so a keyboard user
  // can pan to columns a pointer user would drag to.
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="w-full max-w-full overflow-x-auto rounded-lg border border-line bg-surface"
    >
      <table
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
  align = "left",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      {...props}
      className={[
        "border-b border-line bg-subtle px-3 py-2.5 text-[13px] leading-4 font-medium text-ink-secondary whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  align = "left",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td
      {...props}
      className={[
        "border-b border-line px-3 py-2.5 align-middle",
        align === "right" ? "text-right" : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="transition-colors duration-[100ms] last:[&>td]:border-b-0 hover:bg-subtle">
      {children}
    </tr>
  );
}

/// Shown in place of the table when there is nothing to list. The distinction
/// between "nothing exists yet" and "nothing matches these filters" is the
/// caller's to make — they are different situations for an admin.
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-14 text-center">
      {icon ? <div className="mb-3 flex justify-center text-muted">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
