import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/// The origin to allow past the Server Action CSRF check.
///
/// This is `localhost:3000` and NOT the tunnel hostname, which is the
/// counter-intuitive part. Next compares a Server Action POST's `origin`
/// against `x-forwarded-host` and aborts when they disagree; through a tunnel
/// the browser sends `origin: localhost:3000` while the tunnel client sets
/// `x-forwarded-host: <id>.devtunnels.ms`, so they never match. The allowlist
/// is then tested against the *origin*, not the forwarded host
/// (`isCsrfOriginAllowed(originHost, ...)` in
/// `server/app-render/action-handler.js`), and with the port included.
/// Allowlisting `**.devtunnels.ms` here looks right and does nothing.
const DEV_SERVER_ORIGIN = "localhost:3000";

/// The hostnames the dev server may be requested on, for the asset check.
///
/// `**` and not `*`: a single star matches exactly one label, and a tunnel host
/// is `<id>-3000.<region>.devtunnels.ms` — three labels before the domain, so
/// `*.devtunnels.ms` would silently fail to match. Next's own built-in default
/// is `**.localhost` for the same reason.
const DEV_TUNNEL_HOSTS = ["**.devtunnels.ms"];

/// Build metadata for /api/version.
const buildInfo = {
  NEXT_PUBLIC_COMMIT_ID: process.env.AWS_COMMIT_ID ?? "",
  NEXT_PUBLIC_BRANCH: process.env.AWS_BRANCH ?? "",
  NEXT_PUBLIC_BUILD_ID: process.env.AWS_JOB_ID ?? "",
  NEXT_PUBLIC_BUILT_AT: new Date().toISOString(),
};

const nextConfig: NextConfig = {
  env: buildInfo,
  allowedDevOrigins: isDevelopment ? DEV_TUNNEL_HOSTS : undefined,
  experimental: {
    serverActions: {
      allowedOrigins: isDevelopment ? [DEV_SERVER_ORIGIN] : undefined,
    },
  },
};

export default nextConfig;
