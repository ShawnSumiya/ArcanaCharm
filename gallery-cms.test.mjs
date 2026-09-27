import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const cms = require("./gallery-cms.js");

const imagePath =
  "gallery/11111111-1111-4111-8111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";
const otherImagePath =
  "gallery/cf4b6e6d-ae02-47e1-8366-c85e42827898/343537b7a23c5da17435ce366ea981a8a99775e16f124dff420e4f3264d0dd04.webp";
const config = {
  membersCmsEnabled: false,
  galleryCmsEnabled: true,
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_example_key_value",
};
const staticSrc = "Photo/idol_spirits.webp";
const staticAlt = "ArcanaCharmグループ写真";

function row(overrides = {}) {
  return {
    image_path: imagePath,
    alt_text: "ArcanaCharmグループ写真",
    sort_order: 0,
    ...overrides,
  };
}

function classList(initial) {
  const classes = new Set(initial);
  return {
    classes,
    contains(name) {
      return classes.has(name);
    },
    add(name) {
      classes.add(name);
    },
  };
}

function cardStub() {
  const image = { src: staticSrc, alt: staticAlt };
  const grid = { classList: classList(["gallery-grid"]) };
  const card = {
    id: "mainGroupPhoto",
    hidden: false,
    dataset: { gallerySource: "static" },
    className: "gallery-item main-group-photo",
    parentElement: grid,
    image,
    querySelector(selector) {
      return selector === "img" ? image : null;
    },
  };
  return card;
}

function galleryDocument(card) {
  const section = { id: "gallery" };
  return {
    section,
    getElementById(id) {
      if (id === "mainGroupPhoto") return card;
      if (id === "gallery") return section;
      return null;
    },
  };
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      if (payload instanceof Error) throw payload;
      return payload;
    },
  };
}

describe("public gallery validation", () => {
  it("accepts one published row and ignores unexpected fields", () => {
    const result = cms.validatePublicGallery([{ ...row(), published_by: "hidden" }]);
    assert.equal(result.ok, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].imagePath, imagePath);
    assert.equal(result.items[0].altText, "ArcanaCharmグループ写真");
    assert.equal(result.items[0].sortOrder, 0);
    assert.equal(result.items[0].published_by, undefined);
  });

  it("accepts a content-hash object name and jpeg without pinning one id", () => {
    assert.equal(cms.validatePublicGallery([row({ image_path: otherImagePath })]).ok, true);
    assert.equal(
      cms.validatePublicGallery([
        row({
          image_path:
            "gallery/22222222-2222-4222-8222-222222222222/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpeg",
        }),
      ]).ok,
      true,
    );
  });

  it("accepts an empty array as a valid CMS result", () => {
    const result = cms.validatePublicGallery([]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.items, []);
  });

  it("rejects more than one row, malformed payloads, alt, and sort", () => {
    assert.equal(cms.validatePublicGallery([row(), row({ sort_order: 1 })]).ok, false);
    assert.equal(cms.validatePublicGallery([row(), row({ sort_order: 1 })]).reason, "unsupported");
    assert.equal(cms.validatePublicGallery({ items: [] }).ok, false);
    assert.equal(cms.validatePublicGallery([row({ alt_text: "  " })]).ok, false);
    assert.equal(cms.validatePublicGallery([row({ alt_text: "a".repeat(201) })]).ok, false);
    assert.equal(cms.validatePublicGallery([row({ alt_text: "a".repeat(200) })]).ok, true);
    assert.equal(cms.validatePublicGallery([row({ sort_order: 1.5 })]).ok, false);
    assert.equal(cms.validatePublicGallery([row({ sort_order: -1 })]).ok, false);
    assert.equal(cms.validatePublicGallery([row({ image_path: null })]).ok, false);
  });

  it("rejects unsafe, draft, and query-injected image paths", () => {
    const rejected = [
      "gallery/../secret.webp",
      "https://evil.example/a.webp",
      "//evil.example/a.webp",
      `${imagePath}?x=1`,
      "gallery-draft-images/gallery/11111111-1111-4111-8111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      "draft/gallery/photo.webp",
      "gallery/11111111-1111-4111-8111-111111111111/not-a-hash.webp",
      "Photo/idol_spirits.webp",
    ];
    for (const value of rejected) {
      assert.equal(cms.parseImagePath(value), undefined, value);
      assert.equal(cms.validatePublicGallery([row({ image_path: value })]).ok, false, value);
    }
  });

  it("builds a public gallery image address and never a draft address", () => {
    const url = cms.publicImageUrl("https://example.supabase.co/", imagePath);
    assert.equal(url.includes("/storage/v1/object/public/gallery-images/"), true);
    assert.equal(url.includes("gallery-draft-images"), false);
    assert.equal(url.includes("member-images"), false);
    assert.equal(url.endsWith(imagePath), true);
    assert.equal(cms.publicImageUrl("https://example.supabase.co/gallery-draft-images", imagePath), null);
  });
});

describe("gallery CMS rendering", () => {
  it("applies the CMS image only after preload and keeps the card", async () => {
    const card = cardStub();
    const doc = galleryDocument(card);
    let requested = "";
    let headers = null;
    let srcDuringPreload = "";
    const result = await cms.startGalleryCms({
      document: doc,
      config,
      loadImage: async (url) => {
        srcDuringPreload = card.image.src;
        assert.equal(url.includes("/storage/v1/object/public/gallery-images/"), true);
        assert.equal(url.endsWith(imagePath), true);
      },
      fetchImpl: async (url, options) => {
        requested = url;
        headers = options.headers;
        return jsonResponse([row({ alt_text: " 公開写真 " })]);
      },
    });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "replaced");
    assert.equal(srcDuringPreload, staticSrc);
    assert.equal(card.image.src.endsWith(imagePath), true);
    assert.equal(card.image.alt, "公開写真");
    assert.equal(card.id, "mainGroupPhoto");
    assert.equal(card.hidden, false);
    assert.equal(card.className, "gallery-item main-group-photo");
    assert.equal(card.dataset.gallerySource, "cms");
    assert.equal(doc.section.id, "gallery");
    assert.equal(card.parentElement.classList.contains("gallery-cms-photo-hidden"), false);
    assert.equal(requested, "https://example.supabase.co/rest/v1/rpc/get_public_gallery_v1");
    assert.equal(requested.includes("gallery_items"), false);
    assert.equal(requested.includes("gallery_item_drafts"), false);
    assert.equal(requested.includes("gallery_item_published"), false);
    assert.equal(headers.apikey, config.supabasePublishableKey);
    assert.equal(headers.Authorization.includes("service_role"), false);
  });

  it("keeps the static card when the network fails", async () => {
    const card = cardStub();
    const result = await cms.startGalleryCms({
      document: galleryDocument(card),
      config,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "network");
    assert.equal(card.image.src, staticSrc);
    assert.equal(card.image.alt, staticAlt);
    assert.equal(card.hidden, false);
    assert.equal(card.dataset.gallerySource, "static");
  });

  it("keeps the static card when the request times out", async () => {
    const card = cardStub();
    const result = await cms.startGalleryCms({
      document: galleryDocument(card),
      config,
      timeoutMs: 20,
      fetchImpl: (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "timeout");
    assert.equal(card.image.src, staticSrc);
    assert.equal(card.dataset.gallerySource, "static");
  });

  it("keeps the static card for malformed JSON, an invalid path, or an image failure", async () => {
    const malformed = cardStub();
    const malformedResult = await cms.startGalleryCms({
      document: galleryDocument(malformed),
      config,
      fetchImpl: async () => jsonResponse(new SyntaxError("bad")),
    });
    assert.equal(malformedResult.applied, false);
    assert.equal(malformedResult.reason, "payload");
    assert.equal(malformed.image.src, staticSrc);

    const invalid = cardStub();
    const invalidResult = await cms.startGalleryCms({
      document: galleryDocument(invalid),
      config,
      fetchImpl: async () => jsonResponse([row({ image_path: "https://evil.example/a.webp" })]),
    });
    assert.equal(invalidResult.applied, false);
    assert.equal(invalidResult.reason, "item");
    assert.equal(invalid.image.src, staticSrc);

    const brokenImage = cardStub();
    let preloadCalled = false;
    const imageResult = await cms.startGalleryCms({
      document: galleryDocument(brokenImage),
      config,
      fetchImpl: async () => jsonResponse([row()]),
      loadImage: async () => {
        preloadCalled = true;
        throw new Error("image failed");
      },
    });
    assert.equal(preloadCalled, true);
    assert.equal(imageResult.applied, false);
    assert.equal(imageResult.reason, "image");
    assert.equal(brokenImage.image.src, staticSrc);
    assert.equal(brokenImage.image.alt, staticAlt);
  });

  it("keeps the static card when the RPC returns more than one row", async () => {
    const card = cardStub();
    let preloadCalled = false;
    const result = await cms.startGalleryCms({
      document: galleryDocument(card),
      config,
      fetchImpl: async () => jsonResponse([row(), row({ sort_order: 1 })]),
      loadImage: async () => {
        preloadCalled = true;
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "unsupported");
    assert.equal(preloadCalled, false);
    assert.equal(card.image.src, staticSrc);
    assert.equal(card.hidden, false);
  });

  it("hides only the photo entry for a valid empty result", async () => {
    const card = cardStub();
    const doc = galleryDocument(card);
    const result = await cms.startGalleryCms({
      document: doc,
      config,
      loadImage: async () => {
        throw new Error("should not preload");
      },
      fetchImpl: async () => jsonResponse([]),
    });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "empty");
    assert.equal(card.hidden, true);
    assert.equal(card.id, "mainGroupPhoto");
    assert.equal(card.image.src, staticSrc);
    assert.equal(doc.section.id, "gallery");
    assert.equal(card.parentElement.classList.contains("gallery-cms-photo-hidden"), true);
    assert.equal(card.dataset.gallerySource, "cms-empty");
  });

  it("does not fetch when the Gallery switch is off", async () => {
    let called = false;
    const card = cardStub();
    const result = await cms.startGalleryCms({
      document: galleryDocument(card),
      config: { ...config, galleryCmsEnabled: false, membersCmsEnabled: true },
      fetchImpl: async () => {
        called = true;
        return jsonResponse([]);
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "config");
    assert.equal(called, false);
    assert.equal(card.image.src, staticSrc);
    assert.equal(card.hidden, false);
  });

  it("still loads Gallery when the Members switch is off", async () => {
    let called = false;
    const card = cardStub();
    const result = await cms.startGalleryCms({
      document: galleryDocument(card),
      config,
      loadImage: async () => {},
      fetchImpl: async () => {
        called = true;
        return jsonResponse([row()]);
      },
    });
    assert.equal(called, true);
    assert.equal(result.applied, true);
    assert.equal(result.reason, "replaced");
  });
});

describe("static gallery fallback source", () => {
  it("keeps the static gallery card, image, and anchor in the page", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const source = readFileSync(new URL("./gallery-cms.js", import.meta.url), "utf8");
    const script = readFileSync(new URL("./script.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const nav = readFileSync(new URL("./visual-collection-nav.js", import.meta.url), "utf8");
    const galleryBlock = html.slice(html.indexOf('id="gallery"'), html.indexOf('id="members"'));
    assert.equal(existsSync(new URL("./Photo/idol_spirits.webp", import.meta.url)), true);
    assert.equal(galleryBlock.includes('id="gallery"'), true);
    assert.equal(galleryBlock.includes('id="mainGroupPhoto"'), true);
    assert.equal(galleryBlock.includes('data-gallery-source="static"'), true);
    assert.equal(galleryBlock.includes('src="Photo/idol_spirits.webp"'), true);
    assert.equal(galleryBlock.includes('alt="ArcanaCharmグループ写真"'), true);
    assert.equal(galleryBlock.includes('href="member-selection.html"'), false);
    assert.equal(html.includes("gallery-cms.js"), true);
    assert.equal(script.includes("window.location.href = 'member-selection.html'"), true);
    assert.equal(source.includes("innerHTML"), false);
    assert.equal(source.includes("get_public_gallery_v1"), true);
    assert.equal(source.includes("gallery_item_drafts"), false);
    assert.equal(source.includes("gallery_item_published"), false);
    assert.equal(source.includes("gallery_items"), false);
    assert.equal(source.includes("gallery-draft-images"), true);
    assert.equal(source.includes("service_role"), true);
    assert.equal(source.includes("sb_secret_"), true);
    assert.equal(source.includes("get_public_members_v1"), false);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(/sb_secret_[A-Za-z0-9]/.test(source), false);
    assert.equal(styles.includes(".gallery-grid.gallery-cms-photo-hidden::after"), true);
    assert.equal(styles.includes("✨ ＃あるあむビジュアルコレクションを見る ✨"), true);
    assert.equal(nav.includes('index.html#gallery'), true);
    const publicConfig = readFileSync(new URL("./members-public-config.js", import.meta.url), "utf8");
    assert.equal(publicConfig.includes("membersCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("galleryCmsEnabled: true"), true);
    assert.equal(publicConfig.toLowerCase().includes("service_role"), false);
    assert.equal(publicConfig.toLowerCase().includes("sb_secret_"), false);
    assert.equal(publicConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  });
});
