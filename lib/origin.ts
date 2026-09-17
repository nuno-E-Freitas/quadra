import { headers } from "next/headers";

/**
 * Where this app is being served from, for building the links a coach hands to
 * players.
 *
 * The request headers are the truth when they are there. They were the *only*
 * source until a deployment produced links pointing at localhost — a share link
 * that works on the machine that made it and nowhere else is worse than no link,
 * because it looks right. So the platform's own idea of the domain is the
 * fallback, and localhost is only reached when nothing else knows.
 *
 * VERCEL_PROJECT_PRODUCTION_URL, not VERCEL_URL: the second is this particular
 * deployment, and a link pasted into a group chat should not stop working when
 * that deployment is superseded.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();

  const forwarded = h.get("x-forwarded-host");
  const host = forwarded ?? h.get("host") ?? null;

  if (host) {
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }

  const fromPlatform = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (fromPlatform) return `https://${fromPlatform}`;

  return "http://localhost:3000";
}
