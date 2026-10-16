/*
==================================================
STUDYTRACK V2
HABITS PAGE — FRONTEND JAVASCRIPT
==================================================

File:
public/js/habits.js

Shared application conventions:
- Theme storage: studytrack-v2-theme
- Authentication: /api/auth/me
- Logout: /api/auth/logout
- Unauthenticated redirect: /
- Sidebar: .app-layout.sidebar-collapsed
- Mobile sidebar: .app-layout.sidebar-open

Habit API:
GET    /api/habits
POST   /api/habits
GET    /api/habits/:id
PUT    /api/habits/:id
DELETE /api/habits/:id
GET    /api/habits/:id/records
PUT    /api/habits/:id/records/:date
DELETE /api/habits/:id/records/:date
==================================================
*/

"use strict";


// ==================================================
// 1. APPLICATION STATE
// ==================================================

let habits = [];
let editingHabitId = null;
let activeHistoryHabit = null;
let confirmAction = null;
let isSavingHabit = false;
let isLoadingHabits = false;


// ==================================================
// 2. SHARED APPLICATION CONSTANTS
// ==================================================

const THEME_STORAGE_KEY = "studytrack-v2-theme";
const SIDEBAR_STORAGE_KEY = "studytrack-sidebar-collapsed";
const MOBILE_BREAKPOINT = 850;


// ==================================================
// 3. HTML ELEMENT REFERENCES
// ==================================================

const elements = {
    // Shared layout
    appLayout: document.querySelector(".app-layout"),
    sidebar: document.getElementById("sidebar"),
    menuButton: document.getElementById("menuButton"),

    // Profile
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarAvatar: document.getElementById("sidebarAvatar"),

    // Header
    currentDate: document.getElementById("currentDate"),
    dayThemeButton: document.getElementById("dayThemeButton"),
    nightThemeButton: document.getElementById("nightThemeButton"),
    logoutButton: document.getElementById("logoutButton"),

    // Page feedback
    habitsMessage: document.getElementById("habitsMessage"),

    // Statistics
    activeHabitsCount: document.getElementById("activeHabitsCount"),
    completedTodayCount: document.getElementById("completedTodayCount"),
    todayProgressPercent: document.getElementById("todayProgressPercent"),
    todayProgressBar: document.getElementById("todayProgressBar"),
    todayProgressFill: document.getElementById("todayProgressFill"),
    todayDateBadge: document.getElementById("todayDateBadge"),

    // Active habits
    habitList: document.getElementById("habitList"),
    emptyHabitsState: document.getElementById("emptyHabitsState"),

    // Archived habits
    archivedHabitList: document.getElementById("archivedHabitList"),
    emptyArchivedState: document.getElementById("emptyArchivedState"),
    toggleArchivedButton: document.getElementById("toggleArchivedButton"),
    archivedHabitsContainer: document.getElementById(
        "archivedHabitsContainer"
    ),

    // Create habit
    openCreateHabitButton: document.getElementById(
        "openCreateHabitButton"
    ),
    emptyCreateHabitButton: document.getElementById(
        "emptyCreateHabitButton"
    ),

    // Create/edit modal
    habitModal: document.getElementById("habitModal"),
    habitModalTitle: document.getElementById("habitModalTitle"),
    habitForm: document.getElementById("habitForm"),
    habitTitle: document.getElementById("habitTitle"),
    habitDescription: document.getElementById("habitDescription"),
    habitFrequency: document.getElementById("habitFrequency"),
    habitStartDate: document.getElementById("habitStartDate"),
    habitStatusField: document.getElementById("habitStatusField"),
    habitStatus: document.getElementById("habitStatus"),
    habitFormError: document.getElementById("habitFormError"),
    saveHabitButton: document.getElementById("saveHabitButton"),
    closeHabitModalButton: document.getElementById(
        "closeHabitModalButton"
    ),
    cancelHabitButton: document.getElementById("cancelHabitButton"),

    // History modal
    historyModal: document.getElementById("historyModal"),
    historyModalTitle: document.getElementById("historyModalTitle"),
    historyHabitDescription: document.getElementById(
        "historyHabitDescription"
    ),
    historySummary: document.getElementById("historySummary"),
    historyCalendar: document.getElementById("historyCalendar"),
    closeHistoryModalButton: document.getElementById(
        "closeHistoryModalButton"
    ),

    // Confirmation modal
    confirmModal: document.getElementById("confirmModal"),
    confirmModalTitle: document.getElementById("confirmModalTitle"),
    confirmModalDescription: document.getElementById(
        "confirmModalDescription"
    ),
    cancelConfirmButton: document.getElementById("cancelConfirmButton"),
    acceptConfirmButton: document.getElementById("acceptConfirmButton")
};


// ==================================================
// 4. DATE HELPERS
// ==================================================

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    // Correct format: YYYY-MM-DD
    return `${year}-${month}-${day}`;
}


function isValidDateString(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}


function formatDate(dateString, options = {}) {
    if (!dateString) {
        return "Not set";
    }

    const cleanDate = String(dateString).slice(0, 10);

    if (!isValidDateString(cleanDate)) {
        return cleanDate;
    }

    const [year, month, day] = cleanDate.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...options
    });
}


function getWeekdayName(dateString) {
    const cleanDate = String(dateString || "").slice(0, 10);

    if (!isValidDateString(cleanDate)) {
        return "";
    }

    const [year, month, day] = cleanDate.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-GB", {
        weekday: "long"
    });
}


function updateHeaderDate() {
    if (elements.currentDate) {
        elements.currentDate.textContent =
            new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            });
    }

    setElementText(
        elements.todayDateBadge,
        formatDate(getLocalDateString())
    );
}


// ==================================================
// 5. GENERAL HELPERS
// ==================================================

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );
}


function setElementText(element, value) {
    if (element) {
        element.textContent = String(value ?? "");
    }
}


function getHabitId(habit) {
    return Number(habit.id);
}


function getHabitStartDate(habit) {
    return String(
        habit.startDate ??
        habit.start_date ??
        ""
    ).slice(0, 10);
}


function getHabitStatus(habit) {
    return String(habit.status || "active").toLowerCase();
}


function isHabitCompletedToday(habit) {
    const value = habit.completed_today;

    return (
        value === true ||
        value === 1 ||
        value === "1"
    );
}


function showMessage(message, type = "success") {
    if (!elements.habitsMessage) {
        return;
    }

    elements.habitsMessage.textContent = message;

    // Correct class name: habits-message
    elements.habitsMessage.className =
        `habits-message ${type}`;

    elements.habitsMessage.hidden = false;

    window.clearTimeout(showMessage.timeoutId);

    showMessage.timeoutId = window.setTimeout(() => {
        hideMessage();
    }, 5000);
}


function hideMessage() {
    if (elements.habitsMessage) {
        elements.habitsMessage.hidden = true;
    }
}


function showFormError(message) {
    if (!elements.habitFormError) {
        return;
    }

    elements.habitFormError.textContent = message;
    elements.habitFormError.hidden = false;
}


function clearFormError() {
    if (!elements.habitFormError) {
        return;
    }

    elements.habitFormError.textContent = "";
    elements.habitFormError.hidden = true;
}


function setButtonLoading(button, loading, loadingText = "Saving...") {
    if (!button) {
        return;
    }

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.textContent = loadingText;
        button.disabled = true;

        return;
    }

    button.textContent =
        button.dataset.originalText || "Save habit";

    button.disabled = false;

    delete button.dataset.originalText;
}


// ==================================================
// 6. API REQUEST HELPER
// ==================================================

async function apiRequest(url, options = {}) {
    const headers = {
        Accept: "application/json",
        ...(options.body ? {
            "Content-Type": "application/json"
        } : {}),
        ...(options.headers || {})
    };

    let response;

    try {
        response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers
        });
    } catch (error) {
        console.error("Network request failed:", error);

        throw new Error(
            "Unable to connect to StudyTrack. Check that the server is running."
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch {
        // Some successful responses may not contain JSON.
    }

    if (response.status === 401) {
        window.location.href = "/";

        throw new Error(
            "Your session has expired. Please log in again."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}


// ==================================================
// 7. NORMALISE HABIT DATA
// ==================================================

function normaliseHabit(habit) {
    return {
        ...habit,

        id: Number(habit.id),

        title: String(habit.title || ""),

        description: String(habit.description || ""),

        frequency: String(habit.frequency || "daily"),

        startDate: getHabitStartDate(habit),

        status: getHabitStatus(habit),

        completed_today: isHabitCompletedToday(habit)
    };
}


// ==================================================
// 8. AUTHENTICATION AND PROFILE
// ==================================================

async function loadCurrentUser() {
    try {
        const data = await apiRequest("/api/auth/me");

        if (
            data.success !== true ||
            data.authenticated !== true ||
            !data.user
        ) {
            return false;
        }

        const user = data.user;

        const name = String(
            user.fullName ||
            user.name ||
            user.full_name ||
            user.username ||
            "Student"
        );

        setElementText(elements.sidebarUserName, name);

        if (elements.sidebarAvatar) {
            elements.sidebarAvatar.textContent =
                name.trim().charAt(0).toUpperCase() || "S";
        }

        return true;

    } catch (error) {
        console.error(
            "Could not load sidebar profile information:",
            error.message
        );

        return false;
    }
}


// ==================================================
// 9. DAY / NIGHT THEME
// ==================================================

function applyTheme(theme, savePreference = true) {
    const selectedTheme =
        theme === "night" ? "night" : "day";

    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );

    if (savePreference) {
        try {
            localStorage.setItem(
                THEME_STORAGE_KEY,
                selectedTheme
            );
        } catch (error) {
            console.warn(
                "Unable to save theme preference.",
                error
            );
        }
    }

    if (elements.dayThemeButton) {
        const isDay = selectedTheme === "day";

        elements.dayThemeButton.setAttribute(
            "aria-pressed",
            String(isDay)
        );

        elements.dayThemeButton.classList.toggle(
            "is-active",
            isDay
        );
    }

    if (elements.nightThemeButton) {
        const isNight = selectedTheme === "night";

        elements.nightThemeButton.setAttribute(
            "aria-pressed",
            String(isNight)
        );

        elements.nightThemeButton.classList.toggle(
            "is-active",
            isNight
        );
    }
}


function initialiseTheme() {
    let savedTheme = "day";

    try {
        savedTheme =
            localStorage.getItem(THEME_STORAGE_KEY) || "day";
    } catch (error) {
        console.warn(
            "Unable to read theme preference.",
            error
        );
    }

    applyTheme(savedTheme, false);
}


// ==================================================
// 10. SIDEBAR
// ==================================================

function applySidebarState(collapsed) {
    if (!elements.appLayout) {
        return;
    }

    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (isMobile) {
        // Match Dashboard and Goals mobile navigation.
        elements.appLayout.classList.toggle(
            "sidebar-open",
            Boolean(collapsed)
        );

        elements.appLayout.classList.remove(
            "sidebar-collapsed"
        );
    } else {
        elements.appLayout.classList.toggle(
            "sidebar-collapsed",
            Boolean(collapsed)
        );

        elements.appLayout.classList.remove(
            "sidebar-open"
        );
    }

    if (elements.menuButton) {
        elements.menuButton.setAttribute(
            "aria-expanded",
            String(
                isMobile
                    ? Boolean(collapsed)
                    : !collapsed
            )
        );
    }

    try {
        localStorage.setItem(
            SIDEBAR_STORAGE_KEY,
            String(Boolean(collapsed))
        );
    } catch (error) {
        console.warn(
            "Unable to save sidebar preference.",
            error
        );
    }
}


function initialiseSidebar() {
    let collapsed = false;

    try {
        collapsed =
            localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch (error) {
        console.warn(
            "Unable to read sidebar preference.",
            error
        );
    }

    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        // Always start with the mobile sidebar closed.
        applySidebarState(false);
    } else {
        applySidebarState(collapsed);
    }
}


function handleSidebarResize() {
    if (!elements.appLayout) {
        return;
    }

    if (window.innerWidth > MOBILE_BREAKPOINT) {
        elements.appLayout.classList.remove("sidebar-open");

        let collapsed = false;

        try {
            collapsed =
                localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
        } catch {
            // Use the default expanded state.
        }

        elements.appLayout.classList.toggle(
            "sidebar-collapsed",
            collapsed
        );

        if (elements.menuButton) {
            elements.menuButton.setAttribute(
                "aria-expanded",
                String(!collapsed)
            );
        }

    } else {
        elements.appLayout.classList.remove(
            "sidebar-collapsed"
        );

        elements.appLayout.classList.remove("sidebar-open");

        if (elements.menuButton) {
            elements.menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }
}


function closeMobileSidebar() {
    if (
        window.innerWidth <= MOBILE_BREAKPOINT &&
        elements.appLayout
    ) {
        elements.appLayout.classList.remove("sidebar-open");

        if (elements.menuButton) {
            elements.menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }
}


// ==================================================
// 11. LOAD HABITS
// ==================================================

async function loadHabits(showLoading = true) {
    if (isLoadingHabits) {
        return habits;
    }

    isLoadingHabits = true;

    if (showLoading && elements.habitList) {
        elements.habitList.hidden = false;

        elements.habitList.innerHTML = `
            <div class="habit-loading">
                <span
                    class="loading-spinner"
                    aria-hidden="true"
                ></span>

                <p>Loading your habits...</p>
            </div>
        `;
    }

    try {
        const data = await apiRequest("/api/habits");

        const returnedHabits = Array.isArray(data)
            ? data
            : Array.isArray(data.habits)
                ? data.habits
                : Array.isArray(data.data)
                    ? data.data
                    : [];

        habits = returnedHabits.map(normaliseHabit);

        renderHabits();
        updateStatistics();

        return habits;

    } catch (error) {
        console.error("Could not load habits:", error);

        if (elements.habitList) {
            elements.habitList.hidden = false;

            elements.habitList.innerHTML = `
                <div class="habit-loading">
                    <p>We couldn't load your habits.</p>

                    <button
                        class="secondary-button"
                        type="button"
                        data-action="retry-load"
                    >
                        Try again
                    </button>
                </div>
            `;
        }

        showMessage(error.message, "error");

        throw error;

    } finally {
        isLoadingHabits = false;
    }
}


// ==================================================
// 12. HABIT FREQUENCY HELPERS
// ==================================================

function getFrequencyLabel(frequency) {
    const labels = {
        daily: "Every day",
        weekdays: "Weekdays",
        weekly: "Weekly"
    };

    return labels[frequency] || frequency;
}


function shouldHabitAppearToday(habit) {
    if (getHabitStatus(habit) !== "active") {
        return false;
    }

    const today = getLocalDateString();
    const startDate = getHabitStartDate(habit);

    if (startDate && today < startDate) {
        return false;
    }

    if (habit.frequency === "weekdays") {
        const weekday = new Date().getDay();

        return weekday >= 1 && weekday <= 5;
    }

    // Weekly habits have no designated weekday in the current model.
    return true;
}


// ==================================================
// 13. RENDER ACTIVE HABITS
// ==================================================

function renderHabits() {
    if (!elements.habitList) {
        return;
    }

    const todayHabits = habits.filter(shouldHabitAppearToday);

    const archivedHabits = habits.filter(
        habit => getHabitStatus(habit) === "archived"
    );

    elements.habitList.innerHTML = "";

    if (todayHabits.length === 0) {
        if (elements.emptyHabitsState) {
            elements.emptyHabitsState.hidden = false;
        }

        elements.habitList.hidden = true;

    } else {
        if (elements.emptyHabitsState) {
            elements.emptyHabitsState.hidden = true;
        }

        elements.habitList.hidden = false;

        todayHabits.forEach(habit => {
            elements.habitList.appendChild(
                createHabitCard(habit, false)
            );
        });
    }

    renderArchivedHabits(archivedHabits);
}


// ==================================================
// 14. CREATE HABIT CARD
// ==================================================

function createHabitCard(habit, archived = false) {
    const card = document.createElement("article");

    card.className = archived
        ? "habit-card archived-habit-card"
        : "habit-card";

    card.dataset.habitId = String(habit.id);

    const completed = isHabitCompletedToday(habit);

    const title = escapeHTML(habit.title);

    const description = escapeHTML(
        habit.description ||
        "Keep building your routine one step at a time."
    );

    const frequency = escapeHTML(
        getFrequencyLabel(habit.frequency)
    );

    const startDate = escapeHTML(
        formatDate(getHabitStartDate(habit))
    );

    if (archived) {
        card.innerHTML = `
            <div class="habit-card-main">
                <div class="habit-card-content">
                    <h3 class="habit-title">${title}</h3>

                    <p class="habit-description">${description}</p>

                    <div class="habit-meta">
                        <span class="frequency-badge">${frequency}</span>

                        <span>Started ${startDate}</span>

                        <span class="status-badge archived-badge">
                            Archived
                        </span>
                    </div>
                </div>

                <div class="habit-actions">
                    <button
                        class="secondary-button"
                        type="button"
                        data-action="restore"
                        data-id="${habit.id}"
                    >
                        Restore
                    </button>

                    <button
                        class="icon-button"
                        type="button"
                        data-action="edit"
                        data-id="${habit.id}"
                        aria-label="Edit ${title}"
                        title="Edit habit"
                    >
                        Edit
                    </button>

                    <button
                        class="danger-button"
                        type="button"
                        data-action="delete"
                        data-id="${habit.id}"
                        aria-label="Delete ${title}"
                    >
                        Delete
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    card.innerHTML = `
        <div class="habit-card-main">

            <button
                class="habit-complete-button ${completed ? "completed" : ""}"
                type="button"
                data-action="toggle-completion"
                data-id="${habit.id}"
                aria-label="${completed ? "Undo completion of" : "Mark complete"} ${title}"
                aria-pressed="${completed}"
                title="${completed ? "Undo completion" : "Mark as complete"}"
            >
                <span aria-hidden="true">
                    ${completed ? "✓" : ""}
                </span>
            </button>

            <div class="habit-card-content">

                <h3 class="habit-title ${completed ? "completed-title" : ""}">
                    ${title}
                </h3>

                <p class="habit-description">${description}</p>

                <div class="habit-meta">
                    <span class="frequency-badge">${frequency}</span>
                    <span>Started ${startDate}</span>
                </div>

            </div>

            <div class="habit-actions">

                <button
                    class="secondary-button"
                    type="button"
                    data-action="history"
                    data-id="${habit.id}"
                >
                    History
                </button>

                <button
                    class="icon-button"
                    type="button"
                    data-action="edit"
                    data-id="${habit.id}"
                    aria-label="Edit ${title}"
                    title="Edit habit"
                >
                    Edit
                </button>

                <button
                    class="icon-button"
                    type="button"
                    data-action="archive"
                    data-id="${habit.id}"
                    aria-label="Archive ${title}"
                    title="Archive habit"
                >
                    Archive
                </button>

                <button
                    class="danger-button"
                    type="button"
                    data-action="delete"
                    data-id="${habit.id}"
                    aria-label="Delete ${title}"
                >
                    Delete
                </button>

            </div>

        </div>
    `;

    return card;
}


// ==================================================
// 15. RENDER ARCHIVED HABITS
// ==================================================

function renderArchivedHabits(archivedHabits) {
    if (!elements.archivedHabitList) {
        return;
    }

    elements.archivedHabitList.innerHTML = "";

    if (archivedHabits.length === 0) {
        if (elements.emptyArchivedState) {
            elements.emptyArchivedState.hidden = false;
        }

        return;
    }

    if (elements.emptyArchivedState) {
        elements.emptyArchivedState.hidden = true;
    }

    archivedHabits.forEach(habit => {
        elements.archivedHabitList.appendChild(
            createHabitCard(habit, true)
        );
    });
}


// ==================================================
// 16. UPDATE STATISTICS
// ==================================================

function updateStatistics() {
    const activeHabits = habits.filter(
        habit => getHabitStatus(habit) === "active"
    );

    const todayHabits = activeHabits.filter(
        shouldHabitAppearToday
    );

    const completedToday = todayHabits.filter(
        isHabitCompletedToday
    );

    const total = todayHabits.length;
    const completed = completedToday.length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    setElementText(
        elements.activeHabitsCount,
        activeHabits.length
    );

    setElementText(
        elements.completedTodayCount,
        completed
    );

    setElementText(
        elements.todayProgressPercent,
        `${percentage}%`
    );

    if (elements.todayProgressFill) {
        elements.todayProgressFill.style.width =
            `${percentage}%`;
    }

    if (elements.todayProgressBar) {
        elements.todayProgressBar.setAttribute(
            "aria-valuenow",
            String(percentage)
        );
    }
}


// ==================================================
// 17. OPEN CREATE MODAL
// ==================================================

function openCreateHabitModal() {
    if (!elements.habitModal || !elements.habitForm) {
        return;
    }

    editingHabitId = null;

    elements.habitForm.reset();

    setElementText(
        elements.habitModalTitle,
        "Create a habit"
    );

    if (elements.saveHabitButton) {
        elements.saveHabitButton.textContent = "Save habit";
    }

    if (elements.habitStatusField) {
        elements.habitStatusField.hidden = true;
    }

    if (elements.habitStatus) {
        elements.habitStatus.value = "active";
    }

    if (elements.habitStartDate) {
        elements.habitStartDate.value = getLocalDateString();
    }

    clearFormError();

    openModal(elements.habitModal);

    window.setTimeout(() => {
        elements.habitTitle?.focus();
    }, 50);
}


// ==================================================
// 18. OPEN EDIT MODAL
// ==================================================

function openEditHabitModal(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    if (!elements.habitForm) {
        return;
    }

    editingHabitId = Number(habit.id);

    elements.habitForm.reset();

    setElementText(elements.habitModalTitle, "Edit habit");

    if (elements.saveHabitButton) {
        elements.saveHabitButton.textContent = "Save changes";
    }

    if (elements.habitTitle) {
        elements.habitTitle.value = habit.title;
    }

    if (elements.habitDescription) {
        elements.habitDescription.value = habit.description || "";
    }

    if (elements.habitFrequency) {
        elements.habitFrequency.value = habit.frequency || "daily";
    }

    if (elements.habitStartDate) {
        elements.habitStartDate.value = getHabitStartDate(habit);
    }

    if (elements.habitStatusField) {
        elements.habitStatusField.hidden = false;
    }

    if (elements.habitStatus) {
        elements.habitStatus.value = getHabitStatus(habit);
    }

    clearFormError();

    openModal(elements.habitModal);

    window.setTimeout(() => {
        elements.habitTitle?.focus();
    }, 50);
}


// ==================================================
// 19. MODAL HELPERS
// ==================================================

function openModal(modal) {
    if (!modal) {
        return;
    }

    modal.hidden = false;

    document.body.classList.add("modal-open");
}


function closeModal(modal) {
    if (!modal) {
        return;
    }

    modal.hidden = true;

    const anyModalOpen = [
        elements.habitModal,
        elements.historyModal,
        elements.confirmModal
    ].some(item => item && !item.hidden);

    if (!anyModalOpen) {
        document.body.classList.remove("modal-open");
    }
}


function closeHabitModal() {
    closeModal(elements.habitModal);

    editingHabitId = null;

    clearFormError();
}


function closeHistoryModal() {
    closeModal(elements.historyModal);

    activeHistoryHabit = null;
}


// ==================================================
// 20. SAVE HABIT
// ==================================================

async function saveHabit(event) {
    event.preventDefault();

    if (isSavingHabit) {
        return;
    }

    clearFormError();

    const title = elements.habitTitle?.value.trim() || "";

    const description =
        elements.habitDescription?.value.trim() || "";

    const frequency =
        elements.habitFrequency?.value || "daily";

    const startDate =
        elements.habitStartDate?.value || "";

    const status =
        elements.habitStatus?.value || "active";

    if (!title) {
        showFormError("Please enter a name for your habit.");
        elements.habitTitle?.focus();
        return;
    }

    if (title.length > 150) {
        showFormError(
            "Your habit name must not exceed 150 characters."
        );
        return;
    }

    if (!["daily", "weekdays", "weekly"].includes(frequency)) {
        showFormError("Please select a valid frequency.");
        return;
    }

    if (!isValidDateString(startDate)) {
        showFormError("Please select a valid start date.");
        elements.habitStartDate?.focus();
        return;
    }

    if (
        editingHabitId !== null &&
        !["active", "archived"].includes(status)
    ) {
        showFormError("Please select a valid habit status.");
        return;
    }

    const wasEditing = editingHabitId !== null;
    const habitIdBeingEdited = editingHabitId;

    const payload = {
        title,
        description,
        frequency,
        startDate
    };

    let url = "/api/habits";
    let method = "POST";

    if (wasEditing) {
        // Correct API URL: no embedded spaces.
        url = `/api/habits/${habitIdBeingEdited}`;

        method = "PUT";

        payload.status = status;
    }

    isSavingHabit = true;

    setButtonLoading(
        elements.saveHabitButton,
        true,
        wasEditing ? "Saving..." : "Creating..."
    );

    try {
        await apiRequest(url, {
            method,
            body: JSON.stringify(payload)
        });

        closeHabitModal();

        await loadHabits(false);

        showMessage(
            wasEditing
                ? "Habit updated successfully."
                : "Habit created successfully."
        );

    } catch (error) {
        console.error("Could not save habit:", error);

        showFormError(error.message);

    } finally {
        isSavingHabit = false;

        if (elements.saveHabitButton) {
            elements.saveHabitButton.disabled = false;

            delete elements.saveHabitButton.dataset.originalText;

            elements.saveHabitButton.textContent =
                wasEditing ? "Save changes" : "Save habit";
        }
    }
}


// ==================================================
// 21. TOGGLE HABIT COMPLETION
// ==================================================

async function toggleHabitCompletion(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    if (getHabitStatus(habit) !== "active") {
        showMessage(
            "Only active habits can be completed.",
            "error"
        );
        return;
    }

    const today = getLocalDateString();

    const startDate = getHabitStartDate(habit);

    if (startDate && today < startDate) {
        showMessage(
            "This habit has not reached its start date.",
            "error"
        );
        return;
    }

    if (!shouldHabitAppearToday(habit)) {
        showMessage(
            "This habit is not scheduled for today.",
            "error"
        );
        return;
    }

    const completed = isHabitCompletedToday(habit);

    const method = completed ? "DELETE" : "PUT";

    // Correct API URL: /api/habits/:id/records/:date
    const url =
        `/api/habits/${habit.id}/records/${today}`;

    try {
        await apiRequest(url, {
            method
        });

        await loadHabits(false);

        showMessage(
            completed
                ? "Habit completion undone."
                : "Habit marked complete."
        );

    } catch (error) {
        console.error(
            "Could not update habit completion:",
            error
        );

        showMessage(error.message, "error");
    }
}


// ==================================================
// 22. ARCHIVE HABIT
// ==================================================

async function archiveHabit(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Archive "${habit.title}"? You can restore it later.`
    );

    if (!confirmed) {
        return;
    }

    await changeHabitStatus(habit, "archived");
}


// ==================================================
// 23. RESTORE HABIT
// ==================================================

async function restoreHabit(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    await changeHabitStatus(habit, "active");
}


// ==================================================
// 24. CHANGE HABIT STATUS
// ==================================================

async function changeHabitStatus(habit, status) {
    const payload = {
        title: habit.title,
        description: habit.description || "",
        frequency: habit.frequency,
        startDate: getHabitStartDate(habit),
        status
    };

    try {
        // Correct API URL.
        await apiRequest(`/api/habits/${habit.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        await loadHabits(false);

        showMessage(
            status === "archived"
                ? "Habit archived successfully."
                : "Habit restored successfully."
        );

    } catch (error) {
        console.error("Could not update habit status:", error);

        showMessage(error.message, "error");
    }
}


// ==================================================
// 25. DELETE HABIT
// ==================================================

function askDeleteHabit(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    confirmAction = async () => {
        try {
            await apiRequest(`/api/habits/${habit.id}`, {
                method: "DELETE"
            });

            closeModal(elements.confirmModal);

            await loadHabits(false);

            showMessage("Habit deleted successfully.");

        } catch (error) {
            console.error("Could not delete habit:", error);

            closeModal(elements.confirmModal);

            showMessage(error.message, "error");

        } finally {
            confirmAction = null;
        }
    };

    setElementText(
        elements.confirmModalTitle,
        "Delete this habit?"
    );

    setElementText(
        elements.confirmModalDescription,
        `Delete "${habit.title}" and its completion history? This action cannot be undone.`
    );

    setElementText(
        elements.acceptConfirmButton,
        "Delete habit"
    );

    openModal(elements.confirmModal);
}


// ==================================================
// 26. VIEW HABIT HISTORY
// ==================================================

async function openHabitHistory(habitId) {
    const habit = habits.find(
        item => getHabitId(item) === Number(habitId)
    );

    if (!habit) {
        showMessage("Habit not found.", "error");
        return;
    }

    activeHistoryHabit = habit;

    setElementText(
        elements.historyModalTitle,
        habit.title
    );

    setElementText(
        elements.historyHabitDescription,
        habit.description ||
        "Review your recorded completions."
    );

    setElementText(
        elements.historySummary,
        "Loading history..."
    );

    if (elements.historyCalendar) {
        elements.historyCalendar.innerHTML = "";
    }

    openModal(elements.historyModal);

    try {
        // Correct API URL.
        const data = await apiRequest(
            `/api/habits/${habit.id}/records`
        );

        const records = Array.isArray(data)
            ? data
            : Array.isArray(data.records)
                ? data.records
                : [];

        renderHabitHistory(habit, records);

    } catch (error) {
        console.error("Could not load habit history:", error);

        setElementText(
            elements.historySummary,
            "Unable to load habit history."
        );

        showMessage(error.message, "error");
    }
}


// ==================================================
// 27. RENDER HABIT HISTORY
// ==================================================

function renderHabitHistory(habit, records) {
    if (!elements.historySummary || !elements.historyCalendar) {
        return;
    }

    const completionDates = [
        ...new Set(
            records.map(record => {
                return String(
                    record.completion_date ??
                    record.completionDate ??
                    ""
                ).slice(0, 10);
            }).filter(isValidDateString)
        )
    ].sort((a, b) => b.localeCompare(a));

    const total = completionDates.length;

    elements.historySummary.innerHTML = `
        <div class="history-stat">
            <strong>${total}</strong>
            <span>Total recorded completions</span>
        </div>

        <div class="history-stat">
            <strong>${escapeHTML(getFrequencyLabel(habit.frequency))}</strong>
            <span>Habit frequency</span>
        </div>
    `;

    elements.historyCalendar.innerHTML = "";

    if (total === 0) {
        elements.historyCalendar.innerHTML = `
            <div class="empty-state">
                <h3>No completions recorded yet</h3>
                <p>Complete this habit to begin building your history.</p>
            </div>
        `;

        return;
    }

    const heading = document.createElement("h3");

    heading.textContent = "Completion history";

    elements.historyCalendar.appendChild(heading);

    const list = document.createElement("div");

    list.className = "history-record-list";

    completionDates.forEach(date => {
        const item = document.createElement("div");

        item.className = "history-record";

        item.innerHTML = `
            <span class="history-record-check" aria-hidden="true">✓</span>
            <span>${escapeHTML(formatDate(date))}</span>
            <span>${escapeHTML(getWeekdayName(date))}</span>
        `;

        list.appendChild(item);
    });

    elements.historyCalendar.appendChild(list);
}


// ==================================================
// 28. ARCHIVED SECTION TOGGLE
// ==================================================

function toggleArchivedSection() {
    if (
        !elements.toggleArchivedButton ||
        !elements.archivedHabitsContainer
    ) {
        return;
    }

    const isExpanded =
        elements.toggleArchivedButton.getAttribute(
            "aria-expanded"
        ) === "true";

    const nextExpanded = !isExpanded;

    elements.toggleArchivedButton.setAttribute(
        "aria-expanded",
        String(nextExpanded)
    );

    elements.archivedHabitsContainer.hidden = !nextExpanded;
}


// ==================================================
// 29. LOG OUT
// ==================================================

async function logout() {
    if (!elements.logoutButton) {
        return;
    }

    if (elements.logoutButton.disabled) {
        return;
    }

    const originalText = elements.logoutButton.textContent;

    elements.logoutButton.disabled = true;
    elements.logoutButton.textContent = "Signing out...";

    try {
        // Match the Dashboard and Goals logout endpoint.
        await apiRequest("/api/auth/logout", {
            method: "POST"
        });

        window.location.href = "/";

    } catch (error) {
        console.error("Logout request failed:", error);

        elements.logoutButton.disabled = false;
        elements.logoutButton.textContent = originalText;

        showMessage(
            "Unable to log out. Please try again.",
            "error"
        );
    }
}


// ==================================================
// 30. HABIT LIST EVENT DELEGATION
// ==================================================

function handleHabitListClick(event) {
    const button = event.target.closest("[data-action]");

    if (!button) {
        return;
    }

    const action = button.dataset.action;

    if (action === "retry-load") {
        loadHabits().catch(() => { });
        return;
    }

    const habitId = Number(button.dataset.id);

    if (!Number.isSafeInteger(habitId) || habitId <= 0) {
        return;
    }

    if (action === "toggle-completion") {
        toggleHabitCompletion(habitId);
        return;
    }

    if (action === "edit") {
        openEditHabitModal(habitId);
        return;
    }

    if (action === "archive") {
        archiveHabit(habitId);
        return;
    }

    if (action === "restore") {
        restoreHabit(habitId);
        return;
    }

    if (action === "delete") {
        askDeleteHabit(habitId);
        return;
    }

    if (action === "history") {
        openHabitHistory(habitId);
    }
}


// ==================================================
// 31. MODAL BACKDROP BEHAVIOUR
// ==================================================

function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) {
        return;
    }

    if (event.currentTarget === elements.habitModal) {
        closeHabitModal();
        return;
    }

    if (event.currentTarget === elements.historyModal) {
        closeHistoryModal();
        return;
    }

    if (event.currentTarget === elements.confirmModal) {
        closeModal(elements.confirmModal);
        confirmAction = null;
    }
}


// ==================================================
// 32. KEYBOARD ACCESSIBILITY
// ==================================================

function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
        if (elements.habitModal && !elements.habitModal.hidden) {
            closeHabitModal();
            return;
        }

        if (elements.historyModal && !elements.historyModal.hidden) {
            closeHistoryModal();
            return;
        }

        if (elements.confirmModal && !elements.confirmModal.hidden) {
            closeModal(elements.confirmModal);
            confirmAction = null;
        }
    }
}


// ==================================================
// 33. REGISTER EVENT LISTENERS
// ==================================================

function initialiseEventListeners() {

    // Theme controls

    elements.dayThemeButton?.addEventListener("click", () => {
        applyTheme("day");
    });

    elements.nightThemeButton?.addEventListener("click", () => {
        applyTheme("night");
    });


    // Sidebar

    elements.menuButton?.addEventListener("click", () => {
        const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

        if (isMobile) {
            const isOpen =
                elements.appLayout?.classList.contains("sidebar-open");

            applySidebarState(!isOpen);

        } else {
            const isCollapsed =
                elements.appLayout?.classList.contains(
                    "sidebar-collapsed"
                );

            applySidebarState(!isCollapsed);
        }
    });

    window.addEventListener("resize", handleSidebarResize);

    document.querySelectorAll(".sidebar-navigation .nav-link")
        .forEach(link => {
            link.addEventListener("click", closeMobileSidebar);
        });


    // Create habit

    elements.openCreateHabitButton?.addEventListener(
        "click",
        openCreateHabitModal
    );

    elements.emptyCreateHabitButton?.addEventListener(
        "click",
        openCreateHabitModal
    );


    // Save habit

    elements.habitForm?.addEventListener(
        "submit",
        saveHabit
    );


    // Close create/edit modal

    elements.closeHabitModalButton?.addEventListener(
        "click",
        closeHabitModal
    );

    elements.cancelHabitButton?.addEventListener(
        "click",
        closeHabitModal
    );


    // Habit list actions

    elements.habitList?.addEventListener(
        "click",
        handleHabitListClick
    );

    elements.archivedHabitList?.addEventListener(
        "click",
        handleHabitListClick
    );


    // Archived section

    elements.toggleArchivedButton?.addEventListener(
        "click",
        toggleArchivedSection
    );


    // History modal

    elements.closeHistoryModalButton?.addEventListener(
        "click",
        closeHistoryModal
    );


    // Confirmation modal

    elements.cancelConfirmButton?.addEventListener(
        "click",
        () => {
            closeModal(elements.confirmModal);
            confirmAction = null;
        }
    );

    elements.acceptConfirmButton?.addEventListener(
        "click",
        async () => {
            if (!confirmAction) {
                return;
            }

            const action = confirmAction;

            elements.acceptConfirmButton.disabled = true;

            try {
                await action();
            } finally {
                elements.acceptConfirmButton.disabled = false;
            }
        }
    );


    // Modal backdrops

    elements.habitModal?.addEventListener(
        "click",
        handleBackdropClick
    );

    elements.historyModal?.addEventListener(
        "click",
        handleBackdropClick
    );

    elements.confirmModal?.addEventListener(
        "click",
        handleBackdropClick
    );


    // Logout

    elements.logoutButton?.addEventListener(
        "click",
        logout
    );


    // Keyboard accessibility

    document.addEventListener(
        "keydown",
        handleGlobalKeydown
    );
}


// ==================================================
// 34. APPLICATION INITIALISATION
// ==================================================

async function initialiseHabitsPage() {
    updateHeaderDate();

    initialiseTheme();

    initialiseSidebar();

    initialiseEventListeners();

    await loadCurrentUser();

    try {
        await loadHabits();
    } catch {
        // loadHabits already displays the error message.
        // The user can retry without reloading the page.
    }
}


// ==================================================
// 35. START APPLICATION
// ==================================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiseHabitsPage
    );
} else {
    initialiseHabitsPage();
}