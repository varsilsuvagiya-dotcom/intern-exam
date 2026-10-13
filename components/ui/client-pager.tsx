"use client";

import { useState, type ReactNode } from "react";

import { Pagination } from "./pagination";
import { TableContainer } from "./table";

/// Pages server-rendered rows in the browser: every row arrives once, and
/// Next/Previous only change which slice is shown — no request.
/// Key it by the active filters so a new result set starts at `initialPage`.
export function ClientPager({
  rows,
  initialPage,
  pageSize,
  noun,
  label,
  minWidth,
  head,
}: {
  rows: ReactNode[];
  initialPage: number;
  pageSize: number;
  /// Singular label for the summary, e.g. "candidate".
  noun: string;
  label: string;
  minWidth: number;
  /// The table's <thead>.
  head: ReactNode;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [page, setPage] = useState(initialPage);
  const current = Math.min(page, totalPages);
  const first = (current - 1) * pageSize;

  return (
    <>
      <TableContainer label={label} minWidth={minWidth}>
        {head}
        <tbody>{rows.slice(first, first + pageSize)}</tbody>
      </TableContainer>
      <Pagination
        page={current}
        totalPages={totalPages}
        onPage={setPage}
        summary={`Showing ${first + 1}–${Math.min(first + pageSize, rows.length)} of ${rows.length} ${noun}${rows.length === 1 ? "" : "s"}`}
      />
    </>
  );
}
