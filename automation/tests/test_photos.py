import json
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from photos import clean_image, recently_used, untidied  # noqa: E402

GPS_IFD = 0x8825
ORIENTATION = 0x0112


def make_jpeg(path, size, exif=None):
    im = Image.new("RGB", size, (90, 120, 60))
    if exif is not None:
        im.save(path, "JPEG", exif=exif)
    else:
        im.save(path, "JPEG")


def test_strips_gps_and_resizes(tmp_path):
    src = tmp_path / "gps.jpeg"
    exif = Image.Exif()
    exif.get_ifd(GPS_IFD)[2] = (51.0, 49.0, 59.0)
    exif[0x010F] = "Apple"
    make_jpeg(src, (4000, 3000), exif)
    assert Image.open(src).getexif().get_ifd(GPS_IFD)

    assert clean_image(src, src) == (1800, 1350)
    out = Image.open(src)
    assert out.size == (1800, 1350)
    assert len(out.getexif()) == 0


def test_portrait_orientation_applied(tmp_path):
    src = tmp_path / "rotated.jpeg"
    exif = Image.Exif()
    exif[ORIENTATION] = 6  # stored landscape, displayed portrait
    make_jpeg(src, (4000, 3000), exif)
    dest = tmp_path / "out.jpeg"

    width, height = clean_image(src, dest)
    assert width < height
    assert Image.open(dest).size == (1800, 2400)


def test_small_image_not_upscaled(tmp_path):
    src = tmp_path / "small.jpeg"
    make_jpeg(src, (640, 960))
    assert clean_image(src, tmp_path / "out.jpeg") == (640, 960)


def test_untidied_lists_only_new(tmp_path):
    library = tmp_path / "photo-library"
    library.mkdir()
    for name in ["a.jpeg", "B.JPG", "README.md"]:
        (library / name).write_bytes(b"x")
    photos_json = library / "photos.json"
    photos_json.write_text(json.dumps([{"file": "a.jpeg"}]))

    assert untidied(library, photos_json) == ["B.JPG"]


def write_post(blog, slug, published, image):
    (blog / f"{slug}.html").write_text(
        f'<meta property="article:published_time" content="{published.isoformat()}">\n'
        f'<img src="/images/{image}" alt="">\n'
    )


def test_recently_used_window(tmp_path):
    blog = tmp_path / "blog"
    blog.mkdir()
    today = date(2026, 10, 11)
    write_post(blog, "recent", today - timedelta(days=20), "library-IMG_1.jpeg")
    write_post(blog, "old", today - timedelta(days=60), "library-IMG_2.jpeg")
    write_post(blog, "own", today - timedelta(days=5), "lyra-moss.jpg")
    (blog / "index.html").write_text("<p>no date</p>")

    assert recently_used(blog, today) == {"IMG_1.jpeg"}


def test_jpeg_comment_removed(tmp_path):
    src = tmp_path / "comment.jpeg"
    Image.new("RGB", (100, 100)).save(src, "JPEG", comment=b"secret comment")
    dest = tmp_path / "out.jpg"
    clean_image(src, dest)
    assert b"secret comment" not in dest.read_bytes()


def test_heic_photo_cleaned(tmp_path):
    from pillow_heif import register_heif_opener
    register_heif_opener()
    src = tmp_path / "phone.heic"
    Image.new("RGB", (2400, 1800), (90, 120, 60)).save(src, "HEIF")
    dest = tmp_path / "phone.jpg"
    # A fresh interpreter, as the agent runs it: photos.py must load HEIC support itself.
    script = Path(__file__).resolve().parents[1] / "photos.py"
    subprocess.run([sys.executable, str(script), "clean", str(src), str(dest)], check=True)
    assert Image.open(dest).format == "JPEG"
    assert Image.open(dest).size == (1800, 1350)


def test_non_jpeg_destination_refused(tmp_path):
    src = tmp_path / "a.jpeg"
    make_jpeg(src, (100, 100))
    with pytest.raises(ValueError, match=".jpg"):
        clean_image(src, tmp_path / "a.png")
