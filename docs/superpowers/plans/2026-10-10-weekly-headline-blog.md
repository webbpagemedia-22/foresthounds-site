# Weekly Headline Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Sunday a Claude cloud routine opens three ready-to-publish blog post PRs on foresthounds-site; when David merges one, a GitHub Action adds it to the Forest Hounds Facebook queue in Buffer.

**Architecture:** All tooling lives under `automation/` in the site repo (hidden from the website by the middleware). Small, tested scripts do the mechanical work: Python + Pillow for photos, dependency-free Node for the Buffer hand-off. The agent's judgement work (research, writing, photo choice) is driven by one instructions file, `automation/weekly-headline.md`, which the cloud routine follows.

**Tech Stack:** Cloudflare Pages Functions (existing middleware), Python 3.11 + Pillow + pytest, Node 22 (`node:test`, built-in `fetch`; Node 22 is needed so the test can import the ES-module middleware file without a package.json), GitHub Actions, Buffer GraphQL API, Claude cloud routine with the Canva connector.

**Spec:** `docs/superpowers/specs/2026-10-10-weekly-headline-blog-design.md`

## Global Constraints

- Never commit or push to `main`; every change is a branch + PR with a plain-English summary and the Cloudflare preview link. Never merge (`CLAUDE.md`).
- Site stays static HTML, no build step, no frameworks; keep existing design, fonts, colours.
- British English in all user-facing text.
- Photos: max 1,800px wide, JPEG quality 85, all metadata removed (including location).
- Buffer: Facebook "Forest Hounds" only, channel ID `6ab95608ea19ca0bde0643f6`, mode `addToQueue`, `schedulingType: automatic`, `metadata.facebook.type: "post"`.
- Buffer API key only ever in the GitHub secret `BUFFER_API_KEY`.
- Live-page wait: poll every 30 seconds, give up after 15 minutes.
- Photo reuse window: 6 weeks.
- Routine schedule: Sundays 07:00 Europe/London.

## Review Focus

1. **A merge that adds two `.social.json` files** (David merges two options in one push): each must be sent once, in file-name order. Test in Task 3.
2. **A merge that only edits an existing `.social.json`**: must send nothing. Test in Task 3.
3. **Photo with EXIF orientation** (phone portrait shots): output must be upright, not rotated. Test in Task 2.
4. **Photo already ≤1,800px wide**: must not be upscaled. Test in Task 2.
5. **Facebook text longer than 500 characters or missing the post URL**: validation must fail before anything is sent. Test in Task 3.

## File Map

| File | Responsibility |
|---|---|
| `functions/_middleware.js` | Modify: also 404 `/automation/` and `*.social.json` |
| `automation/tests/middleware.test.mjs` | Middleware tests |
| `automation/photos.py` | Clean/resize images, find untidied library photos, recently used photos |
| `automation/requirements.txt` | `Pillow==11.3.0`, `pytest==8.4.2` |
| `automation/tests/test_photos.py` | Photo tests |
| `automation/buffer.mjs` | Find added social files, validate, build Buffer input, wait for live, send |
| `automation/headline-to-buffer.mjs` | CLI entry point used by the workflow |
| `automation/tests/buffer.test.mjs` | Buffer tests (fetch is injected, nothing real is called) |
| `automation/buffer-channels.json` | Channels to post to |
| `.github/workflows/headline-to-buffer.yml` | On push to `main` + manual dry run |
| `.github/workflows/automation-tests.yml` | Runs both test suites on every PR |
| `automation/weekly-headline.md` | The Sunday agent's instructions |
| `CLAUDE.md` | Modify: mention `automation/` and the weekly flow |

---

### Task 1: Hide automation files from the website

**Files:**
- Modify: `functions/_middleware.js`
- Create: `automation/tests/middleware.test.mjs`

**Interfaces:**
- Produces: exported `isHiddenPath(pathname: string) -> boolean`, used by `onRequest`.

- [ ] **Step 1: Write the failing test** (`node:test`, imports `isHiddenPath` from `../../functions/_middleware.js`)

```js
test("hides internal paths", () => {
  for (const p of ["/photo-library/a.jpeg", "/docs/x.md", "/automation/buffer.mjs", "/blog/walk.social.json"])
    assert.equal(isHiddenPath(p), true, p);
});
test("leaves site paths alone", () => {
  for (const p of ["/", "/blog/", "/blog/one-dog-at-a-time", "/images/lyra-moss.jpg", "/styles.css", "/documents"])
    assert.equal(isHiddenPath(p), false, p);
});
```

- [ ] **Step 2:** `node --test automation/tests/` → FAIL (`isHiddenPath` not exported).
- [ ] **Step 3:** Add `export function isHiddenPath(pathname)` covering the prefixes `/photo-library/`, `/docs/`, `/automation/` and the suffix `.social.json`; replace the existing inline check in `onRequest` with it. Keep the existing `pages.dev` redirect first.
- [ ] **Step 4:** `node --test automation/tests/` → PASS.
- [ ] **Step 5:** Commit on branch `automation-1-middleware`, push, open PR. When the preview appears, check with curl: the four hidden example paths return 404, `/`, `/blog/`, `/blog/one-dog-at-a-time` return 200. Post the preview link and results on the PR.

### Task 2: Photo tools

**Files:**
- Create: `automation/photos.py`, `automation/requirements.txt`, `automation/tests/test_photos.py`

**Interfaces:**
- Produces (CLI and functions, used by Task 5's instructions):
  - `clean_image(src: Path, dest: Path, max_width: int = 1800) -> tuple[int, int]`: upright (EXIF transpose), RGB, downscale only, save JPEG q85 with no metadata; returns final size. `src == dest` allowed.
  - `untidied(library: Path, photos_json: Path) -> list[str]`: image files (`.jpg .jpeg .png .heic`, case-insensitive) in `library` with no `file` entry in `photos.json`, sorted.
  - `recently_used(blog_dir: Path, today: date, weeks: int = 6) -> set[str]`: original library file names from `images/library-<name>` references in posts whose `article:published_time` is within `weeks` of `today`.
  - CLI: `python automation/photos.py clean <src> <dest>`, `python automation/photos.py untidied`, `python automation/photos.py recent` (prints one name per line).

- [ ] **Step 1: Write failing tests** (build fixtures with Pillow in `tmp_path`)

```python
def test_strips_gps_and_resizes(tmp_path):        # 4000x3000 with GPS EXIF -> (1800, 1350), getexif() empty
def test_portrait_orientation_applied(tmp_path):   # 3000x4000 stored landscape with Orientation=6 -> width < height
def test_small_image_not_upscaled(tmp_path):       # 640x960 -> (640, 960)
def test_untidied_lists_only_new(tmp_path):        # a.jpeg in photos.json, B.JPG + README.md not -> ["B.JPG"]
def test_recently_used_window(tmp_path):           # post dated today-20d uses images/library-IMG_1.jpeg,
                                                   # post dated today-60d uses images/library-IMG_2.jpeg -> {"IMG_1.jpeg"}
```

- [ ] **Step 2:** `pip install -r automation/requirements.txt && pytest automation/tests -q` → 5 FAIL.
- [ ] **Step 3:** Implement the three functions and the CLI in `automation/photos.py`.
- [ ] **Step 4:** `pytest automation/tests -q` → 5 passed.
- [ ] **Step 5:** Commit on `automation-2-photos`, PR with summary and preview link.

### Task 3: Buffer hand-off logic

**Files:**
- Create: `automation/buffer.mjs`, `automation/tests/buffer.test.mjs`, `automation/buffer-channels.json`

**Interfaces:**
- Consumes: `.social.json` shape from the spec section 4.4, plus `"image_alt": string` (Buffer requires alt text on images; the agent writes the post photo's alt text here).
- Produces:
  - `addedSocialFiles(diffNameStatus: string) -> string[]`: parses `git diff --name-status <before> <after>` output; returns `blog/*.social.json` paths with status `A`, sorted.
  - `validateSocial(social, channels) -> string[]`: list of problems; empty means valid. Checks `url` starts `https://www.foresthounds.co.uk/blog/`, `image` starts `https://www.foresthounds.co.uk/images/`, `image_alt` non-empty, each channel's `service` has `text[service]`, ≤500 characters for facebook, and contains `url`.
  - `buildPostInput(social, channel) -> object`: `{ channelId, text, schedulingType: "automatic", mode: "addToQueue", assets: [{ image: { url, metadata: { altText } } }], metadata: { facebook: { type: "post" } } }`.
  - `waitForLive(urls: string[], { fetch, intervalMs = 30000, timeoutMs = 900000, sleep }) -> Promise<void>`: resolves when every URL returns 200; rejects with a message naming the URLs still failing.
  - `sendPost(input, { apiKey, fetch }) -> Promise<string>`: POSTs the `createPost` mutation to `https://api.buffer.com` with `Authorization: Bearer <apiKey>`; returns the Buffer post ID; throws with Buffer's error message on a GraphQL error or non-200.
- `automation/buffer-channels.json`: `[{ "id": "6ab95608ea19ca0bde0643f6", "service": "facebook", "name": "Forest Hounds" }]`

- [ ] **Step 1: Confirm the Buffer mutation.** Introspect Buffer's schema (Buffer MCP `introspect_schema`, or a GraphQL introspection query with a key) and record the exact `createPost` input type name, field names and the success/error union shape at the top of `buffer.mjs` as a comment. If any name differs from the Interfaces block above, use Buffer's names and update this block.
- [ ] **Step 2: Write failing tests** (fake `fetch` and `sleep`; no network)

```js
test("only added social files, sorted", ...)        // "A\tblog/b.social.json\nM\tblog/a.social.json\nA\tblog/a.social.json\nA\tblog/a.html" -> ["blog/a.social.json","blog/b.social.json"]
test("edited social file sends nothing", ...)        // "M\tblog/a.social.json" -> []
test("valid social passes", ...)                     // -> []
test("long or link-less facebook text fails", ...)   // 501 chars -> problem; text without url -> problem
test("builds queue post with image and alt", ...)    // deepEqual to the object in Interfaces
test("waitForLive retries then resolves", ...)       // fetch returns 404, 404, 200 -> resolves, sleep called twice
test("waitForLive times out naming the URL", ...)    // always 404, timeoutMs 90000, intervalMs 30000 -> rejects /images\/x.jpg/
test("sendPost returns id and sends bearer key", ...)
test("sendPost throws Buffer's error message", ...)  // GraphQL errors[0].message surfaced
```

- [ ] **Step 3:** `node --test automation/tests/` → new tests FAIL.
- [ ] **Step 4:** Implement `automation/buffer.mjs`.
- [ ] **Step 5:** `node --test automation/tests/` → all PASS.
- [ ] **Step 6:** Commit on `automation-3-buffer`, PR with summary and preview link.

### Task 4: GitHub workflows

**Files:**
- Create: `automation/headline-to-buffer.mjs`, `.github/workflows/headline-to-buffer.yml`, `.github/workflows/automation-tests.yml`

**Interfaces:**
- Consumes: everything from Task 3.
- `headline-to-buffer.mjs` arguments: `--before <sha> --after <sha> [--dry-run] [--file <path>]`. With `--file`, skip the diff and use that file (manual runs). Steps: find files → validate all (exit 1 listing problems if any) → close sibling PRs → wait for live → send per channel → print a summary table. In dry run: validate, print each `buildPostInput` result as JSON, skip closing PRs, waiting and sending. A failure on one channel is reported and the script exits 1 after trying the others.
- Closing siblings: `gh pr list --label weekly-headline --state open --json number,headRefName`, close those whose branch starts `headline/<same yyyy-mm-dd>/` with comment "Not chosen this week."

- [ ] **Step 1:** Write `headline-to-buffer.yml`: `on: push: branches: [main]` and `workflow_dispatch` with inputs `file` (string) and `dry_run` (boolean, default true). `permissions: contents: read, pull-requests: write`. Checkout with `fetch-depth: 0`, Node 22, run the script with `BUFFER_API_KEY` and `GH_TOKEN` from secrets/token.
- [ ] **Step 2:** Write `automation-tests.yml`: on `pull_request`, run `node --test automation/tests/` and `pip install -r automation/requirements.txt && pytest automation/tests -q`.
- [ ] **Step 3:** Add a test fixture post on the branch, `automation/tests/fixtures/test.social.json`, pointing at the existing live post and `images/lyra-bracken.jpg`.
- [ ] **Step 4:** Push branch `automation-4-workflows`; open PR. Expected: the automation-tests check passes.
- [ ] **Step 5:** Ask David to add the `BUFFER_API_KEY` secret (Settings → Secrets and variables → Actions). Don't ask for the key in chat.
- [ ] **Step 6 (after merge):** Run the workflow manually with `file=automation/tests/fixtures/test.social.json`, `dry_run=true`. Expected: the log shows one Facebook payload with the right text, image URL and alt text, and nothing is sent.
- [ ] **Step 7:** Run again with `dry_run=false`. Expected: one post in the Forest Hounds Facebook queue in Buffer. Check it with Buffer's `list_posts`, then delete it from the queue with David's OK.

### Task 5: The Sunday agent's instructions

**Files:**
- Create: `automation/weekly-headline.md`
- Modify: `CLAUDE.md` (add: "`automation/` holds the weekly headline system; see `automation/weekly-headline.md`. It isn't served on the website.")

**Interfaces:**
- Consumes: `photos.py` CLI (Task 2), `.social.json` shape incl. `image_alt` (Task 3), label `weekly-headline`, branch pattern `headline/<yyyy-mm-dd>/<slug>`.

- [ ] **Step 1:** Write `automation/weekly-headline.md` as a numbered runbook that follows spec sections 4.2–4.6 and 6 in order: photo tidy-up PR, research (7-day window, credibility bar, "already covered" check against `blog/`, Evergreen fallback), writing (template copy, meta/OG/schema/date, `blog/index.html`, `sitemap.xml`, 600–1,000 words, Sources, booking box, `.social.json` with Facebook text ≤500 characters ending with the URL), photo choice (`photos.py recent`, library first, Canva fallback with the spec's constraints, `library-<name>` naming, illustration caption), and the PRs (title format, label, description contents, wait up to 15 minutes for the preview link). End with a self-check list: links resolve, no metadata in new images (`photos.py clean` used), `validateSocial` passes (`node -e` one-liner), British English.
- [ ] **Step 2:** Commit on `automation-5-instructions`, PR with summary and preview link.

### Task 6: Cloud routine and trial run

- [ ] **Step 1:** Using the `schedule` skill, create a routine named "Forest Hounds weekly headline": Sundays 07:00 Europe/London, repo `webbpagemedia-22/foresthounds-site`, Canva connector enabled, prompt from spec section 4.9.
- [ ] **Step 2:** Check that the routine can use Canva's image generation. If not, record it in the PR for Task 5's file: the agent will always use the best library photo (spec section 5).
- [ ] **Step 3:** "Run now". Expected: one photo-library PR (if there are untidied photos) and three `Option N — …` PRs with the `weekly-headline` label, each with a preview link, sources, photo note and Facebook text.
- [ ] **Step 4:** Review all PRs with David. Fix anything in `automation/weekly-headline.md` through a PR. Close the trial PRs unless David wants to publish one.
- [ ] **Step 5:** After the first real Sunday merge, check the Action log and the Buffer queue with David.
