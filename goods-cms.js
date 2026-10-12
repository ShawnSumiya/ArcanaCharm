(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    const boot = () => {
      api.startGoodsCms().catch(() => {
        console.warn("Goods CMS was not applied. Static goods remains.");
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
  root.ArcanaGoodsCms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FETCH_TIMEOUT_MS = 4000;
  const IMAGE_TIMEOUT_MS = 5000;
  const IMAGE_PATH = /^goods\/[0-9a-f]{64}\.(jpg|jpeg|png|webp)$/;
  const PRODUCT_HOST = "arcanacharm.base.shop";

  function parseSlot(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
    if (value < 1 || value > 3) return undefined;
    return value;
  }

  function parseProductUrl(value) {
    if (typeof value !== "string") return undefined;
    let url;
    try {
      url = new URL(value);
    } catch {
      return undefined;
    }
    if (url.protocol !== "https:") return undefined;
    if (url.username !== "" || url.password !== "") return undefined;
    if (url.port !== "") return undefined;
    if (url.hostname !== PRODUCT_HOST) return undefined;
    if (url.search !== "" || url.hash !== "") return undefined;
    if (!/^\/items\/[0-9]+$/.test(url.pathname)) return undefined;
    const href = `https://${PRODUCT_HOST}${url.pathname}`;
    if (url.href !== href) return undefined;
    return href;
  }

  function parseTitle(value) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > 200) return undefined;
    return trimmed;
  }

  function parsePriceAmount(value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
    return value;
  }

  function parseCurrency(value) {
    if (value !== "JPY") return undefined;
    return value;
  }

  function parseDescription(value) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) return undefined;
    return trimmed;
  }

  function formatJpy(amount) {
    const digits = String(amount);
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `¥${grouped}`;
  }

  function parseImagePath(value) {
    if (typeof value !== "string") return undefined;
    const lowered = value.toLowerCase();
    if (
      value.includes("..") ||
      value.includes("\\") ||
      value.includes("?") ||
      value.includes("#") ||
      value.startsWith("/") ||
      value.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(value)
    ) {
      return undefined;
    }
    if (lowered.includes("draft")) return undefined;
    if (!IMAGE_PATH.test(value)) return undefined;
    return value;
  }

  function validatePublicGoods(payload) {
    if (!Array.isArray(payload)) return { ok: false, reason: "payload" };
    if (payload.length === 0) return { ok: true, items: [] };
    if (payload.length < 3) return { ok: false, reason: "incomplete" };
    if (payload.length > 3) return { ok: false, reason: "extra" };
    const items = [];
    for (const row of payload) {
      if (row == null || typeof row !== "object" || Array.isArray(row)) {
        return { ok: false, reason: "payload" };
      }
      const slot = parseSlot(row.slot);
      const productUrl = parseProductUrl(row.product_url);
      const title = parseTitle(row.title);
      const priceAmount = parsePriceAmount(row.price_amount);
      const currency = parseCurrency(row.currency);
      const description = parseDescription(row.description);
      const imagePath = parseImagePath(row.image_path);
      if (slot === undefined) return { ok: false, reason: "slot" };
      if (productUrl === undefined) return { ok: false, reason: "url" };
      if (title === undefined) return { ok: false, reason: "title" };
      if (priceAmount === undefined) return { ok: false, reason: "price" };
      if (currency === undefined) return { ok: false, reason: "currency" };
      if (description === undefined) return { ok: false, reason: "description" };
      if (imagePath === undefined) return { ok: false, reason: "image" };
      items.push({
        slot,
        productUrl,
        title,
        priceAmount,
        currency,
        priceText: formatJpy(priceAmount),
        description,
        imagePath,
      });
    }
    const slots = new Set(items.map((item) => item.slot));
    if (slots.size !== 3 || !slots.has(1) || !slots.has(2) || !slots.has(3)) {
      return { ok: false, reason: "slot" };
    }
    items.sort((left, right) => left.slot - right.slot);
    return { ok: true, items };
  }

  function publicImageUrl(supabaseUrl, imagePath) {
    const base = String(supabaseUrl || "").replace(/\/$/, "");
    if (!base.startsWith("https://")) return null;
    const lowered = base.toLowerCase();
    if (lowered.includes("draft") || lowered.includes("goods-draft-images")) return null;
    if (parseImagePath(imagePath) === undefined) return null;
    const encoded = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${base}/storage/v1/object/public/goods-images/${encoded}`;
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

  async function prepareGoodsImages(items, supabaseUrl, loadImage) {
    if (!Array.isArray(items) || items.length !== 3) return { ok: false, reason: "image" };
    const prepared = [];
    for (const item of items) {
      const url = publicImageUrl(supabaseUrl, item.imagePath);
      if (!url || url.toLowerCase().includes("draft") || url.includes("goods-draft-images")) {
        return { ok: false, reason: "image" };
      }
      if (url.includes(PRODUCT_HOST)) return { ok: false, reason: "image" };
      prepared.push({ ...item, imageUrl: url });
    }
    const loader = loadImage || defaultLoadImage;
    try {
      await Promise.all(prepared.map((item) => loader(item.imageUrl, IMAGE_TIMEOUT_MS)));
    } catch {
      return { ok: false, reason: "image" };
    }
    return { ok: true, items: prepared };
  }

  function applyGoodsCards(cards, items) {
    if (!cards || typeof cards.get !== "function" || !Array.isArray(items) || items.length !== 3) return false;
    const updates = [];
    for (const item of items) {
      if (!item || parseProductUrl(item.productUrl) !== item.productUrl) return false;
      if (typeof item.imageUrl !== "string" || !item.imageUrl.startsWith("https://")) return false;
      const lowered = item.imageUrl.toLowerCase();
      if (
        lowered.includes("draft") ||
        lowered.includes(PRODUCT_HOST) ||
        !lowered.includes("/storage/v1/object/public/goods-images/")
      ) {
        return false;
      }
      if (typeof item.title !== "string" || typeof item.priceText !== "string" || typeof item.description !== "string") {
        return false;
      }
      const card = cards.get(item.slot);
      if (!card || typeof card.querySelector !== "function") return false;
      const image = card.querySelector("img");
      const title = card.querySelector("h4");
      const price = card.querySelector(".item-price");
      const description = card.querySelector(".item-description");
      if (!image || !title || !price || !description) return false;
      updates.push({ card, image, title, price, description, item });
    }
    if (updates.length !== 3) return false;
    if (updates[0].item.slot !== 1 || updates[1].item.slot !== 2 || updates[2].item.slot !== 3) return false;
    for (const entry of updates) {
      entry.card.href = entry.item.productUrl;
      entry.card.target = "_blank";
      entry.card.rel = "noopener noreferrer";
      entry.image.src = entry.item.imageUrl;
      entry.image.alt = entry.item.title;
      entry.title.textContent = entry.item.title;
      entry.price.textContent = entry.item.priceText;
      entry.description.textContent = entry.item.description;
    }
    return true;
  }

  function warn(reason) {
    const allowed = new Set([
      "http",
      "payload",
      "slot",
      "url",
      "title",
      "price",
      "currency",
      "description",
      "image",
      "incomplete",
      "extra",
      "timeout",
      "network",
      "config",
    ]);
    if (!allowed.has(reason)) return;
    console.warn(`Goods CMS was not applied (${reason}). Static goods remains.`);
  }

  function publicConfigIsSafe(config) {
    if (!config || config.goodsCmsEnabled !== true) return false;
    if (typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") return false;
    const key = config.supabasePublishableKey;
    if (!config.supabaseUrl.startsWith("https://") || key.length < 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes("service_role") || lowered.startsWith("sb_secret_")) return false;
    if (config.supabaseUrl.toLowerCase().includes("draft")) return false;
    return true;
  }

  function readGoodsCards(section) {
    if (!section || typeof section.querySelectorAll !== "function") return null;
    const nodes = section.querySelectorAll("[data-goods-slot]");
    const bySlot = new Map();
    for (const node of nodes) {
      const raw = node.getAttribute ? node.getAttribute("data-goods-slot") : "";
      if (raw !== "1" && raw !== "2" && raw !== "3") return null;
      const slot = Number(raw);
      if (bySlot.has(slot)) return null;
      bySlot.set(slot, node);
    }
    if (bySlot.size !== 3) return null;
    return bySlot;
  }

  async function loadPublishedGoods(config, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_goods_v1`;
    if (!endpoint.endsWith("/rest/v1/rpc/get_public_goods_v1")) {
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
      return validatePublicGoods(payload);
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function startGoodsCms(options = {}) {
    const config = options.config || globalThis.ARCANA_PUBLIC_CONFIG;
    const doc = options.document || globalThis.document;
    if (!publicConfigIsSafe(config)) {
      if (config && config.goodsCmsEnabled === true) warn("config");
      return { applied: false, reason: "config" };
    }
    const section = doc && doc.getElementById ? doc.getElementById("shop") : null;
    const cards = readGoodsCards(section);
    if (!section || !cards || (section.dataset && section.dataset.goodsSource === "cms")) {
      return { applied: false, reason: "missing" };
    }

    const loaded = await loadPublishedGoods(config, options);
    if (!loaded.ok) {
      warn(loaded.reason);
      return { applied: false, reason: loaded.reason };
    }
    if (!loaded.items || loaded.items.length !== 3) {
      return { applied: false, reason: "empty" };
    }
    const prepared = await prepareGoodsImages(loaded.items, config.supabaseUrl, options.loadImage);
    if (!prepared.ok) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    if (!applyGoodsCards(cards, prepared.items)) {
      return { applied: false, reason: "apply" };
    }
    if (section.dataset) section.dataset.goodsSource = "cms";
    return { applied: true, reason: "replaced" };
  }

  return {
    validatePublicGoods,
    parseSlot,
    parseProductUrl,
    parseTitle,
    parsePriceAmount,
    parseCurrency,
    parseDescription,
    parseImagePath,
    formatJpy,
    publicImageUrl,
    prepareGoodsImages,
    applyGoodsCards,
    loadPublishedGoods,
    startGoodsCms,
    publicConfigIsSafe,
  };
});
