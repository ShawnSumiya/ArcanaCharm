import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const cms = require("./goods-cms.js");

const paths = [
  "goods/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
  "goods/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg",
  "goods/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.png",
];
const livePaths = [
  "goods/2e799adacc35abb4b8a3fa92b8b550bd6066947b9e4a6db71f470ae924ef0c29.webp",
  "goods/2bca5b29f0f4d5eb665b24a1b2ca35f74ed65c63cb06cd26e5c7f5a4a7270f22.webp",
  "goods/13883407e30e90c4e4eba245fdcaa435dc40d503ab32cea9aab45eec54b95690.webp",
];
const otherPath = "goods/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.jpeg";
const urls = [
  "https://arcanacharm.base.shop/items/110801805",
  "https://arcanacharm.base.shop/items/110801727",
  "https://arcanacharm.base.shop/items/118218771",
];
const titles = [
  "有ゆうな生誕祭衣装アクリルスタンド",
  "華本かな生誕衣装アクリルスタンド",
  "宇野木ゆか生誕祭衣装アクリルスタンド",
];
const descriptions = [
  "2025年有ゆうな生誕祭で販売されたアクリルスタンドです。 本体サイズ:75×100（mm）",
  "2025年華本かな生誕祭で販売されたアクリルスタンドです。 本体サイズ:75×100（mm）",
  "『宇野木ゆか生誕祭2025』記念グッズのアクリルスタンドです！",
];
const staticCards = [
  {
    slot: "1",
    href: urls[0],
    src: "Photo/yuuna_acrylic_stand.webp",
    alt: "有ゆうなアクリルスタンド",
    title: titles[0],
    price: "¥1,500",
    description: "2025年有ゆうな生誕祭で販売されたアクリルスタンドです。\n                                    本体サイズ:75×100（mm）",
  },
  {
    slot: "2",
    href: urls[1],
    src: "Photo/hanamoto_acrylic_stand.webp",
    alt: "華本かなアクリルスタンド",
    title: titles[1],
    price: "¥1,500",
    description: "2025年華本かな生誕祭で販売されたアクリルスタンドです。\n                                    本体サイズ:75×100（mm）",
  },
  {
    slot: "3",
    href: urls[2],
    src: "Photo/unoki_acrylic_stand.webp",
    alt: "宇野木ゆかアクリルスタンド",
    title: titles[2],
    price: "¥1,500",
    description: "『宇野木ゆか生誕祭2025』記念グッズのアクリルスタンドです！",
  },
];
const config = {
  membersCmsEnabled: true,
  galleryCmsEnabled: true,
  aboutCmsEnabled: true,
  goodsCmsEnabled: true,
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "sb_publishable_example_key_value",
};

function row(slot, overrides = {}) {
  return {
    slot,
    product_url: urls[slot - 1],
    title: titles[slot - 1],
    price_amount: 1500,
    currency: "JPY",
    description: descriptions[slot - 1],
    image_path: paths[slot - 1],
    ...overrides,
  };
}

function trio(order = [1, 2, 3], overridesBySlot = {}) {
  return order.map((slot) => row(slot, overridesBySlot[slot] || {}));
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

function goodsDocument() {
  const cards = staticCards.map((item) => {
    const image = { src: item.src, alt: item.alt };
    const title = { textContent: item.title };
    const price = { textContent: item.price };
    const description = { textContent: item.description };
    const indicator = { textContent: "商品を見る" };
    const card = {
      href: item.href,
      target: "_blank",
      rel: "",
      className: "item-card-link",
      dataset: {},
      getAttribute(name) {
        return name === "data-goods-slot" ? item.slot : null;
      },
      querySelector(selector) {
        if (selector === "img") return image;
        if (selector === "h4") return title;
        if (selector === ".item-price") return price;
        if (selector === ".item-description") return description;
        if (selector === ".item-link-indicator") return indicator;
        return null;
      },
      image,
      title,
      price,
      description,
      indicator,
    };
    return card;
  });
  const banner = { href: "https://arcanacharm.base.shop/items/all", text: "今すぐショップを見る" };
  const cta = { href: "https://arcanacharm.base.shop/items/all", text: "公式ショップへ" };
  const heading = { textContent: "人気商品" };
  const official = { textContent: "Official Goods" };
  const section = {
    id: "shop",
    hidden: false,
    className: "shop",
    dataset: {},
    banner,
    cta,
    heading,
    official,
    querySelectorAll(selector) {
      return selector === "[data-goods-slot]" ? cards : [];
    },
    querySelector(selector) {
      if (selector === ".shop-banner a") return banner;
      if (selector === ".shop-button") return cta;
      if (selector === ".featured-items h3") return heading;
      if (selector === "h2") return official;
      return null;
    },
  };
  const doc = {
    section,
    cards,
    getElementById(id) {
      return id === "shop" ? section : null;
    },
  };
  return doc;
}

function snapshot(doc) {
  return doc.cards.map((card) => ({
    href: card.href,
    target: card.target,
    rel: card.rel,
    className: card.className,
    src: card.image.src,
    alt: card.image.alt,
    title: card.title.textContent,
    price: card.price.textContent,
    description: card.description.textContent,
    indicator: card.indicator.textContent,
  }));
}

function assertStatic(doc, before) {
  assert.deepEqual(snapshot(doc), before);
  assert.equal(doc.section.hidden, false);
  assert.equal(doc.section.id, "shop");
  assert.equal(doc.section.className, "shop");
  assert.equal(doc.section.dataset.goodsSource, undefined);
  assert.equal(doc.section.banner.href, "https://arcanacharm.base.shop/items/all");
  assert.equal(doc.section.banner.text, "今すぐショップを見る");
  assert.equal(doc.section.cta.href, "https://arcanacharm.base.shop/items/all");
  assert.equal(doc.section.cta.text, "公式ショップへ");
  assert.equal(doc.section.heading.textContent, "人気商品");
  assert.equal(doc.section.official.textContent, "Official Goods");
}

async function startWith(doc, payload, extra = {}) {
  const calls = [];
  const images = [];
  const result = await cms.startGoodsCms({
    document: doc,
    config: extra.config || config,
    timeoutMs: extra.timeoutMs,
    loadImage: extra.loadImage || (async (url) => {
      images.push(url);
    }),
    fetchImpl: extra.fetchImpl || (async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(payload, extra.ok !== false);
    }),
  });
  return { result, calls, images };
}

describe("public goods validation", () => {
  it("accepts exactly three valid rows and ignores unexpected fields", () => {
    const result = cms.validatePublicGoods(trio().map((item) => ({ ...item, source_item_id: "hidden" })));
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((item) => item.slot), [1, 2, 3]);
    assert.equal(result.items[0].title, titles[0]);
    assert.equal(result.items[0].priceText, "¥1,500");
    assert.equal(result.items[0].productUrl, urls[0]);
    assert.equal(result.items[0].source_item_id, undefined);
  });

  it("sorts rows returned out of slot order", () => {
    const result = cms.validatePublicGoods(trio([3, 1, 2]));
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((item) => item.slot), [1, 2, 3]);
    assert.deepEqual(result.items.map((item) => item.title), titles);
    assert.deepEqual(result.items.map((item) => item.imagePath), paths);
  });

  it("accepts the current published paths and a different future hash", () => {
    for (const imagePath of livePaths) {
      assert.equal(cms.parseImagePath(imagePath), imagePath);
    }
    assert.equal(cms.parseImagePath(otherPath), otherPath);
    assert.equal(cms.validatePublicGoods(trio([1, 2, 3], {
      1: { image_path: livePaths[0] },
      2: { image_path: livePaths[1] },
      3: { image_path: otherPath },
    })).ok, true);
  });

  it("keeps an empty result as unavailable goods without treating it as a payload error", () => {
    const result = cms.validatePublicGoods([]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.items, []);
  });

  it("rejects one row, two rows, and more than three rows", () => {
    assert.equal(cms.validatePublicGoods(trio([1])).reason, "incomplete");
    assert.equal(cms.validatePublicGoods(trio([1, 2])).reason, "incomplete");
    assert.equal(cms.validatePublicGoods(trio([1, 2, 3, 1])).reason, "extra");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3), row(1)]).ok, false);
  });

  it("rejects duplicate, missing, zero, high, and string slots", () => {
    assert.equal(cms.parseSlot(1), 1);
    assert.equal(cms.parseSlot(0), undefined);
    assert.equal(cms.parseSlot(4), undefined);
    assert.equal(cms.parseSlot("1"), undefined);
    assert.equal(cms.parseSlot(1.5), undefined);
    assert.equal(cms.validatePublicGoods(trio([1, 1, 2])).reason, "slot");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(2)]).reason, "slot");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(4)]).reason, "slot");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { slot: "3" })]).reason, "slot");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { slot: 0 })]).reason, "slot");
  });

  it("rejects malformed payloads", () => {
    assert.equal(cms.validatePublicGoods({ slot: 1 }).reason, "payload");
    assert.equal(cms.validatePublicGoods(null).reason, "payload");
    assert.equal(cms.validatePublicGoods([row(1), null, row(3)]).reason, "payload");
  });
});

describe("goods product fields", () => {
  it("accepts a trimmed title and rejects a blank or oversized title", () => {
    assert.equal(cms.parseTitle("  有ゆうな生誕祭衣装アクリルスタンド  "), titles[0]);
    assert.equal(cms.parseTitle("   "), undefined);
    assert.equal(cms.parseTitle(""), undefined);
    assert.equal(cms.parseTitle("a".repeat(200)), "a".repeat(200));
    assert.equal(cms.parseTitle("a".repeat(201)), undefined);
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { title: "  " })]).reason, "title");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { title: "a".repeat(201) })]).reason, "title");
  });

  it("accepts a non-negative integer price and rejects other amounts", () => {
    assert.equal(cms.parsePriceAmount(0), 0);
    assert.equal(cms.parsePriceAmount(1500), 1500);
    assert.equal(cms.parsePriceAmount(6500), 6500);
    assert.equal(cms.parsePriceAmount(-1), undefined);
    assert.equal(cms.parsePriceAmount(15.5), undefined);
    assert.equal(cms.parsePriceAmount("1500"), undefined);
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { price_amount: -1 })]).reason, "price");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { price_amount: 1.5 })]).reason, "price");
  });

  it("accepts only JPY", () => {
    assert.equal(cms.parseCurrency("JPY"), "JPY");
    assert.equal(cms.parseCurrency("jpy"), undefined);
    assert.equal(cms.parseCurrency("USD"), undefined);
    assert.equal(cms.parseCurrency("JPY "), undefined);
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { currency: "USD" })]).reason, "currency");
  });

  it("accepts a trimmed description and rejects a blank or oversized description", () => {
    assert.equal(cms.parseDescription(`  ${descriptions[2]}  `), descriptions[2]);
    assert.equal(cms.parseDescription("   "), undefined);
    assert.equal(cms.parseDescription(""), undefined);
    assert.equal(cms.parseDescription("a".repeat(2000)), "a".repeat(2000));
    assert.equal(cms.parseDescription("a".repeat(2001)), undefined);
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { description: " \n " })]).reason, "description");
    assert.equal(cms.validatePublicGoods([row(1), row(2), row(3, { description: "a".repeat(2001) })]).reason, "description");
  });

  it("formats yen without locale-dependent grouping", () => {
    assert.equal(cms.formatJpy(0), "¥0");
    assert.equal(cms.formatJpy(1500), "¥1,500");
    assert.equal(cms.formatJpy(6500), "¥6,500");
    assert.equal(cms.formatJpy(1000000), "¥1,000,000");
  });
});

describe("goods product urls", () => {
  it("accepts an https BASE item url", () => {
    assert.equal(cms.parseProductUrl("https://arcanacharm.base.shop/items/110801805"), urls[0]);
  });

  it("rejects unsafe or off-shop product urls without fetching them", () => {
    const rejected = [
      "http://arcanacharm.base.shop/items/110801805",
      "https://example.com/items/110801805",
      "https://example.base.shop/items/110801805",
      "https://arcanacharm.thebase.in/items/110801805",
      "https://arcanacharm.base.shop/items/all",
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://user:pass@arcanacharm.base.shop/items/110801805",
      "https://arcanacharm.base.shop:444/items/110801805",
      "https://arcanacharm.base.shop/items/110801805?x=1",
      "https://arcanacharm.base.shop/items/110801805#photo",
    ];
    for (const value of rejected) {
      assert.equal(cms.parseProductUrl(value), undefined, value);
      assert.equal(cms.validatePublicGoods([row(1, { product_url: value }), row(2), row(3)]).ok, false, value);
    }
  });
});

describe("goods image paths", () => {
  it("accepts a safe published goods path", () => {
    assert.equal(cms.parseImagePath(paths[0]), paths[0]);
    assert.equal(cms.parseImagePath(paths[1]), paths[1]);
    assert.equal(cms.parseImagePath(paths[2]), paths[2]);
    assert.equal(cms.parseImagePath(otherPath), otherPath);
  });

  it("rejects absolute, parent, draft, query, and unsupported image paths", () => {
    const rejected = [
      "https://evil.example/goods/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      "goods/../secret.webp",
      "goods/1/11111111-1111-4111-8111-111111111111.webp",
      "goods/2/restore-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      `${paths[0]}?x=1`,
      `${paths[0]}#frag`,
      "goods/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.gif",
      "goods-draft-images/goods/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      "Photo/yuuna_acrylic_stand.webp",
    ];
    for (const value of rejected) {
      assert.equal(cms.parseImagePath(value), undefined, value);
      assert.equal(cms.validatePublicGoods([row(1, { image_path: value }), row(2), row(3)]).reason, "image", value);
    }
  });

  it("builds a public goods image address and never a draft or shop address", () => {
    const url = cms.publicImageUrl("https://example.supabase.co/", paths[0]);
    assert.equal(url.includes("/storage/v1/object/public/goods-images/"), true);
    assert.equal(url.endsWith(paths[0]), true);
    assert.equal(url.includes("goods-draft-images"), false);
    assert.equal(url.includes("arcanacharm.base.shop"), false);
    assert.equal(url.includes("token="), false);
    assert.equal(cms.publicImageUrl("https://example.supabase.co/goods-draft-images", paths[0]), null);
    assert.equal(cms.publicImageUrl("http://example.supabase.co", paths[0]), null);
  });
});

describe("goods CMS rendering", () => {
  it("preloads every image before replacing all three cards together", async () => {
    const doc = goodsDocument();
    const before = snapshot(doc);
    const seen = [];
    let preloadSawStatic = false;
    const { result, calls } = await startWith(doc, trio([3, 1, 2]), {
      loadImage: async (url) => {
        assert.deepEqual(snapshot(doc), before);
        seen.push(url);
        preloadSawStatic = true;
      },
    });
    assert.equal(preloadSawStatic, true);
    assert.equal(result.applied, true);
    assert.equal(result.reason, "replaced");
    assert.equal(seen.length, 3);
    assert.deepEqual(doc.cards.map((card) => card.title.textContent), titles);
    assert.deepEqual(doc.cards.map((card) => card.href), urls);
    assert.deepEqual(doc.cards.map((card) => card.price.textContent), ["¥1,500", "¥1,500", "¥1,500"]);
    assert.deepEqual(doc.cards.map((card) => card.description.textContent), descriptions);
    assert.deepEqual(doc.cards.map((card) => card.image.alt), titles);
    assert.equal(doc.cards.every((card) => card.image.src.includes("/storage/v1/object/public/goods-images/")), true);
    assert.equal(doc.cards.every((card) => card.image.src.includes("Photo/") === false), true);
    assert.equal(doc.cards.every((card) => card.target === "_blank"), true);
    assert.equal(doc.cards.every((card) => card.rel === "noopener noreferrer"), true);
    assert.equal(doc.cards.every((card) => card.className === "item-card-link"), true);
    assert.equal(doc.cards.every((card) => card.indicator.textContent === "商品を見る"), true);
    assert.equal(doc.section.dataset.goodsSource, "cms");
    assert.equal(doc.section.hidden, false);
    assert.equal(doc.section.banner.href, "https://arcanacharm.base.shop/items/all");
    assert.equal(doc.section.cta.text, "公式ショップへ");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/get_public_goods_v1");
  });

  it("keeps the current visible card text when published goods match the static cards", async () => {
    const doc = goodsDocument();
    const { result } = await startWith(doc, trio());
    assert.equal(result.applied, true);
    assert.deepEqual(doc.cards.map((card) => card.title.textContent), titles);
    assert.deepEqual(doc.cards.map((card) => card.price.textContent), ["¥1,500", "¥1,500", "¥1,500"]);
    assert.deepEqual(doc.cards.map((card) => card.href), urls);
    assert.deepEqual(doc.cards.map((card) => card.description.textContent), descriptions);
    assert.deepEqual(doc.cards.map((card) => card.image.alt), titles);
  });

  it("renders markup in the title, description, and alt as text", async () => {
    const doc = goodsDocument();
    const scriptTitle = "<script>alert(1)</script>";
    const scriptDescription = '<img src=x onerror="alert(1)">';
    const { result } = await startWith(doc, trio([1, 2, 3], {
      2: { title: `  ${scriptTitle}  `, description: `  ${scriptDescription}  ` },
    }));
    assert.equal(result.applied, true);
    assert.equal(doc.cards[1].title.textContent, scriptTitle);
    assert.equal(doc.cards[1].description.textContent, scriptDescription);
    assert.equal(doc.cards[1].image.alt, scriptTitle);
    assert.equal(doc.cards[1].title.innerHTML, undefined);
    assert.equal(doc.cards[1].description.innerHTML, undefined);
    assert.equal(doc.cards[0].title.textContent, titles[0]);
    assert.equal(doc.cards[2].title.textContent, titles[2]);
  });

  it("does not turn description newlines into markup", async () => {
    const doc = goodsDocument();
    const description = "一行目\n二行目";
    const { result } = await startWith(doc, trio([1, 2, 3], { 1: { description } }));
    assert.equal(result.applied, true);
    assert.equal(doc.cards[0].description.textContent, description);
    assert.equal(doc.cards[0].description.children, undefined);
  });

  it("keeps every static card when the network fails", async () => {
    const doc = goodsDocument();
    const before = snapshot(doc);
    const { result } = await startWith(doc, trio(), {
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "network");
    assertStatic(doc, before);
  });

  it("keeps every static card when the request times out", async () => {
    const doc = goodsDocument();
    const before = snapshot(doc);
    const { result } = await startWith(doc, trio(), {
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
    assertStatic(doc, before);
  });

  it("keeps every static card for http failure and malformed json", async () => {
    const httpDoc = goodsDocument();
    const httpBefore = snapshot(httpDoc);
    const httpResult = await startWith(httpDoc, trio(), { ok: false });
    assert.equal(httpResult.result.applied, false);
    assert.equal(httpResult.result.reason, "http");
    assertStatic(httpDoc, httpBefore);

    const malformed = goodsDocument();
    const malformedBefore = snapshot(malformed);
    const malformedResult = await startWith(malformed, new SyntaxError("bad"));
    assert.equal(malformedResult.result.applied, false);
    assert.equal(malformedResult.result.reason, "payload");
    assertStatic(malformed, malformedBefore);
  });

  it("keeps every static card for an empty result and does not hide the section", async () => {
    const doc = goodsDocument();
    const before = snapshot(doc);
    let preloadCalled = false;
    const { result } = await startWith(doc, [], {
      loadImage: async () => {
        preloadCalled = true;
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "empty");
    assert.equal(preloadCalled, false);
    assertStatic(doc, before);
  });

  it("keeps every static card for a partial or oversized result", async () => {
    for (const [payload, reason] of [
      [trio([1]), "incomplete"],
      [trio([1, 2]), "incomplete"],
      [[row(1), row(2), row(3), row(1)], "extra"],
    ]) {
      const doc = goodsDocument();
      const before = snapshot(doc);
      let preloadCalled = false;
      const { result } = await startWith(doc, payload, {
        loadImage: async () => {
          preloadCalled = true;
        },
      });
      assert.equal(result.applied, false, reason);
      assert.equal(result.reason, reason);
      assert.equal(preloadCalled, false);
      assertStatic(doc, before);
    }
  });

  it("keeps every static card for a duplicate or invalid slot", async () => {
    for (const payload of [trio([1, 1, 2]), [row(1), row(2), row(4)], [row(1), row(2), row(3, { slot: "3" })]]) {
      const doc = goodsDocument();
      const before = snapshot(doc);
      const { result } = await startWith(doc, payload);
      assert.equal(result.applied, false);
      assert.equal(result.reason, "slot");
      assertStatic(doc, before);
    }
  });

  it("keeps every static card when any field is invalid", async () => {
    const cases = [
      [{ title: " " }, "title"],
      [{ price_amount: -5 }, "price"],
      [{ currency: "USD" }, "currency"],
      [{ description: "" }, "description"],
      [{ product_url: "https://example.com/items/110801805" }, "url"],
      [{ image_path: "https://evil.example/a.webp" }, "image"],
    ];
    for (const [overrides, reason] of cases) {
      const doc = goodsDocument();
      const before = snapshot(doc);
      const { result } = await startWith(doc, [row(1, overrides), row(2), row(3)]);
      assert.equal(result.reason, reason);
      assert.equal(result.applied, false);
      assertStatic(doc, before);
    }
  });

  it("does not change any card when one image fails to preload", async () => {
    for (const failingIndex of [0, 1, 2]) {
      const doc = goodsDocument();
      const before = snapshot(doc);
      const seen = [];
      const { result } = await startWith(doc, trio(), {
        loadImage: async (url) => {
          seen.push(url);
          assert.deepEqual(snapshot(doc), before);
          if (url.endsWith(paths[failingIndex])) throw new Error(`slot ${failingIndex + 1}`);
        },
      });
      assert.equal(result.applied, false);
      assert.equal(result.reason, "image");
      assert.equal(seen.length, 3);
      assertStatic(doc, before);
      assert.equal(doc.cards.some((card) => card.image.src.includes("goods-images")), false);
      assert.equal(doc.cards.some((card) => card.title.textContent !== titles[doc.cards.indexOf(card)]), false);
    }
  });

  it("updates all three cards or none", async () => {
    const doc = goodsDocument();
    const replacement = ["CMS 商品 1", "CMS 商品 2", "CMS 商品 3"];
    const { result } = await startWith(doc, trio([2, 3, 1], {
      1: { title: replacement[0], price_amount: 0 },
      2: { title: replacement[1], price_amount: 1500 },
      3: { title: replacement[2], price_amount: 6500 },
    }));
    assert.equal(result.applied, true);
    assert.deepEqual(doc.cards.map((card) => card.title.textContent), replacement);
    assert.deepEqual(doc.cards.map((card) => card.price.textContent), ["¥0", "¥1,500", "¥6,500"]);
    assert.equal(doc.cards.every((card, index) => card.href === urls[index]), true);
    assert.equal(doc.cards.some((card) => card.image.src.startsWith("Photo/")), false);
  });

  it("does not fetch when the goods switch is off", async () => {
    const doc = goodsDocument();
    const before = snapshot(doc);
    let called = false;
    const { result } = await startWith(doc, trio(), {
      config: { ...config, goodsCmsEnabled: false, membersCmsEnabled: true, galleryCmsEnabled: true, aboutCmsEnabled: true },
      fetchImpl: async () => {
        called = true;
        return jsonResponse(trio());
      },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "config");
    assert.equal(called, false);
    assertStatic(doc, before);
  });

  it("still loads goods when the other CMS switches are off", async () => {
    const doc = goodsDocument();
    let called = false;
    const { result } = await startWith(doc, trio(), {
      config: { ...config, membersCmsEnabled: false, galleryCmsEnabled: false, aboutCmsEnabled: false },
      fetchImpl: async (url) => {
        called = true;
        assert.equal(url.endsWith("/rest/v1/rpc/get_public_goods_v1"), true);
        return jsonResponse(trio());
      },
    });
    assert.equal(called, true);
    assert.equal(result.applied, true);
  });

  it("rejects a service role key and does not fetch", async () => {
    let called = false;
    const result = await cms.startGoodsCms({
      document: goodsDocument(),
      config: { ...config, supabasePublishableKey: "sb_secret_not_a_browser_key" },
      fetchImpl: async () => {
        called = true;
        return jsonResponse(trio());
      },
    });
    assert.equal(called, false);
    assert.equal(result.applied, false);
    assert.equal(cms.publicConfigIsSafe({ ...config, supabasePublishableKey: "service_role_key_value_here" }), false);
  });

  it("calls only the public goods rpc and the public image bucket", async () => {
    const doc = goodsDocument();
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      const { result, calls, images } = await startWith(doc, trio());
      assert.equal(result.applied, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/rpc/get_public_goods_v1");
      assert.equal(calls[0].options.method, "POST");
      assert.equal(calls[0].options.body, "{}");
      assert.equal(calls[0].options.headers.Authorization.includes("service_role"), false);
      assert.equal(calls[0].options.headers.Authorization.includes("sb_secret_"), false);
      assert.equal(calls[0].url.includes("goods_drafts"), false);
      assert.equal(calls[0].url.includes("goods_published"), false);
      assert.equal(calls[0].url.includes("goods_publish"), false);
      assert.equal(calls[0].url.includes("goods_restore"), false);
      assert.equal(calls[0].url.includes("goods-draft-images"), false);
      assert.equal(calls[0].url.includes("arcanacharm.base.shop"), false);
      assert.equal(images.length, 3);
      assert.equal(images.every((url) => url.includes("/storage/v1/object/public/goods-images/")), true);
      assert.equal(images.some((url) => url.includes("arcanacharm.base.shop")), false);
      assert.equal(images.some((url) => url.includes("goods-draft-images")), false);
      assert.equal(warnings.length, 0);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("warns without the key or the raw payload", async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      const doc = goodsDocument();
      await startWith(doc, [row(1, { title: "<script>alert(1)</script>" }), row(2)]);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /^Goods CMS was not applied \(incomplete\)\./);
      assert.equal(warnings[0].includes(config.supabasePublishableKey), false);
      assert.equal(warnings[0].includes("<script>"), false);
      assert.equal(warnings[0].includes("service_role"), false);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("static goods fallback source", () => {
  it("keeps the static goods cards, images, links, and section chrome in the page", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const source = readFileSync(new URL("./goods-cms.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const shopBlock = html.slice(html.indexOf('id="shop"'), html.indexOf('id="contact"'));
    assert.equal(shopBlock.includes('id="shop"'), true);
    assert.equal(shopBlock.includes('class="shop"'), true);
    assert.equal(shopBlock.includes("Official Goods"), true);
    assert.equal(shopBlock.includes("ArcanaCharmの公式グッズを販売中！限定アイテムも多数取り扱っています。"), true);
    assert.equal(shopBlock.includes('class="shop-banner"'), true);
    assert.equal(shopBlock.includes("今すぐショップを見る"), true);
    assert.equal(shopBlock.includes("人気商品"), true);
    assert.equal(shopBlock.includes("公式ショップへ"), true);
    assert.equal(shopBlock.includes('class="shop-button"'), true);
    assert.equal(shopBlock.includes("商品を見る"), true);
    for (const card of staticCards) {
      assert.equal(existsSync(new URL(`./${card.src}`, import.meta.url)), true, card.src);
      assert.equal(shopBlock.includes(`data-goods-slot="${card.slot}"`), true, card.slot);
      assert.equal(shopBlock.includes(`href="${card.href}"`), true, card.href);
      assert.equal(shopBlock.includes(`src="${card.src}"`), true, card.src);
      assert.equal(shopBlock.includes(`alt="${card.alt}"`), true, card.alt);
      assert.equal(shopBlock.includes(card.title), true, card.title);
      assert.equal(shopBlock.includes(card.description.split("\n")[0]), true, card.title);
    }
    assert.equal(shopBlock.includes(cms.formatJpy(1500)), true);
    assert.equal(shopBlock.includes('class="item-card-link"'), true);
    assert.equal(shopBlock.includes('class="item-link-indicator"'), true);
    assert.equal(html.includes("goods-cms.js"), true);
    assert.equal(styles.includes(".items-grid"), true);
    assert.equal(styles.includes("object-fit: contain"), true);
    assert.equal(styles.includes(".item-card:hover"), true);
    assert.equal(source.includes("innerHTML"), false);
    assert.equal(source.includes("outerHTML"), false);
    assert.equal(source.includes("insertAdjacentHTML"), false);
    assert.equal(source.includes("toLocaleString"), false);
    assert.equal(source.includes("get_public_goods_v1"), true);
    assert.equal(source.includes("goods_drafts"), false);
    assert.equal(source.includes("goods_published"), false);
    assert.equal(source.includes("goods_publish_events"), false);
    assert.equal(source.includes("goods_publish_snapshots"), false);
    assert.equal(source.includes("goods_restore_events"), false);
    assert.equal(source.includes("goods_restore_draft_backups"), false);
    assert.equal(source.includes("goods-draft-images"), true);
    assert.equal(source.includes("service_role"), true);
    assert.equal(source.includes("sb_secret_"), true);
    assert.equal(/sb_secret_[A-Za-z0-9]/.test(source), false);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(source.includes("get_public_members_v1"), false);
    assert.equal(source.includes("get_public_gallery_v1"), false);
    assert.equal(source.includes("get_public_about_v1"), false);
    assert.equal(source.includes("akamaized"), false);
    assert.equal(/fetch(?:Impl)?\s*\(\s*[^\n]*base\.shop/.test(source), false);
    const publicConfig = readFileSync(new URL("./members-public-config.js", import.meta.url), "utf8");
    assert.equal(publicConfig.includes("membersCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("galleryCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("aboutCmsEnabled: true"), true);
    assert.equal(publicConfig.includes("goodsCmsEnabled: true"), true);
    assert.equal(publicConfig.toLowerCase().includes("service_role"), false);
    assert.equal(publicConfig.toLowerCase().includes("sb_secret_"), false);
    assert.equal(publicConfig.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    const ignore = readFileSync(new URL("./.vercelignore", import.meta.url), "utf8");
    assert.equal(ignore.includes("goods-cms.test.mjs"), true);
    const packageJson = readFileSync(new URL("./package.json", import.meta.url), "utf8");
    assert.equal(packageJson.includes("goods-cms.test.mjs"), true);
  });
});
