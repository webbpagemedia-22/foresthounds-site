# Forest Hounds website – working rules
- Never commit or push directly to main. Main is the live site.
- Every change: create a new branch, commit there, open a pull request
  with a plain-English summary of what changed.
- Cloudflare Pages builds a preview for every branch. Post the preview
  link in your summary once it appears on the pull request.
- Never merge. David checks the preview and merges himself.
- Site is static HTML: index.html, gallery.html, styles.css, images/,
  functions/_middleware.js. No build step, no frameworks.
- British English. Keep the existing design, fonts and colours.
- Resize new photos to max 1800px wide and strip location data before
  adding them.
