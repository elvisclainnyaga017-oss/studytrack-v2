"use strict";

/**
 * StudyTrack V2 — Tasks Page Tooltips
 *
 * This implementation belongs exclusively to the Tasks page.
 * It does not modify or depend on the shared sidebar tooltip script.
 *
 * Features:
 * - Cream background and racing-green text.
 * - Supports collapsed desktop sidebars.
 * - Supports mouse and keyboard navigation.
 * - Positions tooltips outside the sidebar to prevent clipping.
 * - Keeps tooltips within the viewport.
 * - Repositions tooltips when the window changes size or scrolls.
 * - Supports reduced-motion preferences.
 */

(() => {
    const TOOLTIP_ID = "studytrack-tasks-tooltip";
    const TOOLTIP_CLASS = "tasks-sidebar-tooltip";
    const STYLE_ID = "tasks-sidebar-tooltip-styles";

    const desktopQuery = window.matchMedia("(min-width: 851px)");

    let tooltip = null;
    let activeTarget = null;
    let resizeObserver = null;
    let stateObserver = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");

        style.id = STYLE_ID;

        style.textContent = `
body > .${TOOLTIP_CLASS} {
    position: fixed;
    z-index: 2147483647;
    display: block;
    box-sizing: border-box;
    width: max-content;
    max-width: min(280px, calc(100vw - 24px));
    padding: 10px 14px;
    border: 1px solid #C8D9CA;
    border-radius: 9px;
    background: #F4FEF3;
    color: #004225;
    box-shadow: 0 6px 20px rgba(0, 30, 17, 0.18);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.01em;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transform: translateX(-3px);
    transition:
        opacity 140ms ease,
        transform 140ms ease,
        visibility 140ms ease;
}

body > .${TOOLTIP_CLASS}.is-visible {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
}

body > .${TOOLTIP_CLASS}::before {
    content: "";
    position: absolute;
    top: 50%;
    left: -6px;
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    background: #F4FEF3;
    border-left: 1px solid #C8D9CA;
    border-bottom: 1px solid #C8D9CA;
    transform: translateY(-50%) rotate(45deg);
}

:root[data-theme="night"] body > .${TOOLTIP_CLASS} {
    background: #F4FEF3;
    color: #004225;
}

@media (prefers-reduced-motion: reduce) {
    body > .${TOOLTIP_CLASS} {
        transition: none;
    }
}
`;

        document.head.appendChild(style);
    }

    function createTooltip() {
        tooltip = document.getElementById(TOOLTIP_ID);

        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = TOOLTIP_ID;
        }

        tooltip.className = TOOLTIP_CLASS;
        tooltip.setAttribute("role", "tooltip");
        tooltip.setAttribute("aria-hidden", "true");

        if (tooltip.parentElement !== document.body) {
            document.body.appendChild(tooltip);
        }

        tooltip.style.display = "none";
    }

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

    function getTooltipText(target) {
        if (!target) {
            return "";
        }

        const explicitLabel = target.getAttribute("data-tooltip");

        if (explicitLabel && explicitLabel.trim()) {
            return explicitLabel.trim();
        }

        return target.getAttribute("aria-label") || "";
    }

    function positionTooltip(target) {
        if (!tooltip || !target || !target.isConnected) {
            return;
        }

        const targetRect = target.getBoundingClientRect();

        const padding = 12;
        const gap = 14;

        /*
         * Make the tooltip measurable before calculating its position.
         */

        tooltip.style.display = "block";
        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tooltipRect = tooltip.getBoundingClientRect();

        /*
         * Prefer the right side of the sidebar control.
         * Use the left side if there is insufficient space.
         */

        const rightPosition = targetRect.right + gap;
        const leftPosition = targetRect.left - tooltipRect.width - gap;

        let left;

        if (
            rightPosition + tooltipRect.width <=
            window.innerWidth - padding
        ) {
            left = rightPosition;
        } else if (leftPosition >= padding) {
            left = leftPosition;
        } else {
            left = Math.max(
                padding,
                window.innerWidth - tooltipRect.width - padding
            );
        }

        const maximumLeft = Math.max(
            padding,
            window.innerWidth - tooltipRect.width - padding
        );

        left = Math.max(padding, Math.min(left, maximumLeft));

        /*
         * Centre the tooltip vertically beside the target.
         */

        const maximumTop = Math.max(
            padding,
            window.innerHeight - tooltipRect.height - padding
        );

        let top =
            targetRect.top +
            targetRect.height / 2 -
            tooltipRect.height / 2;

        top = Math.max(padding, Math.min(top, maximumTop));

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

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

    function showTooltip(target) {
        if (
            !tooltip ||
            !target ||
            !target.isConnected ||
            !isCollapsedDesktop()
        ) {
            hideTooltip();
            return;
        }

        const label = getTooltipText(target);

        if (!label) {
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

        tooltip.textContent = label;
        tooltip.setAttribute("aria-hidden", "false");

        target.setAttribute("aria-describedby", TOOLTIP_ID);

        tooltip.style.display = "block";
        tooltip.classList.add("is-visible");

        positionTooltip(target);
    }

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

    function attachEvents(target) {
        if (target.dataset.tasksTooltipInitialized === "true") {
            return;
        }

        target.dataset.tasksTooltipInitialized = "true";

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

    function initialise() {
        injectStyles();
        createTooltip();

        const sidebar = getSidebar();

        if (!sidebar) {
            console.warn(
                "StudyTrack Tasks: Sidebar not found; tooltips were not attached."
            );

            return;
        }

        const targets = sidebar.querySelectorAll(
            ".nav-link[data-tooltip], " +
            ".profile-shortcut[data-tooltip], " +
            ".sidebar-logout[data-tooltip]"
        );

        targets.forEach(attachEvents);

        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver(refreshTooltip);
            resizeObserver.observe(sidebar);
        }

        if ("MutationObserver" in window) {
            stateObserver = new MutationObserver(() => {
                if (!isCollapsedDesktop()) {
                    hideTooltip();
                } else {
                    refreshTooltip();
                }
            });

            stateObserver.observe(sidebar, {
                attributes: true,
                attributeFilter: ["class"]
            });

            const layout = getLayout();

            if (layout) {
                stateObserver.observe(layout, {
                    attributes: true,
                    attributeFilter: ["class"]
                });
            }
        }

        window.addEventListener("resize", refreshTooltip);

        window.addEventListener("scroll", refreshTooltip, true);

        const handleBreakpointChange = () => {
            hideTooltip();
            refreshTooltip();
        };

        if (typeof desktopQuery.addEventListener === "function") {
            desktopQuery.addEventListener(
                "change",
                handleBreakpointChange
            );
        } else if (typeof desktopQuery.addListener === "function") {
            desktopQuery.addListener(handleBreakpointChange);
        }

        console.info(
            "StudyTrack Tasks: Independent sidebar tooltips initialized."
        );
    }

    function start() {
        if (document.readyState === "loading") {
            document.addEventListener(
                "DOMContentLoaded",
                initialise,
                { once: true }
            );
        } else {
            initialise();
        }
    }

    start();
})();