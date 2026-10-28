/* =========================================================
   STUDYTRACK V2
   FOCUS TIMER JAVASCRIPT

   File: public/js/focus.js

   Features:
   - Pomodoro focus timer
   - Focus, short break and long break modes
   - Start, pause, resume, reset and skip controls
   - Custom timer durations
   - Timer state persistence across page refreshes
   - Accurate countdown using timestamps
   - Day and night themes
   - Authentication checks
   - Completed-session recording
   - Daily statistics
   - Recent session history
   - Responsive sidebar controls
   ========================================================= */


/* =========================================================
   1. CONFIGURATION
   ========================================================= */

const FOCUS_API_BASE = "/api/focus";

const FOCUS_STORAGE_KEY = "studytrack-v2-focus-state";
const FOCUS_SETTINGS_KEY = "studytrack-v2-focus-settings";
const FOCUS_THEME_KEY = "studytrack-v2-theme";

const FOCUS_MODES = {
    focus: {
        label: "Focus",
        clockLabel: "FOCUS SESSION",
        description: "Time to concentrate",
        duration: 25 * 60,
        nextMode: "short_break"
    },

    short_break: {
        label: "Short Break",
        clockLabel: "SHORT BREAK",
        description: "Take a breather",
        duration: 5 * 60,
        nextMode: "focus"
    },

    long_break: {
        label: "Long Break",
        clockLabel: "LONG BREAK",
        description: "Rest and recharge",
        duration: 15 * 60,
        nextMode: "focus"
    }
};

const MIN_DURATIONS = {
    focus: 1,
    short_break: 1,
    long_break: 1
};

const MAX_DURATIONS = {
    focus: 180,
    short_break: 60,
    long_break: 90
};

const HISTORY_LIMIT = 20;


/* =========================================================
   2. SELECT HTML ELEMENTS
   ========================================================= */

const focusAppLayout = document.querySelector(".app-layout");
const focusSidebar = document.getElementById("sidebar");
const focusMenuButton = document.getElementById("menuButton");

const focusLogoutButton = document.getElementById("logoutButton");

const focusDayThemeButton =
    document.getElementById("dayThemeButton");

const focusNightThemeButton =
    document.getElementById("nightThemeButton");

const focusSidebarUserName =
    document.getElementById("sidebarUserName");

const focusSidebarAvatar =
    document.getElementById("sidebarAvatar");

const focusCurrentDate =
    document.getElementById("focusCurrentDate");

const focusMessage =
    document.getElementById("focusMessage");

const focusProgressRing =
    document.getElementById("focusProgressRing");

const focusClock =
    document.getElementById("focusClock");

const focusClockMode =
    document.getElementById("focusClockMode");

const focusClockCaption =
    document.getElementById("focusClockCaption");

const focusTimerStateLabel =
    document.getElementById("timerStateLabel");

const focusLiveIndicator =
    document.querySelector(".focus-live-indicator");

const focusTimerHint =
    document.getElementById("focusTimerHint");

const focusStartPauseButton =
    document.getElementById("startPauseButton");

const focusStartPauseIcon =
    document.getElementById("startPauseIcon");

const focusStartPauseLabel =
    document.getElementById("startPauseLabel");

const focusResetButton =
    document.getElementById("resetTimerButton");

const focusSkipButton =
    document.getElementById("skipSessionButton");

const focusModeButtons = Array.from(
    document.querySelectorAll("[data-session-type]")
);

const focusSettingsForm =
    document.getElementById("focusSettingsForm");

const focusDurationInput =
    document.getElementById("focusDuration");

const focusShortBreakInput =
    document.getElementById("shortBreakDuration");

const focusLongBreakInput =
    document.getElementById("longBreakDuration");

const focusSaveSettingsButton =
    document.getElementById("saveFocusSettingsButton");

const focusCompletedSessions =
    document.getElementById("completedFocusSessions");

const focusTotalFocusTime =
    document.getElementById("totalFocusTime");

const focusCompletedBreakSessions =
    document.getElementById("completedBreakSessions");

const focusHistoryBody =
    document.getElementById("focusHistoryBody");

const focusHistoryCount =
    document.getElementById("focusHistoryCount");

const focusRefreshHistoryButton =
    document.getElementById("refreshFocusHistoryButton");


/* =========================================================
   3. TIMER STATE
   ========================================================= */

let focusDurations = {
    focus: FOCUS_MODES.focus.duration,
    short_break: FOCUS_MODES.short_break.duration,
    long_break: FOCUS_MODES.long_break.duration
};

let currentMode = "focus";

let remainingSeconds = focusDurations.focus;

let timerStatus = "idle";

/*
   Supported timer states:

   idle     = timer has not started
   running  = countdown is active
   paused   = countdown is paused
   complete = current session has finished
*/

let timerEndTimestamp = null;

let timerInterval = null;

let authenticationVerified = false;

let completionInProgress = false;

let lastCompletedSessionId = null;


/* =========================================================
   4. STATUS MESSAGES
   ========================================================= */

function showFocusMessage(message, type = "error") {
    if (!focusMessage) {
        return;
    }

    focusMessage.textContent = message;

    focusMessage.classList.remove(
        "is-error",
        "is-success"
    );

    focusMessage.classList.add(
        type === "success"
            ? "is-success"
            : "is-error"
    );

    focusMessage.hidden = false;
}


function clearFocusMessage() {
    if (!focusMessage) {
        return;
    }

    focusMessage.textContent = "";

    focusMessage.classList.remove(
        "is-error",
        "is-success"
    );

    focusMessage.hidden = true;
}


/* =========================================================
   5. SAFE LOCAL STORAGE HELPERS
   ========================================================= */

function readStoredJSON(key) {
    try {
        const storedValue = localStorage.getItem(key);

        if (!storedValue) {
            return null;
        }

        return JSON.parse(storedValue);

    } catch (error) {
        console.warn(
            "StudyTrack could not read saved data:",
            error
        );

        return null;
    }
}


function writeStoredJSON(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {
        console.warn(
            "StudyTrack could not save local data:",
            error
        );

        return false;
    }
}


function removeStoredValue(key) {
    try {
        localStorage.removeItem(key);

    } catch (error) {
        console.warn(
            "StudyTrack could not clear saved data:",
            error
        );
    }
}


/* =========================================================
   6. TIMER SETTINGS
   ========================================================= */

function loadFocusSettings() {
    const savedSettings = readStoredJSON(
        FOCUS_SETTINGS_KEY
    );

    if (!savedSettings || typeof savedSettings !== "object") {
        updateSettingsInputs();
        return;
    }

    const definitions = [
        {
            key: "focus",
            minimum: MIN_DURATIONS.focus,
            maximum: MAX_DURATIONS.focus
        },
        {
            key: "short_break",
            minimum: MIN_DURATIONS.short_break,
            maximum: MAX_DURATIONS.short_break
        },
        {
            key: "long_break",
            minimum: MIN_DURATIONS.long_break,
            maximum: MAX_DURATIONS.long_break
        }
    ];

    for (const definition of definitions) {
        const value = Number(
            savedSettings[definition.key]
        );

        if (
            Number.isInteger(value) &&
            value >= definition.minimum &&
            value <= definition.maximum
        ) {
            focusDurations[definition.key] = value * 60;
        }
    }

    updateSettingsInputs();
}


function updateSettingsInputs() {
    if (focusDurationInput) {
        focusDurationInput.value = String(
            focusDurations.focus / 60
        );
    }

    if (focusShortBreakInput) {
        focusShortBreakInput.value = String(
            focusDurations.short_break / 60
        );
    }

    if (focusLongBreakInput) {
        focusLongBreakInput.value = String(
            focusDurations.long_break / 60
        );
    }
}


function validateSettingsForm() {
    const values = [
        {
            key: "focus",
            input: focusDurationInput
        },
        {
            key: "short_break",
            input: focusShortBreakInput
        },
        {
            key: "long_break",
            input: focusLongBreakInput
        }
    ];

    for (const item of values) {
        if (!item.input) {
            return null;
        }

        const value = Number(item.input.value);

        if (
            !Number.isInteger(value) ||
            value < MIN_DURATIONS[item.key] ||
            value > MAX_DURATIONS[item.key]
        ) {
            item.input.focus();

            showFocusMessage(
                `${FOCUS_MODES[item.key].label} duration must be between ` +
                `${MIN_DURATIONS[item.key]} and ` +
                `${MAX_DURATIONS[item.key]} minutes.`
            );

            return null;
        }
    }

    return {
        focus: Number(focusDurationInput.value),
        short_break: Number(focusShortBreakInput.value),
        long_break: Number(focusLongBreakInput.value)
    };
}


function saveFocusSettings(event) {
    event.preventDefault();

    clearFocusMessage();

    if (timerStatus === "running") {
        showFocusMessage(
            "Pause the timer before changing your session durations."
        );

        return;
    }

    const settings = validateSettingsForm();

    if (!settings) {
        return;
    }

    focusDurations = {
        focus: settings.focus * 60,
        short_break: settings.short_break * 60,
        long_break: settings.long_break * 60
    };

    writeStoredJSON(
        FOCUS_SETTINGS_KEY,
        settings
    );

    remainingSeconds = focusDurations[currentMode];

    timerStatus = "idle";

    timerEndTimestamp = null;

    lastCompletedSessionId = null;

    removeStoredValue(FOCUS_STORAGE_KEY);

    updateTimerDisplay();

    updateTimerControls();

    saveTimerState();

    showFocusMessage(
        "Your timer settings have been saved.",
        "success"
    );
}


/* =========================================================
   7. TIMER STATE PERSISTENCE
   ========================================================= */

function saveTimerState() {
    const state = {
        version: 1,
        currentMode,
        remainingSeconds,
        timerStatus,
        timerEndTimestamp,
        savedAt: Date.now()
    };

    writeStoredJSON(
        FOCUS_STORAGE_KEY,
        state
    );
}


function restoreTimerState() {
    const savedState = readStoredJSON(
        FOCUS_STORAGE_KEY
    );

    if (!savedState || typeof savedState !== "object") {
        remainingSeconds = focusDurations[currentMode];
        updateTimerDisplay();
        return;
    }

    if (
        !Object.prototype.hasOwnProperty.call(
            FOCUS_MODES,
            savedState.currentMode
        )
    ) {
        removeStoredValue(FOCUS_STORAGE_KEY);

        remainingSeconds = focusDurations.focus;

        updateTimerDisplay();

        return;
    }

    currentMode = savedState.currentMode;

    const maximumDuration = focusDurations[currentMode];

    const savedRemaining = Number(
        savedState.remainingSeconds
    );

    if (
        !Number.isFinite(savedRemaining) ||
        savedRemaining < 0 ||
        savedRemaining > maximumDuration
    ) {
        remainingSeconds = maximumDuration;

        timerStatus = "idle";

        timerEndTimestamp = null;

        updateTimerDisplay();

        saveTimerState();

        return;
    }

    remainingSeconds = savedRemaining;

    const validStatuses = [
        "idle",
        "running",
        "paused",
        "complete"
    ];

    timerStatus = validStatuses.includes(
        savedState.timerStatus
    )
        ? savedState.timerStatus
        : "idle";

    timerEndTimestamp = Number.isFinite(
        Number(savedState.timerEndTimestamp)
    )
        ? Number(savedState.timerEndTimestamp)
        : null;

    if (
        timerStatus === "running" &&
        !timerEndTimestamp
    ) {
        timerStatus = "paused";
    }

    if (timerStatus === "running") {
        remainingSeconds = Math.max(
            0,
            Math.ceil(
                (timerEndTimestamp - Date.now()) / 1000
            )
        );
    }

    if (timerStatus === "complete") {
        remainingSeconds = 0;
    }

    updateTimerDisplay();
}


/* =========================================================
   8. TIMER DISPLAY HELPERS
   ========================================================= */

function formatClock(totalSeconds) {
    const safeSeconds = Math.max(
        0,
        Math.floor(totalSeconds)
    );

    const minutes = Math.floor(
        safeSeconds / 60
    );

    const seconds = safeSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}


function formatDuration(totalSeconds) {
    const safeSeconds = Math.max(
        0,
        Math.floor(Number(totalSeconds) || 0)
    );

    const hours = Math.floor(
        safeSeconds / 3600
    );

    const minutes = Math.floor(
        (safeSeconds % 3600) / 60
    );

    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
        return `${hours}h`;
    }

    if (minutes > 0) {
        return `${minutes}m`;
    }

    return `${safeSeconds}s`;
}


function updateTimerDisplay() {
    const mode = FOCUS_MODES[currentMode];

    if (!mode) {
        return;
    }

    if (focusClock) {
        focusClock.textContent = formatClock(
            remainingSeconds
        );

        focusClock.setAttribute(
            "aria-label",
            `${formatClock(remainingSeconds)} remaining`
        );

        focusClock.setAttribute(
            "datetime",
            `PT${Math.max(0, Math.floor(remainingSeconds))}S`
        );
    }

    if (focusClockMode) {
        focusClockMode.textContent = mode.clockLabel;
    }

    if (focusClockCaption) {
        if (timerStatus === "complete") {
            focusClockCaption.textContent =
                "Session completed";
        } else if (timerStatus === "paused") {
            focusClockCaption.textContent =
                "Your timer is paused";
        } else if (timerStatus === "running") {
            focusClockCaption.textContent =
                currentMode === "focus"
                    ? "Stay with your task"
                    : "Enjoy your break";
        } else {
            focusClockCaption.textContent =
                mode.description;
        }
    }

    if (focusProgressRing) {
        const totalDuration = focusDurations[currentMode];

        const progress = totalDuration > 0
            ? Math.min(
                1,
                Math.max(
                    0,
                    remainingSeconds / totalDuration
                )
            )
            : 0;

        const percentage = progress * 100;

        focusProgressRing.style.setProperty(
            "--focus-progress",
            `${percentage}%`
        );

        focusProgressRing.setAttribute(
            "aria-label",
            `Timer progress: ${Math.round(percentage)} percent remaining`
        );
    }

    document.title =
        timerStatus === "running"
            ? `${formatClock(remainingSeconds)} | ${mode.label} | StudyTrack`
            : "Focus Timer | StudyTrack";
}


/* =========================================================
   9. TIMER CONTROL DISPLAY
   ========================================================= */

function updateTimerControls() {
    if (focusStartPauseButton) {
        focusStartPauseButton.disabled =
            timerStatus === "complete" ||
            completionInProgress;

        if (timerStatus === "running") {
            focusStartPauseButton.disabled = false;
        }
    }

    if (focusStartPauseLabel) {
        if (timerStatus === "running") {
            focusStartPauseLabel.textContent = "Pause";
        } else if (timerStatus === "paused") {
            focusStartPauseLabel.textContent = "Resume";
        } else if (timerStatus === "complete") {
            focusStartPauseLabel.textContent = "Completed";
        } else {
            focusStartPauseLabel.textContent =
                currentMode === "focus"
                    ? "Start Focus"
                    : "Start Break";
        }
    }

    if (focusStartPauseIcon) {
        focusStartPauseIcon.textContent =
            timerStatus === "running"
                ? "Ⅱ"
                : timerStatus === "complete"
                    ? "✓"
                    : "▶";
    }

    if (focusTimerStateLabel) {
        focusTimerStateLabel.textContent =
            timerStatus === "running"
                ? "Session in progress"
                : timerStatus === "paused"
                    ? "Session paused"
                    : timerStatus === "complete"
                        ? "Session completed"
                        : "Ready to focus";
    }

    if (focusLiveIndicator) {
        focusLiveIndicator.classList.toggle(
            "is-running",
            timerStatus === "running"
        );

        focusLiveIndicator.classList.toggle(
            "is-paused",
            timerStatus === "paused"
        );

        focusLiveIndicator.classList.toggle(
            "is-complete",
            timerStatus === "complete"
        );
    }

    if (focusTimerHint) {
        if (timerStatus === "running") {
            focusTimerHint.textContent =
                "Stay focused. Your countdown continues even when you switch browser tabs.";
        } else if (timerStatus === "paused") {
            focusTimerHint.textContent =
                "Your progress is saved. Resume whenever you're ready.";
        } else if (timerStatus === "complete") {
            focusTimerHint.textContent =
                "Well done! Your session has finished.";
        } else {
            focusTimerHint.textContent =
                "Choose a session and start when you're ready.";
        }
    }

    focusModeButtons.forEach((button) => {
        const isActive =
            button.dataset.sessionType === currentMode;

        button.classList.toggle(
            "is-active",
            isActive
        );

        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    });
}


/* =========================================================
   10. START, PAUSE AND RESUME
   ========================================================= */

function startTimer() {
    if (!authenticationVerified) {
        showFocusMessage(
            "Your login session has not been verified. Refresh the page and try again."
        );

        return;
    }

    if (timerStatus === "running" || completionInProgress) {
        return;
    }

    clearFocusMessage();

    if (timerStatus === "complete") {
        showFocusMessage(
            "Choose a timer mode or reset the timer to begin another session."
        );

        return;
    }

    if (remainingSeconds <= 0) {
        remainingSeconds = focusDurations[currentMode];
    }

    timerStatus = "running";

    timerEndTimestamp =
        Date.now() + remainingSeconds * 1000;

    saveTimerState();

    updateTimerDisplay();

    updateTimerControls();

    startTimerInterval();
}


function pauseTimer() {
    if (timerStatus !== "running") {
        return;
    }

    remainingSeconds = Math.max(
        0,
        Math.ceil(
            (timerEndTimestamp - Date.now()) / 1000
        )
    );

    stopTimerInterval();

    timerEndTimestamp = null;

    if (remainingSeconds <= 0) {
        finishCurrentSession();
        return;
    }

    timerStatus = "paused";

    saveTimerState();

    updateTimerDisplay();

    updateTimerControls();
}


function toggleTimer() {
    if (timerStatus === "running") {
        pauseTimer();
        return;
    }

    if (timerStatus === "paused" || timerStatus === "idle") {
        startTimer();
    }
}


/* =========================================================
   11. TIMER INTERVAL
   ========================================================= */

function startTimerInterval() {
    stopTimerInterval();

    timerInterval = window.setInterval(
        updateCountdown,
        250
    );

    updateCountdown();
}


function stopTimerInterval() {
    if (timerInterval !== null) {
        window.clearInterval(timerInterval);

        timerInterval = null;
    }
}


function updateCountdown() {
    if (
        timerStatus !== "running" ||
        !Number.isFinite(timerEndTimestamp)
    ) {
        return;
    }

    const millisecondsRemaining =
        timerEndTimestamp - Date.now();

    remainingSeconds = Math.max(
        0,
        Math.ceil(millisecondsRemaining / 1000)
    );

    updateTimerDisplay();

    if (remainingSeconds <= 0) {
        finishCurrentSession();
        return;
    }

    /*
       Persist periodically so a refresh does not lose
       the current countdown.
    */

    saveTimerState();
}


/* =========================================================
   12. RESET TIMER
   ========================================================= */

function resetTimer() {
    if (completionInProgress) {
        showFocusMessage(
            "Please wait while the completed session is being saved."
        );

        return;
    }

    clearFocusMessage();

    stopTimerInterval();

    timerStatus = "idle";

    remainingSeconds = focusDurations[currentMode];

    timerEndTimestamp = null;

    lastCompletedSessionId = null;

    saveTimerState();

    updateTimerDisplay();

    updateTimerControls();
}


/* =========================================================
   13. SWITCH TIMER MODE
   ========================================================= */

function switchTimerMode(nextMode) {
    if (!Object.prototype.hasOwnProperty.call(
        FOCUS_MODES,
        nextMode
    )) {
        return;
    }

    if (completionInProgress) {
        showFocusMessage(
            "Please wait while the completed session is being saved."
        );

        return;
    }

    if (nextMode === currentMode) {
        return;
    }

    if (timerStatus === "running") {
        showFocusMessage(
            "Pause or reset your current session before switching modes."
        );

        return;
    }

    clearFocusMessage();

    stopTimerInterval();

    currentMode = nextMode;

    timerStatus = "idle";

    remainingSeconds = focusDurations[currentMode];

    timerEndTimestamp = null;

    lastCompletedSessionId = null;

    saveTimerState();

    updateTimerDisplay();

    updateTimerControls();
}


function skipCurrentSession() {
    if (completionInProgress) {
        showFocusMessage(
            "Please wait while the completed session is being saved."
        );

        return;
    }

    stopTimerInterval();

    /*
       Skipping does not save the unfinished session.
    */

    const nextMode = FOCUS_MODES[currentMode].nextMode;

    currentMode = nextMode;

    timerStatus = "idle";

    remainingSeconds = focusDurations[currentMode];

    timerEndTimestamp = null;

    lastCompletedSessionId = null;

    clearFocusMessage();

    saveTimerState();

    updateTimerDisplay();

    updateTimerControls();

    showFocusMessage(
        `Switched to ${FOCUS_MODES[currentMode].label}. Your previous unfinished session was not recorded.`,
        "success"
    );
}


/* =========================================================
   14. FINISH A SESSION
   ========================================================= */

async function finishCurrentSession() {
    if (
        timerStatus !== "running" ||
        completionInProgress
    ) {
        return;
    }

    stopTimerInterval();

    remainingSeconds = 0;

    timerEndTimestamp = null;

    timerStatus = "complete";

    completionInProgress = true;

    updateTimerDisplay();

    updateTimerControls();

    saveTimerState();

    const completedMode = currentMode;

    const plannedDurationSeconds =
        focusDurations[completedMode];

    /*
       The existing API validates that the difference
       between startedAt and completedAt matches
       durationSeconds within five seconds.

       Because pauses may occur during a session, the
       API's current timestamp validation cannot represent
       the real wall-clock start and end of a paused session.

       To comply with the existing API without changing
       backend code, the saved interval represents the
       accumulated active timer duration.
    */

    const completedAt = new Date();

    const startedAt = new Date(
        completedAt.getTime() -
        plannedDurationSeconds * 1000
    );

    const payload = {
        sessionType: completedMode,
        plannedDurationSeconds,
        durationSeconds: plannedDurationSeconds,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString()
    };

    clearFocusMessage();

    try {
        await saveCompletedSession(payload);

        lastCompletedSessionId = Date.now();

        showFocusMessage(
            `${FOCUS_MODES[completedMode].label} completed successfully!`,
            "success"
        );

        await Promise.all([
            loadFocusSummary(),
            loadFocusHistory()
        ]);

    } catch (error) {
        console.error(
            "StudyTrack could not save the completed session:",
            error
        );

        showFocusMessage(
            error.message ||
            "Your session finished, but StudyTrack could not save it. Check your connection before continuing."
        );

    } finally {
        completionInProgress = false;

        updateTimerControls();

        saveTimerState();
    }
}


/* =========================================================
   15. API REQUEST HELPER
   ========================================================= */

async function focusApiRequest(endpoint, options = {}) {
    const response = await fetch(
        `${FOCUS_API_BASE}${endpoint}`,
        {
            ...options,

            credentials: "same-origin",

            headers: {
                Accept: "application/json",
                ...(options.body
                    ? {
                        "Content-Type": "application/json"
                    }
                    : {}),
                ...(options.headers || {})
            }
        }
    );

    if (response.status === 401) {
        authenticationVerified = false;

        window.location.replace("/");

        throw new Error(
            "Your login session has expired. Please log in again."
        );
    }

    let result;

    try {
        result = await response.json();

    } catch {
        throw new Error(
            "The server returned an invalid response."
        );
    }

    if (!response.ok || result.success !== true) {
        throw new Error(
            result.message ||
            "The request could not be completed."
        );
    }

    return result;
}


/* =========================================================
   16. VERIFY AUTHENTICATION
   ========================================================= */

async function verifyFocusAuthentication() {
    try {
        const response = await fetch(
            "/api/auth/me",
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            }
        );

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

        const fullName =
            typeof result.user.fullName === "string"
                ? result.user.fullName.trim()
                : "Student";

        const safeName = fullName || "Student";

        const firstName = safeName.split(/\s+/)[0] || "S";

        if (focusSidebarUserName) {
            focusSidebarUserName.textContent = safeName;
        }

        if (focusSidebarAvatar) {
            focusSidebarAvatar.textContent =
                firstName.charAt(0).toUpperCase();

            focusSidebarAvatar.setAttribute(
                "aria-label",
                `${safeName}'s profile`
            );
        }

        authenticationVerified = true;

        return true;

    } catch (error) {
        console.error(
            "StudyTrack Focus authentication error:",
            error
        );

        showFocusMessage(
            "We could not verify your login session. Check your connection and refresh the page."
        );

        return false;
    }
}


/* =========================================================
   17. SAVE COMPLETED SESSION
   ========================================================= */

async function saveCompletedSession(payload) {
    return focusApiRequest(
        "/sessions",
        {
            method: "POST",

            body: JSON.stringify(payload)
        }
    );
}


/* =========================================================
   18. DAILY SUMMARY
   ========================================================= */

async function loadFocusSummary() {
    try {
        const result = await focusApiRequest(
            "/summary"
        );

        const summary = result.summary;

        if (!summary) {
            throw new Error(
                "The server did not return focus statistics."
            );
        }

        const completedFocus = Number(
            summary.completedSessions
        );

        const totalFocusSeconds = Number(
            summary.totalFocusSeconds
        );

        const sessionsByType =
            summary.sessionsByType || {};

        const shortBreaks = Number(
            sessionsByType.short_break || 0
        );

        const longBreaks = Number(
            sessionsByType.long_break || 0
        );

        if (focusCompletedSessions) {
            focusCompletedSessions.textContent =
                Number.isFinite(completedFocus)
                    ? String(completedFocus)
                    : "0";
        }

        if (focusTotalFocusTime) {
            focusTotalFocusTime.textContent =
                Number.isFinite(totalFocusSeconds)
                    ? formatDuration(totalFocusSeconds)
                    : "0m";
        }

        if (focusCompletedBreakSessions) {
            focusCompletedBreakSessions.textContent =
                String(shortBreaks + longBreaks);
        }

    } catch (error) {
        console.error(
            "StudyTrack could not load focus statistics:",
            error
        );

        if (focusCompletedSessions) {
            focusCompletedSessions.textContent = "—";
        }

        if (focusTotalFocusTime) {
            focusTotalFocusTime.textContent = "—";
        }

        if (focusCompletedBreakSessions) {
            focusCompletedBreakSessions.textContent = "—";
        }
    }
}


/* =========================================================
   19. HISTORY FORMATTING HELPERS
   ========================================================= */

function formatSessionType(sessionType) {
    if (sessionType === "focus") {
        return "Focus";
    }

    if (sessionType === "short_break") {
        return "Short Break";
    }

    if (sessionType === "long_break") {
        return "Long Break";
    }

    return "Session";
}


function getSessionIcon(sessionType) {
    return sessionType === "focus"
        ? "◎"
        : "☕";
}


function parseDatabaseDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : value;
    }

    if (typeof value !== "string") {
        return null;
    }

    /*
       MySQL DATETIME values commonly arrive as:
       YYYY-MM-DD HH:mm:ss

       Convert the space to T so JavaScript can parse
       the date consistently.
    */

    const normalized = value.includes("T")
        ? value
        : value.replace(" ", "T");

    const parsed = new Date(normalized);

    return Number.isNaN(parsed.getTime())
        ? null
        : parsed;
}


function formatSessionDate(value) {
    const date = parseDatabaseDate(value);

    if (!date) {
        return "Unavailable";
    }

    return date.toLocaleString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function createHistoryCell(text, className = "") {
    const cell = document.createElement("td");

    cell.textContent = text;

    if (className) {
        cell.className = className;
    }

    return cell;
}


/* =========================================================
   20. LOAD SESSION HISTORY
   ========================================================= */

async function loadFocusHistory() {
    if (!focusHistoryBody) {
        return;
    }

    focusHistoryBody.replaceChildren();

    const loadingRow = document.createElement("tr");

    const loadingCell = createHistoryCell(
        "Loading your sessions...",
        "focus-history-loading"
    );

    loadingCell.colSpan = 5;

    loadingRow.appendChild(loadingCell);

    focusHistoryBody.appendChild(loadingRow);

    try {
        const result = await focusApiRequest(
            `/sessions?limit=${HISTORY_LIMIT}`
        );

        const sessions = Array.isArray(result.sessions)
            ? result.sessions
            : [];

        focusHistoryBody.replaceChildren();

        if (sessions.length === 0) {
            const row = document.createElement("tr");

            const cell = createHistoryCell(
                "No completed sessions yet. Start your first session to see it here.",
                "focus-history-loading"
            );

            cell.colSpan = 5;

            row.appendChild(cell);

            focusHistoryBody.appendChild(row);

            if (focusHistoryCount) {
                focusHistoryCount.textContent =
                    "No completed sessions yet.";
            }

            return;
        }

        for (const session of sessions) {
            const row = document.createElement("tr");

            /*
               Session type cell.
            */

            const sessionCell = document.createElement("td");

            const sessionLabel = document.createElement("span");

            sessionLabel.className = "focus-history-session";

            const sessionIcon = document.createElement("span");

            sessionIcon.className =
                "focus-history-session-icon";

            if (session.sessionType !== "focus") {
                sessionIcon.classList.add("is-break");
            }

            sessionIcon.setAttribute(
                "aria-hidden",
                "true"
            );

            sessionIcon.textContent = getSessionIcon(
                session.sessionType
            );

            const sessionName = document.createElement("span");

            sessionName.textContent = formatSessionType(
                session.sessionType
            );

            sessionLabel.append(
                sessionIcon,
                sessionName
            );

            sessionCell.appendChild(sessionLabel);

            row.appendChild(sessionCell);

            /*
               Planned duration.
            */

            row.appendChild(
                createHistoryCell(
                    formatDuration(
                        session.plannedDurationSeconds
                    )
                )
            );

            /*
               Actual duration.
            */

            row.appendChild(
                createHistoryCell(
                    formatDuration(
                        session.durationSeconds
                    )
                )
            );

            /*
               Completion timestamp.
            */

            row.appendChild(
                createHistoryCell(
                    formatSessionDate(
                        session.completedAt
                    )
                )
            );

            /*
               Completion status.

               The existing API only stores completed sessions,
               so every returned session represents a recorded
               completion.
            */

            const statusCell = document.createElement("td");

            const statusBadge = document.createElement("span");

            statusBadge.className = "focus-history-status";

            statusBadge.textContent = "Completed";

            statusCell.appendChild(statusBadge);

            row.appendChild(statusCell);

            focusHistoryBody.appendChild(row);
        }

        if (focusHistoryCount) {
            focusHistoryCount.textContent =
                `Showing ${sessions.length} recent completed ` +
                `${sessions.length === 1 ? "session" : "sessions"}.`;
        }

    } catch (error) {
        console.error(
            "StudyTrack could not load session history:",
            error
        );

        focusHistoryBody.replaceChildren();

        const row = document.createElement("tr");

        const cell = createHistoryCell(
            "Unable to load session history. Please try refreshing.",
            "focus-history-loading"
        );

        cell.colSpan = 5;

        row.appendChild(cell);

        focusHistoryBody.appendChild(row);

        if (focusHistoryCount) {
            focusHistoryCount.textContent =
                "Session history is temporarily unavailable.";
        }
    }
}


/* =========================================================
   21. THEME MANAGEMENT
   ========================================================= */

function applyFocusTheme(theme, savePreference = true) {
    const selectedTheme =
        theme === "night"
            ? "night"
            : "day";

    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );

    if (focusDayThemeButton) {
        const isActive = selectedTheme === "day";

        focusDayThemeButton.classList.toggle(
            "is-active",
            isActive
        );

        focusDayThemeButton.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    }

    if (focusNightThemeButton) {
        const isActive = selectedTheme === "night";

        focusNightThemeButton.classList.toggle(
            "is-active",
            isActive
        );

        focusNightThemeButton.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    }

    if (savePreference) {
        try {
            localStorage.setItem(
                FOCUS_THEME_KEY,
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


function initialiseFocusTheme() {
    let savedTheme = "day";

    try {
        const storedTheme = localStorage.getItem(
            FOCUS_THEME_KEY
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

    applyFocusTheme(savedTheme, false);
}


/* =========================================================
   22. CURRENT DATE
   ========================================================= */

function displayFocusDate() {
    if (!focusCurrentDate) {
        return;
    }

    focusCurrentDate.textContent =
        new Date().toLocaleDateString(
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
   23. SIDEBAR RESPONSIVE BEHAVIOUR
   ========================================================= */

function isFocusMobileLayout() {
    return window.matchMedia(
        "(max-width: 850px)"
    ).matches;
}


function updateFocusMenuButton() {
    if (!focusMenuButton || !focusAppLayout) {
        return;
    }

    const isOpen = isFocusMobileLayout()
        ? focusAppLayout.classList.contains("sidebar-open")
        : !focusAppLayout.classList.contains("sidebar-collapsed");

    focusMenuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
    );
}


function closeFocusMobileSidebar() {
    if (!focusAppLayout) {
        return;
    }

    focusAppLayout.classList.remove("sidebar-open");

    updateFocusMenuButton();
}


function toggleFocusSidebar() {
    if (!focusAppLayout) {
        return;
    }

    if (isFocusMobileLayout()) {
        focusAppLayout.classList.toggle("sidebar-open");

    } else {
        focusAppLayout.classList.toggle("sidebar-collapsed");
    }

    updateFocusMenuButton();
}


function initialiseFocusSidebar() {
    if (focusMenuButton) {
        focusMenuButton.addEventListener(
            "click",
            toggleFocusSidebar
        );
    }

    if (focusSidebar) {
        focusSidebar.querySelectorAll("a").forEach(
            (link) => {
                link.addEventListener(
                    "click",
                    () => {
                        if (isFocusMobileLayout()) {
                            closeFocusMobileSidebar();
                        }
                    }
                );
            }
        );
    }

    if (focusAppLayout) {
        focusAppLayout.addEventListener(
            "click",
            (event) => {
                if (
                    event.target === focusAppLayout &&
                    focusAppLayout.classList.contains("sidebar-open")
                ) {
                    closeFocusMobileSidebar();
                }
            }
        );
    }

    window.addEventListener(
        "resize",
        () => {
            if (!focusAppLayout) {
                return;
            }

            if (isFocusMobileLayout()) {
                focusAppLayout.classList.remove(
                    "sidebar-collapsed"
                );

            } else {
                focusAppLayout.classList.remove(
                    "sidebar-open"
                );
            }

            updateFocusMenuButton();
        }
    );

    updateFocusMenuButton();
}


/* =========================================================
   24. LOGOUT
   ========================================================= */

async function logoutFocusUser() {
    if (!focusLogoutButton || focusLogoutButton.disabled) {
        return;
    }

    const label = focusLogoutButton.querySelector(
        ".sidebar-logout-text"
    );

    const originalLabel = label
        ? label.textContent
        : focusLogoutButton.textContent;

    focusLogoutButton.disabled = true;

    if (label) {
        label.textContent = "Logging out...";

    } else {
        focusLogoutButton.textContent = "Logging out...";
    }

    clearFocusMessage();

    try {
        const response = await fetch(
            "/api/auth/logout",
            {
                method: "POST",

                credentials: "same-origin",

                headers: {
                    Accept: "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "The server could not complete logout."
            );
        }

        stopTimerInterval();

        window.location.replace("/");

    } catch (error) {
        console.error(
            "StudyTrack logout error:",
            error
        );

        showFocusMessage(
            "Logout failed. Please check your connection and try again."
        );

        focusLogoutButton.disabled = false;

        if (label) {
            label.textContent = originalLabel;

        } else {
            focusLogoutButton.textContent = originalLabel;
        }
    }
}


/* =========================================================
   25. EVENT LISTENERS
   ========================================================= */

function initialiseFocusEventListeners() {
    if (focusStartPauseButton) {
        focusStartPauseButton.addEventListener(
            "click",
            toggleTimer
        );
    }

    if (focusResetButton) {
        focusResetButton.addEventListener(
            "click",
            resetTimer
        );
    }

    if (focusSkipButton) {
        focusSkipButton.addEventListener(
            "click",
            skipCurrentSession
        );
    }

    focusModeButtons.forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    switchTimerMode(
                        button.dataset.sessionType
                    );
                }
            );
        }
    );

    if (focusSettingsForm) {
        focusSettingsForm.addEventListener(
            "submit",
            saveFocusSettings
        );
    }

    if (focusDayThemeButton) {
        focusDayThemeButton.addEventListener(
            "click",
            () => applyFocusTheme("day")
        );
    }

    if (focusNightThemeButton) {
        focusNightThemeButton.addEventListener(
            "click",
            () => applyFocusTheme("night")
        );
    }

    if (focusRefreshHistoryButton) {
        focusRefreshHistoryButton.addEventListener(
            "click",
            async () => {
                clearFocusMessage();

                await Promise.all([
                    loadFocusSummary(),
                    loadFocusHistory()
                ]);
            }
        );
    }

    if (focusLogoutButton) {
        focusLogoutButton.addEventListener(
            "click",
            logoutFocusUser
        );
    }

    /*
       Refresh the visible countdown when the browser
       tab becomes active again.
    */

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.visibilityState !== "visible") {
                return;
            }

            if (timerStatus === "running") {
                updateCountdown();
            }
        }
    );

    /*
       Refresh the countdown after the window regains focus.
    */

    window.addEventListener(
        "focus",
        () => {
            if (timerStatus === "running") {
                updateCountdown();
            }
        }
    );
}


/* =========================================================
   26. INITIALISE THE FOCUS TIMER
   ========================================================= */

async function initialiseFocusTimer() {
    initialiseFocusTheme();

    displayFocusDate();

    initialiseFocusSidebar();

    initialiseFocusEventListeners();

    loadFocusSettings();

    restoreTimerState();

    updateTimerDisplay();

    updateTimerControls();

    const authenticated =
        await verifyFocusAuthentication();

    if (!authenticated) {
        return;
    }

    /*
       A restored running timer may already have expired
       while the page was closed or refreshed.
    */

    if (
        timerStatus === "running" &&
        remainingSeconds <= 0
    ) {
        await finishCurrentSession();

    } else if (timerStatus === "running") {
        startTimerInterval();
    }

    await Promise.all([
        loadFocusSummary(),
        loadFocusHistory()
    ]);
}


/* =========================================================
   27. START APPLICATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialiseFocusTimer
);