(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    const boot = () => {
      api.startGalleryCms().catch(() => {
        console.warn("Gallery CMS was not applied. Static gallery remains.");
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
  root.ArcanaGalleryCms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FETCH_TIMEOUT_MS = 4000;
  const IMAGE_TIMEOUT_MS = 5000;
  const ITEM_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const OBJECT_NAME = `(?:${ITEM_ID}|[0-9a-f]{64})`;
  const IMAGE_PATH = new RegExp(`^gallery/${ITEM_ID}/${OBJECT_NAME}\\.(jpg|jpeg|png|webp)$`);

  function parseSortOrder(value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10000) {
      return undefined;
    }
    return value;
  }

  function parseAlt(value) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.length < 1 || value.length > 200) return undefined;
    return trimmed;
  }

  function parseImagePath(value) {
    if (typeof value !== "string") return undefined;
    const lowered = value.toLowerCase();
    if (
      value.includes("..") ||
      value.includes("\\") ||
      value.includes("?") ||
      value.includes("#") ||
      value.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(value)
    ) {
      return undefined;
    }
    if (lowered.includes("draft")) return undefined;
    if (!IMAGE_PATH.test(value)) return undefined;
    return value;
  }

  function validatePublicGallery(payload) {
    if (!Array.isArray(payload)) return { ok: false, reason: "payload" };
    if (payload.length > 1) return { ok: false, reason: "unsupported" };
    if (payload.length === 0) return { ok: true, items: [] };
    const item = payload[0];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "item" };
    }
    const imagePath = parseImagePath(item.image_path);
    const altText = parseAlt(item.alt_text);
    const sortOrder = parseSortOrder(item.sort_order);
    if (imagePath === undefined || altText === undefined || sortOrder === undefined) {
      return { ok: false, reason: "item" };
    }
    return {
      ok: true,
      items: [{ imagePath, altText, sortOrder }],
    };
  }

  function publicImageUrl(supabaseUrl, imagePath) {
    const base = String(supabaseUrl || "").replace(/\/$/, "");
    if (!base.startsWith("https://")) return null;
    const lowered = base.toLowerCase();
    if (lowered.includes("draft") || lowered.includes("gallery-draft-images")) return null;
    if (parseImagePath(imagePath) === undefined) return null;
    const encoded = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${base}/storage/v1/object/public/gallery-images/${encoded}`;
  }

  function defaultLoadImage(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        reject(new Error("timeout"));
      }, timeoutMs);
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("image"));
      };
      image.src = url;
    });
  }

  async function prepareGalleryImage(item, supabaseUrl, loadImage) {
    const url = publicImageUrl(supabaseUrl, item.imagePath);
    if (!url || url.toLowerCase().includes("draft") || url.includes("gallery-draft-images")) {
      return { ok: false, reason: "image" };
    }
    const loader = loadImage || defaultLoadImage;
    try {
      await loader(url, IMAGE_TIMEOUT_MS);
    } catch {
      return { ok: false, reason: "image" };
    }
    return { ok: true, url };
  }

  function applyCmsGalleryImage(card, imageUrl, altText) {
    const image = card.querySelector("img");
    if (!image) return false;
    image.src = imageUrl;
    image.alt = altText;
    card.dataset.gallerySource = "cms";
    return true;
  }

  function applyEmptyGallery(card) {
    card.hidden = true;
    card.dataset.gallerySource = "cms-empty";
    const grid = card.parentElement;
    if (grid && grid.classList && grid.classList.contains("gallery-grid")) {
      grid.classList.add("gallery-cms-photo-hidden");
    }
  }

  function warn(reason) {
    const allowed = new Set(["http", "payload", "item", "timeout", "network", "image", "config", "unsupported"]);
    if (!allowed.has(reason)) return;
    console.warn(`Gallery CMS was not applied (${reason}). Static gallery remains.`);
  }

  function publicConfigIsSafe(config) {
    if (!config || config.galleryCmsEnabled !== true) return false;
    if (typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") return false;
    const key = config.supabasePublishableKey;
    if (!config.supabaseUrl.startsWith("https://") || key.length < 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes("service_role") || lowered.startsWith("sb_secret_")) return false;
    if (config.supabaseUrl.toLowerCase().includes("draft")) return false;
    return true;
  }

  async function loadPublishedGallery(config, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_gallery_v1`;
    if (!endpoint.endsWith("/rest/v1/rpc/get_public_gallery_v1")) {
      return { ok: false, reason: "config" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${config.supabasePublishableKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, reason: "http" };
      let payload;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, reason: "payload" };
      }
      return validatePublicGallery(payload);
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function startGalleryCms(options = {}) {
    const config = options.config || globalThis.ARCANA_PUBLIC_CONFIG;
    const doc = options.document || globalThis.document;
    if (!publicConfigIsSafe(config)) {
      if (config && config.galleryCmsEnabled === true) warn("config");
      return { applied: false, reason: "config" };
    }
    const card = doc && doc.getElementById ? doc.getElementById("mainGroupPhoto") : null;
    const section = doc && doc.getElementById ? doc.getElementById("gallery") : null;
    if (!card || !section || card.dataset.gallerySource === "cms" || card.dataset.gallerySource === "cms-empty") {
      return { applied: false, reason: "missing" };
    }

    const loaded = await loadPublishedGallery(config, options);
    if (!loaded.ok) {
      warn(loaded.reason);
      return { applied: false, reason: loaded.reason };
    }
    if (loaded.items.length === 0) {
      applyEmptyGallery(card);
      return { applied: true, reason: "empty" };
    }
    const images = await prepareGalleryImage(loaded.items[0], config.supabaseUrl, options.loadImage);
    if (!images.ok) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    if (!applyCmsGalleryImage(card, images.url, loaded.items[0].altText)) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    return { applied: true, reason: "replaced" };
  }

  return {
    validatePublicGallery,
    parseImagePath,
    publicImageUrl,
    prepareGalleryImage,
    applyCmsGalleryImage,
    applyEmptyGallery,
    loadPublishedGallery,
    startGalleryCms,
    publicConfigIsSafe,
  };
});
