(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.VisualCollectionNav = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    var COLLECTION_URL = "member-selection.html";
    var TOP_URL = "index.html#gallery";
    var COSTUME_PARAM = "costume";
    var COLLECTION_LABEL = "あるあむビジュアルコレクションに戻る";
    var TOP_LABEL = "TOPページに戻る";

    function isKnownCostume(eventId, knownIds) {
        return typeof eventId === "string" && eventId.length > 0 && knownIds.indexOf(eventId) !== -1;
    }

    function normalizeScroll(scrollY) {
        var value = Number(scrollY);
        if (!Number.isFinite(value) || value < 0) {
            return 0;
        }
        return value;
    }

    function collectionState(scrollY) {
        return {
            view: "collection",
            scrollY: normalizeScroll(scrollY)
        };
    }

    function detailState(eventId, fromCollection) {
        return {
            view: "detail",
            eventId: eventId,
            fromCollection: Boolean(fromCollection)
        };
    }

    function detailUrl(eventId) {
        return COLLECTION_URL + "?" + COSTUME_PARAM + "=" + encodeURIComponent(eventId);
    }

    function costumeIdFromSearch(search) {
        var query = String(search || "").replace(/^\?/, "");
        var params = new URLSearchParams(query);
        return params.get(COSTUME_PARAM) || "";
    }

    function viewForState(historyState, search, knownIds) {
        if (historyState && historyState.view === "detail" && isKnownCostume(historyState.eventId, knownIds)) {
            return {
                view: "detail",
                eventId: historyState.eventId,
                fromCollection: Boolean(historyState.fromCollection)
            };
        }
        if (historyState && historyState.view === "collection") {
            return {
                view: "collection",
                scrollY: normalizeScroll(historyState.scrollY)
            };
        }
        var costumeId = costumeIdFromSearch(search);
        if (isKnownCostume(costumeId, knownIds)) {
            return {
                view: "detail",
                eventId: costumeId,
                fromCollection: false
            };
        }
        return {
            view: "collection",
            scrollY: 0
        };
    }

    function fixedButtonModel(historyState) {
        if (historyState && historyState.view === "detail") {
            return {
                label: COLLECTION_LABEL,
                href: COLLECTION_URL,
                useHistoryBack: Boolean(historyState.fromCollection)
            };
        }
        return {
            label: TOP_LABEL,
            href: TOP_URL,
            useHistoryBack: false
        };
    }

    function collectionReturnAction(historyState) {
        if (historyState && historyState.view === "detail" && historyState.fromCollection) {
            return { type: "history-back" };
        }
        return { type: "navigate", url: COLLECTION_URL };
    }

    return {
        COLLECTION_URL: COLLECTION_URL,
        TOP_URL: TOP_URL,
        COLLECTION_LABEL: COLLECTION_LABEL,
        TOP_LABEL: TOP_LABEL,
        isKnownCostume: isKnownCostume,
        collectionState: collectionState,
        detailState: detailState,
        detailUrl: detailUrl,
        costumeIdFromSearch: costumeIdFromSearch,
        viewForState: viewForState,
        fixedButtonModel: fixedButtonModel,
        collectionReturnAction: collectionReturnAction
    };
});
