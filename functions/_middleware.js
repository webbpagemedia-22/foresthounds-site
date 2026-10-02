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
  return context.next();
}
