// Paths that live in the repository but aren't part of the website:
// photo candidates, internal docs, the weekly headline tooling and the
// social text that sits next to each blog post.
const HIDDEN_PREFIXES = ["/photo-library/", "/docs/", "/automation/"];

export function isHiddenPath(pathname) {
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname.endsWith(".social.json");
}

// Send visitors from the Cloudflare test address to the real domain.
// Only the main test address is redirected, so branch preview links still work.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "foresthounds-site.pages.dev") {
    url.hostname = "www.foresthounds.co.uk";
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  if (isHiddenPath(url.pathname)) {
    return new Response("Not found", { status: 404 });
  }
  return context.next();
}
