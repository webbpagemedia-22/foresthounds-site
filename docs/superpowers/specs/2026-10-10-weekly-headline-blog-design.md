# Weekly headline blog post: design

Date: 10 October 2026
Status: Approved 10 October 2026

## 1. Purpose

Each week Forest Hounds publishes one headline blog post on
foresthounds.co.uk, based on that week's dog news or research, and shares it
as the week's main social media story through Buffer. David adds other
weekly Buffer posts by hand; this system only handles the headline story.

The system does the research and writing. David makes the editorial choice
and approves publication. Nothing goes live without David merging a pull
request.

### Success looks like

- Every Sunday morning, three finished, accurate, sourced post options are
  waiting as pull requests, each with a working Cloudflare preview.
- David can choose and publish one in under 15 minutes.
- Within about 20 minutes of merging, the post is in the Buffer queue for
  every chosen channel, with text, link and photo.
- No photo containing location data is ever stored in the repository or
  published.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Where the Sunday agent runs | Claude cloud routine (runs with the Mac off) |
| How David approves | Merging one of three pull requests |
| Social trigger | GitHub Action on merge to `main` |
| Buffer mode | Added to the queue (next scheduled slot), not published immediately |
| Social content | Plain text, link to the post, and the post's photo |
| Photos | `photo-library/` first; AI image from Canva only when nothing fits |
| Repository | `webbpagemedia-22/foresthounds-site`, private since 10 October 2026 |

## 3. Overview

```
Sunday 07:00 UK
  Cloud routine
    1. Tidy new photos in photo-library/      -> PR "Photo library: N new photos"
    2. Research the past 7 days of dog news
    3. Pick 3 stories, write 3 posts
    4. Choose a photo for each (library, else Canva)
    5. Open 3 PRs                               -> "Option 1/2/3 — <headline>"

Sunday, any time
  David opens the previews, merges one, optionally edits first

On merge to main
  GitHub Action "headline-to-buffer"
    1. Find blog/*.social.json added by the merge
    2. Close that week's other Option PRs
    3. Wait until the live page and photo load
    4. Add the post to the Buffer queue for each configured channel
```

## 4. Components

### 4.1 Agent instructions: `automation/weekly-headline.md`

The cloud routine's prompt is short: "Follow `automation/weekly-headline.md`
in the foresthounds-site repository." All of the real instructions live in
that file, so they are version-controlled and David can change the agent's
behaviour by editing one file through a pull request.

The file covers, in order: photo tidying (4.3), research (4.2), writing
(4.4), photo choice (4.5), pull requests (4.6), and the rules in section 6.

It also includes the existing working rules from `CLAUDE.md`, which the
agent must follow: branch and pull request for every change, never merge,
British English, keep the existing design.

### 4.2 Research

- **Window:** the 7 days ending at the run time.
- **What counts:** UK dog news and research that a Forest of Dean
  one-to-one dog walker can genuinely add to. Examples: veterinary studies,
  Alabama rot updates, wild boar and Forestry England notices, dog law
  changes, seasonal hazards (fireworks, conkers, adder season, heat, ice),
  and local Forest of Dean or Wye Valley stories.
- **Not used:** celebrity dog stories, product promotions, stories with no
  practical angle for local dog owners, or anything already covered in
  `blog/`.
- **Credibility:** every story must be traceable to a primary or credible
  source (journal, vet body, government, Forestry England, national or
  regional news). Each factual claim in a post links to its source. No
  invented quotes, figures or studies.
- **Shortfall:** if fewer than three stories meet the bar, fill the gap
  with a seasonal or evergreen topic, labelled "Evergreen" in the PR title.

### 4.3 Photo library tidy-up

At the start of each run, for any image in `photo-library/` that has no
entry in `photos.json`:

1. Remove all metadata, including location, and resize to a maximum of
   1,800px wide (JPEG, quality 85).
2. Look at the photo and write an entry in `photos.json`.
3. Open one pull request, "Photo library: N new photos", listing each photo
   and its description. If any photo had location data, the PR says so in
   bold.

`photos.json` entries:

```json
{
  "file": "IMG_0213.jpeg",
  "description": "Lyra in wet bracken on a muddy path, autumn",
  "alt": "A whippet standing on a muddy path between tall bracken",
  "tags": ["autumn", "lyra", "woodland", "mud"]
}
```

Photos tidied this way are available for that same day's options. Option
PRs never change `photo-library/`; they only add a cleaned copy of the
chosen photo to `images/` (4.5). So the photo library PR and the option PRs
never conflict, and can be merged in any order.

### 4.4 Writing the post

- **Template:** copy the newest post in `blog/`, as `CLAUDE.md` describes.
  Fill the title, meta description, Open Graph tags, canonical URL,
  `BlogPosting` schema, published date, photo and caption.
- **File:** `blog/<slug>.html`, served at `/blog/<slug>`. The slug is
  short, lowercase and hyphenated.
- **Listing:** add the post at the top of `blog/index.html`.
- **Sitemap:** add the post URL to `sitemap.xml`.
- **Voice:** David, first person, plain British English, practical. Link
  the news to what it means for dogs and owners in the Forest of Dean, as
  the "one dog at a time" post does. Clearly separate what a source says
  from David's own view.
- **Length:** 600 to 1,000 words, with a Sources section at the end and the
  usual booking box.
- **Social text:** written into `blog/<slug>.social.json`:

```json
{
  "url": "https://www.foresthounds.co.uk/blog/<slug>",
  "image": "https://www.foresthounds.co.uk/images/<file>.jpg",
  "image_alt": "Alt text for the photo (Buffer requires it)",
  "text": {
    "facebook": "Plain text, up to 500 characters, ending with the link."
  }
}
```

The `.social.json` file is not linked from any page, and the middleware
returns 404 for it (section 4.8).

### 4.5 Choosing the photo

1. Score every `photos.json` entry against the story and the season.
2. Skip photos used by a published post in the past 6 weeks. "Used" is
   worked out from the posts on `main`: each post's photo is stored as
   `images/library-<original file name>`, so the agent can match it back.
   Photos in rejected options never reach `main`, so they stay available.
3. If a reasonable fit exists, copy a cleaned version (no metadata, max
   1,800px) to `images/library-<original file name>`.
4. If nothing fits, generate an image with Canva's image generation:
   realistic, photo-style, Forest of Dean woodland in the right season, no
   recognisable people, and no dog that could be mistaken for Lyra. Save it
   as `images/<slug>-illustration.jpg` (resized, no metadata). The caption
   says "Illustration", and the PR title gets "⚠️ AI image".
5. If Canva is unavailable, use the best library photo even if it is a weak
   fit, and say so in the PR.

### 4.6 Pull requests

One branch and PR per option: `headline/<yyyy-mm-dd>/<slug>`.

PR title: `Option N — <headline>`, plus "Evergreen" or "⚠️ AI image" where
they apply.

All three PRs get the label `weekly-headline`.

PR description contains:

- a one-line pitch: why this story, why this week;
- the Cloudflare preview link (the agent waits for it and posts it);
- the social text for each channel, as it will appear;
- the photo used and why;
- the full source list.

The agent never merges and never pushes to `main`.

### 4.7 GitHub Action: `.github/workflows/headline-to-buffer.yml`

- **Trigger:** push to `main`. It looks only at `blog/*.social.json` files
  *added* in that push, so re-runs and later edits never post twice.
- **Steps:**
  1. Read the `.social.json` file.
  2. Close any other open PRs with the `weekly-headline` label from the
     same date, with a comment "Not chosen this week."
  3. Poll the live `url` and `image` every 30 seconds for up to 15 minutes
     until both return 200.
  4. For each channel in `automation/buffer-channels.json`, add a post to
     that channel's Buffer queue with that channel's text and the image.
  5. Write a summary to the Action log: which channels, and the Buffer
     post IDs.
- **Secret:** `BUFFER_API_KEY`, stored as a GitHub repository secret.
- **Dry run:** when run manually with `dry_run: true`, it prints exactly
  what it would send and sends nothing.
- **API:** Buffer's API (`api.buffer.com`), creating posts in queue mode.
  The exact mutation and fields are confirmed against Buffer's schema in
  the first implementation step.

`automation/buffer-channels.json` lists the channels to post to:

```json
[
  { "id": "6ab95608ea19ca0bde0643f6", "service": "facebook", "name": "Forest Hounds" }
]
```

Facebook only for now. Adding a channel later means adding an entry here
and a matching key under `text` in the agent instructions (section 8).

### 4.8 Keeping internal files off the website

Cloudflare Pages serves every file in the repository. The middleware
(`functions/_middleware.js`) already returns 404 for `/photo-library/`.
It is extended to also return 404 for `/docs/`, `/automation/`, and any
path ending in `.social.json`.

### 4.9 Cloud routine

- **Schedule:** Sundays at 07:00 Europe/London.
- **Repository access:** `webbpagemedia-22/foresthounds-site`.
- **Connectors:** Canva (image generation).
- **Prompt:** "Follow `automation/weekly-headline.md` in the
  foresthounds-site repository for this week's run."

## 5. Error handling

| Situation | What happens |
|---|---|
| Fewer than 3 strong stories | Fill with Evergreen options, labelled |
| A claim can't be sourced | Claim is dropped; story dropped if it depends on it |
| Canva unavailable | Best library photo, PR says so |
| Cloudflare preview doesn't appear within 15 minutes | PR opened anyway, noting the preview is missing |
| Routine fails entirely | No PRs that Sunday; reason in the routine's run history |
| Live page or photo not up after 15 minutes | Action fails, GitHub emails David, Re-run button retries |
| Buffer rejects a post | Action fails for that channel, others still sent, GitHub emails David |
| Buffer queue full (plan limit: 10 scheduled posts) | Same as Buffer rejecting; David frees a slot and re-runs |
| David edits a post on its branch before merging | Fine; the Action reads whatever is merged |
| David merges nothing that week | Other PRs stay open; next Sunday's PRs are added alongside |

## 6. Rules the agent always follows

- Never merge, never push to `main`, never change site design.
- Never use photos from news articles or other websites.
- Never commit an image with location data.
- British English throughout.
- Every factual claim has a linked source.
- Clearly mark AI-generated images on the page and in the PR.

## 7. Testing

1. **Middleware:** on the preview, `/docs/…`, `/automation/…`,
   `/photo-library/…` and `/blog/<slug>.social.json` return 404; all pages
   still return 200.
2. **Buffer Action dry run:** run manually against a test `.social.json` on
   a branch and check the printed payload for each channel.
3. **Buffer live test:** one real post to the Facebook queue, then delete
   it from Buffer.
4. **Routine trial run:** one manual "Run now". Review the three PRs and
   the photo library PR together; adjust `automation/weekly-headline.md`.
5. **First real week:** watch the first merge through to the Buffer queue.

## 8. Decisions from review (10 October 2026)

1. **Channels:** Facebook "Forest Hounds" only. Instagram ("wtfuk2026") and
   TikTok ("adventureswithfudge") are not used for the headline.
2. **TikTok:** dropped.
3. **Buffer plan limit:** the plan allows 10 scheduled posts at once. If the
   queue is full, the Action fails and David re-runs it after freeing a slot
   (section 5).
