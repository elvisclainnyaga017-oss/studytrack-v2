/* =========================================================
   STUDYTRACK V2
   DASHBOARD JAVASCRIPT
   ========================================================= */


/* =========================================================
   1. SELECT HTML ELEMENTS
   ========================================================= */

const appLayout = document.querySelector(".app-layout");

const sidebar = document.getElementById("sidebar");

const menuButton = document.getElementById("menuButton");

const logoutButton = document.getElementById("logoutButton");

const dayThemeButton =
    document.getElementById("dayThemeButton");

const nightThemeButton =
    document.getElementById("nightThemeButton");

const dashboardUserName =
    document.getElementById("dashboardUserName");

const sidebarUserName =
    document.getElementById("sidebarUserName");

const sidebarAvatar =
    document.getElementById("sidebarAvatar");

const accountFullName =
    document.getElementById("accountFullName");

const dashboardUserEmail =
    document.getElementById("dashboardUserEmail");

const currentDate =
    document.getElementById("currentDate");

const dashboardMessage =
    document.getElementById("dashboardMessage");


/* =========================================================
   2. DISPLAY STATUS MESSAGES
   ========================================================= */

function showDashboardMessage(message, type = "error") {
    if (!dashboardMessage) {
        return;
    }

    dashboardMessage.textContent = message;

    dashboardMessage.classList.remove(
        "is-error",
        "is-success"
    );

    dashboardMessage.classList.add(
        type === "success" ? "is-success" : "is-error"
    );

    dashboardMessage.hidden = false;
}


function clearDashboardMessage() {
    if (!dashboardMessage) {
        return;
    }

    dashboardMessage.textContent = "";

    dashboardMessage.classList.remove(
        "is-error",
        "is-success"
    );

    dashboardMessage.hidden = true;
}


/* =========================================================
   3. DAY AND NIGHT THEME
   ========================================================= */

const THEME_STORAGE_KEY = "studytrack-v2-theme";


function applyTheme(theme, savePreference = true) {
    const selectedTheme =
        theme === "night" ? "night" : "day";

    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );

    if (dayThemeButton) {
        const dayIsActive = selectedTheme === "day";

        dayThemeButton.classList.toggle(
            "is-active",
            dayIsActive
        );

        dayThemeButton.setAttribute(
            "aria-pressed",
            String(dayIsActive)
        );
    }

    if (nightThemeButton) {
        const nightIsActive = selectedTheme === "night";

        nightThemeButton.classList.toggle(
            "is-active",
            nightIsActive
        );

        nightThemeButton.setAttribute(
            "aria-pressed",
            String(nightIsActive)
        );
    }

    if (savePreference) {
        try {
            localStorage.setItem(
                THEME_STORAGE_KEY,
                selectedTheme
            );
        } catch (error) {
            console.warn(
                "StudyTrack could not save the theme preference:",
                error
            );
        }
    }
}


function initialiseTheme() {
    let savedTheme = "day";

    try {
        const storedTheme = localStorage.getItem(
            THEME_STORAGE_KEY
        );

        if (
            storedTheme === "day" ||
            storedTheme === "night"
        ) {
            savedTheme = storedTheme;
        }
    } catch (error) {
        console.warn(
            "StudyTrack could not read the saved theme:",
            error
        );
    }

    applyTheme(savedTheme, false);
}


if (dayThemeButton) {
    dayThemeButton.addEventListener(
        "click",
        () => applyTheme("day")
    );
}


if (nightThemeButton) {
    nightThemeButton.addEventListener(
        "click",
        () => applyTheme("night")
    );
}


/* =========================================================
   4. FORMAT THE CURRENT DATE
   ========================================================= */

function displayCurrentDate() {
    if (!currentDate) {
        return;
    }

    const today = new Date();

    currentDate.textContent = today.toLocaleDateString(
        "en-GB",
        {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   5. DISPLAY USER INFORMATION
   ========================================================= */

function displayUserInformation(user) {
    if (!user) {
        return;
    }

    const fullName =
        typeof user.fullName === "string"
            ? user.fullName.trim()
            : "";

    const email =
        typeof user.email === "string"
            ? user.email.trim()
            : "";

    const safeName = fullName || "Student";

    const firstName =
        safeName.split(/\s+/)[0] || "Student";


    if (dashboardUserName) {
        dashboardUserName.textContent = firstName;
    }


    if (sidebarUserName) {
        sidebarUserName.textContent = safeName;
    }


    if (accountFullName) {
        accountFullName.textContent = safeName;
    }


    if (dashboardUserEmail) {
        dashboardUserEmail.textContent =
            email || "Email unavailable";
    }


    if (sidebarAvatar) {
        sidebarAvatar.textContent =
            firstName.charAt(0).toUpperCase() || "S";

        sidebarAvatar.setAttribute(
            "aria-label",
            `${ safeName } 's profile`
        );
    }
}


/* =========================================================
   6. CHECK THE LOGIN SESSION
   ========================================================= */

async function loadAuthenticatedUser() {
    clearDashboardMessage();

    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });


        if (response.status === 401) {
            window.location.replace("/");
            return false;
        }


        if (!response.ok) {
            throw new Error(
                "Unable to verify your login session."
            );
        }


        const result = await response.json();


        if (
            result.success !== true ||
            result.authenticated !== true ||
            !result.user
        ) {
            window.location.replace("/");
            return false;
        }


        displayUserInformation(result.user);

        return true;

    } catch (error) {
        console.error(
            "Dashboard authentication error:",
            error
        );

        showDashboardMessage(
            "We couldn't verify your session. Check your connection and refresh the page."
        );

        return false;
    }
}


/* =========================================================
   7. SIDEBAR RESPONSIVE BEHAVIOUR
   ========================================================= */

function isMobileLayout() {
    return window.matchMedia(
        "(max-width: 850px)"
    ).matches;
}


function updateMenuButton() {
    if (!menuButton || !appLayout) {
        return;
    }

    const isOpen = isMobileLayout()
        ? appLayout.classList.contains("sidebar-open")
        : !appLayout.classList.contains("sidebar-collapsed");

    menuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
    );
}


function closeMobileSidebar() {
    if (!appLayout) {
        return;
    }

    appLayout.classList.remove("sidebar-open");

    updateMenuButton();
}


function toggleSidebar() {
    if (!appLayout) {
        return;
    }

    if (isMobileLayout()) {
        appLayout.classList.toggle("sidebar-open");
    } else {
        appLayout.classList.toggle("sidebar-collapsed");
    }

    updateMenuButton();
}


if (menuButton) {
    menuButton.addEventListener(
        "click",
        toggleSidebar
    );
}


if (sidebar) {
    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            if (isMobileLayout()) {
                closeMobileSidebar();
            }
        });
    });
}


if (appLayout) {
    appLayout.addEventListener("click", (event) => {
        if (
            event.target === appLayout &&
            appLayout.classList.contains("sidebar-open")
        ) {
            closeMobileSidebar();
        }
    });
}


window.addEventListener("resize", () => {
    if (!appLayout) {
        return;
    }

    if (isMobileLayout()) {
        appLayout.classList.remove("sidebar-collapsed");
    } else {
        appLayout.classList.remove("sidebar-open");
    }

    updateMenuButton();
});


/* =========================================================
   8. SIDEBAR TOOLTIPS
   ========================================================= */

function initialiseSidebarTooltips() {
    if (!sidebar || !appLayout) {
        return;
    }

    if (document.getElementById("studytrackSidebarTooltip")) {
        return;
    }


    const tooltipStyles = document.createElement("style");

    tooltipStyles.id = "studytrackSidebarTooltipStyles";

    tooltipStyles.textContent = `
        .nav-link[data-tooltip]::before,
        .nav-link[data-tooltip]::after,
        .profile-shortcut[data-tooltip]::before,
        .profile-shortcut[data-tooltip]::after,
        .sidebar-logout[data-tooltip]::before,
        .sidebar-logout[data-tooltip]::after {
            content: none !important;
            display: none !important;
        }

        .studytrack-sidebar-tooltip {
            position: fixed;
            z-index: 99999;
            display: block;
            width: max-content;
            max-width: min(280px, calc(100vw - 24px));
            padding: 10px 14px;
            background: #F4FEF3;
            color: #004225;
            border: 1px solid #C8D9CA;
            border-radius: 9px;
            box-shadow: 0 6px 20px rgba(0, 30, 17, 0.18);
            font-family: inherit;
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

        .studytrack-sidebar-tooltip.is-visible {
            opacity: 1;
            visibility: visible;
            transform: translateX(0);
        }

        .studytrack-sidebar-tooltip::before {
            content: "";
            position: absolute;
            top: 50%;
            left: -6px;
            width: 10px;
            height: 10px;
            background: #F4FEF3;
            border-left: 1px solid #C8D9CA;
            border-bottom: 1px solid #C8D9CA;
            transform: translateY(-50%) rotate(45deg);
        }

        @media (prefers-reduced-motion: reduce) {
            .studytrack-sidebar-tooltip {
                transition: none;
            }
        }
    `;

    document.head.appendChild(tooltipStyles);


    const tooltip = document.createElement("div");

    tooltip.id = "studytrackSidebarTooltip";
    tooltip.className = "studytrack-sidebar-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");

    document.body.appendChild(tooltip);


    const tooltipTriggers = Array.from(
        sidebar.querySelectorAll(
            ".nav-link[data-tooltip], " +
            ".profile-shortcut[data-tooltip], " +
            ".sidebar-logout[data-tooltip]"
        )
    );


    let activeTrigger = null;
    let hoveredTrigger = null;
    let focusedTrigger = null;


    function shouldDisplayTooltip(trigger) {
        return (
            window.innerWidth > 850 &&
            appLayout.classList.contains("sidebar-collapsed") &&
            trigger &&
            trigger.isConnected &&
            trigger.hasAttribute("data-tooltip")
        );
    }


    function positionTooltip(trigger) {
        if (
            !trigger ||
            !tooltip.classList.contains("is-visible")
        ) {
            return;
        }

        if (!shouldDisplayTooltip(trigger)) {
            hideTooltip();
            return;
        }

        const label = trigger.getAttribute("data-tooltip");

        if (!label || !label.trim()) {
            hideTooltip();
            return;
        }

        const triggerRect = trigger.getBoundingClientRect();
        const viewportPadding = 12;
        const preferredGap = 14;

        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tooltipRect = tooltip.getBoundingClientRect();

        const maximumLeft = Math.max(
            viewportPadding,
            window.innerWidth - tooltipRect.width - viewportPadding
        );

        const preferredLeft = triggerRect.right + preferredGap;

        const left = Math.max(
            viewportPadding,
            Math.min(preferredLeft, maximumLeft)
        );

        const preferredTop =
            triggerRect.top +
            (triggerRect.height / 2) -
            (tooltipRect.height / 2);

        const maximumTop = Math.max(
            viewportPadding,
            window.innerHeight - tooltipRect.height - viewportPadding
        );

        const top = Math.max(
            viewportPadding,
            Math.min(preferredTop, maximumTop)
        );

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }


    function showTooltip(trigger) {
        if (!shouldDisplayTooltip(trigger)) {
            hideTooltip();
            return;
        }

        const label = trigger.getAttribute("data-tooltip");

        if (!label || !label.trim()) {
            hideTooltip();
            return;
        }

        if (
            activeTrigger &&
            activeTrigger !== trigger &&
            activeTrigger.getAttribute("aria-describedby") === tooltip.id
        ) {
            activeTrigger.removeAttribute("aria-describedby");
        }

        activeTrigger = trigger;

        tooltip.textContent = label.trim();
        tooltip.setAttribute("aria-hidden", "false");

        trigger.setAttribute(
            "aria-describedby",
            tooltip.id
        );

        tooltip.classList.add("is-visible");

        positionTooltip(trigger);
    }


    function hideTooltip() {
        if (activeTrigger) {
            if (
                activeTrigger.getAttribute("aria-describedby") ===
                tooltip.id
            ) {
                activeTrigger.removeAttribute("aria-describedby");
            }
        }

        activeTrigger = null;

        tooltip.classList.remove("is-visible");
        tooltip.setAttribute("aria-hidden", "true");
    }


    function refreshTooltip() {
        const preferredTrigger =
            focusedTrigger || hoveredTrigger;

        if (
            preferredTrigger &&
            shouldDisplayTooltip(preferredTrigger)
        ) {
            showTooltip(preferredTrigger);
        } else {
            hideTooltip();
        }
    }


    tooltipTriggers.forEach((trigger) => {
        trigger.addEventListener("mouseenter", () => {
            hoveredTrigger = trigger;
            refreshTooltip();
        });

        trigger.addEventListener("mouseleave", () => {
            if (hoveredTrigger === trigger) {
                hoveredTrigger = null;
            }

            refreshTooltip();
        });

        trigger.addEventListener("focusin", () => {
            focusedTrigger = trigger;
            refreshTooltip();
        });

        trigger.addEventListener("focusout", () => {
            window.setTimeout(() => {
                if (
                    focusedTrigger === trigger &&
                    !trigger.contains(document.activeElement)
                ) {
                    focusedTrigger = null;
                }

                refreshTooltip();
            }, 0);
        });

        trigger.addEventListener("click", () => {
            if (hoveredTrigger === trigger) {
                hoveredTrigger = null;
            }

            if (focusedTrigger === trigger) {
                focusedTrigger = null;
            }

            hideTooltip();
        });
    });


    window.addEventListener(
        "scroll",
        () => {
            if (activeTrigger) {
                positionTooltip(activeTrigger);
            }
        },
        true
    );


    window.addEventListener("resize", () => {
        if (!activeTrigger) {
            return;
        }

        if (shouldDisplayTooltip(activeTrigger)) {
            positionTooltip(activeTrigger);
        } else {
            hoveredTrigger = null;
            focusedTrigger = null;
            hideTooltip();
        }
    });


    const sidebarStateObserver = new MutationObserver(() => {
        if (
            activeTrigger &&
            !shouldDisplayTooltip(activeTrigger)
        ) {
            hoveredTrigger = null;
            focusedTrigger = null;
            hideTooltip();
        }
    });

    sidebarStateObserver.observe(appLayout, {
        attributes: true,
        attributeFilter: ["class"]
    });
}


/* =========================================================
   9. LOGOUT
   ========================================================= */

async function logoutUser() {
    if (!logoutButton || logoutButton.disabled) {
        return;
    }

    const logoutLabel = logoutButton.querySelector(
        ".sidebar-logout-text"
    );

    const originalLabel = logoutLabel
        ? logoutLabel.textContent
        : logoutButton.textContent;

    logoutButton.disabled = true;

    /*
     * Change only the label so the logout icon remains visible.
     */

    if (logoutLabel) {
        logoutLabel.textContent = "Logging out...";
    } else {
        logoutButton.textContent = "Logging out...";
    }

    clearDashboardMessage();

    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });


        if (!response.ok) {
            throw new Error(
                "The server could not complete logout."
            );
        }


        window.location.replace("/");

    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        showDashboardMessage(
            "Logout failed. Please check your connection and try again."
        );

        logoutButton.disabled = false;

        if (logoutLabel) {
            logoutLabel.textContent = originalLabel;
        } else {
            logoutButton.textContent = originalLabel;
        }
    }
}


if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        logoutUser
    );
}


/* =========================================================
   10. INITIALISE THE DASHBOARD
   ========================================================= */

async function initialiseDashboard() {
    initialiseTheme();

    displayCurrentDate();

    updateMenuButton();

    initialiseSidebarTooltips();

    await loadAuthenticatedUser();
}


/* =========================================================
   11. START THE DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialiseDashboard
);

