"use strict";

/**
 * StudyTrack V2 — Shared Sidebar Tooltips
 *
 * Features:
 * - Cream background and racing-green text.
 * - Positions tooltips beside sidebar controls.
 * - Supports collapsed desktop sidebars.
 * - Supports mouse and keyboard navigation.
 * - Supports navigation links, profile shortcuts and logout.
 * - Repositions tooltips on scroll and resize.
 * - Prevents duplicate tooltips.
 * - Keeps tooltips within the browser viewport.
 */

(() => {
    const TOOLTIP_CLASS = "studytrack-sidebar-tooltip";
    const TOOLTIP_STYLE_ID = "studytrack-sidebar-tooltip-styles";
    const TOOLTIP_ID = "studytrack-sidebar-tooltip";

    const TOOLTIP_BACKGROUND = "#F4FEF3";
    const TOOLTIP_TEXT = "#004225";
    const TOOLTIP_BORDER = "#C8D9CA";

    const desktopQuery = window.matchMedia("(min-width: 851px)");

    let tooltip = null;
    let activeTarget = null;
    let resizeObserver = null;
    let sidebarStateObserver = null;

    /*
     * 1. INJECT TOOLTIP STYLES
     */

    function injectStyles() {
        let style = document.getElementById(TOOLTIP_STYLE_ID);

        if (!style) {
            style = document.createElement("style");
            style.id = TOOLTIP_STYLE_ID;
            document.head.appendChild(style);
        }

        style.textContent = `
body > .${ TOOLTIP_CLASS } {
    position: fixed!important;
    z - index: 100000!important;

    display: none;
    align - items: center;
    justify - content: center;

    width: max - content;
    max - width: min(280px, calc(100vw - 24px));

    box - sizing: border - box;
    padding: 10px 14px;

    background: ${ TOOLTIP_BACKGROUND };
    color: ${ TOOLTIP_TEXT };

    border: 1px solid ${ TOOLTIP_BORDER };
    border - radius: 9px;

    box - shadow: 0 6px 20px rgba(0, 30, 17, 0.18);

    font - family: Arial, Helvetica, sans - serif;
    font - size: 13px;
    font - weight: 600;
    line - height: 1.4;
    letter - spacing: 0.01em;

    white - space: normal;
    overflow - wrap: anywhere;
    text - align: left;

    pointer - events: none;

    opacity: 0;
    visibility: hidden;

    transform: translateX(-3px);

    transition:
                    opacity 140ms ease,
        transform 140ms ease,
            visibility 140ms ease;
}

body > .${ TOOLTIP_CLASS }.is - visible {
    display: flex!important;
    opacity: 1!important;
    visibility: visible!important;
    transform: translateX(0);
}

body > .${ TOOLTIP_CLASS }::before {
    content: "";

    position: absolute;
    top: 50 %;
    left: -6px;

    width: 10px;
    height: 10px;

    background: ${ TOOLTIP_BACKGROUND };

    border - left: 1px solid ${ TOOLTIP_BORDER };
    border - bottom: 1px solid ${ TOOLTIP_BORDER };

    transform: translateY(-50 %) rotate(45deg);
}

@media(prefers - reduced - motion: reduce) {
    body > .${ TOOLTIP_CLASS } {
        transition: none;
    }
}
`;
    }

    /*
     * 2. CREATE THE TOOLTIP ELEMENT
     */

    function createTooltip() {
        const existing = document.getElementById(TOOLTIP_ID);

        if (existing) {
            tooltip = existing;

            if (tooltip.parentElement !== document.body) {
                document.body.appendChild(tooltip);
            }

            tooltip.classList.add(TOOLTIP_CLASS);
            tooltip.setAttribute("role", "tooltip");
            tooltip.setAttribute("aria-hidden", "true");

            return;
        }

        tooltip = document.createElement("div");

        tooltip.id = TOOLTIP_ID;
        tooltip.className = TOOLTIP_CLASS;
        tooltip.setAttribute("role", "tooltip");
        tooltip.setAttribute("aria-hidden", "true");

        document.body.appendChild(tooltip);
    }

    /*
     * 3. FIND THE SIDEBAR AND ITS COLLAPSED STATE
     */

    function getSidebar() {
        return document.querySelector(".sidebar");
    }

    function getLayout() {
        return document.querySelector(".app-layout");
    }

    function isCollapsedDesktop() {
        if (!desktopQuery.matches) {
            return false;
        }

        const sidebar = getSidebar();
        const layout = getLayout();

        return Boolean(
            sidebar &&
            (
                sidebar.classList.contains("sidebar-collapsed") ||
                (
                    layout &&
                    layout.classList.contains("sidebar-collapsed")
                )
            )
        );
    }

    /*
     * 4. GET THE TOOLTIP LABEL
     */

    function getTooltipText(target) {
        if (!target) {
            return "";
        }

        const explicitTooltip = target.getAttribute("data-tooltip");

        if (explicitTooltip && explicitTooltip.trim()) {
            return explicitTooltip.trim();
        }

        const label = target.querySelector(
            ".nav-label, " +
            ".nav-link-text, " +
            ".profile-shortcut-text, " +
            ".sidebar-logout-text"
        );

        if (label && label.textContent.trim()) {
            return label.textContent.trim();
        }

        return target.getAttribute("aria-label") || "";
    }

    /*
     * 5. POSITION THE TOOLTIP
     */

    function positionTooltip(target) {
        if (!tooltip || !target || !target.isConnected) {
            return;
        }

        const targetRect = target.getBoundingClientRect();

        const viewportPadding = 12;
        const preferredGap = 14;

        /*
         * Make the tooltip measurable before positioning it.
         */

        tooltip.style.display = "flex";
        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tooltipRect = tooltip.getBoundingClientRect();

        /*
         * Prefer placing the tooltip to the right of the icon.
         */

        const maximumLeft = Math.max(
            viewportPadding,
            window.innerWidth -
                tooltipRect.width -
                viewportPadding
        );

        let left = targetRect.right + preferredGap;

        /*
         * If there is insufficient room on the right,
         * position it to the left of the target.
         */

        if (
            left + tooltipRect.width >
            window.innerWidth - viewportPadding
        ) {
            left =
                targetRect.left -
                tooltipRect.width -
                preferredGap;
        }

        left = Math.max(
            viewportPadding,
            Math.min(left, maximumLeft)
        );

        /*
         * Centre the tooltip vertically beside its icon.
         */

        const maximumTop = Math.max(
            viewportPadding,
            window.innerHeight -
                tooltipRect.height -
                viewportPadding
        );

        let top =
            targetRect.top +
            targetRect.height / 2 -
            tooltipRect.height / 2;

        top = Math.max(
            viewportPadding,
            Math.min(top, maximumTop)
        );

        /*
         * Important: coordinates must not contain spaces before "px".
         */

        tooltip.style.left = `${ Math.round(left) } px`;
        tooltip.style.top = `${ Math.round(top) } px`;
    }

    /*
     * 6. SHOW THE TOOLTIP
     */

    function showTooltip(target) {
        if (!tooltip || !target || !target.isConnected) {
            hideTooltip();
            return;
        }

        if (!isCollapsedDesktop()) {
            hideTooltip();
            return;
        }

        const text = getTooltipText(target);

        if (!text) {
            hideTooltip();
            return;
        }

        if (
            activeTarget &&
            activeTarget !== target &&
            activeTarget.getAttribute("aria-describedby") === TOOLTIP_ID
        ) {
            activeTarget.removeAttribute("aria-describedby");
        }

        activeTarget = target;

        tooltip.textContent = text;
        tooltip.setAttribute("aria-hidden", "false");

        target.setAttribute("aria-describedby", TOOLTIP_ID);

        tooltip.classList.add("is-visible");

        positionTooltip(target);
    }

    /*
     * 7. HIDE THE TOOLTIP
     */

    function hideTooltip(target) {
        if (
            target &&
            activeTarget &&
            target !== activeTarget
        ) {
            return;
        }

        if (!tooltip) {
            return;
        }

        if (
            activeTarget &&
            activeTarget.getAttribute("aria-describedby") === TOOLTIP_ID
        ) {
            activeTarget.removeAttribute("aria-describedby");
        }

        activeTarget = null;

        tooltip.classList.remove("is-visible");
        tooltip.setAttribute("aria-hidden", "true");
        tooltip.style.display = "none";
    }

    /*
     * 8. REFRESH THE CURRENT TOOLTIP
     */

    function refreshTooltip() {
        if (!activeTarget) {
            return;
        }

        if (
            !activeTarget.isConnected ||
            !isCollapsedDesktop()
        ) {
            hideTooltip();
            return;
        }

        positionTooltip(activeTarget);
    }

    /*
     * 9. ATTACH MOUSE AND KEYBOARD EVENTS
     */

    function attachTooltipEvents(target) {
        if (target.dataset.tooltipInitialized === "true") {
            return;
        }

        target.dataset.tooltipInitialized = "true";

        target.addEventListener("mouseenter", () => {
            showTooltip(target);
        });

        target.addEventListener("mouseleave", () => {
            hideTooltip(target);
        });

        target.addEventListener("focusin", () => {
            showTooltip(target);
        });

        target.addEventListener("focusout", () => {
            window.setTimeout(() => {
                if (!target.contains(document.activeElement)) {
                    hideTooltip(target);
                }
            }, 0);
        });

        target.addEventListener("click", () => {
            hideTooltip(target);
        });
    }

    /*
     * 10. INITIALISE ALL SIDEBAR TOOLTIP TARGETS
     */

    function initialiseTooltips() {
        injectStyles();
        createTooltip();

        const sidebar = getSidebar();

        if (!sidebar) {
            console.warn(
                "StudyTrack: Sidebar not found; tooltips were not attached."
            );

            return;
        }

        const targets = sidebar.querySelectorAll(
            ".nav-link[data-tooltip], " +
            ".profile-shortcut[data-tooltip], " +
            ".sidebar-logout[data-tooltip]"
        );

        targets.forEach(attachTooltipEvents);

        /*
         * Observe sidebar size changes so the tooltip
         * remains beside the correct control.
         */

        if (resizeObserver) {
            resizeObserver.disconnect();
        }

        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver(() => {
                refreshTooltip();
            });

            resizeObserver.observe(sidebar);
        }

        refreshTooltip();
    }

    /*
     * 11. WATCH SIDEBAR STATE CHANGES
     */

    function observeSidebarState() {
        if (!("MutationObserver" in window)) {
            return;
        }

        if (sidebarStateObserver) {
            sidebarStateObserver.disconnect();
        }

        sidebarStateObserver = new MutationObserver(() => {
            if (!isCollapsedDesktop()) {
                hideTooltip();
            } else {
                refreshTooltip();
            }
        });

        const sidebar = getSidebar();
        const layout = getLayout();

        if (sidebar) {
            sidebarStateObserver.observe(sidebar, {
                attributes: true,
                attributeFilter: ["class"]
            });
        }

        if (layout) {
            sidebarStateObserver.observe(layout, {
                attributes: true,
                attributeFilter: ["class"]
            });
        }
    }

    /*
     * 12. START THE TOOLTIP SYSTEM
     */

    function initialise() {
        initialiseTooltips();
        observeSidebarState();

        window.addEventListener("resize", refreshTooltip);

        window.addEventListener(
            "scroll",
            refreshTooltip,
            true
        );

        if (typeof desktopQuery.addEventListener === "function") {
            desktopQuery.addEventListener("change", () => {
                hideTooltip();
                refreshTooltip();
            });
        } else if (typeof desktopQuery.addListener === "function") {
            desktopQuery.addListener(() => {
                hideTooltip();
                refreshTooltip();
            });
        }

        console.info(
            "StudyTrack: Shared sidebar tooltips initialized."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            { once: true }
        );
    } else {
        initialise();
    }
})();

