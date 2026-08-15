// Filae encodes each person's gender as their avatar circle's background
// color, not a semantic class name or explicit attribute - confirmed
// against 8 live samples (4 male, 4 female), spanning parent/sibling/child
// roles and two different spouse-branches: every male avatar's computed
// background-color was exactly rgb(102, 204, 204), every female exactly
// rgb(255, 136, 136), no drift, no third color observed (see issue #28).
//
// That color only exists as a *rendered* CSS value - Filae assigns it via
// a compiled/hashed CSS class (different hash per person, e.g. "css-gems4w"
// vs "css-tdaz7q"), not an inline style or a stable class name, so a parser
// working from a serialized HTML string has no way to see it; it only
// exists once the page's real stylesheet has been applied by a live
// browser. Reading computed style doesn't require React internals the way
// MyHeritage's link annotation does, so unlike annotateMyHeritageLinks.js
// this runs in the normal isolated world (shares the DOM with the page,
// which is all getComputedStyle() needs), not the MAIN world - it's
// injected alongside getPagesSource.js in popup.js's getPageCode(), just
// ahead of it in the same file list, so this stamps the resolved color
// onto each avatar as a plain data attribute before the page gets
// serialized.
//
// Best-effort only, like annotateMyHeritageLinks.js: a no-op with no
// visible effect on any page without ".avatar-content" elements, so it's
// safe to run unconditionally on every site rather than gating it to Filae
// specifically.
(function () {
    try {
        var avatarEls = document.querySelectorAll(".avatar-content");
        for (var i = 0; i < avatarEls.length; i++) {
            var el = avatarEls[i];
            var color = window.getComputedStyle(el).backgroundColor;
            if (color) {
                el.setAttribute("data-smartcopy-avatar-color", color);
            }
        }
    } catch (e) {
        // Never let this block the rest of the page capture.
    }
})();
