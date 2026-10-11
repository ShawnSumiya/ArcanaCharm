(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    const boot = () => {
      api.startAboutCms().catch(() => {
        console.warn("About CMS was not applied. Static about remains.");
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
  root.ArcanaAboutCms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FETCH_TIMEOUT_MS = 4000;
  const IMAGE_TIMEOUT_MS = 5000;
  const OBJECT_NAME =
    "(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{64})";
  const IMAGE_PATH = new RegExp(`^about/${OBJECT_NAME}\\.(jpg|jpeg|png|webp)$`);

  function parseBody(value) {
    if (typeof value !== "string" || value.length > 2000) return undefined;
    const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!normalized) return undefined;
    const paragraphs = normalized
      .split(/\n(?:[ \t]*\n)+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
    if (paragraphs.length === 0) return undefined;
    return paragraphs;
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

  function validatePublicAbout(payload) {
    if (!Array.isArray(payload)) return { ok: false, reason: "payload" };
    if (payload.length > 1) return { ok: false, reason: "unsupported" };
    if (payload.length === 0) return { ok: true, about: null };
    const item = payload[0];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "payload" };
    }
    const paragraphs = parseBody(item.body);
    const imagePath = parseImagePath(item.image_path);
    const alt = parseAlt(item.image_alt);
    if (paragraphs === undefined) return { ok: false, reason: "body" };
    if (imagePath === undefined) return { ok: false, reason: "image" };
    if (alt === undefined) return { ok: false, reason: "alt" };
    return {
      ok: true,
      about: { paragraphs, imagePath, alt },
    };
  }

  function publicImageUrl(supabaseUrl, imagePath) {
    const base = String(supabaseUrl || "").replace(/\/$/, "");
    if (!base.startsWith("https://")) return null;
    const lowered = base.toLowerCase();
    if (lowered.includes("draft") || lowered.includes("about-draft-images")) return null;
    if (parseImagePath(imagePath) === undefined) return null;
    const encoded = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${base}/storage/v1/object/public/about-images/${encoded}`;
  }

  function appendMultilineText(doc, element, text) {
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0) element.appendChild(doc.createElement("br"));
      element.appendChild(doc.createTextNode(lines[index]));
    }
  }

  function applyAboutContent(textEl, imageEl, paragraphs, imageUrl, alt) {
    if (!textEl || !imageEl || !textEl.ownerDocument || typeof textEl.replaceChildren !== "function") return false;
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) return false;
    if (typeof imageUrl !== "string" || typeof alt !== "string") return false;
    const doc = textEl.ownerDocument;
    const nodes = paragraphs.map((paragraph) => {
      const p = doc.createElement("p");
      appendMultilineText(doc, p, paragraph);
      return p;
    });
    textEl.replaceChildren(...nodes);
    imageEl.src = imageUrl;
    imageEl.alt = alt;
    return true;
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

  async function prepareAboutImage(about, supabaseUrl, loadImage) {
    const url = publicImageUrl(supabaseUrl, about.imagePath);
    if (!url || url.toLowerCase().includes("draft") || url.includes("about-draft-images")) {
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

  function warn(reason) {
    const allowed = new Set(["http", "payload", "body", "alt", "timeout", "network", "image", "config", "unsupported"]);
    if (!allowed.has(reason)) return;
    console.warn(`About CMS was not applied (${reason}). Static about remains.`);
  }

  function publicConfigIsSafe(config) {
    if (!config || config.aboutCmsEnabled !== true) return false;
    if (typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") return false;
    const key = config.supabasePublishableKey;
    if (!config.supabaseUrl.startsWith("https://") || key.length < 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes("service_role") || lowered.startsWith("sb_secret_")) return false;
    if (config.supabaseUrl.toLowerCase().includes("draft")) return false;
    return true;
  }

  async function loadPublishedAbout(config, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_about_v1`;
    if (!endpoint.endsWith("/rest/v1/rpc/get_public_about_v1")) {
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
      return validatePublicAbout(payload);
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function startAboutCms(options = {}) {
    const config = options.config || globalThis.ARCANA_PUBLIC_CONFIG;
    const doc = options.document || globalThis.document;
    if (!publicConfigIsSafe(config)) {
      if (config && config.aboutCmsEnabled === true) warn("config");
      return { applied: false, reason: "config" };
    }
    const section = doc && doc.getElementById ? doc.getElementById("about") : null;
    const content = section && section.querySelector ? section.querySelector(".about-content") : null;
    const text = content && content.querySelector ? content.querySelector(".about-text") : null;
    const image = content && content.querySelector ? content.querySelector(".about-image img") : null;
    if (!section || !content || !text || !image || (content.dataset && content.dataset.aboutSource === "cms")) {
      return { applied: false, reason: "missing" };
    }

    const loaded = await loadPublishedAbout(config, options);
    if (!loaded.ok) {
      warn(loaded.reason);
      return { applied: false, reason: loaded.reason };
    }
    if (!loaded.about) {
      return { applied: false, reason: "empty" };
    }
    const prepared = await prepareAboutImage(loaded.about, config.supabaseUrl, options.loadImage);
    if (!prepared.ok) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    if (!applyAboutContent(text, image, loaded.about.paragraphs, prepared.url, loaded.about.alt)) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    if (content.dataset) content.dataset.aboutSource = "cms";
    return { applied: true, reason: "replaced" };
  }

  return {
    validatePublicAbout,
    parseBody,
    parseAlt,
    parseImagePath,
    publicImageUrl,
    prepareAboutImage,
    applyAboutContent,
    loadPublishedAbout,
    startAboutCms,
    publicConfigIsSafe,
  };
});
