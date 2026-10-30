"use strict";

/* =========================================================
   STUDYTRACK V2
   SHARED SIDEBAR ACCOUNT INFORMATION

   Features:
   - Loads the authenticated user's profile.
   - Displays the user's full name and email.
   - Displays the uploaded profile picture.
   - Falls back to the user's initials.
   - Works across the StudyTrack pages.
   - Preserves the Profile page's existing picture controls.
   ========================================================= */

(() => {

    const PROFILE_API = "/api/profile";

    let currentProfile = null;
    let isRenderingAvatar = false;


    /* =====================================================
       1. GET USER INITIAL
       ===================================================== */

    function getInitial(name) {

        if (!name || typeof name !== "string") {
            return "S";
        }

        return name.trim().charAt(0).toUpperCase() || "S";
    }


    /* =====================================================
       2. CREATE SIDEBAR EMAIL ELEMENT
       ===================================================== */

    function getSidebarEmailElement(nameElement) {

        if (!nameElement) {
            return null;
        }

        let emailElement =
            document.getElementById("sidebarUserEmail");

        if (emailElement) {
            return emailElement;
        }

        emailElement = document.createElement("small");

        emailElement.id = "sidebarUserEmail";
        emailElement.className = "sidebar-user-email";

        emailElement.style.display = "block";
        emailElement.style.fontSize = "11px";
        emailElement.style.lineHeight = "1.4";
        emailElement.style.opacity = "0.75";
        emailElement.style.overflow = "hidden";
        emailElement.style.textOverflow = "ellipsis";
        emailElement.style.whiteSpace = "nowrap";
        emailElement.style.maxWidth = "100%";

        nameElement.insertAdjacentElement(
            "afterend",
            emailElement
        );

        return emailElement;
    }


    /* =====================================================
       3. DISPLAY NAME AND EMAIL
       ===================================================== */

    function renderIdentity(profile) {

        if (!profile) {
            return;
        }

        const fullName =
            typeof profile.fullName === "string"
                ? profile.fullName.trim()
                : "";

        const email =
            typeof profile.email === "string"
                ? profile.email.trim()
                : "";

        const safeName = fullName || "StudyTrack User";

        const nameElement =
            document.getElementById("sidebarUserName");

        if (nameElement) {

            nameElement.textContent = safeName;

            const emailElement =
                getSidebarEmailElement(nameElement);

            if (emailElement) {
                emailElement.textContent =
                    email || "Email unavailable";

                emailElement.title = email || "";
            }
        }
    }


    /* =====================================================
       4. DISPLAY PROFILE PICTURE
       ===================================================== */

    function renderAvatar(profile) {

        const avatar =
            document.getElementById("sidebarAvatar");

        if (!avatar || !profile) {
            return;
        }

        const imageUrl =
            typeof profile.profilePicture === "string"
                ? profile.profilePicture.trim()
                : "";

        const initial = getInitial(profile.fullName);

        isRenderingAvatar = true;

        avatar.replaceChildren();

        if (imageUrl) {

            const image = document.createElement("img");

            image.src = imageUrl;
            image.alt = "Profile picture";

            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "cover";
            image.style.objectPosition = "center";
            image.style.borderRadius = "50%";
            image.style.display = "block";

            image.addEventListener("error", () => {

                if (image.parentElement === avatar) {

                    avatar.textContent = initial;
                }

            }, { once: true });

            avatar.appendChild(image);

        } else {

            avatar.textContent = initial;
        }

        avatar.setAttribute(
            "aria-label",
            `${profile.fullName || "User"}'s profile picture`
        );

        isRenderingAvatar = false;
    }


    /* =====================================================
       5. RENDER COMPLETE ACCOUNT INFORMATION
       ===================================================== */

    function renderAccount(profile) {

        if (!profile) {
            return;
        }

        currentProfile = profile;

        renderIdentity(profile);

        /*
         * The Profile page already has its own picture
         * rendering and upload functionality.
         *
         * Do not interfere with that functionality.
         */

        const isProfilePage =
            window.location.pathname.endsWith("/profile.html");

        if (!isProfilePage) {
            renderAvatar(profile);
        }
    }


    /* =====================================================
       6. LOAD AUTHENTICATED PROFILE
       ===================================================== */

    async function loadAccount() {

        try {

            const response = await fetch(PROFILE_API, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            });

            if (response.status === 401) {

                window.location.replace("/");

                return;
            }

            if (!response.ok) {

                throw new Error(
                    "Unable to load account information."
                );
            }

            const result = await response.json();

            if (
                result.success !== true ||
                !result.profile
            ) {

                throw new Error(
                    "The profile response was invalid."
                );
            }

            renderAccount(result.profile);

        } catch (error) {

            console.error(
                "StudyTrack sidebar account error:",
                error
            );
        }
    }


    /* =====================================================
       7. KEEP DASHBOARD AVATAR SYNCHRONIZED
       ===================================================== */

    function observeAvatarChanges() {

        const avatar =
            document.getElementById("sidebarAvatar");

        if (!avatar) {
            return;
        }

        const isProfilePage =
            window.location.pathname.endsWith("/profile.html");

        /*
         * The Profile page manages its own avatar.
         * Do not observe or override its changes.
         */

        if (isProfilePage) {
            return;
        }

        const observer = new MutationObserver(() => {

            if (
                !currentProfile ||
                isRenderingAvatar
            ) {
                return;
            }

            const image =
                avatar.querySelector("img");

            const expectedImage =
                currentProfile.profilePicture;

            if (expectedImage) {

                if (
                    !image ||
                    !image.src.endsWith(expectedImage)
                ) {

                    renderAvatar(currentProfile);
                }

            } else {

                const expectedInitial =
                    getInitial(currentProfile.fullName);

                if (
                    image ||
                    avatar.textContent.trim() !== expectedInitial
                ) {

                    renderAvatar(currentProfile);
                }
            }
        });

        observer.observe(avatar, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }


    /* =====================================================
       8. INITIALIZE
       ===================================================== */

    document.addEventListener("DOMContentLoaded", () => {

        observeAvatarChanges();

        loadAccount();
    });


    /* =====================================================
       9. PUBLIC API
       ===================================================== */

    window.StudyTrackSidebarAccount = {

        refresh: loadAccount,

        render: renderAccount,

        getProfile: () => currentProfile

    };

})();