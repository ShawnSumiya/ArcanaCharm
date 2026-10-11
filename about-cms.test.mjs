import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const cms = require("./about-cms.js");

const imagePath = "about/9c333187b78a574ea131dc0798f47a495b402b7948a41282c374aaf19c1de2ed.webp";
const otherImagePath =
  "about/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpeg";
const uuidImagePath = "about/11111111-1111-4111-8111-111111111111.png";
const staticSrc = "Photo/about.webp";
const staticAlt = "水玉衣装フライヤー";
const staticParagraphs = [
  "アルカナチャーム（通称あるあむ）は、2025年2月にデビューしたセルフプロデュースグループです。",
  "「理想を現実に」を目指しジャンルにとらわれない幅広い楽曲や活動が魅力。都内を中心に4人で活動しています。",
  "応援よろしくお願いいたします。",
];
const publishedBody = staticParagraphs.join("\n\n");
const config = {
  membersCmsEnabled: true,
  galleryCmsEnabled: true,
  aboutCmsEnabled: true,
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_example_key_value",
};

function row(overrides = {}) {
  return {
    body: publishedBody,
    image_path: imagePath,
    image_alt: staticAlt,
    ...overrides,
  };
}

function paragraphText(node) {
  if (!node.children) return node.textContent || "";
  return node.children
    .map((child) => {
      if (child.type === "text") return child.value;
      if (child.tag === "br") return "\n";
      return "";
    })
    .join("");
}

function aboutDocument() {
  const image = { src: staticSrc, alt: staticAlt };
  const text = {
    className: "about-text",
    children: staticParagraphs.map((textContent) => ({ textContent })),
    replaceChildren(...nodes) {
      this.children = nodes;
    },
  };
  const imageWrap = {
    className: "about-image",
    image,
  };
  const heading = { textContent: "About ArcanaCharm" };
  const content = {
    className: "about-content",
    dataset: {},
    text,
    imageWrap,
    querySelector(selector) {
      if (selector === ".about-text") return text;
      if (selector === ".about-image img") return image;
      if (selector === "h2") return heading;
      return null;
    },
  };
  const section = {
    id: "about",
    hidden: false,
    content,
    querySelector(selector) {
      if (selector === ".about-content") return content;
      return null;
    },
  };
  const doc = {
    section,
    content,
    text,
    image,
    heading,
    createElement(tag) {
      return {
        tag,
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
      };
    },
    createTextNode(value) {
      return { type: "text", value };
    },
    getElementById(id) {
      return id === "about" ? section : null;
    },
  };
  text.ownerDocument = doc;
  return doc;
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

function textsOf(doc) {
  return doc.text.children.map(paragraphText);
}

describe("public about validation", () => {
  it("accepts one published row and ignores unexpected fields", () => {
    const result = cms.validatePublicAbout([{ ...row(), published_by: "hidden" }]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.about.paragraphs, staticParagraphs);
    assert.equal(result.about.imagePath, imagePath);
    assert.equal(result.about.alt, staticAlt);
    assert.equal(result.about.published_by, undefined);
  });

  it("accepts another hash and a uuid object name without pinning one hash", () => {
    assert.equal(cms.validatePublicAbout([row({ image_path: otherImagePath })]).ok, true);
    assert.equal(cms.validatePublicAbout([row({ image_path: uuidImagePath })]).ok, true);
  });

  it("accepts zero rows as a valid no-content result", () => {
    const result = cms.validatePublicAbout([]);
    assert.equal(result.ok, true);
    assert.equal(result.about, null);
  });

  it("rejects more than one row and malformed payloads", () => {
    assert.equal(cms.validatePublicAbout([row(), row()]).ok, false);
    assert.equal(cms.validatePublicAbout([row(), row()]).reason, "unsupported");
    assert.equal(cms.validatePublicAbout({ body: publishedBody }).ok, false);
    assert.equal(cms.validatePublicAbout([null]).ok, false);
  });

  it("rejects a blank body and a body longer than 2000 characters", () => {
    assert.equal(cms.parseBody("   "), undefined);
    assert.equal(cms.parseBody("\n\n"), undefined);
    assert.equal(cms.parseBody(""), undefined);
    assert.equal(cms.validatePublicAbout([row({ body: "  \n\n  " })]).reason, "body");
    assert.equal(cms.validatePublicAbout([row({ body: "a".repeat(2001) })]).reason, "body");
    assert.equal(cms.validatePublicAbout([row({ body: "a".repeat(2000) })]).ok, true);
  });

  it("parses blank lines as paragraphs and normalizes CRLF", () => {
    const parsed = cms.parseBody("一行目\r\n\r\n二行目\r\n続き\r\n\r\n三行目");
    assert.deepEqual(parsed, ["一行目", "二行目\n続き", "三行目"]);
    assert.deepEqual(cms.parseBody("a\n\n\n\nb"), ["a", "b"]);
    assert.deepEqual(cms.parseBody("  a  \n\n  b  "), ["a", "b"]);
  });

  it("validates image alt length and rejects blank alt", () => {
    assert.equal(cms.parseAlt("  水玉衣装フライヤー  "), "水玉衣装フライヤー");
    assert.equal(cms.parseAlt("   "), undefined);
    assert.equal(cms.parseAlt("a".repeat(201)), undefined);
    assert.equal(cms.parseAlt("a".repeat(200)), "a".repeat(200));
    assert.equal(cms.validatePublicAbout([row({ image_alt: 12 })]).reason, "alt");
  });

  it("rejects draft, unsafe, and malformed image paths", () => {
    const rejected = [
      "about/../secret.webp",
      "https://evil.example/about/a.webp",
      "//evil.example/a.webp",
      `${imagePath}?x=1`,
      `${imagePath}#frag`,
      "about-draft-images/about/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      "draft/about/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      "about/not-a-hash.webp",
      "about/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.gif",
      "Photo/about.webp",
      "/about/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
    ];
    for (const value of rejected) {
      assert.equal(cms.parseImagePath(value), undefined, value);
      assert.equal(cms.validatePublicAbout([row({ image_path: value })]).ok, false, value);
    }
  });

  it("builds a public about image address and never a draft address", () => {
    const url = cms.publicImageUrl("https://example.supabase.co/", imagePath);
    assert.equal(url.includes("/storage/v1/object/public/about-images/"), true);
    assert.equal(url.includes("about-draft-images"), false);
    assert.equal(url.includes("gallery-images"), false);
    assert.equal(url.includes("member-images"), false);
    assert.equal(url.endsWith(imagePath), true);
    assert.equal(url.includes("token="), false);
    assert.equal(cms.publicImageUrl("https://example.supabase.co/about-draft-images", imagePath), null);
  });
});

describe("about CMS rendering", () => {
  it("preloads the image before replacing body, image, and alt", async () => {
    const doc = aboutDocument();
    const before = doc.text.children;
    let requested = "";
    let headers = null;
    const result = await cms.startAboutCms({
      document: doc,
      config,
      loadImage: async (url) => {
        assert.equal(doc.text.children, before);
        assert.deepEqual(textsOf(doc), staticParagraphs);
        assert.equal(doc.image.src, staticSrc);
        assert.equal(doc.image.alt, staticAlt);
        assert.equal(url.includes("/storage/v1/object/public/about-images/"), true);
        assert.equal(url.endsWith(imagePath), true);
      },
      fetchImpl: async (url, options) => {
        requested = url;
        headers = options.headers;
        return jsonResponse([row({ image_alt: " 水玉衣装フライヤー " })]);
      },
    });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "replaced");
    assert.equal(doc.text.children.length, 3);
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.text.children.every((node) => node.tag === "p"), true);
    assert.equal(doc.image.src.endsWith(imagePath), true);
    assert.equal(doc.image.alt, staticAlt);
    assert.equal(doc.section.id, "about");
    assert.equal(doc.section.hidden, false);
    assert.equal(doc.content.className, "about-content");
    assert.equal(doc.heading.textContent, "About ArcanaCharm");
    assert.equal(doc.content.dataset.aboutSource, "cms");
    assert.equal(requested, "https://example.supabase.co/rest/v1/rpc/get_public_about_v1");
    assert.equal(requested.includes("about_draft"), false);
    assert.equal(requested.includes("about_published"), false);
    assert.equal(requested.includes("about-draft-images"), false);
    assert.equal(headers.apikey, config.supabasePublishableKey);
    assert.equal(headers.Authorization.includes("service_role"), false);
    assert.equal(headers.Authorization.includes("sb_secret_"), false);
  });

  it("renders a single newline inside a paragraph as a break between text nodes", async () => {
    const doc = aboutDocument();
    const result = await cms.startAboutCms({
      document: doc,
      config,
      loadImage: async () => {},
      fetchImpl: async () => jsonResponse([row({ body: "一行目\n二行目\n\n次の段落" })]),
    });
    assert.equal(result.applied, true);
    assert.equal(doc.text.children.length, 2);
    assert.deepEqual(
      doc.text.children[0].children.map((child) => child.tag || child.value),
      ["一行目", "br", "二行目"],
    );
    assert.equal(paragraphText(doc.text.children[1]), "次の段落");
  });

  it("renders markup in the body and alt as text", async () => {
    const doc = aboutDocument();
    const scriptBody = "<script>alert(1)</script>\n\n<img onerror=\"alert(1)\">";
    const alt = "<img onerror=alert(1)>";
    const result = await cms.startAboutCms({
      document: doc,
      config,
      loadImage: async () => {},
      fetchImpl: async () => jsonResponse([row({ body: scriptBody, image_alt: alt })]),
    });
    assert.equal(result.applied, true);
    assert.equal(paragraphText(doc.text.children[0]), "<script>alert(1)</script>");
    assert.equal(paragraphText(doc.text.children[1]), "<img onerror=\"alert(1)\">");
    assert.equal(doc.text.children[0].children[0].type, "text");
    assert.equal(doc.image.alt, alt);
    assert.equal(doc.image.onerror, undefined);
  });

  it("keeps the static about section when the network fails", async () => {
    const doc = aboutDocument();
    const result = await cms.startAboutCms({
      document: doc,
      config,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "network");
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
    assert.equal(doc.image.alt, staticAlt);
    assert.equal(doc.section.hidden, false);
    assert.equal(doc.content.dataset.aboutSource, undefined);
  });

  it("keeps the static about section when the request times out", async () => {
    const doc = aboutDocument();
    const result = await cms.startAboutCms({
      document: doc,
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
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
  });

  it("keeps the static about section for malformed JSON, a non-2xx response, and an invalid path", async () => {
    const malformed = aboutDocument();
    const malformedResult = await cms.startAboutCms({
      document: malformed,
      config,
      fetchImpl: async () => jsonResponse(new SyntaxError("bad")),
    });
    assert.equal(malformedResult.applied, false);
    assert.equal(malformedResult.reason, "payload");
    assert.deepEqual(textsOf(malformed), staticParagraphs);
    assert.equal(malformed.image.src, staticSrc);

    const httpError = aboutDocument();
    const httpResult = await cms.startAboutCms({
      document: httpError,
      config,
      fetchImpl: async () => jsonResponse([], false),
    });
    assert.equal(httpResult.applied, false);
    assert.equal(httpResult.reason, "http");
    assert.equal(httpError.image.src, staticSrc);

    const invalid = aboutDocument();
    const invalidResult = await cms.startAboutCms({
      document: invalid,
      config,
      fetchImpl: async () => jsonResponse([row({ image_path: "https://evil.example/a.webp" })]),
    });
    assert.equal(invalidResult.applied, false);
    assert.equal(invalidResult.reason, "image");
    assert.deepEqual(textsOf(invalid), staticParagraphs);
    assert.equal(invalid.image.src, staticSrc);
  });

  it("keeps the static about section for an empty result and does not hide it", async () => {
    const doc = aboutDocument();
    let preloadCalled = false;
    const result = await cms.startAboutCms({
      document: doc,
      config,
      loadImage: async () => {
        preloadCalled = true;
      },
      fetchImpl: async () => jsonResponse([]),
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "empty");
    assert.equal(preloadCalled, false);
    assert.equal(doc.section.hidden, false);
    assert.equal(doc.section.id, "about");
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
    assert.equal(doc.image.alt, staticAlt);
    assert.equal(doc.heading.textContent, "About ArcanaCharm");
    assert.equal(doc.content.className, "about-content");
  });

  it("keeps the static about section when the RPC returns more than one row", async () => {
    const doc = aboutDocument();
    let preloadCalled = false;
    const result = await cms.startAboutCms({
      document: doc,
      config,
      fetchImpl: async () => jsonResponse([row(), row()]),
      loadImage: async () => {
        preloadCalled = true;
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "unsupported");
    assert.equal(preloadCalled, false);
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
    assert.equal(doc.section.hidden, false);
  });

  it("keeps the static about section when image preload fails", async () => {
    const doc = aboutDocument();
    let preloadCalled = false;
    const result = await cms.startAboutCms({
      document: doc,
      config,
      fetchImpl: async () => jsonResponse([row()]),
      loadImage: async () => {
        preloadCalled = true;
        throw new Error("image failed");
      },
    });
    assert.equal(preloadCalled, true);
    assert.equal(result.applied, false);
    assert.equal(result.reason, "image");
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
    assert.equal(doc.image.alt, staticAlt);
    assert.equal(doc.content.className, "about-content");
  });

  it("does not fetch when the About switch is off", async () => {
    let called = false;
    const doc = aboutDocument();
    const result = await cms.startAboutCms({
      document: doc,
      config: { ...config, aboutCmsEnabled: false, membersCmsEnabled: true, galleryCmsEnabled: true },
      fetchImpl: async () => {
        called = true;
        return jsonResponse([]);
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "config");
    assert.equal(called, false);
    assert.deepEqual(textsOf(doc), staticParagraphs);
    assert.equal(doc.image.src, staticSrc);
  });

  it("still loads About when the Members and Gallery switches are off", async () => {
    let called = false;
    const doc = aboutDocument();
    const result = await cms.startAboutCms({
      document: doc,
      config: { ...config, membersCmsEnabled: false, galleryCmsEnabled: false },
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

  it("rejects a service role key and does not fetch", async () => {
    let called = false;
    const result = await cms.startAboutCms({
      document: aboutDocument(),
      config: { ...config, supabasePublishableKey: "sb_secret_not_a_browser_key" },
      fetchImpl: async () => {
        called = true;
        return jsonResponse([row()]);
      },
    });
    assert.equal(called, false);
    assert.equal(result.applied, false);
    assert.equal(cms.publicConfigIsSafe({ ...config, supabasePublishableKey: "service_role_key_value_here" }), false);
  });
});

describe("static about fallback source", () => {
  it("keeps the static about copy, image, anchor, and heading in the page", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const source = readFileSync(new URL("./about-cms.js", import.meta.url), "utf8");
    const script = readFileSync(new URL("./script.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const aboutBlock = html.slice(html.indexOf('id="about"'), html.indexOf('id="schedule"'));
    assert.equal(existsSync(new URL("./Photo/about.webp", import.meta.url)), true);
    assert.equal(aboutBlock.includes('id="about"'), true);
    assert.equal(aboutBlock.includes("About ArcanaCharm"), true);
    assert.equal(aboutBlock.includes('class="about-content"'), true);
    assert.equal(aboutBlock.includes('class="about-text"'), true);
    assert.equal(aboutBlock.includes('class="about-image"'), true);
    assert.equal(aboutBlock.includes('src="Photo/about.webp"'), true);
    assert.equal(aboutBlock.includes('alt="水玉衣装フライヤー"'), true);
    for (const paragraph of staticParagraphs) {
      assert.equal(aboutBlock.includes(paragraph), true, paragraph);
    }
    assert.equal(html.includes("about-cms.js"), true);
    assert.equal(script.includes(".about-content"), true);
    assert.equal(styles.includes(".about-text p"), true);
    assert.equal(styles.includes(".about-image img"), true);
    assert.equal(source.includes("innerHTML"), false);
    assert.equal(source.includes("outerHTML"), false);
    assert.equal(source.includes("insertAdjacentHTML"), false);
    assert.equal(source.includes("get_public_about_v1"), true);
    assert.equal(source.includes("about_draft"), false);
    assert.equal(source.includes("about_published"), false);
    assert.equal(source.includes("about-draft-images"), true);
    assert.equal(source.includes("service_role"), true);
    assert.equal(source.includes("sb_secret_"), true);
    assert.equal(source.includes("get_public_members_v1"), false);
    assert.equal(source.includes("get_public_gallery_v1"), false);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(/sb_secret_[A-Za-z0-9]/.test(source), false);
    const publicConfig = readFileSync(new URL("./members-public-config.js", import.meta.url), "utf8");
    assert.equal(publicConfig.includes("membersCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("galleryCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("aboutCmsEnabled: true"), true);
    assert.equal(publicConfig.toLowerCase().includes("service_role"), false);
    assert.equal(publicConfig.toLowerCase().includes("sb_secret_"), false);
    assert.equal(publicConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  });
});
