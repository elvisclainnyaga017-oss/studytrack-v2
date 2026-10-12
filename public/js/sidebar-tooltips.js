/* =========================================================
   STUDYTRACK V2 — GOALS SIDEBAR VISUAL FIXES
   Purpose:
   1. Show floating tooltips when the sidebar is collapsed.
   2. Keep the collapsed StudyTrack branding compact.
   3. Improve typography on the Goals page.
   4. Leave dashboard functionality and backend unchanged.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // Identify this page so the styles affect Goals only.
    document.body.classList.add("goals-document");

    const sidebar = document.querySelector(".sidebar");
    const appLayout = document.querySelector(".app-layout");
    const tooltipTargets = [
        ".nav-link[data-tooltip]",
        ".profile-shortcut[data-tooltip]"
    ].join(",");

    if (!sidebar) {
        console.warn("StudyTrack: Sidebar not found.");
        return;
    }

    /* =====================================================
       GOALS PAGE VISUAL STYLES
       ===================================================== */

    const style = document.createElement("style");

    style.textContent = `
        /* Improve the Goals page typography. */
        body.goals-document {
            font-size: 16px;
        }

        body.goals-document .sidebar {
            overflow-x: hidden;
        }

        body.goals-document .nav-link,
        body.goals-document .profile-shortcut,
        body.goals-document .sidebar-logout {
            font-size: 16px;
        }

        /* Keep the Goals branding compact when collapsed. */
        @media (min-width: 851px) {
            body.goals-document .sidebar.sidebar-collapsed .brand,
            body.goals-document .sidebar-collapsed .sidebar .brand {
                justify-content: center;
                gap: 0;
            }

            body.goals-document .sidebar.sidebar-collapsed .brand-copy,
            body.goals-document .sidebar-collapsed .sidebar .brand-copy,
            body.goals-document .sidebar.sidebar-collapsed .brand-name,
            body.goals-document .sidebar-collapsed .sidebar .brand-name {
                display: none !important;
            }

            body.goals-document .sidebar.sidebar-collapsed .brand-mark,
            body.goals-document .sidebar-collapsed .sidebar .brand-mark {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin: 0 auto;
            }

            body.goals-document .sidebar.sidebar-collapsed .nav-link,
            body.goals-document .sidebar-collapsed .sidebar .nav-link,
            body.goals-document .sidebar.sidebar-collapsed .profile-shortcut,
            body.goals-document .sidebar-collapsed .sidebar .profile-shortcut,
            body.goals-document .sidebar.sidebar-collapsed .sidebar-logout,
            body.goals-document .sidebar-collapsed .sidebar .sidebar-logout {
                justify-content: center;
            }

            body.goals-document .sidebar.sidebar-collapsed .nav-label,
            body.goals-document .sidebar-collapsed .sidebar .nav-label,
            body.goals-document .sidebar.sidebar-collapsed .profile-shortcut-copy,
            body.goals-document .sidebar-collapsed .sidebar .profile-shortcut-copy {
                display: none !important;
            }
        }

        /* Floating tooltips are attached to the document,
           not confined inside the sidebar. */
        .sidebar-floating-tooltip {
            position: fixed;
            z-index: 999999;
            display: none;
            max-width: 220px;
            padding: 9px 13px;
            border-radius: 7px;
            background: #f5f0e6;
            color: #004225;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.4;
            white-space: nowrap;
            overflow-wrap: normal;
            box-shadow: 0 5px 18px rgba(0, 0, 0, 0.22);
            pointer-events: none;
        }

        .sidebar-floating-tooltip.is-visible {
            display: block;
        }

        .sidebar-floating-tooltip::before {
            content: "";
            position: absolute;
            top: 50%;
            left: -5px;
            width: 10px;
            height: 10px;
            background: inherit;
            transform: translateY(-50%) rotate(45deg);
        }

        /* Do not display the custom tooltips on small screens. */
        @media (max-width: 850px) {
            .sidebar-floating-tooltip {
                display: none !important;
            }
        }
    `;

    document.head.appendChild(style);

    /* =====================================================
       CREATE ONE FLOATING TOOLTIP
       ===================================================== */

    const tooltip = document.createElement("div");

    tooltip.className = "sidebar-floating-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");

    document.body.appendChild(tooltip);

    let activeTarget = null;
    let positionFrame = null;

    function isSidebarCollapsed() {
        const desktop = window.matchMedia("(min-width: 851px)").matches;

        if (!desktop) {
            return false;
        }

        return Boolean(
            sidebar.classList.contains("sidebar-collapsed") ||
            (appLayout &&
                appLayout.classList.contains("sidebar-collapsed"))
        );
    }

    function hideTooltip() {
        activeTarget = null;

        tooltip.classList.remove("is-visible");
        tooltip.setAttribute("aria-hidden", "true");
        tooltip.textContent = "";

        if (positionFrame !== null) {
            cancelAnimationFrame(positionFrame);
            positionFrame = null;
        }
    }

    function positionTooltip(target) {
        if (!target || !target.isConnected) {
            hideTooltip();
            return;
        }

        const label = target.getAttribute("data-tooltip");

        if (!label || !isSidebarCollapsed()) {
            hideTooltip();
            return;
        }

        const rect = target.getBoundingClientRect();

        tooltip.textContent = label;
        tooltip.style.display = "block";
        tooltip.classList.add("is-visible");

        const tooltipRect = tooltip.getBoundingClientRect();

        let left = rect.right + 12;
        let top = rect.top + (rect.height - tooltipRect.height) / 2;

        // Keep the tooltip inside the visible browser window.
        const rightLimit = window.innerWidth - tooltipRect.width - 12;
        const bottomLimit = window.innerHeight - tooltipRect.height - 12;

        if (left > rightLimit) {
            left = Math.max(12, rightLimit);
        }

        if (top > bottomLimit) {
            top = bottomLimit;
        }

        if (top < 12) {
            top = 12;
        }

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
        tooltip.setAttribute("aria-hidden", "false");
    }

    function showTooltip(target) {
        if (!target || !target.matches(tooltipTargets)) {
            hideTooltip();
            return;
        }

        if (!isSidebarCollapsed()) {
            hideTooltip();
            return;
        }

        const label = target.getAttribute("data-tooltip");

        if (!label) {
            hideTooltip();
            return;
        }

        activeTarget = target;
        positionTooltip(target);
    }

    function scheduleTooltipPosition() {
        if (!activeTarget || positionFrame !== null) {
            return;
        }

        positionFrame = requestAnimationFrame(function () {
            positionFrame = null;

            if (activeTarget) {
                positionTooltip(activeTarget);
            }
        });
    }

    /* =====================================================
       MOUSE AND KEYBOARD INTERACTIONS
       ===================================================== */

    document.addEventListener("pointerover", function (event) {
        const target = event.target.closest(tooltipTargets);

        if (!target) {
            return;
        }

        // Ignore movement between children of the same link.
        if (event.relatedTarget && target.contains(event.relatedTarget)) {
            return;
        }

        showTooltip(target);
    });

    document.addEventListener("pointerout", function (event) {
        if (!activeTarget) {
            return;
        }

        if (
            event.target === activeTarget ||
            activeTarget.contains(event.target)
        ) {
            if (
                event.relatedTarget &&
                activeTarget.contains(event.relatedTarget)
            ) {
                return;
            }

            hideTooltip();
        }
    });

    document.addEventListener("focusin", function (event) {
        const target = event.target.closest(tooltipTargets);

        if (target) {
            showTooltip(target);
        }
    });

    document.addEventListener("focusout", function (event) {
        if (activeTarget && activeTarget.contains(event.target)) {
            hideTooltip();
        }
    });

    // Reposition the tooltip if the browser window changes.
    window.addEventListener("resize", function () {
        if (!isSidebarCollapsed()) {
            hideTooltip();
            return;
        }

        scheduleTooltipPosition();
    });

    window.addEventListener("scroll", scheduleTooltipPosition, true);

    // Hide tooltips if the sidebar expands or the theme/layout changes.
    const observer = new MutationObserver(function () {
        if (!isSidebarCollapsed()) {
            hideTooltip();
        } else {
            scheduleTooltipPosition();
        }
    });

    observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ["class"]
    });

    if (appLayout) {
        observer.observe(appLayout, {
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    console.log("StudyTrack: Goals sidebar visual fixes initialized.");
});