#!/usr/bin/env python3

import json
import subprocess
from datetime import datetime
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
PHOTO_DIR = REPO / "photos"
OUTPUT = REPO / "photos.json"


IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
}


def run_exiftool():
    """Read EXIF information for all images in the photo directory."""

    command = [
        "exiftool",
        "-json",
        "-r",
        "-d",
        "%Y-%m-%dT%H:%M:%S",
        "-DateTimeOriginal",
        "-CreateDate",
        "-Make",
        "-Model",
        "-ISO",
        "-FNumber",
        "-ExposureTime",
        "-FocalLength",
        str(PHOTO_DIR),
    ]

    result = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )

    return json.loads(result.stdout)


def fallback_timestamp(path: Path) -> str:
    """Use file modification time when EXIF has no capture date."""

    timestamp = datetime.fromtimestamp(
        path.stat().st_mtime
    )

    return timestamp.strftime(
        "%Y-%m-%dT%H:%M:%S"
    )


def make_photo_record(item):
    source = Path(item["SourceFile"]).resolve()

    try:
        relative = source.relative_to(
            REPO.resolve()
        )
    except ValueError:
        return None

    if relative.suffix.lower() not in IMAGE_EXTENSIONS:
        return None

    relative_file = relative.as_posix()

    thumbnail = Path("thumbnails") / relative.name

    timestamp = (
        item.get("DateTimeOriginal")
        or item.get("CreateDate")
    )

    if not timestamp:
        timestamp = fallback_timestamp(source)

    make = item.get("Make", "")
    model = item.get("Model", "")

    if make and model:
        camera = f"{make} {model}"
    else:
        camera = model or make or "DIGITAL CAMERA"

    return {
        "file": relative_file,
        "thumbnail": thumbnail.as_posix(),
        "timestamp": timestamp,
        "camera": camera,
        "iso": item.get("ISO"),
        "aperture": item.get("FNumber"),
        "shutter": item.get("ExposureTime"),
        "focalLength": item.get("FocalLength"),
    }


def sort_key(photo):
    return photo.get(
        "timestamp",
        ""
    )


def main():
    if not PHOTO_DIR.exists():
        PHOTO_DIR.mkdir(
            parents=True,
            exist_ok=True
        )

    raw_items = run_exiftool()

    photos = []

    for item in raw_items:
        record = make_photo_record(item)

        if record is not None:
            photos.append(record)

    # Newest first
    photos.sort(
        key=sort_key,
        reverse=True
    )

    with OUTPUT.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            photos,
            file,
            indent=2,
            ensure_ascii=False
        )

        file.write("\n")

    print(
        f"Generated {OUTPUT} "
        f"with {len(photos)} photos."
    )


if __name__ == "__main__":
    main()