"use strict";

/* =========================================================
STUDYTRACK V2
TASKS PAGE
========================================================= */

document.addEventListener("DOMContentLoaded", initializeTasksPage);

/* =========================================================
APPLICATION STATE
========================================================= */

const TasksApp = {
    tasks: [],


summary: {
    total_tasks: 0,
    pending_tasks: 0,
    in_progress_tasks: 0,
    completed_tasks: 0,
    overdue_tasks: 0
},

editingTaskId: null,
deletingTaskId: null,
notificationTimer: null,
requestInProgress: false


};

/* =========================================================
DOM HELPERS
========================================================= */

function getTaskElement(id) {
    return document.getElementById(id);
}

function createTaskElement(tagName, className = "", text = "") {
    const element = document.createElement(tagName);

    
if (className) {
    element.className = className;
}

if (text !== undefined && text !== null) {
    element.textContent = String(text);
}

return element;


}

function createTaskButton({
    text,
    className = "",
    title = "",
    ariaLabel = "",
    type = "button"
}) {
    const button = document.createElement("button");

    
button.type = type;
button.className = className;
button.textContent = text;

if (title) {
    button.title = title;
}

if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
}

return button;


}

/* =========================================================
INITIALIZATION
========================================================= */

function initializeTasksPage() {
    initializeSidebar();
    initializeTaskDialogs();
    initializeTaskForm();
    initializeTaskFilters();
    initializeTaskActions();

    
loadTasksPage();


}

/* =========================================================
API REQUEST HELPER
========================================================= */

async function tasksApiRequest(url, options = {}) {
    const requestOptions = {
        method: options.method || "GET",
        credentials: "same-origin",


    headers: {
        Accept: "application/json",
        ...(options.headers || {})
    }
};

if (options.body !== undefined) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
}

let response;

try {
    response = await fetch(url, requestOptions);
} catch (error) {
    const networkError = new Error(
        "Unable to reach the StudyTrack server. Check that the server is running."
    );

    networkError.isNetworkError = true;

    throw networkError;
}

let result;

try {
    result = await response.json();
} catch (error) {
    result = {
        success: false,
        message: "The server returned an invalid response."
    };
}

if (response.status === 401) {
    showTaskNotification(
        "Your session has expired. Redirecting you to sign in.",
        "warning"
    );

    window.setTimeout(() => {
        window.location.href = "/index.html";
    }, 1200);

    const authError = new Error(
        "Your session has expired. Please sign in again."
    );

    authError.isAuthenticationError = true;

    throw authError;
}

if (!response.ok || result.success === false) {
    throw new Error(
        result.message || "The request could not be completed."
    );
}

return result;


}

/* =========================================================
LOAD TASKS PAGE
========================================================= */

async function loadTasksPage() {
    setTasksLoading(true);

    
try {
    await Promise.all([
        loadTaskList(),
        loadTaskSummary()
    ]);
} catch (error) {
    if (!error.isAuthenticationError) {
        console.error("Unable to load Tasks page:", error);

        showTaskNotification(
            error.message || "Unable to load your tasks.",
            "error"
        );
    }
} finally {
    setTasksLoading(false);
}


}

/* =========================================================
LOAD TASK LIST
========================================================= */

async function loadTaskList() {
    const statusElement = getTaskElement("statusFilter");
    const priorityElement = getTaskElement("priorityFilter");
    const searchElement = getTaskElement("taskSearch");

    
const query = new URLSearchParams();

const status = statusElement ? statusElement.value : "all";
const priority = priorityElement ? priorityElement.value : "all";
const search = searchElement ? searchElement.value.trim() : "";

if (status !== "all") {
    query.set("status", status);
}

if (priority !== "all") {
    query.set("priority", priority);
}

if (search) {
    query.set("search", search);
}

const queryString = query.toString();

const endpoint = queryString
    ? `/ api / tasks ? ${ queryString }`
    : "/api/tasks";

const result = await tasksApiRequest(endpoint);

TasksApp.tasks = Array.isArray(result.tasks)
    ? result.tasks
    : [];

renderTaskList();


}

/* =========================================================
LOAD SUMMARY STATISTICS
========================================================= */

async function loadTaskSummary() {
    const result = await tasksApiRequest("/api/tasks/summary");

    
if (result.summary) {
    TasksApp.summary = {
        ...TasksApp.summary,
        ...result.summary
    };
}

renderTaskSummary();


}

/* =========================================================
RENDER SUMMARY CARDS
========================================================= */

function renderTaskSummary() {
    const summary = TasksApp.summary;

    
setTextContent("totalTasks", summary.total_tasks ?? 0);
setTextContent("pendingTasks", summary.pending_tasks ?? 0);
setTextContent("inProgressTasks", summary.in_progress_tasks ?? 0);
setTextContent("completedTasks", summary.completed_tasks ?? 0);
setTextContent("overdueTasks", summary.overdue_tasks ?? 0);


}

function setTextContent(id, value) {
    const element = getTaskElement(id);

    
if (element) {
    element.textContent = String(value);
}


}

/* =========================================================
RENDER TASK LIST
========================================================= */

function renderTaskList() {
    const list = getTaskElement("tasksList");
    const emptyState = getTaskElement("tasksEmptyState");
    const loading = getTaskElement("tasksLoading");

    
if (!list || !emptyState) {
    return;
}

list.replaceChildren();

if (loading) {
    loading.hidden = true;
}

const tasks = sortTasks([...TasksApp.tasks]);
const count = tasks.length;

setTextContent(
    "visibleTaskCount",
    `${ count } ${ count === 1 ? "task" : "tasks" }`
);

if (count === 0) {
    emptyState.hidden = false;

    const statusElement = getTaskElement("statusFilter");
    const priorityElement = getTaskElement("priorityFilter");
    const searchElement = getTaskElement("taskSearch");

    const status = statusElement ? statusElement.value : "all";
    const priority = priorityElement ? priorityElement.value : "all";
    const search = searchElement ? searchElement.value.trim() : "";

    if (status !== "all" || priority !== "all" || search) {
        setTextContent("emptyStateTitle", "No matching tasks");

        setTextContent(
            "emptyStateMessage",
            "Try changing your search or filters to find your tasks."
        );

        setTextContent(
            "emptyStateAddButton",
            "＋ Create a task"
        );
    } else {
        setTextContent("emptyStateTitle", "Your task list is ready");

        setTextContent(
            "emptyStateMessage",
            "Add your first task and start organizing your day."
        );

        setTextContent(
            "emptyStateAddButton",
            "＋ Create your first task"
        );
    }

    return;
}

emptyState.hidden = true;

const fragment = document.createDocumentFragment();

tasks.forEach((task) => {
    fragment.appendChild(createTaskCard(task));
});

list.appendChild(fragment);


}

/* =========================================================
SORT TASKS
========================================================= */

function sortTasks(tasks) {
    const sortElement = getTaskElement("sortFilter");
    const sortMode = sortElement ? sortElement.value : "due_date";

    
const priorityOrder = {
    high: 3,
    medium: 2,
    low: 1
};

tasks.sort((a, b) => {
    switch (sortMode) {
        case "created_at":
        case "created_desc":
            return compareDates(a.created_at, b.created_at, false);

        case "created_asc":
            return compareDates(a.created_at, b.created_at, true);

        case "due_date":
        case "due_asc": {
            const aDate = normalizeDate(a.due_date) || "9999-12-31";
            const bDate = normalizeDate(b.due_date) || "9999-12-31";

            return aDate.localeCompare(bDate);
        }

        case "priority":
        case "priority_desc":
            return (
                (priorityOrder[b.priority] || 0) -
                (priorityOrder[a.priority] || 0)
            );

        case "title":
        case "title_asc":
            return String(a.title || "").localeCompare(
                String(b.title || ""),
                undefined,
                { sensitivity: "base" }
            );

        default:
            return compareDates(a.created_at, b.created_at, false);
    }
});

return tasks;


}

function compareDates(a, b, ascending) {
    const first = a ? new Date(a).getTime() : 0;
    const second = b ? new Date(b).getTime() : 0;

    
const difference = first - second;

return ascending ? difference : -difference;


}

/* =========================================================
CREATE A TASK CARD
========================================================= */

function createTaskCard(task) {
    const card = createTaskElement("article", "task-card");

    
card.dataset.taskId = String(task.id);

const completed = task.status === "completed";
const overdue = isTaskOverdue(task);

if (completed) {
    card.classList.add("task-is-completed");
}

if (overdue) {
    card.classList.add("task-is-overdue");
}

/* Completion checkbox */

const checkbox = createTaskButton({
    text: completed ? "✓" : "",
    className: "task-checkbox",
    title: completed ? "Mark as pending" : "Mark as completed",
    ariaLabel: completed
        ? `Mark ${ task.title } as pending`
        : `Mark ${ task.title } as completed`
});

checkbox.classList.toggle("is-checked", completed);

checkbox.addEventListener("click", () => {
    toggleTaskCompletion(task);
});

card.appendChild(checkbox);

/* Main task information */

const main = createTaskElement("div", "task-main");

main.appendChild(
    createTaskElement("h3", "task-title", task.title)
);

main.appendChild(
    createTaskElement(
        "p",
        "task-description",
        task.description || ""
    )
);

/* Task metadata */

const metadata = createTaskElement("div", "task-meta");

metadata.appendChild(
    createTaskElement(
        "span",
        `task - badge priority - ${ task.priority }`,
        `${ capitalize(task.priority) } priority`
    )
);

const statusLabel = getStatusLabel(task.status);

metadata.appendChild(
    createTaskElement(
        "span",
        `task - badge status - ${ statusLabel.className }`,
        statusLabel.text
    )
);

if (task.due_date) {
    const dueDate = createTaskElement("span", "task-due-date");

    dueDate.appendChild(createTaskElement("span", "", "◷"));

    dueDate.appendChild(
        document.createTextNode(
            ` Due ${ formatTaskDate(task.due_date) }`
        )
    );

    if (overdue) {
        dueDate.classList.add("is-overdue");

        dueDate.appendChild(
            document.createTextNode(" · Overdue")
        );
    } else if (isDueToday(task.due_date)) {
        dueDate.classList.add("is-today");

        dueDate.appendChild(
            document.createTextNode(" · Due today")
        );
    }

    metadata.appendChild(dueDate);
}

main.appendChild(metadata);
card.appendChild(main);

/* Task actions */

const actions = createTaskElement("div", "task-actions");

const editButton = createTaskButton({
    text: "✎",
    className: "task-action-button edit-task-button",
    title: "Edit task",
    ariaLabel: `Edit ${ task.title }`
});

editButton.addEventListener("click", () => {
    openEditTaskDialog(task);
});

actions.appendChild(editButton);

const deleteButton = createTaskButton({
    text: "×",
    className: "task-action-button delete-task-button",
    title: "Delete task",
    ariaLabel: `Delete ${ task.title }`
});

deleteButton.addEventListener("click", () => {
    openDeleteTaskDialog(task);
});

actions.appendChild(deleteButton);
card.appendChild(actions);

return card;


}

/* =========================================================
TASK STATUS HELPERS
========================================================= */

function getStatusLabel(status) {
    switch (status) {
        case "in_progress":
            return {
                text: "In Progress",
                className: "in-progress"
            };

            
    case "completed":
        return {
            text: "Completed",
            className: "completed"
        };

    case "pending":
    default:
        return {
            text: "Pending",
            className: "pending"
        };
}


    }

    function capitalize(value) {
        const text = String(value || "");

        
if (!text) {
    return "";
}

return text.charAt(0).toUpperCase() + text.slice(1);


    }

    /* =========================================================
    DATE HELPERS
    ========================================================= */

    function getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        
return `${ year } -${ month } -${ day }`;


    }

    function normalizeDate(dateValue) {
        if (!dateValue) {
            return "";
        }

        
if (typeof dateValue === "string") {
    const match = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);

    if (match) {
        return match[1];
    }
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
    return "";
}

return getLocalDateString(date);


    }

    function isTaskOverdue(task) {
        if (!task.due_date || task.status === "completed") {
            return false;
        }

        
const dueDate = normalizeDate(task.due_date);

if (!dueDate) {
    return false;
}

return dueDate < getLocalDateString();


    }

    function isDueToday(dateValue) {
        return normalizeDate(dateValue) === getLocalDateString();
    }

    function formatTaskDate(dateValue) {
        const normalized = normalizeDate(dateValue);

        
if (!normalized) {
    return "No date";
}

const parts = normalized.split("-").map(Number);

const date = new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
);

return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
}).format(date);


    }

    /* =========================================================
    LOADING INDICATOR
    ========================================================= */

    function setTasksLoading(isLoading) {
        const loading = getTaskElement("tasksLoading");
        const emptyState = getTaskElement("tasksEmptyState");

        
if (loading) {
    loading.hidden = !isLoading;
}

if (isLoading && emptyState) {
    emptyState.hidden = true;
}


    }

    /* =========================================================
    TASK NOTIFICATIONS
    ========================================================= */

    function showTaskNotification(message, type = "success") {
        const notification = getTaskElement("tasksNotification");

        
if (!notification) {
    return;
}

if (TasksApp.notificationTimer) {
    clearTimeout(TasksApp.notificationTimer);
}

notification.textContent = message;
notification.className = `tasks - notification ${ type }`;
notification.hidden = false;

if (type !== "error" && type !== "warning") {
    TasksApp.notificationTimer = window.setTimeout(() => {
        notification.hidden = true;
    }, 4000);
}


    }

    /* =========================================================
    TASK FILTERS
    ========================================================= */

    function initializeTaskFilters() {
        const search = getTaskElement("taskSearch");
        const status = getTaskElement("statusFilter");
        const priority = getTaskElement("priorityFilter");
        const sort = getTaskElement("sortFilter");

        
let searchTimer;

if (search) {
    search.addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer = window.setTimeout(() => {
            refreshTaskList();
        }, 250);
    });
}

if (status) {
    status.addEventListener("change", refreshTaskList);
}

if (priority) {
    priority.addEventListener("change", refreshTaskList);
}

if (sort) {
    sort.addEventListener("change", renderTaskList);
}


    }

    async function refreshTaskList() {
        try {
            await loadTaskList();
        } catch (error) {
            if (!error.isAuthenticationError) {
                showTaskNotification(
                    error.message || "Unable to filter tasks.",
                    "error"
                );
            }
        }
    }

    /* =========================================================
    DIALOG INITIALIZATION
    ========================================================= */

    function initializeTaskDialogs() {
        const taskDialog = getTaskElement("taskDialog");
        const deleteDialog = getTaskElement("deleteTaskDialog");

        
const openButton = getTaskElement("openTaskModalButton");
const emptyStateButton = getTaskElement("emptyStateAddButton");
const closeButton = getTaskElement("closeTaskModalButton");

/*
 * The HTML uses cancelTaskModalButton.
 * Do not look for the nonexistent cancelTaskButton.
 */
const cancelButton = getTaskElement("cancelTaskModalButton");

const cancelDeleteButton = getTaskElement("cancelDeleteButton");
const confirmDeleteButton = getTaskElement("confirmDeleteButton");

if (openButton) {
    openButton.addEventListener("click", openCreateTaskDialog);
}

if (emptyStateButton) {
    emptyStateButton.addEventListener("click", openCreateTaskDialog);
}

if (closeButton) {
    closeButton.addEventListener("click", closeTaskDialog);
}

if (cancelButton) {
    cancelButton.addEventListener("click", closeTaskDialog);
}

if (cancelDeleteButton) {
    cancelDeleteButton.addEventListener("click", closeDeleteTaskDialog);
}

if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener("click", deleteSelectedTask);
}

if (taskDialog) {
    taskDialog.addEventListener("click", (event) => {
        if (event.target === taskDialog) {
            closeTaskDialog();
        }
    });
}

if (deleteDialog) {
    deleteDialog.addEventListener("click", (event) => {
        if (event.target === deleteDialog) {
            closeDeleteTaskDialog();
        }
    });
}


    }

    /* =========================================================
    CREATE TASK DIALOG
    ========================================================= */

    function openCreateTaskDialog() {
        TasksApp.editingTaskId = null;

        
const form = getTaskElement("taskForm");

if (!form) {
    return;
}

form.reset();

const taskId = getTaskElement("taskId");
const priority = getTaskElement("taskPriority");
const status = getTaskElement("taskStatus");
const statusField = getTaskElement("taskStatusField");

if (taskId) {
    taskId.value = "";
}

setTextContent("taskDialogTitle", "Create a task");

setTextContent(
    "taskDialogSubtitle",
    "Add the details you need to stay on track."
);

setTextContent("saveTaskButton", "Save Task");

if (priority) {
    priority.value = "medium";
}

if (status) {
    status.value = "pending";
}

if (statusField) {
    statusField.value = "pending";
    statusField.hidden = true;
}

clearTaskFormError();

openDialog(getTaskElement("taskDialog"));

window.setTimeout(() => {
    const title = getTaskElement("taskTitle");

    if (title) {
        title.focus();
    }
}, 50);


    }

    /* =========================================================
    EDIT TASK DIALOG
    ========================================================= */

    function openEditTaskDialog(task) {
        TasksApp.editingTaskId = task.id;

        
const taskId = getTaskElement("taskId");
const title = getTaskElement("taskTitle");
const description = getTaskElement("taskDescription");
const dueDate = getTaskElement("taskDueDate");
const priority = getTaskElement("taskPriority");
const status = getTaskElement("taskStatus");
const statusField = getTaskElement("taskStatusField");

if (taskId) {
    taskId.value = String(task.id);
}

if (title) {
    title.value = task.title || "";
}

if (description) {
    description.value = task.description || "";
}

if (dueDate) {
    dueDate.value = normalizeDate(task.due_date);
}

if (priority) {
    priority.value = task.priority || "medium";
}

if (status) {
    status.value = task.status || "pending";
}

if (statusField) {
    statusField.value = task.status || "pending";
    statusField.hidden = false;
}

setTextContent("taskDialogTitle", "Edit task");

setTextContent(
    "taskDialogSubtitle",
    "Update your task details and progress."
);

setTextContent("saveTaskButton", "Save Changes");

clearTaskFormError();

openDialog(getTaskElement("taskDialog"));


    }

    /* =========================================================
    SHOW AND CLOSE DIALOGS
    ========================================================= */

    function openDialog(dialog) {
        if (!dialog) {
            return;
        }

        
if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
        dialog.showModal();
    }
} else {
    dialog.setAttribute("open", "");
}


    }

    function closeTaskDialog() {
        const dialog = getTaskElement("taskDialog");

        
if (dialog) {
    if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
    } else {
        dialog.removeAttribute("open");
    }
}

TasksApp.editingTaskId = null;

clearTaskFormError();


    }

    function closeDeleteTaskDialog() {
        const dialog = getTaskElement("deleteTaskDialog");

        
if (dialog) {
    if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
    } else {
        dialog.removeAttribute("open");
    }
}

TasksApp.deletingTaskId = null;


    }

    /* =========================================================
    TASK FORM
    ========================================================= */

    function initializeTaskForm() {
        const form = getTaskElement("taskForm");

        
if (form) {
    form.addEventListener("submit", saveTask);
}

/*
 * Keep the hidden status field synchronized with the visible
 * status selector for compatibility with the existing markup.
 */
const statusField = getTaskElement("taskStatusField");
const hiddenStatus = getTaskElement("taskStatus");

if (statusField && hiddenStatus) {
    statusField.addEventListener("change", () => {
        hiddenStatus.value = statusField.value;
    });
}


    }

    async function saveTask(event) {
        event.preventDefault();

        
if (TasksApp.requestInProgress) {
    return;
}

const titleElement = getTaskElement("taskTitle");
const descriptionElement = getTaskElement("taskDescription");
const dueDateElement = getTaskElement("taskDueDate");
const priorityElement = getTaskElement("taskPriority");
const statusElement = getTaskElement("taskStatusField");

if (
    !titleElement ||
    !descriptionElement ||
    !dueDateElement ||
    !priorityElement
) {
    showTaskFormError("Some task form fields could not be found.");
    return;
}

const title = titleElement.value.trim();
const description = descriptionElement.value.trim();
const dueDate = dueDateElement.value;
const priority = priorityElement.value;

const status = statusElement
    ? statusElement.value
    : "pending";

if (!title) {
    showTaskFormError("Please enter a task title.");
    titleElement.focus();
    return;
}

if (title.length > 150) {
    showTaskFormError(
        "The task title cannot exceed 150 characters."
    );
    return;
}

const taskData = {
    title,
    description,
    due_date: dueDate || null,
    priority
};

const editingId = TasksApp.editingTaskId;
const isEditing = editingId !== null;

if (isEditing) {
    taskData.status = status;
}

const saveButton = getTaskElement("saveTaskButton");

TasksApp.requestInProgress = true;

if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = isEditing
        ? "Saving Changes..."
        : "Creating Task...";
}

clearTaskFormError();

try {
    if (isEditing) {
        await tasksApiRequest(
            `/ api / tasks / ${ encodeURIComponent(editingId) }`,
            {
                method: "PUT",
                body: taskData
            }
        );

        closeTaskDialog();

        showTaskNotification(
            "Task updated successfully.",
            "success"
        );
    } else {
        await tasksApiRequest("/api/tasks", {
            method: "POST",
            body: taskData
        });

        closeTaskDialog();

        showTaskNotification(
            "Task created successfully.",
            "success"
        );
    }

    await reloadTasksAfterMutation();
} catch (error) {
    if (!error.isAuthenticationError) {
        showTaskFormError(
            error.message || "Unable to save this task."
        );
    }
} finally {
    TasksApp.requestInProgress = false;

    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = isEditing
            ? "Save Changes"
            : "Save Task";
    }
}


    }

    /* =========================================================
    FORM ERRORS
    ========================================================= */

    function showTaskFormError(message) {
        const errorBox = getTaskElement("taskFormError");

        
if (!errorBox) {
    showTaskNotification(message, "error");
    return;
}

errorBox.textContent = message;
errorBox.hidden = false;


    }

    function clearTaskFormError() {
        const errorBox = getTaskElement("taskFormError");

        
if (errorBox) {
    errorBox.textContent = "";
    errorBox.hidden = true;
}


    }

    /* =========================================================
    COMPLETE OR REOPEN TASK
    ========================================================= */

    async function toggleTaskCompletion(task) {
        if (TasksApp.requestInProgress) {
            return;
        }

        
const newStatus = task.status === "completed"
    ? "pending"
    : "completed";

TasksApp.requestInProgress = true;

try {
    await tasksApiRequest(
        `/ api / tasks / ${ encodeURIComponent(task.id) }/status`,
        {
            method: "PATCH",
                body: {
                status: newStatus
            }
        }
    );

        showTaskNotification(
            newStatus === "completed"
                ? "Task marked as completed."
                : "Task moved back to pending.",
            "success"
        );

        await reloadTasksAfterMutation();
    } catch (error) {
        if (!error.isAuthenticationError) {
            showTaskNotification(
                error.message || "Unable to update task status.",
                "error"
            );
        }
    } finally {
        TasksApp.requestInProgress = false;
    }
    

}

/* =========================================================
DELETE TASK DIALOG
========================================================= */

function openDeleteTaskDialog(task) {
TasksApp.deletingTaskId = task.id;


    setTextContent("deleteTaskName", task.title);

    openDialog(getTaskElement("deleteTaskDialog"));
    

}

/* =========================================================
DELETE TASK
========================================================= */

async function deleteSelectedTask() {
const taskId = TasksApp.deletingTaskId;


    if (taskId === null || TasksApp.requestInProgress) {
        return;
    }

    const deleteButton = getTaskElement("confirmDeleteButton");

    TasksApp.requestInProgress = true;

    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";
    }

    try {
        await tasksApiRequest(
            `/api/tasks/${encodeURIComponent(taskId)}`,
            {
                method: "DELETE"
            }
        );

        closeDeleteTaskDialog();

        showTaskNotification(
            "Task deleted successfully.",
            "success"
        );

        await reloadTasksAfterMutation();
    } catch (error) {
        if (!error.isAuthenticationError) {
            showTaskNotification(
                error.message || "Unable to delete this task.",
                "error"
            );
        }
    } finally {
        TasksApp.requestInProgress = false;

        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete Task";
        }
    }
    

}

/* =========================================================
RELOAD AFTER CREATE, EDIT, COMPLETE, OR DELETE
========================================================= */

async function reloadTasksAfterMutation() {
await Promise.all([
loadTaskList(),
loadTaskSummary()
]);
}

/* =========================================================
SIDEBAR
========================================================= */

/*

* The sidebar toggle and saved sidebar state are handled by the
* shared inline controls in tasks.html. Do not attach another
* click handler here, because that would toggle the sidebar twice.
  */
  function initializeSidebar() {
  const layout = document.querySelector(".app-layout");
  const toggle = getTaskElement("sidebarToggle");

  if (!layout || !toggle) {
  return;
  }

  const collapsed = layout.classList.contains("sidebar-collapsed");

  toggle.setAttribute("aria-expanded", String(!collapsed));

  toggle.setAttribute(
  "aria-label",
  collapsed ? "Expand sidebar" : "Collapse sidebar"
  );
  }

/* =========================================================
TASK ACTIONS INITIALIZATION
========================================================= */

function initializeTaskActions() {
/*
* Edit, delete, and completion handlers are attached to each
* task card inside createTaskCard().
*
* They are initialized whenever renderTaskList() creates
* the task cards.
*/
}
