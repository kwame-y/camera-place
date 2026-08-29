/* ============================================================
   CAMERA PHOTO ARCHIVE
   ============================================================ */

let photos = [];
let currentPhoto = 0;


/* ============================================================
   LOAD PHOTO LIST
   ============================================================ */

async function loadGallery() {

    const gallery = document.getElementById("gallery-grid");

    try {

        const response =
            await fetch("photos.json");

        if (!response.ok) {
            throw new Error(
                "Could not load photos.json"
            );
        }

        photos = await response.json();

        if (!Array.isArray(photos)) {
            throw new Error(
                "photos.json must contain an array"
            );
        }

        /*
         * Newest photo first.
         *
         * Once your automation begins generating
         * chronological data, you can remove this
         * if you want to preserve Git/import order.
         */
        photos.reverse();

        document.getElementById(
            "photo-count"
        ).textContent = photos.length;

        document.getElementById(
            "hero-photo-count"
        ).textContent =
            `001 / ${padNumber(photos.length)}`;

        if (photos.length > 0) {

            document.getElementById(
                "last-updated"
            ).textContent =
                formatShortDate(
                    photos[0].timestamp
                );
        }


        /*
         * Create all cards.
         */

        for (
            let i = 0;
            i < photos.length;
            i++
        ) {

            await createPhotoCard(
                photos[i],
                i
            );
        }


    } catch (error) {

        console.error(error);

        gallery.innerHTML = `
            <p>
                Couldn't load the photo archive :(
            </p>
        `;
    }
}


/* ============================================================
   CREATE PHOTO CARD
   ============================================================ */

async function createPhotoCard(
    photo,
    index
) {

    const gallery =
        document.getElementById(
            "gallery-grid"
        );

    const card =
        document.createElement("article");

    card.className = "photo-card";

    const filename =
        getFilename(photo.file);

    /*
     * Start with JSON fallback metadata.
     */

    let metadata = {
        camera: photo.camera || "DIGITAL CAMERA",
        date: photo.timestamp || "UNKNOWN DATE"
    };


    /*
     * Try to read EXIF directly from the image.
     */

    try {

        const exif =
            await readExif(photo.file);

        metadata =
            mergeMetadata(
                metadata,
                exif
            );

    } catch (error) {

        console.warn(
            "EXIF unavailable:",
            filename
        );
    }


    card.innerHTML = `

        <a
            class="photo-link"
            href="${photo.file}"
            data-index="${index}"
        >

            <img
                src="${photo.thumbnail || photo.file}"
                alt="${escapeHtml(filename)}"
                loading="lazy"
            >

            <div class="photo-overlay">

                <span class="photo-rec">
                    <span class="photo-rec-dot">●</span>
                    REC
                </span>

                <span>
                    ${formatDisplayDate(
                        metadata.date
                    )}
                </span>

            </div>

        </a>


        <div class="photo-info">

            <div class="photo-topline">

                <span class="photo-number">
                    PHOTO #${padNumber(index + 1)}
                </span>

                <span>
                    ${index + 1}/${photos.length}
                </span>

            </div>


            <div class="photo-filename">
                ${escapeHtml(filename)}
            </div>


            <div class="photo-camera">
                ${escapeHtml(
                    metadata.camera
                )}
            </div>


            <div class="photo-date">
                ${formatDisplayDate(
                    metadata.date
                )}
            </div>

        </div>
    `;


    /*
     * Clicking card opens playback mode.
     */

    card
        .querySelector(".photo-link")
        .addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                openLightbox(index);

            }
        );


    gallery.appendChild(card);
}


/* ============================================================
   EXIF
   ============================================================ */

async function readExif(path) {

    /*
     * exifr is loaded from the CDN in index.html.
     *
     * We only ask for the fields we actually display.
     */

    return await exifr.parse(
        path,
        {
            pick: [
                "DateTimeOriginal",
                "DateTimeDigitized",
                "Make",
                "Model",
                "ISO",
                "FNumber",
                "ExposureTime",
                "FocalLength",
                "PixelXDimension",
                "PixelYDimension"
            ]
        }
    );
}


/* ============================================================
   COMBINE JSON + EXIF
   ============================================================ */

function mergeMetadata(
    fallback,
    exif
) {

    if (!exif) {
        return fallback;
    }

    let result = {
        ...fallback
    };


    if (exif.DateTimeOriginal) {

        result.date =
            exif.DateTimeOriginal;
    }


    if (exif.Model) {

        result.camera =
            exif.Make
                ? `${exif.Make} ${exif.Model}`
                : exif.Model;
    }


    if (exif.ISO !== undefined) {

        result.iso =
            exif.ISO;
    }


    if (exif.FNumber !== undefined) {

        result.aperture =
            exif.FNumber;
    }


    if (exif.ExposureTime !== undefined) {

        result.shutter =
            exif.ExposureTime;
    }


    if (exif.FocalLength !== undefined) {

        result.focal =
            exif.FocalLength;
    }


    return result;
}


/* ============================================================
   LIGHTBOX
   ============================================================ */

async function openLightbox(index) {

    currentPhoto = index;

    const lightbox =
        document.getElementById(
            "lightbox"
        );

    lightbox.classList.add(
        "visible"
    );

    lightbox.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

    await updateLightbox();
}


/* ============================================================
   CLOSE LIGHTBOX
   ============================================================ */

function closeLightbox() {

    const lightbox =
        document.getElementById(
            "lightbox"
        );

    lightbox.classList.remove(
        "visible"
    );

    lightbox.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow =
        "";
}


/* ============================================================
   UPDATE LIGHTBOX
   ============================================================ */

async function updateLightbox() {

    const photo =
        photos[currentPhoto];

    const image =
        document.getElementById(
            "lightbox-image"
        );

    const filename =
        getFilename(photo.file);


    /*
     * Set the main image.
     */

    image.src =
        photo.file;

    image.alt =
        filename;


    /*
     * Update photo number.
     */

    document.getElementById(
        "playback-index"
    ).textContent =
        `${padNumber(currentPhoto + 1)} / ${padNumber(photos.length)}`;


    /*
     * Default metadata.
     */

    let metadata = {

        camera:
            photo.camera ||
            "UNKNOWN CAMERA",

        date:
            photo.timestamp ||
            "UNKNOWN DATE",

        iso:
            "--",

        aperture:
            "--",

        shutter:
            "--",

        focal:
            "--"
    };


    /*
     * Try real EXIF.
     */

    try {

        const exif =
            await readExif(
                photo.file
            );

        metadata =
            mergeMetadata(
                metadata,
                exif
            );

    } catch (error) {

        console.warn(
            "Could not read EXIF:",
            filename
        );
    }


    /*
     * Fill metadata UI.
     */

    document.getElementById(
        "meta-filename"
    ).textContent =
        filename;


    document.getElementById(
        "meta-date"
    ).textContent =
        formatFullDate(
            metadata.date
        );


    document.getElementById(
        "meta-camera"
    ).textContent =
        metadata.camera;


    document.getElementById(
        "meta-iso"
    ).textContent =
        metadata.iso ?? "--";


    document.getElementById(
        "meta-aperture"
    ).textContent =
        metadata.aperture !== "--"
            ? `F${formatNumber(metadata.aperture)}`
            : "--";


    document.getElementById(
        "meta-shutter"
    ).textContent =
        formatShutter(
            metadata.shutter
        );


    document.getElementById(
        "meta-focal"
    ).textContent =
        metadata.focal !== "--"
            ? `${formatNumber(metadata.focal)}mm`
            : "--";
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function previousPhoto() {

    if (photos.length === 0) {
        return;
    }

    currentPhoto--;

    if (currentPhoto < 0) {
        currentPhoto =
            photos.length - 1;
    }

    updateLightbox();
}


function nextPhoto() {

    if (photos.length === 0) {
        return;
    }

    currentPhoto++;

    if (
        currentPhoto >= photos.length
    ) {
        currentPhoto = 0;
    }

    updateLightbox();
}


/* ============================================================
   KEYBOARD CONTROLS
   ============================================================ */

document.addEventListener(
    "keydown",
    function(event) {

        const lightbox =
            document.getElementById(
                "lightbox"
            );

        if (
            !lightbox.classList.contains(
                "visible"
            )
        ) {
            return;
        }


        if (
            event.key === "Escape"
        ) {

            closeLightbox();

        } else if (
            event.key === "ArrowLeft"
        ) {

            previousPhoto();

        } else if (
            event.key === "ArrowRight"
        ) {

            nextPhoto();
        }

    }
);


/* ============================================================
   CLICK LIGHTBOX BACKGROUND TO CLOSE
   ============================================================ */

document.getElementById(
    "lightbox"
).addEventListener(
    "click",
    function(event) {

        if (
            event.target === this
        ) {

            closeLightbox();

        }

    }
);


/* ============================================================
   BUTTONS
   ============================================================ */

document.getElementById(
    "close-lightbox"
).addEventListener(
    "click",
    closeLightbox
);


document.getElementById(
    "previous-photo"
).addEventListener(
    "click",
    previousPhoto
);


document.getElementById(
    "next-photo"
).addEventListener(
    "click",
    nextPhoto
);


/* ============================================================
   UTILITIES
   ============================================================ */

function getFilename(path) {

    return path
        .split("/")
        .pop();
}


function padNumber(number) {

    return String(number)
        .padStart(3, "0");
}


function formatNumber(number) {

    const numeric =
        Number(number);

    if (
        Number.isNaN(numeric)
    ) {
        return number;
    }

    if (
        Number.isInteger(numeric)
    ) {
        return String(numeric);
    }

    return numeric
        .toFixed(1)
        .replace(/\.0$/, "");
}


function formatShutter(value) {

    if (
        value === undefined ||
        value === null ||
        value === "--"
    ) {
        return "--";
    }

    const numeric =
        Number(value);

    if (
        !Number.isNaN(numeric)
    ) {

        if (
            numeric >= 1
        ) {

            return `${numeric}s`;

        }

        return `1/${Math.round(1 / numeric)}`;

    }

    return String(value);
}


function formatDisplayDate(value) {

    if (!value) {
        return "UNKNOWN";
    }

    const date =
        parseExifDate(value);

    if (!date) {
        return value;
    }

    return date.toLocaleDateString(
        "en-US",
        {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit"
        }
    );
}


function formatFullDate(value) {

    if (!value) {
        return "UNKNOWN DATE";
    }

    const date =
        parseExifDate(value);

    if (!date) {
        return value;
    }

    return date.toLocaleString(
        "en-US",
        {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        }
    );
}


function formatShortDate(value) {

    if (!value) {
        return "--";
    }

    const date =
        parseExifDate(value);

    if (!date) {
        return value;
    }

    return date.toLocaleDateString(
        "en-US",
        {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit"
        }
    );
}


/*
 * EXIF often looks like:
 *
 * 2026:08:29 00:42:17
 *
 * JavaScript does not consistently parse that format,
 * so convert it into an ISO-like format first.
 */

function parseExifDate(value) {

    if (
        value instanceof Date
    ) {
        return value;
    }

    if (
        typeof value !== "string"
    ) {
        return null;
    }


    const normalized =
        value.replace(
            /^(\d{4}):(\d{2}):(\d{2})/,
            "$1-$2-$3"
        );

    const date =
        new Date(
            normalized.replace(
                " ",
                "T"
            )
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
   START
   ============================================================ */

loadGallery();