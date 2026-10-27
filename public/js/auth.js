/* =========================================================
   STUDYTRACK V2
   FRONTEND AUTHENTICATION
   File: public/js/auth.js

   Responsibilities:
   1. Handle user registration.
   2. Handle user login.
   3. Display success and error messages.
   4. Check existing authentication sessions.
   5. Handle user logout.
   ========================================================= */


/* =========================================================
   1. API REQUEST HELPER
   Sends requests to the StudyTrack V2 backend.
   ========================================================= */

async function sendAuthRequest(endpoint, payload = null) {
    const options = {
        method: payload ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "same-origin"
    };

    if (payload) {
        options.body = JSON.stringify(payload);
    }

    const response = await fetch(endpoint, options);

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        const error = new Error(
            result.message || "Something went wrong. Please try again."
        );

        error.status = response.status;

        throw error;
    }

    return result;
}


/* =========================================================
   2. MESSAGE HELPERS
   Uses the CSS classes defined in style.css:
   .form-message
   .form-message.is-visible
   .form-message.is-error
   .form-message.is-success
   ========================================================= */

function showMessage(element, message, type = "error") {
    if (!element) {
        return;
    }

    element.textContent = message;

    element.classList.remove(
        "is-visible",
        "is-error",
        "is-success",
        "is-info",
        "error",
        "success"
    );

    const messageClass =
        type === "success" ? "is-success" : "is-error";

    element.classList.add("is-visible", messageClass);

    element.hidden = false;
}


function clearMessage(element) {
    if (!element) {
        return;
    }

    element.textContent = "";

    element.classList.remove(
        "is-visible",
        "is-error",
        "is-success",
        "is-info",
        "error",
        "success"
    );

    element.hidden = true;
}


/* =========================================================
   3. BUTTON LOADING HELPER
   Prevents repeated form submissions.
   ========================================================= */

function setButtonLoading(button, isLoading, loadingText) {
    if (!button) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.textContent.trim();
        }

        button.textContent = loadingText;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");

    } else {
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }

        button.disabled = false;
        button.removeAttribute("aria-busy");

        delete button.dataset.originalText;
    }
}


/* =========================================================
   4. LOGIN FORM
   Handles login functionality on index.html.
   ========================================================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const messageElement = document.getElementById("loginMessage");
    const submitButton = document.getElementById("loginButton");

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        clearMessage(messageElement);

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage(
                messageElement,
                "Please enter your email address and password."
            );

            return;
        }

        setButtonLoading(
            submitButton,
            true,
            "Signing in..."
        );

        try {
            const result = await sendAuthRequest(
                "/api/auth/login",
                {
                    email,
                    password
                }
            );

            showMessage(
                messageElement,
                result.message || "Login successful. Redirecting...",
                "success"
            );

            window.location.href = "/dashboard.html";

        } catch (error) {
            showMessage(
                messageElement,
                error.message ||
                    "Unable to sign in. Please try again."
            );

        } finally {
            setButtonLoading(
                submitButton,
                false,
                "Signing in..."
            );
        }
    });
}


/* =========================================================
   5. REGISTRATION FORM
   Handles creation of new user accounts.
   ========================================================= */

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    const nameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("registerEmail");
    const passwordInput =
        document.getElementById("registerPassword");

    const confirmPasswordInput =
        document.getElementById("confirmPassword");

    const messageElement =
        document.getElementById("registerMessage");

    const submitButton =
        document.getElementById("registerButton");

    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        clearMessage(messageElement);

        const fullName = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!fullName || !email || !password || !confirmPassword) {
            showMessage(
                messageElement,
                "Please complete all the required fields."
            );

            return;
        }

        if (fullName.length > 100) {
            showMessage(
                messageElement,
                "Your full name must not exceed 100 characters."
            );

            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                messageElement,
                "Your passwords do not match."
            );

            return;
        }

        if (password.length < 8) {
            showMessage(
                messageElement,
                "Your password must contain at least 8 characters."
            );

            return;
        }

        setButtonLoading(
            submitButton,
            true,
            "Creating account..."
        );

        try {
            const result = await sendAuthRequest(
                "/api/auth/register",
                {
                    fullName,
                    email,
                    password
                }
            );

            showMessage(
                messageElement,
                result.message || "Account created successfully.",
                "success"
            );

            window.location.href = "/dashboard.html";

        } catch (error) {
            showMessage(
                messageElement,
                error.message ||
                    "Unable to create your account. Please try again."
            );

        } finally {
            setButtonLoading(
                submitButton,
                false,
                "Creating account..."
            );
        }
    });
}


/* =========================================================
   6. LOGOUT
   Uses the existing backend endpoint:
   POST /api/auth/logout

   The server destroys the session and clears its cookie.
   ========================================================= */

function initializeLogout() {
    const logoutButtons = document.querySelectorAll("#logoutButton");

    logoutButtons.forEach((logoutButton) => {
        if (logoutButton.dataset.logoutInitialized === "true") {
            return;
        }

        logoutButton.dataset.logoutInitialized = "true";

        logoutButton.addEventListener("click", async function (event) {
            event.preventDefault();

            if (logoutButton.disabled) {
                return;
            }

            const originalText = logoutButton.textContent.trim();

            logoutButton.disabled = true;
            logoutButton.setAttribute("aria-busy", "true");
            logoutButton.textContent = "Signing out...";

            try {
                await sendAuthRequest("/api/auth/logout", {});

                // Replace the current page so the authenticated
                // page is not left as the active browser history entry.
                window.location.replace("/index.html");

            } catch (error) {
                console.error("StudyTrack logout failed:", error);

                logoutButton.disabled = false;
                logoutButton.removeAttribute("aria-busy");
                logoutButton.textContent = originalText;

                window.alert(
                    error.message ||
                    "Unable to sign out. Please check your connection and try again."
                );
            }
        });
    });
}


/* =========================================================
   7. EXISTING SESSION CHECK

   Redirects authenticated users away from login and
   registration pages.

   A 401 response means the user is not logged in and is
   expected when visiting these pages without a session.
   ========================================================= */

async function redirectIfAuthenticated() {
    const isAuthPage = loginForm || registerForm;

    if (!isAuthPage) {
        return;
    }

    try {
        await sendAuthRequest("/api/auth/me");

        // An authenticated user should not remain on
        // the login or registration page.
        window.location.replace("/dashboard.html");

    } catch (error) {
        if (error.status === 401) {
            // Expected: the visitor is not authenticated.
            // Keep the login or registration page available.
            return;
        }

        // A network or server error should not prevent
        // the visitor from using the authentication form.
        console.error(
            "Unable to verify the current session:",
            error.message
        );
    }
}


/* =========================================================
   8. INITIALIZE AUTHENTICATION FEATURES
   ========================================================= */

function initializeAuthentication() {
    initializeLogout();
    redirectIfAuthenticated();
}


if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeAuthentication,
        { once: true }
    );
} else {
    initializeAuthentication();
}

