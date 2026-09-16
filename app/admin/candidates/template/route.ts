import { requireAdmin } from "@/lib/auth/require-admin";
import { XLSX_CONTENT_TYPE, buildTemplateXlsx } from "@/lib/admin/xlsx-export";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireAdmin();

  // `new Uint8Array(...)` rather than the Buffer itself: Node's Buffer is not
  // in the DOM `BodyInit` union that the Response type expects.
  return new Response(new Uint8Array(buildTemplateXlsx()), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="cloudus-candidate-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
