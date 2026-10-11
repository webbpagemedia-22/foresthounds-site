// Paths that live in the repository but aren't part of the website:
// photo candidates, internal docs, the weekly headline tooling and the
// social text that sits next to each blog post. Also the database schema,
// GitHub workflows and the repo's own notes and licence.
const HIDDEN_FOLDERS = ["/photo-library", "/docs", "/automation", "/db", "/.github"];
const HIDDEN_FILES = ["/claude.md", "/readme.md", "/license", "/.gitignore"];

export function isHiddenPath(pathname) {
  let path;
  try {
    // Decode and tidy first, so /%61utomation/ or //Automation/ can't slip past.
    path = decodeURIComponent(pathname).replace(/\/+/g, "/").toLowerCase();
  } catch {
    return true; // Malformed encoding: no real page looks like this.
  }
  if (HIDDEN_FILES.includes(path)) return true;
  return HIDDEN_FOLDERS.some((folder) => path === folder || path.startsWith(`${folder}/`)) || path.endsWith(".social.json");
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
