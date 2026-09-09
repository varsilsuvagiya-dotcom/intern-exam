"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { NAV_GROUPS, isActive, type NavItem } from "./admin-nav";

/// The persistent admin frame: sidebar, header and content area.
///
/// This is a visual and navigational shell only. Authorization stays where it
/// already is — every page and route handler keeps its own `requireAdmin()`
/// call, so the layout is never the thing standing between a request and data.

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 rounded-md px-3 text-sm transition-colors duration-[120ms]",
        // Comfortable on a pointer, at the touch minimum on a phone.
        "h-9 max-md:h-11",
        active
          ? "bg-primary-subtle font-medium text-primary"
          : "text-ink-secondary hover:bg-subtle hover:text-ink",
      ].join(" ")}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
        />
      ) : null}
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

function NavGroups({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? index} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 text-xs font-medium tracking-[0.04em] text-muted uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/// The company logo is a wide lockup (mark + "CLOUDUS" + "INFOTECH PVT. LTD.",
/// roughly 4:1). Rendered at a width where the tagline still reads; a
/// mark-only crop would be needed for anything narrower.
function Brand() {
  return (
    <Link
      href="/admin"
      className="flex min-w-0 items-center rounded-md"
      aria-label="CloudUS admin — go to overview"
    >
      <Image
        src="/cloudus-logo.png"
        alt="CloudUS Infotech"
        width={2825}
        height={685}
        priority
        // Fills the header band rather than sitting small inside it. `max-w-full`
        // keeps the wide lockup inside the sidebar on narrow drawers.
        className="h-8 w-auto max-w-full object-contain"
      />
    </Link>
  );
}

function SidebarFooter({
  email,
  logout,
  onNavigate,
}: {
  email: string;
  logout: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-line px-3 pt-3" onClick={onNavigate}>
      <p className="truncate px-1 pb-2 text-xs text-muted" title={email}>
        {email}
      </p>
      {logout}
    </div>
  );
}

export function AdminShell({
  email,
  logout,
  children,
}: {
  email: string;
  /// The logout form, rendered on the server so the Server Action stays intact.
  logout: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // The drawer is closed by its own controls — nav links call `onNavigate`, the
  // scrim and close button set it directly — rather than by an effect watching
  // the pathname, which would set state synchronously on every route change.

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // The page behind a modal drawer should not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the drawer so the keyboard follows the eye.
    drawer.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="cloudus-admin flex min-h-screen w-full">
      {/* Desktop sidebar: fixed, always present from lg up. */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex"
      >
        <div className="flex h-14 items-center border-b border-line px-3">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavGroups pathname={pathname} />
        </div>
        <div className="p-3">
          <SidebarFooter email={email} logout={logout} />
        </div>
      </nav>

      {/* Mobile / tablet drawer. Rendered only when open so it never sits in
          the tab order while hidden. */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            ref={drawer}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-lg outline-none motion-safe:animate-[drawer-in_180ms_ease-out]"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-ink"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Main navigation links" className="flex-1 overflow-y-auto p-3">
              <NavGroups pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="p-3">
              <SidebarFooter email={email} logout={logout} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 lg:px-6">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-secondary hover:bg-subtle hover:text-ink lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          {/* On small screens the header carries the logo, since the sidebar
              brand is behind the drawer. Deliberately nothing else: no search,
              no notifications, no profile menu — none of those exist. */}
          <div className="lg:hidden">
            <Brand />
          </div>
        </header>

        {/* Deliberately a div, not <main>: every existing admin page already
            renders its own <main>, and nesting landmarks is invalid. Pages own
            that element; the shell only frames it. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
