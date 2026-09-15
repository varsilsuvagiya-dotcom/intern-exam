"use client";

import { useState, type ReactNode } from "react";

import { ChevronDown, ChevronRight, Code2, ExternalLink, FileText, Globe, Link as LinkIcon } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { Td } from "@/components/ui/table";
import type { CandidateListItem } from "@/lib/admin/query-candidates";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function formatDateOnly(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

/// Candidate-provided links often arrive without a protocol (the live sheet
/// has real values like `"linkedin.com/in/nij-bhavsar-cse"`). A bare `href`
/// like that is a relative path as far as the browser is concerned, so it
/// resolves under this admin page's own origin (`/admin/linkedin.com/...`)
/// instead of leaving the site — this is what makes a valid-looking link
/// silently 404. Prepending `https://` when no scheme is present is what a
/// browser's own address bar does for the same input; nothing here changes
/// the value stored on Candidate, only how it is used as an href.
function externalHref(raw: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
}

/// A short labeled value — dates, single words, short answers. Grouped in a
/// tight grid; nothing here ever runs more than a line or two.
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-secondary">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">
        {value ? <span className="wrap-anywhere">{value}</span> : <span className="text-disabled">—</span>}
      </dd>
    </div>
  );
}

/// A long free-text answer (project description, reason for joining, …). Its
/// own block rather than a grid cell, and capped to a readable measure —
/// these run to several sentences, and a line stretching the full width of a
/// wide admin table is exactly the line length typography guidance warns
/// against.
function Answer({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="max-w-[75ch]">
      <dt className="text-xs font-medium text-ink-secondary">{label}</dt>
      <dd className="mt-1 text-[13px] leading-relaxed text-ink whitespace-pre-line wrap-anywhere">{value}</dd>
    </div>
  );
}

/// One labeled section of the profile — a card of its own, so 19 fields read
/// as five short groups instead of one undifferentiated list.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h4 className="text-xs font-semibold tracking-wide text-ink uppercase">{title}</h4>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

const LINKS: {
  key: keyof Pick<CandidateListItem, "githubUrl" | "linkedinUrl" | "liveProjectUrl" | "resumeUrl">;
  label: string;
  icon: typeof LinkIcon;
}[] = [
  { key: "githubUrl", label: "GitHub", icon: Code2 },
  { key: "linkedinUrl", label: "LinkedIn", icon: LinkIcon },
  { key: "liveProjectUrl", label: "Live project", icon: Globe },
  { key: "resumeUrl", label: "Resume", icon: FileText },
];

/// Links render as small cards with an icon and a fixed label — never the raw
/// URL inline with other text, which is what made them unreadable before (a
/// long URL wraps mid-word and merges visually with surrounding prose).
function LinkCard({ label, href, icon: Icon }: { label: string; href: string; icon: typeof LinkIcon }) {
  return (
    <a
      href={externalHref(href)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 rounded-md border border-line bg-subtle px-3 py-2 text-[13px] transition-colors duration-[120ms] hover:border-line-strong hover:bg-inset"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate font-medium text-ink">{label}</span>
      <ExternalLink
        aria-hidden="true"
        className="size-3.5 shrink-0 text-disabled transition-colors duration-[120ms] group-hover:text-muted"
      />
    </a>
  );
}

/// The full candidate profile, shown only when the row is expanded. Every
/// field Phase 12 added to Candidate appears here, grouped into sections
/// (personal, education, links, long-form answers, consent) rather than one
/// flat grid — the compact table only ever showed identity, mobile, dates
/// and attempt count, and the remaining ~19 profile fields had nowhere to go
/// until now.
function ProfileDetail({ candidate }: { candidate: CandidateListItem }) {
  const links = LINKS.map((link) => ({ ...link, href: candidate[link.key] })).filter(
    (link): link is (typeof LINKS)[number] & { href: string } => Boolean(link.href),
  );

  const answers: { label: string; value: string | null }[] = [
    { label: "Project info", value: candidate.projectInfo },
    { label: "Self-learning info", value: candidate.selfLearningInfo },
    { label: "AI tools used", value: candidate.aiToolsInfo },
    { label: "Reason for joining", value: candidate.reasonForJoining },
  ];
  const hasAnswers = answers.some((answer) => answer.value);

  return (
    <div className="grid grid-cols-1 gap-3 py-3 lg:grid-cols-2">
      <Section title="Personal">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Fact label="Current city" value={candidate.currentCity} />
          <Fact label="Date of birth" value={formatDateOnly(candidate.dateOfBirth)} />
          <Fact label="Willing to relocate to Surat" value={candidate.willingFullTimeSurat} />
        </div>
      </Section>

      <Section title="Education">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Fact label="Qualification" value={candidate.highestQualification} />
          <Fact label="College / institute" value={candidate.collegeName} />
          <Fact label="Year of passing" value={candidate.yearOfPassing} />
          <Fact label="CGPA / percentage" value={candidate.cgpaOrPercentage} />
        </div>
      </Section>

      {candidate.technologies || links.length > 0 ? (
        <Section title="Skills & links">
          <Fact label="Technologies" value={candidate.technologies} />
          {links.length > 0 ? (
            <div>
              <dt className="text-xs font-medium text-ink-secondary">Links</dt>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {links.map((link) => (
                  <LinkCard key={link.key} label={link.label} href={link.href} icon={link.icon} />
                ))}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title="Application">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Fact label="Heard about the program via" value={candidate.hearAboutProgram} />
          <Fact label="Terms agreement" value={candidate.termsAgreement} />
          <Fact label="Information confirmed" value={candidate.informationConfirmation} />
          <Fact label="Source timestamp" value={formatDateTime(candidate.sourceTimestamp)} />
        </div>
      </Section>

      {hasAnswers ? (
        <div className="lg:col-span-2">
          <Section title="In their own words">
            <div className="space-y-4">
              {answers.map((answer) =>
                answer.value ? <Answer key={answer.label} label={answer.label} value={answer.value} /> : null,
              )}
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}

/// Wraps one candidate's row pair: the server-rendered row (passed through as
/// `children`, so the identity/mobile/dates/attempts/actions cells and their
/// formatting stay exactly where they already lived) plus a detail row that
/// expands beneath it. A client component because "is this row's detail
/// open" is purely local UI state — nothing here refetches or mutates, so it
/// does not need the page above it to be a client component too.
export function CandidateRow({
  candidate,
  columnCount,
  children,
}: {
  candidate: CandidateListItem;
  /// Total column count of the surrounding table, so the detail row's single
  /// cell can span the full width.
  columnCount: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={[
          "transition-colors duration-[100ms] hover:bg-subtle",
          // When expanded, the detail row below supplies its own top edge
          // (via the border on that <tr>), so every cell in this row must
          // drop its own bottom border — otherwise the two borders sit right
          // next to each other and read as one thick double line.
          expanded ? "[&>td]:border-b-0" : "",
        ].join(" ")}
      >
        <Td className="w-10 border-b-0 pr-0">
          <IconButton
            label={expanded ? `Hide details for ${candidate.name}` : `Show details for ${candidate.name}`}
            size="sm"
            variant="tertiary"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )}
          </IconButton>
        </Td>
        {children}
      </tr>
      {expanded ? (
        <tr className="border-b border-line last:border-b-0">
          <Td colSpan={columnCount + 1} className="bg-subtle">
            <ProfileDetail candidate={candidate} />
          </Td>
        </tr>
      ) : null}
    </>
  );
}
