/**
 * =========================================================
 * STUDYTRACK V2 — REMINDERS
 * File: public/js/reminders.js
 *
 * Features:
 * - Load reminders from the existing authenticated API.
 * - Update reminder summary cards.
 * - Search, filter and sort reminders.
 * - Create, edit, complete, reopen and delete reminders.
 * - Handle loading, empty and error states.
 * - Preserve local reminder date and time.
 * - Safely render user-provided content.
 * - Support local sidebar tooltips for this page.
 * =========================================================
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initializeReminders();
});


// =========================================================
// MAIN INITIALIZATION
// =========================================================

function initializeReminders() {
    const elements = {
        list: document.getElementById("remindersList"),
        loading: document.getElementById("remindersLoading"),
        emptyState: document.getElementById("remindersEmptyState"),

        emptyTitle: document.getElementById("reminderEmptyStateTitle"),
        emptyMessage: document.getElementById("reminderEmptyStateMessage"),

        notification: document.getElementById("remindersNotification"),
        visibleCount: document.getElementById("visibleReminderCount"),

        search: document.getElementById("reminderSearch"),
        statusFilter: document.getElementById("reminderStatusFilter"),
        timeFilter: document.getElementById("reminderTimeFilter"),
        sortFilter: document.getElementById("reminderSortFilter"),

        total: document.getElementById("totalReminders"),
        pending: document.getElementById("pendingReminders"),
        upcoming: document.getElementById("upcomingReminders"),
        overdue: document.getElementById("overdueReminders"),
        completed: document.getElementById("completedReminders"),

        openAddButton: document.getElementById("openReminderModalButton"),
        emptyAddButton: document.getElementById("emptyStateAddReminderButton"),

        dialog: document.getElementById("reminderDialog"),
        form: document.getElementById("reminderForm"),
        formId: document.getElementById("reminderId"),
        formTitle: document.getElementById("reminderTitle"),
        formDescription: document.getElementById("reminderDescription"),
        formDateTime: document.getElementById("reminderDateTime"),
        formStatus: document.getElementById("reminderStatusField"),
        formError: document.getElementById("reminderFormError"),

        dialogTitle: document.getElementById("reminderDialogTitle"),
        dialogSubtitle: document.getElementById("reminderDialogSubtitle"),

        closeDialogButton: document.getElementById(
            "closeReminderModalButton"
        ),

        cancelDialogButton: document.getElementById(
            "cancelReminderModalButton"
        ),

        saveButton: document.getElementById("saveReminderButton"),

        deleteDialog: document.getElementById("deleteReminderDialog"),
        deleteName: document.getElementById("deleteReminderName"),

        cancelDeleteButton: document.getElementById(
            "cancelDeleteReminderButton"
        ),

        confirmDeleteButton: document.getElementById(
            "confirmDeleteReminderButton"
        )
    };

    const requiredElements = [
        elements.list,
        elements.loading,
        elements.emptyState,
        elements.emptyTitle,
        elements.emptyMessage,
        elements.search,
        elements.statusFilter,
        elements.timeFilter,
        elements.sortFilter,
        elements.dialog,
        elements.form,
        elements.formId,
        elements.formTitle,
        elements.formDescription,
        elements.formDateTime,
        elements.formStatus,
        elements.formError,
        elements.saveButton,
        elements.deleteDialog,
        elements.deleteName,
        elements.confirmDeleteButton
    ];

    if (requiredElements.some(element => !element)) {
        console.error(
            "StudyTrack Reminders: One or more required HTML elements are missing."
        );

        return;
    }

    const state = {
        reminders: [],
        reminderToDelete: null,
        notificationTimer: null,
        loading: false,
        saving: false,
        changingStatus: new Set(),
        deleting: false
    };

    // Initialize the page-specific tooltip behavior.
    initializeRemindersTooltips();


    // =====================================================
    // API HELPERS
    // =====================================================

    async function apiRequest(path, options = {}) {
        const requestOptions = {
            method: options.method || "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...(options.body !== undefined
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            }
        };

        if (options.body !== undefined) {
            requestOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(
            `/api/reminders${path}`,
            requestOptions
        );

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok || data.success === false) {
            if (response.status === 401) {
                throw new Error(
                    "Your session may have expired. Please log in again."
                );
            }

            if (response.status === 403) {
                throw new Error(
                    "You are not authorized to perform this action."
                );
            }

            throw new Error(
                data.message || "The request could not be completed."
            );
        }

        return data;
    }


    // =====================================================
    // DATE AND TIME HELPERS
    // =====================================================

    /**
     * Interpret database DATETIME values as local times.
     *
     * Expected examples:
     * 2026-10-27 14:30:00
     * 2026-10-27T14:30:00
     */

    function parseReminderDate(value) {
        if (typeof value !== "string") {
            return null;
        }

        const match = value.match(
            /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
        );

        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const hour = Number(match[4]);
        const minute = Number(match[5]);
        const second = Number(match[6] || 0);

        const date = new Date(
            year,
            month - 1,
            day,
            hour,
            minute,
            second,
            0
        );

        // Reject invalid calendar dates instead of silently normalizing them.
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day ||
            date.getHours() !== hour ||
            date.getMinutes() !== minute ||
            date.getSeconds() !== second
        ) {
            return null;
        }

        return date;
    }


    function formatDateTime(value) {
        const date = parseReminderDate(value);

        if (!date) {
            return "Date unavailable";
        }

        return new Intl.DateTimeFormat("en-KE", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    }


    function formatDateForInput(value) {
        if (typeof value !== "string") {
            return "";
        }

        // The datetime-local input expects YYYY-MM-DDTHH:mm.
        const normalized = value.trim().replace(" ", "T");

        const match = normalized.match(
            /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/
        );

        return match ? `${match[1]}T${match[2]}` : "";
    }


    function getLocalDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        // Correct format: YYYY-MM-DD, without additional spaces.
        return `${year}-${month}-${day}`;
    }


    function getReminderDateKey(value) {
        const date = parseReminderDate(value);

        return date ? getLocalDateKey(date) : "";
    }


    function getReminderTiming(reminder) {
        if (reminder.status === "completed") {
            return "completed";
        }

        const date = parseReminderDate(reminder.remind_at);

        if (!date) {
            return "invalid";
        }

        return date.getTime() < Date.now()
            ? "overdue"
            : "upcoming";
    }


    function getDefaultDateTime() {
        const date = new Date();

        date.setHours(date.getHours() + 1);
        date.setSeconds(0, 0);

        // Round up to the next five-minute interval.
        date.setMinutes(
            Math.ceil(date.getMinutes() / 5) * 5,
            0,
            0
        );

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");

        return `${year}-${month}-${day}T${hour}:${minute}`;
    }


    // =====================================================
    // NOTIFICATIONS
    // =====================================================

    function showNotification(message, type = "info") {
        window.clearTimeout(state.notificationTimer);

        elements.notification.textContent = message;

        // These class names match reminders.css.
        elements.notification.className =
            `reminders-notification is-${type}`;

        elements.notification.hidden = false;

        state.notificationTimer = window.setTimeout(() => {
            elements.notification.hidden = true;
        }, 5000);
    }


    function hideNotification() {
        window.clearTimeout(state.notificationTimer);

        elements.notification.hidden = true;
        elements.notification.textContent = "";
    }


    function showFormError(message) {
        elements.formError.textContent = message;
        elements.formError.hidden = false;
    }


    function clearFormError() {
        elements.formError.textContent = "";
        elements.formError.hidden = true;
    }


    // =====================================================
    // LOADING AND ERROR STATES
    // =====================================================

    function setLoading(isLoading) {
        state.loading = isLoading;
        elements.loading.hidden = !isLoading;

        if (isLoading) {
            elements.emptyState.hidden = true;
        }
    }


    function showListError(message) {
        elements.list.replaceChildren();

        const errorContainer = createElement(
            "div",
            "reminders-loading"
        );

        errorContainer.setAttribute("role", "alert");

        const messageElement = createElement(
            "span",
            "",
            message
        );

        const retryButton = createElement(
            "button",
            "secondary-button",
            "Try Again"
        );

        retryButton.type = "button";

        retryButton.addEventListener("click", () => {
            loadReminders();
        });

        errorContainer.append(messageElement, retryButton);
        elements.list.appendChild(errorContainer);

        elements.emptyState.hidden = true;
    }


    // =====================================================
    // SUMMARY CARDS
    // =====================================================

    function updateSummary(summary) {
        const values = {
            total: summary.total_reminders,
            pending: summary.pending_reminders,
            upcoming: summary.upcoming_reminders,
            overdue: summary.overdue_reminders,
            completed: summary.completed_reminders
        };

        for (const [key, value] of Object.entries(values)) {
            const element = elements[key];

            if (element) {
                const number = Number(value);

                element.textContent = Number.isFinite(number)
                    ? String(number)
                    : "0";
            }
        }
    }


    async function loadSummary() {
        try {
            const data = await apiRequest("/summary");

            if (data.summary) {
                updateSummary(data.summary);
            }
        } catch (error) {
            // A summary failure should not prevent the reminder list
            // from displaying.
            console.error(
                "StudyTrack Reminders: Could not load summary.",
                error
            );
        }
    }


    // =====================================================
    // FILTERING AND SORTING
    // =====================================================

    function getVisibleReminders() {
        const searchTerm = elements.search.value
            .trim()
            .toLocaleLowerCase();

        const selectedStatus = elements.statusFilter.value;
        const selectedTiming = elements.timeFilter.value;
        const selectedSort = elements.sortFilter.value;

        const todayKey = getLocalDateKey(new Date());

        const visible = state.reminders.filter(reminder => {
            const title = String(reminder.title || "")
                .toLocaleLowerCase();

            const description = String(reminder.description || "")
                .toLocaleLowerCase();

            const matchesSearch =
                !searchTerm ||
                title.includes(searchTerm) ||
                description.includes(searchTerm);

            const matchesStatus =
                selectedStatus === "all" ||
                reminder.status === selectedStatus;

            const timing = getReminderTiming(reminder);

            let matchesTiming = true;

            if (selectedTiming === "upcoming") {
                matchesTiming = timing === "upcoming";
            } else if (selectedTiming === "overdue") {
                matchesTiming = timing === "overdue";
            } else if (selectedTiming === "today") {
                matchesTiming =
                    getReminderDateKey(reminder.remind_at) === todayKey;
            }

            return (
                matchesSearch &&
                matchesStatus &&
                matchesTiming
            );
        });

        visible.sort((a, b) => {
            const dateA = parseReminderDate(a.remind_at);
            const dateB = parseReminderDate(b.remind_at);

            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;

            switch (selectedSort) {
                case "newest":
                    return (
                        new Date(b.created_at || 0).getTime() -
                        new Date(a.created_at || 0).getTime()
                    );

                case "oldest":
                    return (
                        new Date(a.created_at || 0).getTime() -
                        new Date(b.created_at || 0).getTime()
                    );

                case "updated_at":
                    return (
                        new Date(b.updated_at || 0).getTime() -
                        new Date(a.updated_at || 0).getTime()
                    );

                case "title":
                    return String(a.title || "").localeCompare(
                        String(b.title || ""),
                        undefined,
                        { sensitivity: "base" }
                    );

                case "remind_at":
                default:
                    return timeA - timeB;
            }
        });

        return visible;
    }


    // =====================================================
    // SAFE DOM HELPERS
    // =====================================================

    function createElement(tag, className = "", text = undefined) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }


    function createActionButton(
        label,
        action,
        className = ""
    ) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = [
            "reminder-action-button",
            className
        ].filter(Boolean).join(" ");

        button.textContent = label;
        button.addEventListener("click", action);

        return button;
    }


    // =====================================================
    // CREATE A REMINDER CARD
    // =====================================================

    function createReminderCard(reminder) {
        const completed = reminder.status === "completed";
        const timing = getReminderTiming(reminder);

        const card = createElement(
            "article",
            `reminder-card${completed ? " is-completed" : ""}`
        );

        card.dataset.reminderId = String(reminder.id);

        const main = createElement("div", "reminder-card-main");
        const titleRow = createElement("div", "reminder-card-top");

        const title = createElement(
            "h3",
            "reminder-card-title",
            reminder.title
        );

        const statusBadge = createElement(
            "span",
            `reminder-status ${completed ? "completed" : "pending"}`,
            completed ? "Completed" : "Pending"
        );

        titleRow.append(title, statusBadge);
        main.appendChild(titleRow);

        if (reminder.description) {
            const description = createElement(
                "p",
                "reminder-card-description",
                reminder.description
            );

            main.appendChild(description);
        }

        const meta = createElement("div", "reminder-card-meta");

        const dateLabel = createElement(
            "span",
            "reminder-card-date",
            `Scheduled: ${formatDateTime(reminder.remind_at)}`
        );

        meta.appendChild(dateLabel);

        if (!completed && timing === "overdue") {
            meta.appendChild(
                createElement(
                    "span",
                    "reminder-status overdue",
                    "Overdue"
                )
            );
        } else if (!completed && timing === "upcoming") {
            meta.appendChild(
                createElement(
                    "span",
                    "reminder-status upcoming",
                    "Upcoming"
                )
            );
        }

        main.appendChild(meta);

        const actions = createElement(
            "div",
            "reminder-card-actions"
        );

        if (!completed) {
            actions.appendChild(
                createActionButton(
                    "Mark Complete",
                    () => changeReminderStatus(reminder, "completed")
                )
            );
        } else {
            actions.appendChild(
                createActionButton(
                    "Reopen",
                    () => changeReminderStatus(reminder, "pending")
                )
            );
        }

        actions.appendChild(
            createActionButton(
                "Edit",
                () => openEditDialog(reminder)
            )
        );

        actions.appendChild(
            createActionButton(
                "Delete",
                () => openDeleteDialog(reminder),
                "delete"
            )
        );

        card.append(main, actions);

        return card;
    }


    // =====================================================
    // RENDER REMINDERS
    // =====================================================

    function renderReminders() {
        const visibleReminders = getVisibleReminders();

        elements.list.replaceChildren();
        elements.loading.hidden = true;

        if (visibleReminders.length === 0) {
            elements.emptyState.hidden = false;

            const hasAnyReminders = state.reminders.length > 0;

            if (hasAnyReminders) {
                elements.emptyTitle.textContent =
                    "No matching reminders";

                elements.emptyMessage.textContent =
                    "Try changing your search or filters to find a reminder.";
            } else {
                elements.emptyTitle.textContent =
                    "No reminders yet";

                elements.emptyMessage.textContent =
                    "Create your first reminder to keep important dates and commitments organised.";
            }

            if (elements.visibleCount) {
                elements.visibleCount.textContent = "0 reminders";
            }

            return;
        }

        elements.emptyState.hidden = true;

        const fragment = document.createDocumentFragment();

        visibleReminders.forEach(reminder => {
            fragment.appendChild(createReminderCard(reminder));
        });

        elements.list.appendChild(fragment);

        if (elements.visibleCount) {
            const count = visibleReminders.length;

            elements.visibleCount.textContent =
                `${count} ${count === 1 ? "reminder" : "reminders"}`;
        }
    }


    // =====================================================
    // LOAD REMINDERS
    // =====================================================

    async function loadReminders() {
        setLoading(true);
        hideNotification();

        try {
            const data = await apiRequest("");

            if (!Array.isArray(data.reminders)) {
                throw new Error(
                    "The server did not return a valid reminders list."
                );
            }

            state.reminders = data.reminders;

            renderReminders();

            await loadSummary();

            console.info(
                `StudyTrack Reminders: Loaded ${state.reminders.length} reminder(s).`
            );
        } catch (error) {
            console.error(
                "StudyTrack Reminders: Loading failed.",
                error
            );

            showListError(
                error.message || "Unable to load reminders."
            );

            showNotification(
                error.message || "Unable to load reminders.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    }


    // =====================================================
    // ADD REMINDER
    // =====================================================

    function openCreateDialog() {
        elements.form.reset();

        elements.formId.value = "";
        elements.formDateTime.value = getDefaultDateTime();
        elements.formStatus.value = "pending";

        clearFormError();

        elements.dialogTitle.textContent = "Create a Reminder";

        if (elements.dialogSubtitle) {
            elements.dialogSubtitle.textContent =
                "Choose what to remember and when it matters.";
        }

        elements.saveButton.textContent = "Save Reminder";
        elements.saveButton.disabled = false;

        if (!elements.dialog.open) {
            elements.dialog.showModal();
        }

        elements.formTitle.focus();
    }


    // =====================================================
    // EDIT REMINDER
    // =====================================================

    function openEditDialog(reminder) {
        elements.form.reset();

        elements.formId.value = String(reminder.id);
        elements.formTitle.value = reminder.title || "";
        elements.formDescription.value = reminder.description || "";
        elements.formDateTime.value = formatDateForInput(
            reminder.remind_at
        );
        elements.formStatus.value = reminder.status || "pending";

        clearFormError();

        elements.dialogTitle.textContent = "Edit Reminder";

        if (elements.dialogSubtitle) {
            elements.dialogSubtitle.textContent =
                "Update the reminder details below.";
        }

        elements.saveButton.textContent = "Save Changes";
        elements.saveButton.disabled = false;

        if (!elements.dialog.open) {
            elements.dialog.showModal();
        }

        elements.formTitle.focus();
    }


    function closeReminderDialog() {
        if (elements.dialog.open) {
            elements.dialog.close();
        }

        clearFormError();
    }


    // =====================================================
    // SAVE REMINDER
    // =====================================================

    async function saveReminder(event) {
        event.preventDefault();

        if (state.saving) {
            return;
        }

        clearFormError();

        if (!elements.form.reportValidity()) {
            return;
        }

        const reminderId = elements.formId.value.trim();

        const payload = {
            title: elements.formTitle.value.trim(),
            description: elements.formDescription.value.trim() || null,
            remind_at: elements.formDateTime.value,
            status: elements.formStatus.value
        };

        if (!payload.title) {
            showFormError("Please enter a reminder title.");
            elements.formTitle.focus();
            return;
        }

        if (!payload.remind_at) {
            showFormError("Please choose a reminder date and time.");
            elements.formDateTime.focus();
            return;
        }

        state.saving = true;
        elements.saveButton.disabled = true;
        elements.saveButton.textContent = "Saving...";

        try {
            if (reminderId) {
                // Correct URL: /api/reminders/:id
                await apiRequest(
                    `/${encodeURIComponent(reminderId)}`,
                    {
                        method: "PUT",
                        body: payload
                    }
                );

                closeReminderDialog();

                await loadReminders();

                showNotification(
                    "Reminder updated successfully.",
                    "success"
                );
            } else {
                await apiRequest("", {
                    method: "POST",
                    body: payload
                });

                closeReminderDialog();

                await loadReminders();

                showNotification(
                    "Reminder created successfully.",
                    "success"
                );
            }
        } catch (error) {
            console.error(
                "StudyTrack Reminders: Saving failed.",
                error
            );

            showFormError(
                error.message || "Unable to save the reminder."
            );
        } finally {
            state.saving = false;
            elements.saveButton.disabled = false;

            elements.saveButton.textContent =
                elements.formId.value.trim()
                    ? "Save Changes"
                    : "Save Reminder";
        }
    }


    // =====================================================
    // COMPLETE OR REOPEN REMINDER
    // =====================================================

    async function changeReminderStatus(reminder, status) {
        const reminderId = String(reminder.id);

        if (state.changingStatus.has(reminderId)) {
            return;
        }

        state.changingStatus.add(reminderId);

        try {
            // Correct URL: /api/reminders/:id/status
            await apiRequest(
                `/${encodeURIComponent(reminderId)}/status`,
                {
                    method: "PATCH",
                    body: { status }
                }
            );

            await loadReminders();

            showNotification(
                status === "completed"
                    ? "Reminder marked as completed."
                    : "Reminder reopened.",
                "success"
            );
        } catch (error) {
            console.error(
                "StudyTrack Reminders: Status update failed.",
                error
            );

            showNotification(
                error.message || "Unable to update reminder status.",
                "error"
            );
        } finally {
            state.changingStatus.delete(reminderId);
        }
    }


    // =====================================================
    // DELETE REMINDER
    // =====================================================

    function openDeleteDialog(reminder) {
        if (state.deleting) {
            return;
        }

        state.reminderToDelete = reminder;
        elements.deleteName.textContent = reminder.title || "this reminder";

        if (!elements.deleteDialog.open) {
            elements.deleteDialog.showModal();
        }
    }


    function closeDeleteDialog() {
        if (elements.deleteDialog.open) {
            elements.deleteDialog.close();
        }

        state.reminderToDelete = null;
    }


    async function deleteReminder() {
        const reminder = state.reminderToDelete;

        if (!reminder || state.deleting) {
            return;
        }

        state.deleting = true;

        elements.confirmDeleteButton.disabled = true;
        elements.confirmDeleteButton.textContent = "Deleting...";

        try {
            // Correct URL: /api/reminders/:id
            await apiRequest(
                `/${encodeURIComponent(String(reminder.id))}`,
                {
                    method: "DELETE"
                }
            );

            closeDeleteDialog();

            await loadReminders();

            showNotification(
                "Reminder deleted successfully.",
                "success"
            );
        } catch (error) {
            console.error(
                "StudyTrack Reminders: Delete failed.",
                error
            );

            showNotification(
                error.message || "Unable to delete the reminder.",
                "error"
            );
        } finally {
            state.deleting = false;
            elements.confirmDeleteButton.disabled = false;
            elements.confirmDeleteButton.textContent = "Delete Reminder";
        }
    }


    // =====================================================
    // EVENT LISTENERS
    // =====================================================

    elements.search.addEventListener("input", renderReminders);

    elements.statusFilter.addEventListener("change", renderReminders);

    elements.timeFilter.addEventListener("change", renderReminders);

    elements.sortFilter.addEventListener("change", renderReminders);


    if (elements.openAddButton) {
        elements.openAddButton.addEventListener(
            "click",
            openCreateDialog
        );
    }


    if (elements.emptyAddButton) {
        elements.emptyAddButton.addEventListener(
            "click",
            openCreateDialog
        );
    }


    elements.form.addEventListener("submit", saveReminder);


    if (elements.closeDialogButton) {
        elements.closeDialogButton.addEventListener(
            "click",
            closeReminderDialog
        );
    }


    if (elements.cancelDialogButton) {
        elements.cancelDialogButton.addEventListener(
            "click",
            closeReminderDialog
        );
    }


    if (elements.cancelDeleteButton) {
        elements.cancelDeleteButton.addEventListener(
            "click",
            closeDeleteDialog
        );
    }


    elements.confirmDeleteButton.addEventListener(
        "click",
        deleteReminder
    );


    // Clicking the form dialog backdrop closes the form.
    elements.dialog.addEventListener("click", event => {
        if (event.target === elements.dialog) {
            closeReminderDialog();
        }
    });


    // Clicking the delete dialog backdrop cancels deletion.
    elements.deleteDialog.addEventListener("click", event => {
        if (event.target === elements.deleteDialog) {
            closeDeleteDialog();
        }
    });


    // =====================================================
    // START THE PAGE
    // =====================================================

    loadReminders();
}


// =========================================================
// REMINDERS-LOCAL SIDEBAR TOOLTIPS
// =========================================================

/**
 * This tooltip controller belongs to the Reminders page.
 * It does not load or modify sidebar-tooltips.js.
 *
 * Tooltip appearance is defined in reminders.css.
 * Tooltips are shown only for the collapsed desktop sidebar.
 */

function initializeRemindersTooltips() {
    const layout = document.getElementById("appLayout");
    const sidebar = document.getElementById("sidebar");

    if (!layout || !sidebar) {
        return;
    }

    const tooltipTargets = sidebar.querySelectorAll(
        ".nav-link, .profile-shortcut, .sidebar-logout"
    );

    if (!tooltipTargets.length) {
        return;
    }

    let tooltip = document.getElementById(
        "remindersSidebarTooltip"
    );

    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "remindersSidebarTooltip";
        tooltip.className = "reminders-sidebar-tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.hidden = true;

        document.body.appendChild(tooltip);
    }

    let activeTarget = null;
    let hideTimer = null;

    function isTooltipEnabled() {
        return (
            window.matchMedia("(min-width: 851px)").matches &&
            layout.classList.contains("sidebar-collapsed")
        );
    }

    function getTooltipText(target) {
        const explicitText = target.dataset.tooltip;

        if (explicitText && explicitText.trim()) {
            return explicitText.trim();
        }

        if (target.classList.contains("sidebar-logout")) {
            return "Sign out";
        }

        return target.textContent
            .replace(/\s+/g, " ")
            .trim();
    }

    function hideTooltip() {
        window.clearTimeout(hideTimer);

        tooltip.hidden = true;
        tooltip.textContent = "";
        activeTarget = null;
    }

    function positionTooltip(target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        const gap = 12;
        const viewportPadding = 10;

        let left = rect.right + gap;

        if (
            left + tooltipRect.width >
            window.innerWidth - viewportPadding
        ) {
            left = window.innerWidth -
                tooltipRect.width -
                viewportPadding;
        }

        let top = rect.top + (rect.height - tooltipRect.height) / 2;

        top = Math.max(
            viewportPadding,
            Math.min(
                top,
                window.innerHeight -
                tooltipRect.height -
                viewportPadding
            )
        );

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    function showTooltip(target) {
        window.clearTimeout(hideTimer);

        if (!isTooltipEnabled()) {
            hideTooltip();
            return;
        }

        const text = getTooltipText(target);

        if (!text) {
            hideTooltip();
            return;
        }

        activeTarget = target;
        tooltip.textContent = text;
        tooltip.hidden = false;

        // Measure after the tooltip becomes visible.
        requestAnimationFrame(() => {
            if (
                activeTarget === target &&
                !tooltip.hidden &&
                isTooltipEnabled()
            ) {
                positionTooltip(target);
            }
        });
    }

    function scheduleHide() {
        window.clearTimeout(hideTimer);

        hideTimer = window.setTimeout(() => {
            hideTooltip();
        }, 80);
    }

    tooltipTargets.forEach(target => {
        // Keep tooltip labels local to the Reminders page.
        if (
            !target.dataset.tooltip &&
            target.classList.contains("sidebar-logout")
        ) {
            target.dataset.tooltip = "Sign out";
        }

        target.addEventListener("pointerenter", () => {
            showTooltip(target);
        });

        target.addEventListener("pointerleave", scheduleHide);

        target.addEventListener("focus", () => {
            showTooltip(target);
        });

        target.addEventListener("blur", scheduleHide);
    });

    tooltip.addEventListener("pointerenter", () => {
        window.clearTimeout(hideTimer);
    });

    tooltip.addEventListener("pointerleave", scheduleHide);

    document.addEventListener("pointerdown", event => {
        if (
            activeTarget &&
            !activeTarget.contains(event.target) &&
            !tooltip.contains(event.target)
        ) {
            hideTooltip();
        }
    });

    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);

    // Hide immediately when the sidebar expands or the viewport
    // changes to a mobile layout.
    const observer = new MutationObserver(() => {
        if (!isTooltipEnabled()) {
            hideTooltip();
        }
    });

    observer.observe(layout, {
        attributes: true,
        attributeFilter: ["class"]
    });

    window.matchMedia("(max-width: 850px)").addEventListener(
        "change",
        hideTooltip
    );
}