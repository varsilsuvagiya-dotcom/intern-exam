import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { PageBody } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";

export default function QuestionNotFound() {
  return (
    <PageBody width="form">
      <EmptyState
        icon={<FileQuestion aria-hidden="true" className="size-6" />}
        title="Question not found"
        body="No question in the bank has that ID. It may have been removed, or the link may be wrong."
        action={
          <Link href="/admin/questions" className={buttonClass("secondary")}>
            Back to question bank
          </Link>
        }
      />
    </PageBody>
  );
}
