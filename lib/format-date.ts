/// Formats a timestamp for the admin panel, in India Standard Time.
///
/// Every timestamp this app stores (Prisma `DateTime`) is UTC internally; the
/// exam runs in India, so every admin-facing display renders it in IST rather
/// than the server's or the browser's own zone — otherwise the same moment
/// shows a different hour depending on where the admin's browser happens to
/// be. `Intl.DateTimeFormat` with a fixed `timeZone` does this conversion
/// directly, with no manual offset arithmetic (which would get DST-naive
/// regions wrong, though India itself has none).
///
/// Format: `YYYY-MM-DD hh:mm AM/PM` — sortable date, 12-hour clock.
const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function formatDateIST(value: Date): string {
  const parts = Object.fromEntries(
    IST_FORMATTER.formatToParts(value).map((part) => [part.type, part.value]),
  );
  // "en-CA" gives a lowercase "a.m./p.m." dayPeriod; every admin page wants
  // the plain "AM"/"PM" spelling instead.
  const period = parts.dayPeriod.replace(/\./g, "").toUpperCase();
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${period}`;
}

/// Date only (`YYYY-MM-DD`), still read in IST — a UTC-based date-only slice
/// can name the wrong calendar day for a moment within a few hours either
/// side of midnight IST, which spans most of an Indian evening.
export function formatDateOnlyIST(value: Date): string {
  return formatDateIST(value).slice(0, 10);
}
