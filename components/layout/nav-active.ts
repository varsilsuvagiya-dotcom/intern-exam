/// Which navigation item represents the current page.
///
/// Kept free of any React or icon import so the rule can be reasoned about — and
/// tested — on its own. Prefix matching alone gets this wrong twice: `/admin`
/// prefixes every admin route, and `/admin/questions` prefixes
/// `/admin/questions/import`. So `/admin` matches exactly, and Questions
/// explicitly excludes the import route while still claiming
/// `/admin/questions/[id]`.
export type NavMatch = {
  href: string;
  /// Match this route and nothing beneath it.
  exact?: boolean;
  /// Routes that belong to a different item, despite sharing this prefix.
  excludes?: string[];
};

export function isActive(pathname: string, item: NavMatch): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  if (item.excludes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
