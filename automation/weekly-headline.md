# Weekly headline: Sunday runbook

You are preparing this week's headline blog post options for Forest Hounds,
a one-to-one dog walking business in the Forest of Dean run by David Page.
David reads three finished options on Sunday, merges one, and the merge
sends it to the Forest Hounds Facebook page through Buffer.

Follow these steps in order. Read `CLAUDE.md` first; its rules always apply.

## Rules that are never broken

- Never merge a PR, never push to `main`, never change the site's design,
  fonts or colours.
- Never use photos or images from news articles or any other website.
- Never commit an image that still has metadata. Every image you add goes
  through `python automation/photos.py clean <src> <dest>` first.
- British English throughout (colour, organise, programme, metres).
- Every factual claim links to its source. Never invent quotes, numbers,
  studies or people. If you can't source it, leave it out.
- AI-generated images are always labelled, on the page and in the PR.

## 0. Set up

```bash
pip install -r automation/requirements.txt
gh label create weekly-headline --color 2E7D32 --description "Sunday headline post option" 2>/dev/null || true
```

Today's date (Europe/London) is the post date for all three options. Call it
`DATE` (yyyy-mm-dd).

## 1. Tidy new library photos

1. `python automation/photos.py untidied` lists photos with no
   `photo-library/photos.json` entry. If it prints nothing, skip to step 2.
2. On a branch `photo-library/DATE`, for each listed photo:
   - Before cleaning, note whether it has location data:
     `python -c "import sys; sys.path.insert(0, 'automation'); import photos; from PIL import Image; print(bool(Image.open(sys.argv[1]).getexif().get_ifd(0x8825)))" photo-library/<file>`
   - Clean it. The output is always a JPEG, so a `.jpg`/`.jpeg` file keeps
     its name, and anything else (`.heic`, `.png`) becomes `<name>.jpg`
     with the original removed (`git rm`):
     `python automation/photos.py clean photo-library/<file> photo-library/<name>.jpg`
   - Look at the photo and add an entry to `photos.json` using the cleaned
     file's name:
     `{"file", "description", "alt", "tags"}`. The description says what's in
     it (dog, place, season, light, mood) in one line. Alt text is a plain
     sentence for screen readers. Tags are lowercase words: season, dog
     (`lyra` if it's clearly Lyra, the whippet), place, mood.
3. Open a PR "Photo library: N new photos" listing each photo and its
   description. If any photo had location data, start the PR description
   with **"⚠️ N photos had location data. It's been removed in this PR, but
   the originals are still in the repository history."**
4. Return to `main` for step 2. For the rest of this run, read photo
   descriptions and cleaned photos from the `photo-library/DATE` branch
   (`git show photo-library/DATE:photo-library/photos.json`,
   `git show photo-library/DATE:photo-library/<file> > /tmp/<file>`), since
   they aren't on `main` yet.

## 2. Research

Search the 7 days up to now for UK dog news and research. Good sources:
peer-reviewed journals, vet bodies (BVA, RVC, BSAVA, PDSA), the Royal Kennel
Club, government (Defra, Gov.uk), Forestry England, the Forest of Dean
District Council, national and regional news (BBC, Gloucestershire Live,
The Forester).

Good stories have a practical angle for dog owners in the Forest of Dean
and Wye Valley, such as:
- veterinary studies and health warnings (Alabama rot, toxins, seasonal illness)
- wild boar, deer, livestock and Forestry England notices
- dog law and rule changes
- seasonal hazards (fireworks, conkers, acorns, adders, heat, ice, rock salt)
- local news involving dogs, walks, the Forest or nearby towns

Skip celebrity dog stories, product promotions, anything without a
practical angle, and anything already covered: check every post in
`blog/` and skip a topic it already covers unless there's genuinely new
information.

A story needs at least one credible source you've actually opened. Pick the
three strongest. If fewer than three qualify, fill the gap with a seasonal
or evergreen topic that suits the time of year; mark those **Evergreen**.

## 3. Write each option

For each story, on its own branch `headline/DATE/<slug>` from `main`:

1. **The post**: copy the newest post in `blog/` to `blog/<slug>.html`. The
   slug is short, lowercase and hyphenated, e.g. `conkers-and-dogs`. Update:
   `<title>`, meta description, `og:title`, `og:description`, `og:url`,
   canonical, `og:image`, `article:published_time` (DATE), the
   `BlogPosting` JSON-LD (headline, datePublished, image,
   mainEntityOfPage), the `<h1>`, the "Posted" date line, the photo, its
   alt text and caption, the booking box heading, and the body.
2. **The body**: 600 to 1,000 words, in David's voice: first person, plain,
   practical, warm but not gushing. Short paragraphs, `<h2>` sections, lists
   where they help. Open with the news in one or two sentences. Then say
   what it means for dogs and owners here, in the Forest of Dean, and where
   it fits, how a one-to-one walk handles it. Clearly separate what a source
   says from David's own view ("What follows is my own view…"). Link each
   claim to its source inline. End with the usual booking section and a
   `<h2>Sources</h2>` list (`<ul class="sources">`). Use the newest post as
   the model for structure and tone. Prices and contact details must match
   `index.html`.
3. **The listing**: add the post at the top of the list in `blog/index.html`,
   in the same format as the entries already there.
4. **The sitemap**: add `https://www.foresthounds.co.uk/blog/<slug>` to
   `sitemap.xml` with `<lastmod>` DATE, matching the existing entries.
5. **The photo**: see step 4.
6. **The social text**: `blog/<slug>.social.json`:

   ```json
   {
     "url": "https://www.foresthounds.co.uk/blog/<slug>",
     "image": "https://www.foresthounds.co.uk/images/<image file>",
     "image_alt": "<the photo's alt text>",
     "text": {
       "facebook": "<plain text, max 500 characters, ending with the url>"
     }
   }
   ```

   The Facebook text is plain text: no HTML, no markdown, at most two
   emoji, no hashtags. Lead with the most useful fact, give one practical
   tip, then the link.

## 4. Choose each photo

1. `python automation/photos.py recent` lists library photos used in the
   last 6 weeks. Don't use those.
2. Read `photo-library/photos.json`, from the `photo-library/DATE` branch if
   step 1 made one.
   Pick the photo whose description and tags best fit the story and season.
   Use each photo for at most one of this week's three options.
3. If one fits reasonably, run
   `python automation/photos.py clean photo-library/<file> images/library-<file>`
   and use `/images/library-<file>`. Library files are always `.jpg` or
   `.jpeg` after step 1. Keep the `library-` prefix and the file name
   exactly; that's how recently used photos are tracked.
4. If nothing fits, generate an image with Canva's image generation:
   realistic, natural-light photograph style; Forest of Dean mixed woodland
   in the current season; no recognisable people; no text; any dog is a
   generic breed, never a whippet (so it can't be mistaken for Lyra).
   Landscape 3:2. Download it, then
   `python automation/photos.py clean <download> images/<slug>-illustration.jpg`.
   Caption it "Illustration" and say what it shows. Mark the PR
   "⚠️ AI image".
5. If Canva isn't available or fails, use the best library photo even if
   it's a weak fit, and say so in the PR.

## 5. Open the PRs

For each option:

- Title: `Option N — <headline>`, adding ` · Evergreen` and/or
  ` · ⚠️ AI image` where they apply.
- Label: `weekly-headline`.
- Description, in this order:
  1. **Why this story, this week:** one or two sentences.
  2. **Preview:** the preview only exists once the PR is open. Open the PR
     with "Preview: coming shortly", wait up to 15 minutes for Cloudflare's
     preview link to appear on it, then edit the description to include
     the link. If it doesn't appear, say "Preview not ready yet".
  3. **Facebook post:** the social text exactly as it will appear.
  4. **Photo:** which photo, and why it fits, or why an AI image was used.
  5. **Sources:** every source used, as links.
  6. A last line: "Merge this PR to publish it. The other options close
     automatically, and the post goes into the Forest Hounds Facebook queue
     in Buffer."

## 6. Check before you finish

For every option:

- [ ] Open the preview: the post, the blog list and the photo all load.
- [ ] Every link in the post resolves (no 404s).
- [ ] Every new image went through `photos.py clean`.
- [ ] The social file passes validation:
      `node -e "import('./automation/buffer.mjs').then(async m => { const fs = await import('node:fs'); const p = m.validateSocial(JSON.parse(fs.readFileSync('blog/<slug>.social.json')), JSON.parse(fs.readFileSync('automation/buffer-channels.json'))); console.log(p.length ? p : 'ok'); })"`
- [ ] British spelling throughout; no claim without a source.

Finish with a short summary: the three options (titles and PR links), the
photo library PR if any, and anything that didn't go to plan.
