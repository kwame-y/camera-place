#!/bin/zsh

set -u

# ============================================================
# CONFIGURATION
# ============================================================

# The script lives in:
#   /your/site/scripts/import-camera.sh
#
# Therefore the repository is automatically two levels above it.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

CAMERA="/Volumes/CAMERA"

PHOTO_DIR="$REPO/photos"
THUMBNAIL_DIR="$REPO/thumbnails"
MANIFEST_SCRIPT="$REPO/scripts/build-manifest.py"

LOCK_DIR="$HOME/.kwame-camera-import.lock"


# ============================================================
# LOGGING
# ============================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}


# ============================================================
# CHECK CAMERA
# ============================================================

if [[ ! -d "$CAMERA" ]]; then
    exit 0
fi


# ============================================================
# CHECK REPOSITORY
# ============================================================

if [[ ! -d "$REPO/.git" ]]; then
    log "ERROR: Git repository not found:"
    log "$REPO"
    exit 1
fi


# ============================================================
# PREPARE DIRECTORIES
# ============================================================

mkdir -p "$PHOTO_DIR"
mkdir -p "$THUMBNAIL_DIR"


# ============================================================
# PREVENT MULTIPLE IMPORTS
# ============================================================

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    exit 0
fi

cleanup() {
    rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap cleanup EXIT


log "Camera detected."
log "Repository: $REPO"


# ============================================================
# IMPORT PHOTOS
# ============================================================

find "$CAMERA" \
    -type f \
    \( \
        -iname "*.jpg" \
        -o -iname "*.jpeg" \
        -o -iname "*.png" \
    \) \
    -print0 |
while IFS= read -r -d '' SOURCE; do

    ORIGINAL_NAME="$(basename "$SOURCE")"

    EXT="${SOURCE##*.}"
    EXT="${EXT:l}"


    # --------------------------------------------------------
    # Read capture date from EXIF
    # --------------------------------------------------------

    TIMESTAMP="$(
        exiftool \
            -s3 \
            -d "%Y-%m-%d_%H-%M-%S" \
            -DateTimeOriginal \
            "$SOURCE" 2>/dev/null
    )"


    # --------------------------------------------------------
    # Fallback if camera has no EXIF capture date
    # --------------------------------------------------------

    if [[ -z "$TIMESTAMP" ]]; then

        TIMESTAMP="$(
            stat \
                -f "%Sm" \
                -t "%Y-%m-%d_%H-%M-%S" \
                "$SOURCE"
        )"

    fi


    # --------------------------------------------------------
    # Determine destination filename
    # --------------------------------------------------------

    DEST="$PHOTO_DIR/${TIMESTAMP}.${EXT}"

    COUNTER=1


    # --------------------------------------------------------
    # Avoid collisions / duplicate imports
    # --------------------------------------------------------

    while [[ -e "$DEST" ]]; do

        # Same file already exists
        if cmp -s "$SOURCE" "$DEST"; then

            log "Already imported: $ORIGINAL_NAME"

            DEST=""

            break
        fi

        DEST="$PHOTO_DIR/${TIMESTAMP}_${COUNTER}.${EXT}"

        ((COUNTER++))

    done


    if [[ -z "$DEST" ]]; then
        continue
    fi


    # --------------------------------------------------------
    # Copy original
    # --------------------------------------------------------

    log "Importing: $ORIGINAL_NAME"

    cp "$SOURCE" "$DEST"


    # --------------------------------------------------------
    # Generate thumbnail
    # --------------------------------------------------------

    THUMB="$THUMBNAIL_DIR/$(basename "$DEST")"

    sips \
        -Z 1200 \
        "$DEST" \
        --out "$THUMB" \
        >/dev/null


done


# ============================================================
# REBUILD MANIFEST
# ============================================================

log "Rebuilding photo manifest..."

python3 "$MANIFEST_SCRIPT"


# ============================================================
# GIT
# ============================================================

cd "$REPO" || exit 1

git add \
    photos \
    thumbnails \
    photos.json


# ============================================================
# DON'T COMMIT IF NOTHING CHANGED
# ============================================================

if git diff --cached --quiet; then

    log "No new photos."

    exit 0
fi


# ============================================================
# COMMIT
# ============================================================

PHOTO_TOTAL="$(
    find "$PHOTO_DIR" \
        -type f \
        \( \
            -iname "*.jpg" \
            -o -iname "*.jpeg" \
            -o -iname "*.png" \
        \) |
    wc -l |
    tr -d ' '
)"

COMMIT_MESSAGE="Add camera photos (${PHOTO_TOTAL} total)"

log "Creating Git commit..."

git commit \
    -m "$COMMIT_MESSAGE"


# ============================================================
# PUSH
# ============================================================

log "Pushing to GitHub..."

git push origin main

log "Camera import complete."