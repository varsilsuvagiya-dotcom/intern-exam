import { requireAdmin } from "@/lib/auth/require-admin";
import { exportFilename } from "@/lib/admin/sheet-export";
import { XLSX_CONTENT_TYPE, buildDetailXlsx } from "@/lib/admin/xlsx-export";

export const dynamic = "force-dynamic";

/// Admin Excel export of one attempt's question-by-question result.
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
  const result = await buildDetailXlsx(id);

  if (result.kind === "not-found") {
    return new Response("Attempt not found.", { status: 404 });
  }

  if (result.kind === "not-scored") {
    return new Response("This attempt has no scored result to export.", { status: 409 });
  }

  // `new Uint8Array(...)` rather than the Buffer itself: Node's Buffer is not
  // in the DOM `BodyInit` union that the Response type expects.
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${exportFilename(`cloudus-result-${id}`)}"`,
      "Cache-Control": "no-store",
    },
  });
}
