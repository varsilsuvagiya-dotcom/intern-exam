import { requireAdmin } from "@/lib/auth/require-admin";
import { toCsv } from "@/lib/admin/csv-export";
import { TEMPLATE_EXAMPLE_ROW, TEMPLATE_HEADERS } from "@/lib/candidate-import/csv-contract";

export const dynamic = "force-dynamic";

/// Downloadable candidate import template.
///
/// Headers come straight from the import contract, so a file started here is
/// one the importer accepts by construction — change a header there and this
/// download changes with it. Contains no candidate data: one illustrative
/// example row only.
export async function GET(): Promise<Response> {
  await requireAdmin();

  const csv = toCsv([...TEMPLATE_HEADERS], [TEMPLATE_EXAMPLE_ROW]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cloudus-candidate-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
