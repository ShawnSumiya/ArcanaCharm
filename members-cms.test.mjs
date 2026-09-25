import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const cms = require("./members-cms.js");

const imagePath =
  "members/6960f6db-fb88-4045-83e1-7e930e2d0603/9c8c72c3-0773-4fbf-9921-0b4c2d6da705.webp";
const config = {
  membersCmsEnabled: true,
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_example_key_value",
};

function member(overrides = {}) {
  return {
    name: "有ゆうな",
    profile: "23歳 AB型です。いっぱい喋ります。\r\n画像をクリックして有ゆうなのSNSを見に来てね♡",
    x_url: null,
    instagram_url: null,
    tiktok_url: null,
    other_url: "https://instabio.cc/ariyuuna",
    sort_order: 0,
    image_path: imagePath,
    image_focus_x: 50,
    image_focus_y: 50,
    ...overrides,
  };
}

function element(tag) {
  const node = {
    tag,
    className: "",
    children: [],
    attributes: {},
    style: {},
    nodeType: 1,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener() {},
  };
  let text = "";
  Object.defineProperty(node, "textContent", {
    get() {
      return text;
    },
    set(value) {
      text = String(value);
      node.children = [];
    },
  });
  return node;
}

function documentStub() {
  return {
    createElement: element,
    createTextNode(value) {
      return { nodeType: 3, tag: "#text", text: String(value), children: [] };
    },
  };
}

function textOf(node) {
  if (node.nodeType === 3) return node.text;
  if (node.children.length === 0) return node.textContent || "";
  return node.children.map(textOf).join("");
}

function tagsOf(node, found = []) {
  if (node.tag) found.push(node.tag);
  for (const child of node.children || []) tagsOf(child, found);
  return found;
}

function gridStub(doc) {
  return {
    ownerDocument: doc,
    dataset: { membersSource: "static" },
    nodes: [{ tag: "static-card" }],
    replaceChildren(...nodes) {
      this.nodes = nodes;
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

describe("public member validation", () => {
  it("accepts a published member and ignores unexpected fields", () => {
    const result = cms.validatePublicMembers([{ ...member(), published_by: "hidden" }]);
    assert.equal(result.ok, true);
    assert.equal(result.members[0].name, "有ゆうな");
    assert.equal(result.members[0].published_by, undefined);
    assert.equal(cms.splitProfile(result.members[0].profile).role, "23歳 AB型です。いっぱい喋ります。");
    assert.equal(
      cms.splitProfile(result.members[0].profile).description,
      "画像をクリックして有ゆうなのSNSを見に来てね♡",
    );
  });

  it("rejects unsafe URL protocols and accepts http and https", () => {
    assert.equal(cms.safeHttpUrl("https://instabio.cc/ariyuuna"), "https://instabio.cc/ariyuuna");
    assert.equal(cms.safeHttpUrl("http://example.com/a"), "http://example.com/a");
    assert.equal(cms.safeHttpUrl(null), null);
    for (const value of ["javascript:alert(1)", "data:text/html,hi", "file:///tmp/a", "ftp://example.com"]) {
      assert.equal(cms.safeHttpUrl(value), undefined, value);
      assert.equal(cms.validatePublicMembers([member({ other_url: value })]).ok, false, value);
    }
  });

  it("rejects an invalid required field and a non-array payload", () => {
    assert.equal(cms.validatePublicMembers({ members: [] }).ok, false);
    assert.equal(cms.validatePublicMembers([member({ name: "  " })]).ok, false);
    assert.equal(cms.validatePublicMembers([member({ sort_order: 1.5 })]).ok, false);
    assert.equal(cms.validatePublicMembers([member({ image_focus_x: 120 })]).ok, false);
    assert.equal(cms.validatePublicMembers([member({ image_path: "member-draft-images/a.webp" })]).ok, false);
  });

  it("accepts an empty array as a valid CMS result", () => {
    const result = cms.validatePublicMembers([]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.members, []);
  });

  it("builds a published image address and never a draft address", () => {
    const url = cms.publicImageUrl("https://example.supabase.co/", imagePath);
    assert.equal(url.includes("/storage/v1/object/public/member-images/"), true);
    assert.equal(url.includes("member-draft-images"), false);
    assert.equal(url.endsWith(imagePath), true);
  });
});

describe("members CMS rendering", () => {
  it("renders CMS text without creating an HTML script", () => {
    const validated = cms.validatePublicMembers([
      member({
        name: "<script>alert(1)</script>",
        profile: "<script>alert(1)</script>\n<img src=x onerror=alert(1)>",
      }),
    ]);
    const doc = documentStub();
    const card = cms.createMemberCard(doc, validated.members[0], "https://example.supabase.co/photo.webp");
    const rendered = textOf(card);
    assert.equal(rendered.includes("<script>alert(1)</script>"), true);
    assert.equal(tagsOf(card).includes("script"), false);
    assert.equal(tagsOf(card).includes("img"), true);
    const image = card.children[0].children[0].children[0];
    assert.equal(image.attributes.alt || image.alt, "<script>alert(1)</script>");
    assert.equal(image.style.objectPosition, "50% 50%");
  });

  it("replaces the grid only after a valid payload and prepared images", async () => {
    const doc = documentStub();
    const grid = gridStub(doc);
    let requested = "";
    const result = await cms.startMembersCms({
      document: { querySelector: () => grid },
      config,
      loadImage: async () => {},
      fetchImpl: async (url) => {
        requested = url;
        return jsonResponse([
          member(),
          member({ name: "華本かな", sort_order: 1, other_url: "https://linkbio.co/kana" }),
          member({ name: "やや", sort_order: 2, other_url: "https://linkbio.co/yaya" }),
          member({ name: "宇野木ゆか", sort_order: 3, other_url: "https://linkbio.co/yuka" }),
        ]);
      },
    });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "replaced");
    assert.equal(grid.nodes.length, 4);
    assert.equal(grid.dataset.membersSource, "cms");
    assert.equal(textOf(grid.nodes[0]).includes("有ゆうな"), true);
    assert.equal(textOf(grid.nodes[1]).includes("華本かな"), true);
    assert.equal(requested, "https://example.supabase.co/rest/v1/rpc/get_public_members_v1");
    assert.equal(requested.includes("member_drafts"), false);
    assert.equal(requested.includes("member-draft-images"), false);
  });

  it("keeps the static grid when the network fails", async () => {
    const grid = gridStub(documentStub());
    const result = await cms.startMembersCms({
      document: { querySelector: () => grid },
      config,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "network");
    assert.equal(grid.dataset.membersSource, "static");
    assert.equal(grid.nodes[0].tag, "static-card");
  });

  it("keeps the static grid when the request times out", async () => {
    const grid = gridStub(documentStub());
    const result = await cms.startMembersCms({
      document: { querySelector: () => grid },
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
    assert.equal(grid.dataset.membersSource, "static");
  });

  it("keeps the static grid for malformed JSON or an invalid member", async () => {
    const malformed = gridStub(documentStub());
    const malformedResult = await cms.startMembersCms({
      document: { querySelector: () => malformed },
      config,
      fetchImpl: async () => jsonResponse(new SyntaxError("bad")),
    });
    assert.equal(malformedResult.applied, false);
    assert.equal(malformed.dataset.membersSource, "static");

    const invalid = gridStub(documentStub());
    const invalidResult = await cms.startMembersCms({
      document: { querySelector: () => invalid },
      config,
      fetchImpl: async () => jsonResponse([member({ name: "" })]),
    });
    assert.equal(invalidResult.applied, false);
    assert.equal(invalidResult.reason, "member");
    assert.equal(invalid.dataset.membersSource, "static");
  });

  it("keeps the static grid when a public image fails", async () => {
    const grid = gridStub(documentStub());
    const result = await cms.startMembersCms({
      document: { querySelector: () => grid },
      config,
      fetchImpl: async () => jsonResponse([member()]),
      loadImage: async () => {
        throw new Error("image failed");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "image");
    assert.equal(grid.dataset.membersSource, "static");
  });

  it("replaces the static cards with a valid empty CMS result", async () => {
    const grid = gridStub(documentStub());
    const result = await cms.startMembersCms({
      document: { querySelector: () => grid },
      config,
      fetchImpl: async () => jsonResponse([]),
    });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "empty");
    assert.equal(grid.nodes.length, 0);
    assert.equal(grid.dataset.membersSource, "cms");
  });

  it("does not fetch when the CMS switch is off", async () => {
    let called = false;
    const result = await cms.startMembersCms({
      config: { ...config, membersCmsEnabled: false },
      fetchImpl: async () => {
        called = true;
        return jsonResponse([]);
      },
    });
    assert.equal(result.applied, false);
    assert.equal(called, false);
  });
});

describe("static fallback source", () => {
  it("keeps the current members markup in the page", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const source = readFileSync(new URL("./members-cms.js", import.meta.url), "utf8");
    assert.equal(html.includes('data-members-source="static"'), true);
    assert.equal(html.includes("members-cms.js"), true);
    for (const name of ["有ゆうな", "華本かな", "やや", "宇野木ゆか"]) {
      assert.equal(html.includes(name), true, name);
    }
    assert.equal(source.includes("innerHTML"), false);
    assert.equal(source.includes("member_drafts"), false);
    assert.equal(source.includes("member-draft-images"), true);
    const publicConfig = readFileSync(new URL("./members-public-config.js", import.meta.url), "utf8");
    assert.equal(publicConfig.includes("membersCmsEnabled: true"), true);
    assert.equal(publicConfig.toLowerCase().includes("service_role"), false);
    assert.equal(publicConfig.toLowerCase().includes("sb_secret_"), false);
    assert.equal(publicConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  });
});
