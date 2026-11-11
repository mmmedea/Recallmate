export function getBuildLabel() {
  const sha =
    process.env.NEXT_PUBLIC_APP_BUILD ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    "";

  return sha ? sha.slice(0, 7) : "local";
}

export function getPublicBuildLabel() {
  const sha = process.env.NEXT_PUBLIC_APP_BUILD || "";
  return sha ? sha.slice(0, 7) : "production";
}
