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


/*
 * Apply the selected theme to the page.
 *
 * The CSS stylesheet uses the data-theme attribute
 * on the HTML element to determine the colour scheme.
 */

function applyTheme(theme, savePreference = true) {
    const selectedTheme =
        theme === "night" ? "night" : "day";

    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );

    /*
     * Update the theme buttons for accessibility.
     */

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

    /*
     * Save the preference so it remains selected
     * after refreshing or reopening the dashboard.
     */

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


/*
 * Read the previously selected theme.
 *
 * Day mode is the default when no valid preference
 * has been saved.
 */

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


/*
 * Connect the Day button.
 */

if (dayThemeButton) {
    dayThemeButton.addEventListener(
        "click",
        () => applyTheme("day")
    );
}


/*
 * Connect the Night button.
 */

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


    /*
     * Display the user's first name in the welcome heading.
     */

    if (dashboardUserName) {
        dashboardUserName.textContent = firstName;
    }


    /*
     * Display the full name in the sidebar.
     */

    if (sidebarUserName) {
        sidebarUserName.textContent = safeName;
    }


    /*
     * Display the full name in the account section.
     */

    if (accountFullName) {
        accountFullName.textContent = safeName;
    }


    /*
     * Display the email address in the account section.
     */

    if (dashboardUserEmail) {
        dashboardUserEmail.textContent =
            email || "Email unavailable";
    }


    /*
     * Use the first letter of the name as the avatar.
     */

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


        /*
         * A 401 response means the browser does not have
         * a valid authenticated session.
         */

        if (response.status === 401) {
            window.location.replace("/");

            return false;
        }


        /*
         * Handle other unsuccessful responses.
         */

        if (!response.ok) {
            throw new Error(
                "Unable to verify your login session."
            );
        }


        const result = await response.json();


        /*
         * Confirm that the API reports an authenticated user.
         */

        if (
            result.success !== true ||
            result.authenticated !== true ||
            !result.user
        ) {
            window.location.replace("/");

            return false;
        }


        /*
         * Display the authenticated user's information.
         */

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

        /*
         * On smaller screens, show or hide the sidebar
         * over the page content.
         */

        appLayout.classList.toggle("sidebar-open");

    } else {

        /*
         * On larger screens, collapse or expand the sidebar.
         */

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


/*
 * Close the mobile sidebar when a navigation link is selected.
 */

if (sidebar) {
    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            if (isMobileLayout()) {
                closeMobileSidebar();
            }
        });
    });
}


/*
 * Close the mobile sidebar when the user clicks the
 * dimmed area outside the sidebar.
 */

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


/*
 * Reset mobile sidebar behaviour when the screen size changes.
 */

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

/*
 * The original tooltips were CSS pseudo-elements attached
 * to sidebar links.
 *
 * Because the sidebar uses overflow-x: hidden, those
 * tooltips can be clipped by the sidebar.
 *
 * This solution creates real HTML tooltip elements and
 * attaches them directly to document.body.
 *
 * Position: fixed keeps them relative to the browser
 * viewport rather than the sidebar.
 *
 * No manual CSS-file changes are required.
 */

function initialiseSidebarTooltips() {
    if (!sidebar || !appLayout) {
        return;
    }

    /*
     * Prevent duplicate initialisation.
     */

    if (document.getElementById("studytrackSidebarTooltip")) {
        return;
    }

    /*
     * Install the tooltip styles dynamically.
     *
     * Also disable the original CSS pseudo-tooltips to
     * prevent two tooltips from appearing simultaneously.
     */

    const tooltipStyles = document.createElement("style");

    tooltipStyles.id = "studytrackSidebarTooltipStyles";

    tooltipStyles.textContent = `
        .nav-link[data-tooltip]::before,
        .nav-link[data-tooltip]::after,
        .profile-shortcut[data-tooltip]::before,
        .profile-shortcut[data-tooltip]::after {
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


    /*
     * Create the tooltip element outside the sidebar.
     */

    const tooltip = document.createElement("div");

    tooltip.id = "studytrackSidebarTooltip";

    tooltip.className = "studytrack-sidebar-tooltip";

    tooltip.setAttribute("role", "tooltip");

    tooltip.setAttribute("aria-hidden", "true");

    document.body.appendChild(tooltip);


    /*
     * Find every sidebar control with a tooltip label.
     */

    const tooltipTriggers = Array.from(
        sidebar.querySelectorAll(
            ".nav-link[data-tooltip], .profile-shortcut[data-tooltip]"
        )
    );


    let activeTrigger = null;

    let hoveredTrigger = null;

    let focusedTrigger = null;


    /*
     * Tooltips are only required when the desktop sidebar
     * is collapsed.
     */

    function shouldDisplayTooltip(trigger) {
        return (
            window.innerWidth > 850 &&
            appLayout.classList.contains("sidebar-collapsed") &&
            trigger &&
            trigger.isConnected &&
            trigger.hasAttribute("data-tooltip")
        );
    }


    /*
     * Calculate a safe position for the tooltip.
     *
     * The tooltip is kept inside the browser viewport,
     * including near the top and bottom edges.
     */

    function positionTooltip(trigger) {
        if (!trigger || !tooltip.classList.contains("is-visible")) {
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

        /*
         * Measure the tooltip before calculating its final
         * position.
         */

        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tooltipRect = tooltip.getBoundingClientRect();

        const maximumLeft =
            window.innerWidth - tooltipRect.width - viewportPadding;

        const preferredLeft =
            triggerRect.right + preferredGap;

        const left = Math.max(
            viewportPadding,
            Math.min(preferredLeft, maximumLeft)
        );

        const preferredTop =
            triggerRect.top + (triggerRect.height / 2) -
            (tooltipRect.height / 2);

        const maximumTop =
            window.innerHeight - tooltipRect.height - viewportPadding;

        const top = Math.max(
            viewportPadding,
            Math.min(preferredTop, maximumTop)
        );

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }


    /*
     * Display a tooltip for the selected navigation control.
     */

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

        activeTrigger = trigger;

        tooltip.textContent = label;

        tooltip.setAttribute("aria-hidden", "false");

        trigger.setAttribute(
            "aria-describedby",
            tooltip.id
        );

        /*
         * Make the tooltip measurable before positioning it.
         */

        tooltip.classList.add("is-visible");

        positionTooltip(trigger);
    }


    /*
     * Hide the current tooltip and clean up its
     * accessibility association.
     */

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


    /*
     * Keep a tooltip visible if its trigger remains hovered
     * or focused.
     */

    function refreshTooltip() {
        const preferredTrigger =
            focusedTrigger || hoveredTrigger;

        if (preferredTrigger && shouldDisplayTooltip(preferredTrigger)) {
            showTooltip(preferredTrigger);
        } else {
            hideTooltip();
        }
    }


    /*
     * Add mouse and keyboard support to each control.
     */

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
            /*
             * Wait until the browser updates focus so moving
             * between child elements does not hide the tooltip.
             */

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

    });


    /*
     * Reposition the tooltip when the page scrolls.
     *
     * The capture option also catches scroll events from
     * scrollable containers.
     */

    window.addEventListener(
        "scroll",
        () => {
            if (activeTrigger) {
                positionTooltip(activeTrigger);
            }
        },
        true
    );


    /*
     * Hide or reposition tooltips when the viewport changes.
     */

    window.addEventListener("resize", () => {
        if (activeTrigger) {
            if (shouldDisplayTooltip(activeTrigger)) {
                positionTooltip(activeTrigger);
            } else {
                hoveredTrigger = null;
                focusedTrigger = null;

                hideTooltip();
            }
        }
    });


    /*
     * Watch the sidebar layout state.
     *
     * When the sidebar expands, or the mobile layout opens,
     * any existing tooltip is hidden.
     */

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


    /*
     * Remove a tooltip when the user clicks a navigation
     * control. This avoids leaving it visible during a page
     * transition or mobile navigation.
     */

    tooltipTriggers.forEach((trigger) => {
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

}


/* =========================================================
   9. LOGOUT
   ========================================================= */

async function logoutUser() {
    if (!logoutButton) {
        return;
    }

    const originalText = logoutButton.textContent;

    logoutButton.disabled = true;

    logoutButton.textContent = "Logging out...";

    clearDashboardMessage();

    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",

            credentials: "same-origin",

            headers: {
                Accept: "application/json"
            }
        });


        /*
         * The server's logout endpoint should invalidate
         * the session and clear its cookie.
         */

        if (!response.ok) {
            throw new Error(
                "The server could not complete logout."
            );
        }


        /*
         * Return to the login page after logout.
         */

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

        logoutButton.textContent = originalText;
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

    /*
     * Apply the saved theme before displaying dashboard data.
     */

    initialiseTheme();


    /*
     * Display today's date.
     */

    displayCurrentDate();


    /*
     * Set the initial sidebar state.
     */

    updateMenuButton();


    /*
     * Initialise the new sidebar tooltip system.
     */

    initialiseSidebarTooltips();


    /*
     * Verify the session and load the user.
     */

    await loadAuthenticatedUser();
}


/* =========================================================
   11. START THE DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialiseDashboard
);

