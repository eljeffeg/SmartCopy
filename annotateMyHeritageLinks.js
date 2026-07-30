// MyHeritage's redesigned profile page renders "Immediate Family" cards
// (parents/siblings) with no <a href> at all - the click handler reads a
// link_in_profile_page URL straight out of the React component's props,
// which never reaches the DOM. That prop only exists as a JS object
// property attached by the page's own React runtime, so reading it requires
// running in the page's own ("MAIN") JS world - a normal isolated-world
// content script (like getPagesSource.js) shares the DOM with the page but
// not its JS object identities/expando properties, and would never see it.
//
// This file is injected separately with {world: "MAIN"} (see popup.js's
// getPageCode()), specifically so it can walk React's internal fiber tree
// and pull that URL out, before getPagesSource.js serializes the page in
// the isolated world as usual. It stamps the URL onto the element as a
// data-smartcopy-profile-link attribute - a normal DOM attribute, which
// (unlike JS properties) lives on the shared DOM node and so is visible to
// the isolated-world script that runs afterward.
//
// MAIN-world content scripts have no access to chrome.* extension APIs, so
// this file must stay pure DOM manipulation with no chrome.runtime calls.
//
// This only touches elements matching MyHeritage's specific card markup, so
// it's a no-op on every other site, and it's entirely best-effort: relies on
// React internals (__reactFiber$* keys, memoizedProps) that aren't a public
// API and could change in a future React version, so failures here must
// never block page capture.
(function () {
    function searchPropsForLink(props, depth) {
        if (!props || typeof props !== 'object' || depth > 6) {
            return null;
        }
        if (typeof props.link_in_profile_page === 'string') {
            return props.link_in_profile_page;
        }
        for (var key in props) {
            if (key === 'children') {
                continue;
            }
            var val = props[key];
            if (val && typeof val === 'object') {
                var found = searchPropsForLink(val, depth + 1);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function findLinkInProfilePage(fiber) {
        var hops = 0;
        while (fiber && hops < 8) {
            var found = searchPropsForLink(fiber.memoizedProps, 0);
            if (found) {
                return found;
            }
            fiber = fiber.return;
            hops++;
        }
        return null;
    }

    try {
        var cards = document.querySelectorAll('.profile_page_section.immediate_family .family_relative');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var fiberKey = Object.keys(card).find(function (k) {
                return k.indexOf('__reactFiber$') === 0;
            });
            if (!fiberKey) {
                continue;
            }
            var link = findLinkInProfilePage(card[fiberKey]);
            if (link) {
                card.setAttribute('data-smartcopy-profile-link', link);
            }
        }
    } catch (e) {
        // Best-effort only.
    }
})();
