import { requireAdmin } from "@/lib/auth/require-admin";
import { buildDetailCsv, exportFilename } from "@/lib/admin/csv-export";

export const dynamic = "force-dynamic";

/// Admin CSV export of one attempt's question-by-question result.
///
/// Only a finalized, scored attempt can be exported. An in-progress attempt is
/// refused because the rows carry the correct answers and explanations, and
/// handing those over while a supervised exam is running would leak the answer
/// key; a scoring-pending attempt is refused because there is no result yet.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireAdmin();

  const { id } = await params;
  const result = await buildDetailCsv(id);

  if (result.kind === "not-found") {
    return new Response("Attempt not found.", { status: 404 });
  }

  if (result.kind === "not-scored") {
    return new Response("This attempt has no scored result to export.", { status: 409 });
  }

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // The attempt id identifies the export without naming the candidate.
      "Content-Disposition": `attachment; filename="${exportFilename(`cloudus-result-${id}`)}"`,
      "Cache-Control": "no-store",
    },
  });
}
