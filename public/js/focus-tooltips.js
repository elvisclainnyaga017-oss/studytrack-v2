"use strict";

/**
 * StudyTrack V2 — Focus Timer Sidebar Tooltips
 *
 * File: public/js/focus-tooltips.js
 *
 * Features:
 * - Displays tooltips when the desktop sidebar is collapsed.
 * - Uses a fixed-position tooltip to prevent sidebar overflow clipping.
 * - Supports navigation links, profile shortcuts and logout buttons.
 * - Supports mouse and keyboard navigation.
 * - Positions tooltips within the visible browser window.
 * - Repositions tooltips when the page scrolls or resizes.
 * - Hides tooltips on mobile and tablet screens.
 * - Avoids interfering with the Focus Timer functionality.
 * - Cleans up event listeners when the page is unloaded.
 */

(() => {
    "use strict";

    const TOOLTIP_ID = "studytrack-focus-tooltip";
    const DESKTOP_BREAKPOINT = 851;
    const TOOLTIP_GAP = 12;
    const VIEWPORT_PADDING = 10;

    const TARGET_SELECTORS = [
        ".nav-link[data-tooltip]",
        ".profile-shortcut[data-tooltip]",
        ".sidebar-logout[data-tooltip]",
        ".logout-button[data-tooltip]"
    ].join(",");

    let tooltipElement = null;
    let activeTarget = null;
    let resizeObserver = null;
    let repositionFrame = null;

    /**
     * Determine whether the current viewport supports desktop tooltips.
     */
    function isDesktopViewport() {
        return window.matchMedia(
            `(min-width: ${DESKTOP_BREAKPOINT}px)`
        ).matches;
    }

    /**
     * Determine whether the sidebar is collapsed.
     */
    function isSidebarCollapsed() {
        const layout = document.querySelector(".app-layout");

        return Boolean(
            layout &&
            layout.classList.contains("sidebar-collapsed")
        );
    }

    /**
     * Return the tooltip text for a sidebar control.
     */
    function getTooltipText(target) {
        if (!target) {
            return "";
        }

        const explicitTooltip = target.getAttribute("data-tooltip");

        if (explicitTooltip && explicitTooltip.trim()) {
            return explicitTooltip.trim();
        }

        const accessibleLabel = target.getAttribute("aria-label");

        if (accessibleLabel && accessibleLabel.trim()) {
            return accessibleLabel.trim();
        }

        const title = target.getAttribute("title");

        if (title && title.trim()) {
            return title.trim();
        }

        const visibleText = target.querySelector(
            ".nav-link-text, .profile-shortcut-text, span:not(.nav-icon)"
        );

        if (visibleText && visibleText.textContent.trim()) {
            return visibleText.textContent.trim();
        }

        return target.textContent.trim();
    }

    /**
     * Create the tooltip outside the sidebar so its parent cannot clip it.
     */
    function createTooltip() {
        const existingTooltip = document.getElementById(TOOLTIP_ID);

        if (existingTooltip) {
            existingTooltip.remove();
        }

        tooltipElement = document.createElement("div");

        tooltipElement.id = TOOLTIP_ID;
        tooltipElement.className = "studytrack-focus-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.setAttribute("aria-hidden", "true");

        document.body.appendChild(tooltipElement);
    }

    /**
     * Keep the tooltip within the visible browser viewport.
     */
    function clamp(value, minimum, maximum) {
        return Math.min(
            Math.max(value, minimum),
            Math.max(minimum, maximum)
        );
    }

    /**
     * Calculate and apply the tooltip position.
     */
    function positionTooltip(target) {
        if (
            !tooltipElement ||
            !target ||
            !target.isConnected
        ) {
            hideTooltip();
            return;
        }

        const targetRect = target.getBoundingClientRect();

        const tooltipRect = tooltipElement.getBoundingClientRect();

        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;

        const availableRight =
            viewportWidth - targetRect.right - TOOLTIP_GAP;

        const availableLeft =
            targetRect.left - TOOLTIP_GAP;

        let left;

        /*
         * Prefer displaying the tooltip to the right of the sidebar.
         * If there is insufficient room, display it to the left.
         */
        if (
            availableRight >= tooltipRect.width + VIEWPORT_PADDING
        ) {
            left = targetRect.right + TOOLTIP_GAP;
        } else if (
            availableLeft >= tooltipRect.width + VIEWPORT_PADDING
        ) {
            left = targetRect.left - tooltipRect.width - TOOLTIP_GAP;
        } else {
            left = clamp(
                targetRect.right + TOOLTIP_GAP,
                VIEWPORT_PADDING,
                viewportWidth - tooltipRect.width - VIEWPORT_PADDING
            );
        }

        /*
         * Align the tooltip vertically with its sidebar control.
         */
        let top =
            targetRect.top +
            (targetRect.height / 2) -
            (tooltipRect.height / 2);

        top = clamp(
            top,
            VIEWPORT_PADDING,
            viewportHeight - tooltipRect.height - VIEWPORT_PADDING
        );

        tooltipElement.style.left = `${Math.round(left)}px`;
        tooltipElement.style.top = `${Math.round(top)}px`;
    }

    /**
     * Display a tooltip for a sidebar control.
     */
    function showTooltip(target) {
        if (
            !target ||
            !tooltipElement ||
            !isDesktopViewport() ||
            !isSidebarCollapsed()
        ) {
            hideTooltip();
            return;
        }

        const text = getTooltipText(target);

        if (!text) {
            hideTooltip();
            return;
        }

        activeTarget = target;

        tooltipElement.textContent = text;
        tooltipElement.setAttribute("aria-hidden", "false");

        tooltipElement.classList.add("is-visible");

        /*
         * Make the tooltip measurable before calculating its position.
         */
        positionTooltip(target);
    }

    /**
     * Hide the active tooltip.
     */
    function hideTooltip() {
        if (!tooltipElement) {
            activeTarget = null;
            return;
        }

        tooltipElement.classList.remove("is-visible");

        tooltipElement.setAttribute("aria-hidden", "true");

        activeTarget = null;
    }

    /**
     * Schedule tooltip repositioning without repeatedly forcing layout.
     */
    function scheduleReposition() {
        if (repositionFrame !== null) {
            cancelAnimationFrame(repositionFrame);
        }

        repositionFrame = requestAnimationFrame(() => {
            repositionFrame = null;

            if (
                activeTarget &&
                activeTarget.isConnected &&
                isDesktopViewport() &&
                isSidebarCollapsed()
            ) {
                positionTooltip(activeTarget);
            } else {
                hideTooltip();
            }
        });
    }

    /**
     * Find the sidebar control associated with an event.
     */
    function findTarget(eventTarget) {
        if (!(eventTarget instanceof Element)) {
            return null;
        }

        return eventTarget.closest(TARGET_SELECTORS);
    }

    /**
     * Handle mouse movement into sidebar controls.
     */
    function handlePointerOver(event) {
        const target = findTarget(event.target);

        if (!target) {
            return;
        }

        /*
         * Ignore movement between children of the same control.
         */
        if (
            event.relatedTarget instanceof Node &&
            target.contains(event.relatedTarget)
        ) {
            return;
        }

        showTooltip(target);
    }

    /**
     * Handle mouse movement away from sidebar controls.
     */
    function handlePointerOut(event) {
        const target = findTarget(event.target);

        if (!target) {
            return;
        }

        /*
         * Keep the tooltip visible while moving within the same control.
         */
        if (
            event.relatedTarget instanceof Node &&
            target.contains(event.relatedTarget)
        ) {
            return;
        }

        if (activeTarget === target) {
            hideTooltip();
        }
    }

    /**
     * Display tooltips when keyboard users focus a sidebar control.
     */
    function handleFocusIn(event) {
        const target = findTarget(event.target);

        if (target) {
            showTooltip(target);
        }
    }

    /**
     * Hide tooltips when keyboard focus leaves a sidebar control.
     */
    function handleFocusOut(event) {
        const target = findTarget(event.target);

        if (!target) {
            return;
        }

        if (
            event.relatedTarget instanceof Node &&
            target.contains(event.relatedTarget)
        ) {
            return;
        }

        if (activeTarget === target) {
            hideTooltip();
        }
    }

    /**
     * Hide the tooltip when the sidebar expands or the viewport changes.
     */
    function handleLayoutChange() {
        if (!isDesktopViewport() || !isSidebarCollapsed()) {
            hideTooltip();
            return;
        }

        scheduleReposition();
    }

    /**
     * Initialize the tooltip system.
     */
    function initialize() {
        /*
         * Avoid initializing the same script more than once.
         */
        if (document.documentElement.dataset.focusTooltipsInitialized === "true") {
            return;
        }

        document.documentElement.dataset.focusTooltipsInitialized = "true";

        createTooltip();

        /*
         * Delegated events support sidebar controls that are updated later
         * without requiring the tooltip script to be initialized again.
         */
        document.addEventListener(
            "pointerover",
            handlePointerOver
        );

        document.addEventListener(
            "pointerout",
            handlePointerOut
        );

        document.addEventListener(
            "focusin",
            handleFocusIn
        );

        document.addEventListener(
            "focusout",
            handleFocusOut
        );

        window.addEventListener(
            "resize",
            handleLayoutChange,
            { passive: true }
        );

        window.addEventListener(
            "scroll",
            scheduleReposition,
            { passive: true, capture: true }
        );

        /*
         * Observe sidebar class changes so tooltips disappear immediately
         * when the sidebar expands.
         */
        const layout = document.querySelector(".app-layout");

        if (layout && "MutationObserver" in window) {
            const observer = new MutationObserver(() => {
                handleLayoutChange();
            });

            observer.observe(layout, {
                attributes: true,
                attributeFilter: ["class"]
            });
        }

        /*
         * Keep tooltip positions correct if a sidebar control changes size.
         */
        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver(() => {
                scheduleReposition();
            });

            const sidebar = document.querySelector(".sidebar");

            if (sidebar) {
                resizeObserver.observe(sidebar);
            }
        }

        /*
         * Hide the tooltip when the user switches browser tabs.
         */
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                hideTooltip();
            }
        });

        /*
         * Clean up when leaving the page.
         */
        window.addEventListener("pagehide", () => {
            hideTooltip();

            if (repositionFrame !== null) {
                cancelAnimationFrame(repositionFrame);
                repositionFrame = null;
            }

            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
        });

        console.info(
            "StudyTrack: Focus Timer sidebar tooltips initialized."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }
})();