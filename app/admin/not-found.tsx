import Link from "next/link";
import { FileSearch } from "lucide-react";

import { PageBody } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";

/// The admin panel's own not-found page, matching the one the question editor
/// already has. Previously an unknown `/admin/...` URL rendered the root
/// not-found, which is styled for the candidate side and sends the admin to the
/// public home page rather than back into the panel.
export default function AdminNotFound() {
  return (
    <PageBody width="form">
      <EmptyState
        icon={<FileSearch aria-hidden="true" className="size-6" />}
        title="Page not found"
        body="No admin page exists at that address. The link may be out of date."
        action={
          <Link href="/admin" className={buttonClass("secondary")}>
            Back to overview
          </Link>
        }
      />
    </PageBody>
  );
}
