(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    const boot = () => {
      api.startMembersCms().catch(() => {
        console.warn("Members CMS was not applied. Static members remain.");
      });
    };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
  root.ArcanaMembersCms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FETCH_TIMEOUT_MS = 4000;
  const IMAGE_TIMEOUT_MS = 5000;
  const IMAGE_PATH =
    /^members\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
  const SOCIALS = [
    ["xUrl", "X"],
    ["instagramUrl", "Instagram"],
    ["tiktokUrl", "TikTok"],
    ["otherUrl", "Link"],
  ];

  function safeHttpUrl(value) {
    if (value == null) return null;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return undefined;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url.href;
  }

  function parseFocus(value) {
    let number = Number.NaN;
    if (typeof value === "number") number = value;
    else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 100) return undefined;
    return number;
  }

  function parseSortOrder(value) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10000) {
      return undefined;
    }
    return value;
  }

  function parseImagePath(value) {
    if (value == null) return null;
    if (typeof value !== "string" || !IMAGE_PATH.test(value)) return undefined;
    if (value.includes("..") || value.toLowerCase().includes("draft")) return undefined;
    return value;
  }

  function parseName(value) {
    if (typeof value !== "string") return undefined;
    if (value.trim().length < 1 || value.length > 100) return undefined;
    return value;
  }

  function parseProfile(value) {
    if (typeof value !== "string" || value.length > 2000) return undefined;
    return value;
  }

  function validatePublicMembers(payload) {
    if (!Array.isArray(payload)) return { ok: false, reason: "payload" };
    const members = [];
    for (const item of payload) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) {
        return { ok: false, reason: "member" };
      }
      const name = parseName(item.name);
      const profile = parseProfile(item.profile);
      const sortOrder = parseSortOrder(item.sort_order);
      const imagePath = parseImagePath(item.image_path);
      const focusX = parseFocus(item.image_focus_x);
      const focusY = parseFocus(item.image_focus_y);
      const xUrl = safeHttpUrl(item.x_url);
      const instagramUrl = safeHttpUrl(item.instagram_url);
      const tiktokUrl = safeHttpUrl(item.tiktok_url);
      const otherUrl = safeHttpUrl(item.other_url);
      if (
        name === undefined ||
        profile === undefined ||
        sortOrder === undefined ||
        imagePath === undefined ||
        focusX === undefined ||
        focusY === undefined ||
        xUrl === undefined ||
        instagramUrl === undefined ||
        tiktokUrl === undefined ||
        otherUrl === undefined
      ) {
        return { ok: false, reason: "member" };
      }
      members.push({
        name,
        profile,
        sortOrder,
        imagePath,
        focusX,
        focusY,
        xUrl,
        instagramUrl,
        tiktokUrl,
        otherUrl,
      });
    }
    return { ok: true, members };
  }

  function splitProfile(profile) {
    const normalized = profile.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const index = normalized.indexOf("\n");
    if (index === -1) return { role: normalized, description: "" };
    return {
      role: normalized.slice(0, index),
      description: normalized.slice(index + 1),
    };
  }

  function publicImageUrl(supabaseUrl, imagePath) {
    const base = String(supabaseUrl || "").replace(/\/$/, "");
    if (!base || base.includes("member-draft-images")) return null;
    const encoded = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${base}/storage/v1/object/public/member-images/${encoded}`;
  }

  function primaryLink(member) {
    return member.otherUrl || member.xUrl || member.instagramUrl || member.tiktokUrl || null;
  }

  function appendMultilineText(doc, element, text) {
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0) element.appendChild(doc.createElement("br"));
      element.appendChild(doc.createTextNode(lines[index]));
    }
  }

  function createMemberCard(doc, member, imageUrl) {
    const card = doc.createElement("div");
    card.className = "member-card";

    const imageWrap = doc.createElement("div");
    imageWrap.className = "member-image";
    let media;
    if (imageUrl) {
      media = doc.createElement("img");
      media.src = imageUrl;
      media.alt = member.name;
      media.style.objectPosition = `${member.focusX}% ${member.focusY}%`;
    } else {
      media = doc.createElement("div");
      media.className = "member-image-placeholder";
      media.setAttribute("role", "img");
      media.setAttribute("aria-label", member.name);
    }

    const linkHref = primaryLink(member);
    if (linkHref) {
      const link = doc.createElement("a");
      link.className = "member-image-link";
      link.href = linkHref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(media);
      imageWrap.appendChild(link);
    } else {
      imageWrap.appendChild(media);
    }
    card.appendChild(imageWrap);

    const info = doc.createElement("div");
    info.className = "member-info";
    const heading = doc.createElement("h3");
    heading.textContent = member.name;
    info.appendChild(heading);

    const parts = splitProfile(member.profile);
    if (parts.role) {
      const role = doc.createElement("p");
      role.className = "member-role";
      role.textContent = parts.role;
      info.appendChild(role);
    }
    if (parts.description) {
      const description = doc.createElement("p");
      description.className = "member-description";
      appendMultilineText(doc, description, parts.description);
      info.appendChild(description);
    }

    const extras = SOCIALS.filter(([key]) => member[key] && member[key] !== linkHref);
    if (extras.length > 0) {
      const list = doc.createElement("ul");
      list.className = "member-socials";
      for (const [key, label] of extras) {
        const item = doc.createElement("li");
        const anchor = doc.createElement("a");
        anchor.href = member[key];
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = label;
        item.appendChild(anchor);
        list.appendChild(item);
      }
      info.appendChild(list);
    }

    card.appendChild(info);
    return card;
  }

  function bindMemberCardHover(card) {
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-15px) scale(1.02)";
      card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.15)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0) scale(1)";
      card.style.boxShadow = "0 15px 35px rgba(0,0,0,0.1)";
    });
  }

  function applyCmsMembers(grid, members, imageUrls) {
    const doc = grid.ownerDocument;
    const cards = members.map((member, index) => {
      const card = createMemberCard(doc, member, imageUrls[index] || null);
      card.style.animation = "none";
      card.style.opacity = "1";
      bindMemberCardHover(card);
      return card;
    });
    grid.replaceChildren(...cards);
    grid.dataset.membersSource = "cms";
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

  async function prepareMemberImages(members, supabaseUrl, loadImage) {
    const urls = [];
    for (const member of members) {
      if (!member.imagePath) {
        urls.push(null);
        continue;
      }
      const url = publicImageUrl(supabaseUrl, member.imagePath);
      if (!url || url.includes("member-draft-images")) return { ok: false, reason: "image" };
      urls.push(url);
    }
    const loader = loadImage || defaultLoadImage;
    try {
      await Promise.all(urls.map((url) => (url ? loader(url, IMAGE_TIMEOUT_MS) : Promise.resolve())));
    } catch {
      return { ok: false, reason: "image" };
    }
    return { ok: true, urls };
  }

  function warn(reason) {
    const allowed = new Set(["http", "payload", "member", "timeout", "network", "image", "config"]);
    if (!allowed.has(reason)) return;
    console.warn(`Members CMS was not applied (${reason}). Static members remain.`);
  }

  function publicConfigIsSafe(config) {
    if (!config || config.membersCmsEnabled !== true) return false;
    if (typeof config.supabaseUrl !== "string" || typeof config.supabasePublishableKey !== "string") return false;
    const key = config.supabasePublishableKey;
    if (!config.supabaseUrl.startsWith("https://") || key.length < 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes("service_role") || lowered.startsWith("sb_secret_")) return false;
    return true;
  }

  async function loadPublishedMembers(config, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_members_v1`;
    if (!endpoint.includes("/rest/v1/rpc/get_public_members_v1")) {
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
      return validatePublicMembers(payload);
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "timeout" };
      return { ok: false, reason: "network" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function startMembersCms(options = {}) {
    const config = options.config || globalThis.ARCANA_PUBLIC_CONFIG;
    const doc = options.document || globalThis.document;
    if (!publicConfigIsSafe(config)) {
      if (config && config.membersCmsEnabled === true) warn("config");
      return { applied: false, reason: "config" };
    }
    const grid = doc && doc.querySelector ? doc.querySelector(".members-grid") : null;
    if (!grid || grid.dataset.membersSource === "cms") {
      return { applied: false, reason: "missing" };
    }

    const loaded = await loadPublishedMembers(config, options);
    if (!loaded.ok) {
      warn(loaded.reason);
      return { applied: false, reason: loaded.reason };
    }
    if (loaded.members.length === 0) {
      applyCmsMembers(grid, [], []);
      return { applied: true, reason: "empty" };
    }
    const images = await prepareMemberImages(loaded.members, config.supabaseUrl, options.loadImage);
    if (!images.ok) {
      warn("image");
      return { applied: false, reason: "image" };
    }
    applyCmsMembers(grid, loaded.members, images.urls);
    return { applied: true, reason: "replaced" };
  }

  return {
    validatePublicMembers,
    safeHttpUrl,
    splitProfile,
    publicImageUrl,
    createMemberCard,
    loadPublishedMembers,
    prepareMemberImages,
    applyCmsMembers,
    startMembersCms,
    publicConfigIsSafe,
  };
});
