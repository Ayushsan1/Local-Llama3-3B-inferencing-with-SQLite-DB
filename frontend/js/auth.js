// Verify session token on page load
function checkAuth() {
  const token = localStorage.getItem("jwt_token");
  const isAuthPage = window.location.pathname.includes("login.html") || window.location.pathname.includes("register.html");
  
  if (!token && !isAuthPage) {
    window.location.href = "login.html";
  } else if (token && isAuthPage) {
    window.location.href = "index.html";
  }
}

// Show notification box message
function showToast(message, isSuccess = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  
  toast.innerText = message;
  toast.className = `toast show ${isSuccess ? "success" : ""}`;
  
  setTimeout(() => {
    toast.className = toast.className.replace("show", "").trim();
  }, 4000);
}

// Bind auth forms actions once DOM loads
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usernameField = document.getElementById("username");
      const passwordField = document.getElementById("password");
      const submitBtn = document.getElementById("submit-btn");
      
      const username = usernameField.value.trim();
      const password = passwordField.value;

      try {
        submitBtn.disabled = true;
        submitBtn.querySelector("#btn-text").innerText = "Signing In...";

        // Call api.js login utility
        const data = await API.login(username, password);
        
        localStorage.setItem("jwt_token", data.access_token);
        localStorage.setItem("username", data.username);
        
        window.location.href = "index.html";
      } catch (error) {
        showToast(error.message || "Failed to log in. Please try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector("#btn-text").innerText = "Sign In";
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usernameField = document.getElementById("username");
      const passwordField = document.getElementById("password");
      const submitBtn = document.getElementById("submit-btn");
      
      const username = usernameField.value.trim();
      const password = passwordField.value;

      try {
        submitBtn.disabled = true;
        submitBtn.querySelector("#btn-text").innerText = "Signing Up...";

        await API.register(username, password);
        showToast("Registration successful! Redirecting...", true);
        
        // Redirect back to login screen on success
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } catch (error) {
        showToast(error.message || "Registration failed. Username might be taken.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector("#btn-text").innerText = "Sign Up";
      }
    });
  }
});
