"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Check, ChevronDown } from "lucide-react";

/// A select whose dropdown follows the CloudUS theme.
///
/// A native `<select>` renders its option list with the operating system's own
/// styling — on Windows that means a blue system highlight that has nothing to
/// do with this palette, and no amount of CSS can reach it. So the list is a
/// custom listbox.
///
/// A real hidden `<select>` is kept in the form and updated on every change, so
/// the surrounding GET form, its query parameters and all server-side filtering
/// behave exactly as they did before. Nothing about the submitted data changes.
///
/// `onChange` is optional. A filter form only needs the hidden `<select>` to
/// carry the right value at submit time, so it is left unset there; a form
/// that reacts to the choice as it is made — a live badge, a "changed since
/// save" flag — passes it and is told every time the selection changes, the
/// same as it would be with a native `<select>`.
export function ThemeSelect({
  id,
  name,
  value,
  onChange,
  options,
  className = "",
  invalid = false,
  "aria-describedby": describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onChange?: (value: string) => void;
  options: [string, string][];
  className?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  // The server-supplied `value` is the source of truth until the user picks
  // something; deriving it here avoids syncing props into state in an effect.
  const selected = chosen ?? value;
  const [active, setActive] = useState(() =>
    Math.max(0, options.findIndex(([optionValue]) => optionValue === value)),
  );

  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  const label = options.find(([optionValue]) => optionValue === selected)?.[1] ?? "";

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    setChosen(option[0]);
    setActive(index);
    setOpen(false);
    onChange?.(option[0]);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        choose(active);
      } else {
        setOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(options.length - 1, Math.max(0, current + step)));
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : options.length - 1);
    }
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      {/* The real control: carries the name, so the GET form submits exactly
          what it always did. Hidden from view and from assistive tech, which
          reads the listbox below instead. */}
      <select
        name={name}
        value={selected}
        onChange={() => undefined}
        hidden
        aria-hidden="true"
        tabIndex={-1}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>

      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((shown) => !shown)}
        onKeyDown={onKeyDown}
        className={[
          "flex h-9 w-full min-w-[9rem] items-center justify-between gap-2 rounded-md border bg-surface px-3 text-left text-sm text-ink transition-colors duration-[120ms] hover:bg-subtle max-md:h-11",
          invalid ? "border-danger" : "border-line-strong",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted transition-transform duration-[120ms] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          className="absolute z-30 mt-1 max-h-64 w-full min-w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-md"
        >
          {options.map(([optionValue, optionLabel], index) => {
            const isSelected = optionValue === selected;

            return (
              <li
                key={optionValue}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={[
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm max-md:py-2.5",
                  // Themed hover, not the OS highlight.
                  index === active ? "bg-primary-subtle text-primary" : "text-ink",
                ].join(" ")}
              >
                <span className="truncate">{optionLabel}</span>
                {isSelected ? (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
