"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { PageBody } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";

/// The admin panel's own error boundary.
///
/// Without this, a failure under `/admin` fell through to the root
/// `app/error.tsx`, which is styled for the candidate side and offers "Back to
/// home" — a link out of the admin panel entirely. Nothing about the error
/// handling changes; only which shell the admin sees it in.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageBody width="form">
      <EmptyState
        icon={<TriangleAlert aria-hidden="true" className="size-6" />}
        title="Something went wrong"
        body="This page could not be loaded. Try again — if it keeps failing, the details are in the server log."
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={reset}
            icon={<RotateCcw aria-hidden="true" className="size-4" />}
          >
            Try again
          </Button>
        }
      />
    </PageBody>
  );
}
