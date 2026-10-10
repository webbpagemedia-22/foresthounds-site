"""Photo tools for the weekly headline post.

    python automation/photos.py clean <src> <dest>   resize to 1800px wide max, drop all metadata
    python automation/photos.py untidied             library photos with no photos.json entry
    python automation/photos.py recent               library photos used by a post in the last 6 weeks
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "photo-library"
PHOTOS_JSON = LIBRARY / "photos.json"
BLOG = ROOT / "blog"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".heic"}
PUBLISHED = re.compile(r'property="article:published_time" content="(\d{4}-\d{2}-\d{2})"')
LIBRARY_IMAGE = re.compile(r"/images/library-([^\"'\s)]+)")


def clean_image(src: Path, dest: Path, max_width: int = 1800) -> tuple[int, int]:
    """Save an upright, metadata-free JPEG no wider than max_width. src may equal dest."""
    with Image.open(src) as original:
        im = ImageOps.exif_transpose(original).convert("RGB")
    if im.width > max_width:
        im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
    # Saving without exif= or icc_profile= writes no metadata at all.
    im.save(dest, "JPEG", quality=85, optimize=True, progressive=True)
    return im.size


def untidied(library: Path, photos_json: Path) -> list[str]:
    """Image files in the library that have no entry in photos.json yet."""
    known = {entry["file"] for entry in json.loads(photos_json.read_text())} if photos_json.exists() else set()
    return sorted(
        p.name for p in library.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES and p.name not in known
    )


def recently_used(blog_dir: Path, today: date, weeks: int = 6) -> set[str]:
    """Library file names used by posts published within `weeks` of today."""
    cutoff = today - timedelta(weeks=weeks)
    used = set()
    for post in blog_dir.glob("*.html"):
        html = post.read_text()
        published = PUBLISHED.search(html)
        if published and date.fromisoformat(published.group(1)) >= cutoff:
            used.update(LIBRARY_IMAGE.findall(html))
    return used


def main(argv: list[str]) -> int:
    if argv[:1] == ["clean"] and len(argv) == 3:
        width, height = clean_image(Path(argv[1]), Path(argv[2]))
        print(f"{argv[2]} {width}x{height}")
    elif argv == ["untidied"]:
        print("\n".join(untidied(LIBRARY, PHOTOS_JSON)))
    elif argv == ["recent"]:
        print("\n".join(sorted(recently_used(BLOG, date.today()))))
    else:
        print(__doc__, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
