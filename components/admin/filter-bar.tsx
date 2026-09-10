"use client";

import type { FormEvent, ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ThemeSelect } from "@/components/ui/theme-select";

/// The filter toolbar shared by the admin list pages.
///
/// Filters still live in the URL, so a view stays refreshable, shareable and
/// survives browser back/forward — the query string is built exactly as a
/// native GET form would build it. The one difference is *how* that URL is
/// reached: submitting goes through the router's client-side navigation
/// (`router.push`) instead of a real form submission, which would otherwise
/// force a full browser page load (a document unload, every layout
/// remounting, the network waterfall starting from zero) for what is, from
/// the App Router's point of view, just another server-rendered page.
export function FilterBar({
  resetHref,
  hidden,
  children,
}: {
  /// Where "Reset" clears to — the page's own path with no query.
  resetHref: string;
  /// Values that must survive a filter change (e.g. an active candidate id).
  hidden?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      // Empty fields (an unselected "All", a blank search box) would
      // otherwise serialize as `key=`, which is not how the page's own links
      // build a query: an absent param and an empty one both mean "no
      // filter", but omitting it keeps the URL itself just as clean.
      if (typeof value === "string" && value !== "") {
        query.append(key, value);
      }
    }
    const search = query.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-line bg-surface p-4"
      role="search"
    >
      {hidden}

      <div className="flex flex-wrap items-end gap-3">
        {children}

        <div className="flex items-center gap-2 max-sm:w-full max-sm:*:flex-1">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          <Link
            href={resetHref}
            className={buttonClass("secondary")}
          >
            Reset
          </Link>
        </div>
      </div>
    </form>
  );
}

/// A labelled filter control. The label is always visible — never a placeholder
/// standing in for one.
export function FilterField({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

export function SearchField({
  id,
  name,
  defaultValue,
  placeholder,
  label,
  className = "w-full sm:w-72",
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id} className={className}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          id={id}
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
    </FilterField>
  );
}

export function SelectField({
  id,
  name,
  label,
  value,
  options,
  className = "",
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: [string, string][];
  className?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id} className={className}>
      <ThemeSelect id={id} name={name} value={value} options={options} />
    </FilterField>
  );
}
