export const dynamic = "force-dynamic";

/// Which commit is actually live.
///
/// Amplify exposes the build's source commit as `AWS_COMMIT_ID` and the build
/// as `AWS_JOB_ID`/`AWS_BRANCH`, but only while the build container runs —
/// they are gone at request time. `next.config.ts` therefore copies them into
/// `NEXT_PUBLIC_*` vars, which Next inlines into the bundle during `npm run
/// build`, so what this route reports is baked into the deployed artifact and
/// cannot drift from it.
///
/// Public on purpose: the point is to confirm a deploy without an AWS console
/// login. It discloses the running commit and nothing else — no config, no
/// secrets, no data. Point a monitor at it, or open it after a push and check
/// the sha matches your latest commit.
/// "unknown" rather than a blank when built outside Amplify (a local
/// `npm run build` has no AWS_* vars), so a missing value can never be
/// mistaken for a stale one. Checks for empty too: `next.config.ts` inlines
/// `""` for an absent var, which `??` alone would pass straight through.
function value(raw: string | undefined): string {
  return raw === undefined || raw === "" ? "unknown" : raw;
}

export async function GET(): Promise<Response> {
  return Response.json(
    {
      commit: value(process.env.NEXT_PUBLIC_COMMIT_ID),
      branch: value(process.env.NEXT_PUBLIC_BRANCH),
      buildId: value(process.env.NEXT_PUBLIC_BUILD_ID),
      builtAt: value(process.env.NEXT_PUBLIC_BUILT_AT),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
