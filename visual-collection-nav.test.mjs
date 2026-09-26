import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const nav = require("./visual-collection-nav.js");

const costumes = ["predebut", "debut", "february", "dress", "october"];

describe("visual collection history", () => {
    it("keeps collection and detail as separate addressable states", () => {
        assert.equal(nav.detailUrl("february"), "member-selection.html?costume=february");
        assert.equal(nav.detailUrl("dress"), "member-selection.html?costume=dress");
        assert.notEqual(nav.detailUrl("february"), nav.detailUrl("dress"));
        assert.equal(nav.COLLECTION_URL, "member-selection.html");
    });

    it("reads a direct detail URL without inventing collection history", () => {
        const view = nav.viewForState(null, "?costume=october", costumes);
        assert.deepEqual(view, {
            view: "detail",
            eventId: "october",
            fromCollection: false
        });
    });

    it("restores the collection scroll saved before opening a costume", () => {
        const state = nav.collectionState(640);
        const view = nav.viewForState(state, "", costumes);
        assert.deepEqual(view, { view: "collection", scrollY: 640 });
    });

    it("prefers an existing detail history entry over the query string", () => {
        const state = nav.detailState("may", true);
        const view = nav.viewForState(state, "?costume=june", ["may", "june"]);
        assert.equal(view.eventId, "may");
        assert.equal(view.fromCollection, true);
    });

    it("ignores an unknown costume and shows the collection", () => {
        const view = nav.viewForState(null, "?costume=not-a-costume", costumes);
        assert.deepEqual(view, { view: "collection", scrollY: 0 });
    });

    it("uses browser back only when the detail was opened from the collection", () => {
        const fromCollection = nav.collectionReturnAction(nav.detailState("polkadot", true));
        const direct = nav.collectionReturnAction(nav.detailState("polkadot", false));
        const missing = nav.collectionReturnAction(null);

        assert.deepEqual(fromCollection, { type: "history-back" });
        assert.deepEqual(direct, { type: "navigate", url: "member-selection.html" });
        assert.deepEqual(missing, { type: "navigate", url: "member-selection.html" });
    });

    it("changes the fixed button only while a costume detail is open", () => {
        const collection = nav.fixedButtonModel(nav.collectionState(0));
        const detail = nav.fixedButtonModel(nav.detailState("debut", true));
        const direct = nav.fixedButtonModel(nav.detailState("debut", false));

        assert.equal(collection.label, "TOPページに戻る");
        assert.equal(collection.href, "index.html#gallery");
        assert.equal(collection.useHistoryBack, false);

        assert.equal(detail.label, "あるあむビジュアルコレクションに戻る");
        assert.equal(detail.href, "member-selection.html");
        assert.equal(detail.useHistoryBack, true);

        assert.equal(direct.label, "あるあむビジュアルコレクションに戻る");
        assert.equal(direct.href, "member-selection.html");
        assert.equal(direct.useHistoryBack, false);
    });
});
