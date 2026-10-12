"use strict";

/* =========================================================
   STUDYTRACK V2
   GOALS PAGE JAVASCRIPT

   Handles:
   - Authentication and account information
   - Day and night themes
   - Sidebar navigation
   - Goal creation and editing
   - Goal progress and completion
   - Goal search and filtering
   - Goal deletion
   - Summary statistics
   ========================================================= */


/* =========================================================
   1. SELECT HTML ELEMENTS
   ========================================================= */

const appLayout = document.querySelector(".app-layout");
const sidebar = document.getElementById("sidebar");

const menuButton = document.getElementById("menuButton");
const logoutButton = document.getElementById("logoutButton");

const dayThemeButton = document.getElementById("dayThemeButton");
const nightThemeButton = document.getElementById("nightThemeButton");

const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarAvatar = document.getElementById("sidebarAvatar");
const currentDate = document.getElementById("currentDate");

const goalsMessage = document.getElementById("goalsMessage");

const totalGoalsCount = document.getElementById("totalGoalsCount");
const activeGoalsCount = document.getElementById("activeGoalsCount");
const completedGoalsCount = document.getElementById("completedGoalsCount");
const overallProgressCount = document.getElementById("overallProgressCount");

const overallProgressBar = document.getElementById("overallProgressBar");
const overallProgressFill = document.getElementById("overallProgressFill");

const goalFormCard = document.getElementById("goalFormCard");
const goalForm = document.getElementById("goalForm");
const goalFormHeading = document.getElementById("goalFormHeading");

const editingGoalId = document.getElementById("editingGoalId");
const goalTitle = document.getElementById("goalTitle");
const goalDescription = document.getElementById("goalDescription");
const goalTargetDate = document.getElementById("goalTargetDate");
const goalProgress = document.getElementById("goalProgress");

const openGoalFormButton = document.getElementById("openGoalFormButton");
const closeGoalFormButton = document.getElementById("closeGoalFormButton");
const cancelGoalFormButton = document.getElementById("cancelGoalFormButton");
const saveGoalButton = document.getElementById("saveGoalButton");

const emptyStateCreateButton = document.getElementById("emptyStateCreateButton");

const goalSearch = document.getElementById("goalSearch");
const filterButtons = document.querySelectorAll(".filter-button");

const goalsLoading = document.getElementById("goalsLoading");
const goalsEmpty = document.getElementById("goalsEmpty");
const emptyStateHeading = document.getElementById("emptyStateHeading");
const emptyStateDescription = document.getElementById("emptyStateDescription");

const goalsGrid = document.getElementById("goalsGrid");

const deleteGoalDialog = document.getElementById("deleteGoalDialog");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");


/* =========================================================
   2. APPLICATION STATE
   ========================================================= */

let goals = [];

let currentFilter = "all";

let searchQuery = "";

let goalPendingDeletion = null;

let goalsLoadFailed = false;

const THEME_STORAGE_KEY = "studytrack-v2-theme";


/* =========================================================
   3. GENERAL HELPERS
   ========================================================= */

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}


function showMessage(message, type = "error") {
    if (!goalsMessage) {
        console.error(message);
        return;
    }

    goalsMessage.textContent = message;

    goalsMessage.classList.remove("success", "error");

    if (type === "success" || type === "error") {
        goalsMessage.classList.add(type);
    }

    goalsMessage.hidden = false;
}


function hideMessage() {
    if (!goalsMessage) {
        return;
    }

    goalsMessage.textContent = "";

    goalsMessage.classList.remove("success", "error");

    goalsMessage.hidden = true;
}


function setLoading(isLoading) {
    if (goalsLoading) {
        goalsLoading.hidden = !isLoading;
    }

    if (saveGoalButton) {
        saveGoalButton.disabled = isLoading;
        saveGoalButton.textContent = isLoading
            ? "Saving..."
            : "Save goal";
    }
}


async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",

        ...options,

        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            "The server returned an invalid response. Please try again."
        );
    }

    if (response.status === 401) {
        window.location.replace("/");
        throw new Error("Your session has expired. Please sign in again.");
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || `The request failed with status ${response.status}.`
        );
    }

    return data;
}


function formatDate(dateValue) {
    if (!dateValue) {
        return "No target date";
    }

    const dateString = String(dateValue).slice(0, 10);

    const parts = dateString.split("-");

    if (parts.length !== 3) {
        return "No target date";
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const date = new Date(year, month - 1, day);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return "No target date";
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function getTodayString() {
    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1).padStart(2, "0");

    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function isOverdue(goal) {
    if (!goal.target_date || goal.status === "completed") {
        return false;
    }

    return String(goal.target_date).slice(0, 10) < getTodayString();
}


function getGoalStatus(goal) {
    return goal.status === "completed"
        ? "completed"
        : "active";
}


/* =========================================================
   4. DAY AND NIGHT THEMES
   ========================================================= */

function applyTheme(theme, savePreference = true) {
    const selectedTheme = theme === "night" ? "night" : "day";

    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );

    if (dayThemeButton) {
        const active = selectedTheme === "day";

        dayThemeButton.classList.toggle("is-active", active);

        dayThemeButton.setAttribute("aria-pressed", String(active));
    }

    if (nightThemeButton) {
        const active = selectedTheme === "night";

        nightThemeButton.classList.toggle("is-active", active);

        nightThemeButton.setAttribute("aria-pressed", String(active));
    }

    if (savePreference) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
        } catch (error) {
            console.warn("Could not save theme preference:", error);
        }
    }
}


function initialiseTheme() {
    let theme = "day";

    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

        if (savedTheme === "day" || savedTheme === "night") {
            theme = savedTheme;
        }
    } catch (error) {
        console.warn("Could not read theme preference:", error);
    }

    applyTheme(theme, false);
}


if (dayThemeButton) {
    dayThemeButton.addEventListener("click", () => {
        applyTheme("day");
    });
}


if (nightThemeButton) {
    nightThemeButton.addEventListener("click", () => {
        applyTheme("night");
    });
}


/* =========================================================
   5. CURRENT DATE
   ========================================================= */

function displayCurrentDate() {
    if (!currentDate) {
        return;
    }

    currentDate.textContent = new Date().toLocaleDateString(
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
   6. AUTHENTICATION AND USER INFORMATION
   ========================================================= */

async function loadCurrentUser() {
    try {
        const data = await requestJSON("/api/auth/me");

        if (
            data.authenticated !== true ||
            !data.user
        ) {
            window.location.replace("/");
            return false;
        }

        const user = data.user;

        const fullName =
            typeof user.fullName === "string"
                ? user.fullName.trim()
                : "";

        const safeName = fullName || "Student";

        const firstName = safeName.split(/\s+/)[0] || "S";

        if (sidebarUserName) {
            sidebarUserName.textContent = safeName;
        }

        if (sidebarAvatar) {
            sidebarAvatar.textContent =
                firstName.charAt(0).toUpperCase();

            sidebarAvatar.setAttribute(
                "aria-label",
                `${safeName}'s profile`
            );
        }

        return true;
    } catch (error) {
        console.error("Account loading error:", error);

        showMessage(
            "We couldn't load your account information. Please refresh the page.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   7. SIDEBAR AND MOBILE NAVIGATION
   ========================================================= */

function isMobileLayout() {
    return window.matchMedia("(max-width: 850px)").matches;
}


function updateMenuButton() {
    if (!appLayout || !menuButton) {
        return;
    }

    const expanded = isMobileLayout()
        ? appLayout.classList.contains("sidebar-open")
        : !appLayout.classList.contains("sidebar-collapsed");

    menuButton.setAttribute("aria-expanded", String(expanded));
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
    menuButton.addEventListener("click", toggleSidebar);
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
   8. LOGOUT
   ========================================================= */

async function logoutUser() {
    if (!logoutButton) {
        return;
    }

    logoutButton.disabled = true;

    const originalText = logoutButton.textContent;

    logoutButton.textContent = "Logging out...";

    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("The server could not complete logout.");
        }

        window.location.replace("/");
    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Logout failed. Please check your connection and try again."
        );

        logoutButton.disabled = false;
        logoutButton.textContent = originalText;
    }
}


if (logoutButton) {
    logoutButton.addEventListener("click", logoutUser);
}


/* =========================================================
   9. GOAL SUMMARY STATISTICS
   ========================================================= */

function updateGoalSummary() {
    const total = goals.length;

    const completed = goals.filter(
        (goal) => getGoalStatus(goal) === "completed"
    ).length;

    const active = total - completed;

    const averageProgress = total === 0
        ? 0
        : Math.round(
            goals.reduce(
                (sum, goal) => sum + (Number(goal.progress) || 0),
                0
            ) / total
        );

    if (totalGoalsCount) {
        totalGoalsCount.textContent = String(total);
    }

    if (activeGoalsCount) {
        activeGoalsCount.textContent = String(active);
    }

    if (completedGoalsCount) {
        completedGoalsCount.textContent = String(completed);
    }

    if (overallProgressCount) {
        overallProgressCount.textContent = `${averageProgress}%`;
    }

    if (overallProgressFill) {
        overallProgressFill.style.width = `${averageProgress}%`;
    }

    if (overallProgressBar) {
        overallProgressBar.setAttribute(
            "aria-valuenow",
            String(averageProgress)
        );
    }
}


/* =========================================================
   10. CREATE GOAL CARD
   ========================================================= */

function createGoalCard(goal) {
    const card = createElement(
        "article",
        `goal-card${goal.status === "completed" ? " completed" : ""}`
    );

    const cardTop = createElement("div", "goal-card-top");

    const status = getGoalStatus(goal);

    const statusLabel = createElement(
        "span",
        `goal-status ${status}`,
        status === "completed" ? "✓ Completed" : "● In progress"
    );

    cardTop.appendChild(statusLabel);

    const actions = createElement("div", "goal-actions");

    const editButton = createElement("button", "goal-action-button", "✎");

    editButton.type = "button";
    editButton.title = "Edit goal";
    editButton.setAttribute("aria-label", `Edit ${goal.title}`);

    editButton.addEventListener("click", () => {
        openEditForm(goal);
    });

    const deleteButton = createElement(
        "button",
        "goal-action-button delete",
        "×"
    );

    deleteButton.type = "button";
    deleteButton.title = "Delete goal";
    deleteButton.setAttribute("aria-label", `Delete ${goal.title}`);

    deleteButton.addEventListener("click", () => {
        openDeleteDialog(goal);
    });

    actions.append(editButton, deleteButton);
    cardTop.appendChild(actions);

    card.appendChild(cardTop);

    const title = createElement("h3", "goal-title", goal.title);

    card.appendChild(title);

    const description = createElement(
        "p",
        "goal-description",
        goal.description || "No description added yet."
    );

    if (!goal.description) {
        description.classList.add("empty-description");
    }

    card.appendChild(description);

    const overdue = isOverdue(goal);

    const dateRow = createElement(
        "div",
        `goal-date-row${overdue ? " overdue" : ""}`
    );

    dateRow.appendChild(
        createElement("span", "goal-date-icon", "◷")
    );

    dateRow.appendChild(
        createElement(
            "span",
            "",
            overdue
                ? `Overdue · ${formatDate(goal.target_date)}`
                : `Target date · ${formatDate(goal.target_date)}`
        )
    );

    card.appendChild(dateRow);

    const progressSection = createElement(
        "div",
        "goal-progress-section"
    );

    const progressHeading = createElement(
        "div",
        "goal-progress-heading"
    );

    const progress = Math.min(
        100,
        Math.max(0, Number(goal.progress) || 0)
    );

    progressHeading.append(
        createElement("span", "", "Your progress"),
        createElement(
            "span",
            "goal-progress-percentage",
            `${progress}%`
        )
    );

    progressSection.appendChild(progressHeading);

    const progressTrack = createElement(
        "div",
        "goal-progress-track"
    );

    progressTrack.setAttribute("role", "progressbar");
    progressTrack.setAttribute("aria-valuemin", "0");
    progressTrack.setAttribute("aria-valuemax", "100");
    progressTrack.setAttribute("aria-valuenow", String(progress));
    progressTrack.setAttribute(
        "aria-label",
        `Progress on ${goal.title}`
    );

    const progressFill = createElement("span", "goal-progress-fill");

    progressFill.style.width = `${progress}%`;

    progressTrack.appendChild(progressFill);
    progressSection.appendChild(progressTrack);

    card.appendChild(progressSection);

    const cardBottom = createElement("div", "goal-card-bottom");

    const updated = createElement(
        "span",
        "goal-updated",
        goal.status === "completed"
            ? "Achievement unlocked"
            : "Keep moving forward"
    );

    cardBottom.appendChild(updated);

    if (goal.status !== "completed") {
        const completeButton = createElement(
            "button",
            "goal-complete-button",
            "✓ Mark complete"
        );

        completeButton.type = "button";

        completeButton.addEventListener("click", () => {
            completeGoal(goal.id);
        });

        cardBottom.appendChild(completeButton);
    }

    card.appendChild(cardBottom);

    return card;
}


/* =========================================================
   11. SEARCH AND FILTER GOALS
   ========================================================= */

function getVisibleGoals() {
    return goals.filter((goal) => {
        const status = getGoalStatus(goal);

        const matchesFilter =
            currentFilter === "all" ||
            status === currentFilter;

        const searchableText = [
            goal.title || "",
            goal.description || ""
        ].join(" ").toLowerCase();

        const matchesSearch =
            searchableText.includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });
}


function updateFilterButtons() {
    filterButtons.forEach((button) => {
        const active = button.dataset.filter === currentFilter;

        button.classList.toggle("active", active);

        button.setAttribute("aria-pressed", String(active));
    });
}


function renderGoals() {
    if (!goalsGrid) {
        console.error('The HTML element "goalsGrid" was not found.');
        return;
    }

    goalsGrid.replaceChildren();

    const visibleGoals = getVisibleGoals();

    if (goalsLoading) {
        goalsLoading.hidden = true;
    }

    if (goalsEmpty) {
        goalsEmpty.hidden = visibleGoals.length > 0;
    }

    if (visibleGoals.length === 0) {
        if (emptyStateHeading && emptyStateDescription) {
            if (goals.length === 0) {
                emptyStateHeading.textContent =
                    "Your next achievement starts here.";

                emptyStateDescription.textContent =
                    "Create your first goal and start turning your plans into progress.";
            } else {
                emptyStateHeading.textContent = "No goals found.";

                emptyStateDescription.textContent =
                    "Try another search or choose a different filter.";
            }
        }

        if (emptyStateCreateButton) {
            emptyStateCreateButton.hidden = goals.length > 0;
        }

        return;
    }

    if (emptyStateCreateButton) {
        emptyStateCreateButton.hidden = true;
    }

    visibleGoals.forEach((goal) => {
        goalsGrid.appendChild(createGoalCard(goal));
    });
}


/* =========================================================
   12. LOAD GOALS FROM THE DATABASE
   ========================================================= */

async function loadGoals() {
    goalsLoadFailed = false;

    if (goalsLoading) {
        goalsLoading.hidden = false;
    }

    if (goalsEmpty) {
        goalsEmpty.hidden = true;
    }

    if (goalsGrid) {
        goalsGrid.replaceChildren();
    }

    try {
        const data = await requestJSON("/api/goals");

        goals = Array.isArray(data.goals) ? data.goals : [];

        updateGoalSummary();
        renderGoals();

        hideMessage();

        console.log(`StudyTrack: Loaded ${goals.length} goal(s).`);
    } catch (error) {
        goalsLoadFailed = true;

        console.error("Could not load goals:", error);

        if (goalsLoading) {
            goalsLoading.hidden = true;
        }

        if (goalsEmpty) {
            goalsEmpty.hidden = true;
        }

        showMessage(
            error.message || "Could not load your goals. Please refresh the page."
        );
    }
}


/* =========================================================
   13. OPEN AND CLOSE THE GOAL FORM
   ========================================================= */

function resetGoalForm() {
    if (goalForm) {
        goalForm.reset();
    }

    if (editingGoalId) {
        editingGoalId.value = "";
    }

    if (goalFormHeading) {
        goalFormHeading.textContent = "Create a new goal";
    }

    if (saveGoalButton) {
        saveGoalButton.textContent = "Save goal";
        saveGoalButton.disabled = false;
    }
}


function openCreateForm() {
    resetGoalForm();

    if (goalFormCard) {
        goalFormCard.hidden = false;
    }

    hideMessage();

    if (goalTitle) {
        goalTitle.focus();
    }

    if (goalFormCard) {
        goalFormCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


function openEditForm(goal) {
    resetGoalForm();

    if (editingGoalId) {
        editingGoalId.value = String(goal.id);
    }

    if (goalTitle) {
        goalTitle.value = goal.title || "";
    }

    if (goalDescription) {
        goalDescription.value = goal.description || "";
    }

    if (goalTargetDate) {
        goalTargetDate.value = goal.target_date
            ? String(goal.target_date).slice(0, 10)
            : "";
    }

    if (goalProgress) {
        goalProgress.value = String(Number(goal.progress) || 0);
    }

    if (goalFormHeading) {
        goalFormHeading.textContent = "Edit your goal";
    }

    if (goalFormCard) {
        goalFormCard.hidden = false;
    }

    hideMessage();

    if (goalFormCard) {
        goalFormCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    if (goalTitle) {
        goalTitle.focus();
    }
}


function closeGoalForm() {
    if (goalFormCard) {
        goalFormCard.hidden = true;
    }

    resetGoalForm();
    hideMessage();
}


if (openGoalFormButton) {
    openGoalFormButton.addEventListener("click", openCreateForm);
}

if (emptyStateCreateButton) {
    emptyStateCreateButton.addEventListener("click", openCreateForm);
}

if (closeGoalFormButton) {
    closeGoalFormButton.addEventListener("click", closeGoalForm);
}

if (cancelGoalFormButton) {
    cancelGoalFormButton.addEventListener("click", closeGoalForm);
}


/* =========================================================
   14. CREATE OR UPDATE A GOAL
   ========================================================= */

if (goalForm) {
    goalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        hideMessage();

        const title = goalTitle ? goalTitle.value.trim() : "";

        const description = goalDescription
            ? goalDescription.value.trim()
            : "";

        const targetDate = goalTargetDate
            ? goalTargetDate.value
            : "";

        const progress = Number(
            goalProgress ? goalProgress.value : 0
        );

        const existingId = editingGoalId
            ? editingGoalId.value.trim()
            : "";

        if (!title) {
            showMessage("Please enter a title for your goal.");
            if (goalTitle) {
                goalTitle.focus();
            }
            return;
        }

        const payload = {
            title,
            description,
            targetDate,
            progress,
            status: progress === 100 ? "completed" : "active"
        };

        setLoading(true);

        try {
            let data;

            if (existingId) {
                data = await requestJSON(
                    `/api/goals/${encodeURIComponent(existingId)}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    }
                );
            } else {
                data = await requestJSON("/api/goals", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }

            closeGoalForm();

            showMessage(
                data.message ||
                (existingId
                    ? "Goal updated successfully."
                    : "Goal created successfully."),
                "success"
            );

            await loadGoals();

            showMessage(
                data.message ||
                (existingId
                    ? "Goal updated successfully."
                    : "Goal created successfully."),
                "success"
            );
        } catch (error) {
            console.error("Saving goal failed:", error);

            showMessage(
                error.message || "Could not save your goal."
            );
        } finally {
            setLoading(false);
        }
    });
}


/* =========================================================
   15. MARK A GOAL AS COMPLETED
   ========================================================= */

async function completeGoal(goalId) {
    hideMessage();

    try {
        const data = await requestJSON(
            `/api/goals/${encodeURIComponent(goalId)}/complete`,
            {
                method: "PATCH"
            }
        );

        await loadGoals();

        showMessage(
            data.message || "Congratulations! Your goal is completed.",
            "success"
        );
    } catch (error) {
        console.error("Completing goal failed:", error);

        showMessage(
            error.message || "Could not complete this goal."
        );
    }
}


/* =========================================================
   16. DELETE GOALS
   ========================================================= */

function openDeleteDialog(goal) {
    goalPendingDeletion = goal;

    if (!deleteGoalDialog) {
        const confirmed = window.confirm(
            `Delete "${goal.title}"? This action cannot be undone.`
        );

        if (confirmed) {
            deleteGoal(goal.id);
        }

        return;
    }

    if (typeof deleteGoalDialog.showModal === "function") {
        deleteGoalDialog.showModal();
    } else {
        const confirmed = window.confirm(
            `Delete "${goal.title}"? This action cannot be undone.`
        );

        if (confirmed) {
            deleteGoal(goal.id);
        }
    }
}


function closeDeleteDialog() {
    goalPendingDeletion = null;

    if (
        deleteGoalDialog &&
        deleteGoalDialog.open
    ) {
        deleteGoalDialog.close();
    }
}


if (cancelDeleteButton) {
    cancelDeleteButton.addEventListener("click", closeDeleteDialog);
}


if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener("click", async () => {
        if (!goalPendingDeletion) {
            return;
        }

        const goalId = goalPendingDeletion.id;

        confirmDeleteButton.disabled = true;
        confirmDeleteButton.textContent = "Deleting...";

        try {
            const data = await requestJSON(
                `/api/goals/${encodeURIComponent(goalId)}`,
                {
                    method: "DELETE"
                }
            );

            closeDeleteDialog();

            await loadGoals();

            showMessage(
                data.message || "Goal deleted successfully.",
                "success"
            );
        } catch (error) {
            console.error("Deleting goal failed:", error);

            showMessage(
                error.message || "Could not delete this goal."
            );
        } finally {
            confirmDeleteButton.disabled = false;
            confirmDeleteButton.textContent = "Delete goal";
        }
    });
}


/* =========================================================
   17. SEARCH INPUT
   ========================================================= */

if (goalSearch) {
    goalSearch.addEventListener("input", () => {
        searchQuery = goalSearch.value.trim();

        renderGoals();
    });
}


/* =========================================================
   18. FILTER BUTTONS
   ========================================================= */

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter || "all";

        updateFilterButtons();
        renderGoals();
    });
});


/* =========================================================
   19. INITIALISE THE GOALS PAGE
   ========================================================= */

async function initialiseGoalsPage() {
    initialiseTheme();

    displayCurrentDate();

    updateMenuButton();

    updateFilterButtons();

    const authenticated = await loadCurrentUser();

    if (!authenticated) {
        return;
    }

    await loadGoals();
}


document.addEventListener(
    "DOMContentLoaded",
    initialiseGoalsPage
);