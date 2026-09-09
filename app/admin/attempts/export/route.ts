import { requireAdmin } from "@/lib/auth/require-admin";
import { buildSummaryCsv, exportFilename } from "@/lib/admin/csv-export";
import { parseAttemptFilters } from "@/lib/admin/query-attempts";

export const dynamic = "force-dynamic";

/// Admin CSV export of the attempts list.
///
/// `requireAdmin()` runs before any query, and redirects an unauthenticated
/// request to the login page rather than returning data. The CSV is generated
/// into the response — nothing is written to disk, uploaded, or served from a
/// public URL — and its contents are never logged.
export async function GET(request: Request): Promise<Response> {
  await requireAdmin();

  const url = new URL(request.url);
  // The same parser the attempts page uses, so unknown status, scoring, sort and
  // page values fall back to their defaults instead of reaching the database.
  const filters = parseAttemptFilters(Object.fromEntries(url.searchParams));

  const csv = await buildSummaryCsv(filters);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename("cloudus-attempts")}"`,
      // An export is a point-in-time snapshot of live data; never reuse it.
      "Cache-Control": "no-store",
    },
  });
}
