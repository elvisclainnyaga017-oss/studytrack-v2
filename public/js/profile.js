// ==================================================
// STUDYTRACK V2
// PROFILE PAGE JAVASCRIPT
//
// Features:
// - Load authenticated user's profile.
// - Update personal information.
// - Upload and preview profile pictures.
// - Replace and remove profile pictures.
// - Change account password.
// - Day/night theme.
// - Independent Profile sidebar.
// - Independent Profile tooltips.
// - Desktop sidebar collapse.
// - Mobile sidebar navigation.
// ==================================================

document.addEventListener("DOMContentLoaded", () => {

    // ==================================================
    // ELEMENTS
    // ==================================================

    const profileFeedback =
        document.getElementById("profileFeedback");

    const profilePicture =
        document.getElementById("profilePicture");

    const profilePicturePlaceholder =
        document.getElementById("profilePicturePlaceholder");

    const profilePictureInput =
        document.getElementById("profilePictureInput");

    const choosePictureButton =
        document.getElementById("choosePictureButton");

    const removePictureButton =
        document.getElementById("removePictureButton");

    const personalInformationForm =
        document.getElementById("personalInformationForm");

    const passwordForm =
        document.getElementById("passwordForm");

    const saveProfileButton =
        document.getElementById("saveProfileButton");

    const changePasswordButton =
        document.getElementById("changePasswordButton");

    const fullNameInput =
        document.getElementById("fullName");

    const emailInput =
        document.getElementById("email");

    const usernameInput =
        document.getElementById("username");

    const bioInput =
        document.getElementById("bio");

    const bioCharacterCount =
        document.getElementById("bioCharacterCount");

    const currentPasswordInput =
        document.getElementById("currentPassword");

    const newPasswordInput =
        document.getElementById("newPassword");

    const confirmPasswordInput =
        document.getElementById("confirmPassword");

    const overviewFullName =
        document.getElementById("overviewFullName");

    const overviewUsername =
        document.getElementById("overviewUsername");

    const overviewEmail =
        document.getElementById("overviewEmail");

    const accountId =
        document.getElementById("accountId");

    const registrationDate =
        document.getElementById("registrationDate");

    const profileUpdatedDate =
        document.getElementById("profileUpdatedDate");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarAvatar =
        document.getElementById("sidebarAvatar");

    const sidebarUserName =
        document.getElementById("sidebarUserName");

    const logoutButton =
        document.getElementById("logoutButton");

    const menuButton =
        document.getElementById("menuButton");

    const sidebarClose =
        document.getElementById("sidebarClose");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const appLayout =
        document.getElementById("profileAppLayout");

    const dayThemeButton =
        document.getElementById("dayThemeButton");

    const nightThemeButton =
        document.getElementById("nightThemeButton");


    // ==================================================
    // STATE
    // ==================================================

    let currentProfile = null;
    let selectedPictureFile = null;
    let previewObjectUrl = null;

    let tooltip = null;
    let activeTooltipTarget = null;


    // ==================================================
    // FEEDBACK
    // ==================================================

    function showFeedback(message, type = "success") {

        profileFeedback.textContent = message;

        profileFeedback.className =
            `feedback-message visible ${type}`;

        window.clearTimeout(showFeedback.timeout);

        showFeedback.timeout = window.setTimeout(() => {

            profileFeedback.className = "feedback-message";
            profileFeedback.textContent = "";

        }, 5500);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    // ==================================================
    // API REQUEST HELPER
    // ==================================================

    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        let result;

        try {

            result = await response.json();

        } catch {

            result = {
                success: false,
                message: "The server returned an invalid response."
            };
        }

        if (response.status === 401) {

            window.location.replace("/");

            throw new Error("Your session has expired.");
        }

        if (!response.ok || result.success !== true) {

            throw new Error(
                result.message || "The request could not be completed."
            );
        }

        return result;
    }


    // ==================================================
    // DATE FORMATTING
    // ==================================================

    function formatDate(value) {

        if (!value) {
            return "Not available";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    }


    // ==================================================
    // CURRENT DATE
    // ==================================================

    function updateCurrentDate() {

        const dateElement =
            document.getElementById("profileCurrentDate");

        if (!dateElement) {
            return;
        }

        dateElement.textContent =
            new Intl.DateTimeFormat(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            }).format(new Date());
    }


    // ==================================================
    // AVATAR INITIALS
    // ==================================================

    function getInitial(name) {

        if (!name || typeof name !== "string") {
            return "U";
        }

        return name.trim().charAt(0).toUpperCase() || "U";
    }


    // ==================================================
    // DISPLAY PROFILE PICTURE
    // ==================================================

    function displayProfilePicture(imageUrl) {

        if (imageUrl) {

            profilePicture.src = imageUrl;
            profilePicture.hidden = false;

            profilePicturePlaceholder.hidden = true;

            removePictureButton.disabled = false;

            sidebarAvatar.replaceChildren();

            const avatarImage = document.createElement("img");

            avatarImage.src = imageUrl;
            avatarImage.alt = "Profile picture";

            sidebarAvatar.appendChild(avatarImage);

        } else {

            profilePicture.removeAttribute("src");
            profilePicture.hidden = true;

            profilePicturePlaceholder.hidden = false;

            removePictureButton.disabled = true;

            const initial = getInitial(
                currentProfile?.fullName
            );

            profilePicturePlaceholder.textContent = initial;

            sidebarAvatar.textContent = initial;
        }
    }


    // ==================================================
    // RENDER PROFILE
    // ==================================================

    function renderProfile(profile) {

        currentProfile = profile;

        const initial = getInitial(profile.fullName);

        overviewFullName.textContent =
            profile.fullName || "Your name";

        overviewUsername.textContent =
            profile.username
                ? `@${profile.username}`
                : "No username added";

        overviewEmail.textContent =
            profile.email || "";

        fullNameInput.value =
            profile.fullName || "";

        emailInput.value =
            profile.email || "";

        usernameInput.value =
            profile.username || "";

        bioInput.value =
            profile.bio || "";

        bioCharacterCount.textContent =
            bioInput.value.length;

        accountId.textContent =
            profile.id ?? "—";

        registrationDate.textContent =
            formatDate(profile.createdAt);

        profileUpdatedDate.textContent =
            formatDate(profile.profileUpdatedAt);

        sidebarUserName.textContent =
            profile.fullName || "StudyTrack User";

        if (!profile.profilePicture) {

            profilePicturePlaceholder.textContent = initial;

            sidebarAvatar.textContent = initial;
        }

        displayProfilePicture(profile.profilePicture);
    }


    // ==================================================
    // LOAD PROFILE
    // ==================================================

    async function loadProfile() {

        try {

            const result = await apiRequest("/api/profile");

            renderProfile(result.profile);

        } catch (error) {

            if (error.message !== "Your session has expired.") {

                showFeedback(error.message, "error");
            }
        }
    }


    // ==================================================
    // SAVE PERSONAL INFORMATION
    // ==================================================

    personalInformationForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const fullName = fullNameInput.value.trim();
            const username = usernameInput.value.trim();
            const bio = bioInput.value.trim();

            if (!fullName) {

                showFeedback(
                    "Please enter your full name.",
                    "error"
                );

                return;
            }

            saveProfileButton.disabled = true;
            saveProfileButton.textContent = "Saving...";

            try {

                const result = await apiRequest(
                    "/api/profile",
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            fullName,
                            username,
                            bio
                        })
                    }
                );

                showFeedback(result.message);

                await loadProfile();

            } catch (error) {

                showFeedback(error.message, "error");

            } finally {

                saveProfileButton.disabled = false;
                saveProfileButton.textContent = "Save changes";
            }
        }
    );


    // ==================================================
    // BIO CHARACTER COUNTER
    // ==================================================

    bioInput.addEventListener("input", () => {

        bioCharacterCount.textContent =
            bioInput.value.length;
    });


    // ==================================================
    // SELECT PROFILE PICTURE
    // ==================================================

    choosePictureButton.addEventListener("click", () => {

        profilePictureInput.click();
    });


    // ==================================================
    // PREVIEW SELECTED IMAGE
    // ==================================================

    profilePictureInput.addEventListener(
        "change",
        () => {

            const file = profilePictureInput.files[0];

            if (!file) {
                return;
            }

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(file.type)) {

                showFeedback(
                    "Please choose a JPG, PNG or WEBP image.",
                    "error"
                );

                profilePictureInput.value = "";

                return;
            }

            const maximumSize = 5 * 1024 * 1024;

            if (file.size > maximumSize) {

                showFeedback(
                    "Your profile picture cannot exceed 5 MB.",
                    "error"
                );

                profilePictureInput.value = "";

                return;
            }

            if (previewObjectUrl) {

                URL.revokeObjectURL(previewObjectUrl);
            }

            selectedPictureFile = file;

            previewObjectUrl =
                URL.createObjectURL(file);

            profilePicture.src = previewObjectUrl;
            profilePicture.hidden = false;

            profilePicturePlaceholder.hidden = true;

            showFeedback(
                "Image preview ready. Select Save picture to upload it."
            );

            showPictureSaveButton();
        }
    );


    // ==================================================
    // PICTURE SAVE BUTTON
    // ==================================================

    function showPictureSaveButton() {

        let saveButton =
            document.getElementById("savePictureButton");

        if (!saveButton) {

            saveButton = document.createElement("button");

            saveButton.type = "button";
            saveButton.id = "savePictureButton";

            saveButton.className =
                "button button-primary";

            saveButton.textContent = "Save picture";

            choosePictureButton.parentNode.appendChild(
                saveButton
            );

            saveButton.addEventListener(
                "click",
                uploadProfilePicture
            );
        }

        saveButton.hidden = false;
    }


    // ==================================================
    // UPLOAD PROFILE PICTURE
    // ==================================================

    async function uploadProfilePicture() {

        if (!selectedPictureFile) {

            showFeedback(
                "Please choose an image first.",
                "error"
            );

            return;
        }

        const saveButton =
            document.getElementById("savePictureButton");

        const formData = new FormData();

        formData.append(
            "profilePicture",
            selectedPictureFile
        );

        saveButton.disabled = true;
        saveButton.textContent = "Uploading...";

        try {

            const result = await apiRequest(
                "/api/profile/picture",
                {
                    method: "POST",
                    body: formData
                }
            );

            currentProfile.profilePicture =
                result.profilePicture;

            displayProfilePicture(
                result.profilePicture
            );

            selectedPictureFile = null;

            profilePictureInput.value = "";

            if (previewObjectUrl) {

                URL.revokeObjectURL(previewObjectUrl);

                previewObjectUrl = null;
            }

            saveButton.hidden = true;

            showFeedback(result.message);

        } catch (error) {

            showFeedback(error.message, "error");

        } finally {

            saveButton.disabled = false;
            saveButton.textContent = "Save picture";
        }
    }


    // ==================================================
    // REMOVE PROFILE PICTURE
    // ==================================================

    removePictureButton.addEventListener(
        "click",
        async () => {

            if (!currentProfile?.profilePicture) {
                return;
            }

            const confirmed = window.confirm(
                "Are you sure you want to remove your profile picture?"
            );

            if (!confirmed) {
                return;
            }

            removePictureButton.disabled = true;
            removePictureButton.textContent = "Removing...";

            try {

                const result = await apiRequest(
                    "/api/profile/picture",
                    {
                        method: "DELETE"
                    }
                );

                currentProfile.profilePicture = null;

                selectedPictureFile = null;

                profilePictureInput.value = "";

                if (previewObjectUrl) {

                    URL.revokeObjectURL(previewObjectUrl);

                    previewObjectUrl = null;
                }

                const saveButton =
                    document.getElementById("savePictureButton");

                if (saveButton) {
                    saveButton.hidden = true;
                }

                displayProfilePicture(null);

                showFeedback(result.message);

            } catch (error) {

                showFeedback(error.message, "error");

            } finally {

                removePictureButton.textContent = "Remove picture";

                removePictureButton.disabled =
                    !currentProfile?.profilePicture;
            }
        }
    );


    // ==================================================
    // CHANGE PASSWORD
    // ==================================================

    passwordForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const currentPassword =
                currentPasswordInput.value;

            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {

                showFeedback(
                    "Your new password and confirmation do not match.",
                    "error"
                );

                return;
            }

            if (newPassword.length < 8) {

                showFeedback(
                    "Your new password must contain at least 8 characters.",
                    "error"
                );

                return;
            }

            if (new TextEncoder().encode(newPassword).length > 72) {

                showFeedback(
                    "Your new password is too long.",
                    "error"
                );

                return;
            }

            changePasswordButton.disabled = true;
            changePasswordButton.textContent = "Updating...";

            try {

                const result = await apiRequest(
                    "/api/profile/password",
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            currentPassword,
                            newPassword
                        })
                    }
                );

                passwordForm.reset();

                showFeedback(result.message);

            } catch (error) {

                showFeedback(error.message, "error");

            } finally {

                changePasswordButton.disabled = false;

                changePasswordButton.textContent =
                    "Update password";
            }
        }
    );


    // ==================================================
    // DAY / NIGHT THEME
    // ==================================================

    function applyTheme(theme) {

        const selectedTheme =
            theme === "night" ? "night" : "day";

        document.documentElement.dataset.theme =
            selectedTheme;

        try {

            localStorage.setItem(
                "studytrack-v2-theme",
                selectedTheme
            );

        } catch (error) {

            console.warn(
                "StudyTrack: Theme preference could not be saved.",
                error
            );
        }

        dayThemeButton.classList.toggle(
            "active",
            selectedTheme === "day"
        );

        nightThemeButton.classList.toggle(
            "active",
            selectedTheme === "night"
        );

        dayThemeButton.setAttribute(
            "aria-pressed",
            String(selectedTheme === "day")
        );

        nightThemeButton.setAttribute(
            "aria-pressed",
            String(selectedTheme === "night")
        );
    }

    dayThemeButton.addEventListener(
        "click",
        () => applyTheme("day")
    );

    nightThemeButton.addEventListener(
        "click",
        () => applyTheme("night")
    );


    // ==================================================
    // SIDEBAR RESPONSIVE STATE
    // ==================================================

    const desktopQuery =
        window.matchMedia("(min-width: 851px)");

    function isDesktop() {
        return desktopQuery.matches;
    }

    function hideSidebarTooltip() {

        if (activeTooltipTarget) {

            activeTooltipTarget.removeAttribute(
                "aria-describedby"
            );
        }

        activeTooltipTarget = null;

        if (tooltip) {

            tooltip.classList.remove("is-visible");

            tooltip.setAttribute(
                "aria-hidden",
                "true"
            );

            tooltip.style.display = "none";
        }
    }

    function closeSidebar() {

        appLayout.classList.remove("sidebar-open");

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function updateMenuButton() {

        if (isDesktop()) {

            const collapsed =
                appLayout.classList.contains("sidebar-collapsed");

            menuButton.setAttribute(
                "aria-label",
                collapsed ? "Expand sidebar" : "Collapse sidebar"
            );

            menuButton.setAttribute(
                "title",
                collapsed ? "Expand sidebar" : "Collapse sidebar"
            );

            menuButton.setAttribute(
                "aria-expanded",
                String(!collapsed)
            );

        } else {

            const opened =
                appLayout.classList.contains("sidebar-open");

            menuButton.setAttribute(
                "aria-label",
                opened ? "Close navigation" : "Open navigation"
            );

            menuButton.setAttribute(
                "title",
                opened ? "Close navigation" : "Open navigation"
            );

            menuButton.setAttribute(
                "aria-expanded",
                String(opened)
            );
        }
    }

    function handleMenuButton() {

        if (isDesktop()) {

            hideSidebarTooltip();

            appLayout.classList.toggle("sidebar-collapsed");

            updateMenuButton();

        } else {

            appLayout.classList.toggle("sidebar-open");

            updateMenuButton();
        }
    }

    menuButton.addEventListener(
        "click",
        handleMenuButton
    );

    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {

            closeSidebar();

            hideSidebarTooltip();
        }
    });

    function handleResponsiveChange() {

        hideSidebarTooltip();

        if (isDesktop()) {

            appLayout.classList.remove("sidebar-open");

            sidebarOverlay.style.display = "";

        } else {

            appLayout.classList.remove("sidebar-collapsed");
        }

        updateMenuButton();
    }

    if (typeof desktopQuery.addEventListener === "function") {

        desktopQuery.addEventListener(
            "change",
            handleResponsiveChange
        );

    } else if (typeof desktopQuery.addListener === "function") {

        desktopQuery.addListener(
            handleResponsiveChange
        );
    }


    // ==================================================
    // INDEPENDENT PROFILE TOOLTIP SYSTEM
    // ==================================================

    function createSidebarTooltip() {

        if (tooltip) {
            return;
        }

        tooltip = document.createElement("div");

        tooltip.id = "profile-sidebar-tooltip";

        tooltip.className =
            "profile-sidebar-tooltip";

        tooltip.setAttribute("role", "tooltip");

        tooltip.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.appendChild(tooltip);
    }

    function getTooltipText(target) {

        if (!target) {
            return "";
        }

        const explicitText =
            target.getAttribute("data-tooltip");

        if (explicitText && explicitText.trim()) {
            return explicitText.trim();
        }

        return target.getAttribute("aria-label") || "";
    }

    function positionSidebarTooltip(target) {

        if (!tooltip || !target || !target.isConnected) {
            return;
        }

        const targetRect =
            target.getBoundingClientRect();

        const padding = 12;
        const gap = 14;

        tooltip.style.display = "flex";

        tooltip.style.left = "0px";
        tooltip.style.top = "0px";

        const tooltipRect =
            tooltip.getBoundingClientRect();

        const maximumLeft =
            Math.max(
                padding,
                window.innerWidth -
                tooltipRect.width -
                padding
            );

        let left =
            targetRect.right + gap;

        if (
            left + tooltipRect.width >
            window.innerWidth - padding
        ) {

            left =
                targetRect.left -
                tooltipRect.width -
                gap;
        }

        left = Math.max(
            padding,
            Math.min(left, maximumLeft)
        );

        const maximumTop =
            Math.max(
                padding,
                window.innerHeight -
                tooltipRect.height -
                padding
            );

        let top =
            targetRect.top +
            targetRect.height / 2 -
            tooltipRect.height / 2;

        top = Math.max(
            padding,
            Math.min(top, maximumTop)
        );

        tooltip.style.left =
            `${Math.round(left)}px`;

        tooltip.style.top =
            `${Math.round(top)}px`;
    }

    function showSidebarTooltip(target) {

        if (
            !isDesktop() ||
            !appLayout.classList.contains("sidebar-collapsed") ||
            !target ||
            !target.isConnected
        ) {

            hideSidebarTooltip();

            return;
        }

        const text = getTooltipText(target);

        if (!text) {

            hideSidebarTooltip();

            return;
        }

        if (
            activeTooltipTarget &&
            activeTooltipTarget !== target
        ) {

            activeTooltipTarget.removeAttribute(
                "aria-describedby"
            );
        }

        createSidebarTooltip();

        activeTooltipTarget = target;

        tooltip.textContent = text;

        tooltip.setAttribute(
            "aria-hidden",
            "false"
        );

        target.setAttribute(
            "aria-describedby",
            tooltip.id
        );

        tooltip.classList.add("is-visible");

        positionSidebarTooltip(target);
    }

    function refreshSidebarTooltip() {

        if (!activeTooltipTarget) {
            return;
        }

        if (
            !activeTooltipTarget.isConnected ||
            !isDesktop() ||
            !appLayout.classList.contains("sidebar-collapsed")
        ) {

            hideSidebarTooltip();

            return;
        }

        positionSidebarTooltip(activeTooltipTarget);
    }

    function initialiseProfileTooltips() {

        createSidebarTooltip();

        const tooltipTargets =
            sidebar.querySelectorAll(
                ".nav-link[data-tooltip], " +
                ".profile-shortcut[data-tooltip], " +
                ".sidebar-logout[data-tooltip]"
            );

        tooltipTargets.forEach((target) => {

            target.addEventListener(
                "mouseenter",
                () => showSidebarTooltip(target)
            );

            target.addEventListener(
                "mouseleave",
                () => hideSidebarTooltip(target)
            );

            target.addEventListener(
                "focusin",
                () => showSidebarTooltip(target)
            );

            target.addEventListener(
                "focusout",
                () => {

                    window.setTimeout(() => {

                        if (!target.contains(document.activeElement)) {

                            hideSidebarTooltip();
                        }

                    }, 0);
                }
            );

            target.addEventListener(
                "click",
                () => hideSidebarTooltip()
            );
        });

        window.addEventListener(
            "resize",
            refreshSidebarTooltip
        );

        window.addEventListener(
            "scroll",
            refreshSidebarTooltip,
            true
        );
    }

    initialiseProfileTooltips();

    updateMenuButton();


    // ==================================================
    // LOGOUT
    // ==================================================

    logoutButton.addEventListener(
        "click",
        async () => {

            const confirmed = window.confirm(
                "Are you sure you want to sign out?"
            );

            if (!confirmed) {
                return;
            }

            logoutButton.disabled = true;

            try {

                await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "same-origin"
                });

            } finally {

                window.location.replace("/");
            }
        }
    );


    // ==================================================
    // INITIALIZE PROFILE PAGE
    // ==================================================

    updateCurrentDate();

    applyTheme(
        localStorage.getItem("studytrack-v2-theme")
    );

    loadProfile();

});