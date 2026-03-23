async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

const page = document.body.dataset.page;
const protectedPages = new Set(["dashboard", "profile", "admin"]);

function isAuthenticated() {
  return window.localStorage.getItem("uniHubAuth") === "true";
}

function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem("uniHubCurrentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  window.localStorage.setItem("uniHubCurrentUser", JSON.stringify(user));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setAuthMessage(message) {
  setText("auth-message", message || "");
}

function setBrandingMessage(message) {
  setText("branding-message", message || "");
}

function signIn(user) {
  window.localStorage.setItem("uniHubAuth", "true");
  setCurrentUser(user);
  window.location.href = "/dashboard";
}

function signOut() {
  window.localStorage.removeItem("uniHubAuth");
  window.localStorage.removeItem("uniHubCurrentUser");
  window.location.href = "/login";
}

function setupAuthFlows() {
  if (protectedPages.has(page) && !isAuthenticated()) {
    window.location.href = "/login";
    return false;
  }

  if ((page === "login" || page === "register") && isAuthenticated()) {
    window.location.href = "/dashboard";
    return false;
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutLink = document.getElementById("logout-link");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);

      try {
        setAuthMessage("");
        const result = await fetchJson("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
          }),
        });
        signIn(result.user);
      } catch (error) {
        setAuthMessage(error.message);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const password = formData.get("password");
      const confirmPassword = formData.get("confirmPassword");

      if (password !== confirmPassword) {
        setAuthMessage("Passwords do not match.");
        return;
      }

      try {
        setAuthMessage("");
        const result = await fetchJson("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            studentId: formData.get("studentId"),
            email: formData.get("email"),
            department: formData.get("department"),
            year: formData.get("year"),
            password,
          }),
        });
        signIn(result.user);
      } catch (error) {
        setAuthMessage(error.message);
      }
    });
  }

  if (logoutLink) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      signOut();
    });
  }

  return true;
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function getClubBadge(club) {
  if (!club?.name) return "CL";
  return club.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function previewEventMarkup(event) {
  return `
    <article class="preview-item">
      <div class="preview-date">
        <span>${event.month || "TBD"}</span>
        <strong>${event.day || "--"}</strong>
      </div>
      <div class="preview-copy">
        <h4>${event.title}</h4>
        <p>${event.location || "Location pending"}</p>
        <small>${event.category || "Campus activity"}</small>
      </div>
      <button type="button" class="table-action">${event.actionLabel || "View"}</button>
    </article>
  `;
}

function mobileEventMarkup(event) {
  return `
    <article class="phone-card">
      <div class="preview-date">
        <span>${event.month || "TBD"}</span>
        <strong>${event.day || "--"}</strong>
      </div>
      <div class="preview-copy">
        <h4>${event.title}</h4>
        <p>${event.location || "Location pending"}</p>
      </div>
    </article>
  `;
}

function clubMarkup(club) {
  return `
    <article class="club-card">
      <div class="club-icon">${getClubBadge(club)}</div>
      <div>
        <h4>${club.name}</h4>
        <p>${club.focus || "Club information will appear here."}</p>
      </div>
      <span class="club-meta">${club.members || 0} members</span>
    </article>
  `;
}

function announcementMarkup(item) {
  return `
    <article class="announcement-card">
      <h4>${item.title}</h4>
      <p>${item.detail || "Announcement details will appear here."}</p>
    </article>
  `;
}

function statMarkup(label, value) {
  return `
    <div class="stat-pill">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function eventTableMarkup(events) {
  if (!events.length) {
    return emptyStateMarkup("No upcoming events yet. Events will appear here after they are uploaded.");
  }

  return `
    <table class="events-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Event</th>
          <th>Category</th>
          <th>Location</th>
          <th>Time</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${events
          .map(
            (event) => `
              <tr>
                <td><span class="table-date">${event.month || "TBD"} ${event.day || "--"}</span></td>
                <td>${event.title}</td>
                <td>${event.category || "Campus activity"}</td>
                <td>${event.location || "Location pending"}</td>
                <td>${event.time || "TBD"}</td>
                <td><button type="button" class="table-action">${event.actionLabel || "View"}</button></td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function loadInstitutionBranding() {
  const image = window.localStorage.getItem("uniHubInstitutionImage");
  const title = window.localStorage.getItem("uniHubInstitutionTitle");
  const caption = window.localStorage.getItem("uniHubInstitutionCaption");

  const landingImage = document.getElementById("institution-image");
  const landingTitle = document.getElementById("institution-name");
  const landingCaption = document.getElementById("institution-caption");
  const adminPreview = document.getElementById("admin-institution-preview");
  const adminTitle = document.getElementById("institution-title");
  const adminCaption = document.getElementById("institution-caption-input");

  if (image && landingImage) landingImage.src = image;
  if (image && adminPreview) adminPreview.src = image;
  if (title && landingTitle) landingTitle.textContent = title;
  if (caption && landingCaption) landingCaption.textContent = caption;
  if (title && adminTitle) adminTitle.value = title;
  if (caption && adminCaption) adminCaption.value = caption;
}

function setupInstitutionBranding() {
  loadInstitutionBranding();

  const imageInput = document.getElementById("institution-image-input");
  const titleInput = document.getElementById("institution-title");
  const captionInput = document.getElementById("institution-caption-input");
  const saveButton = document.getElementById("save-institution-branding");
  const preview = document.getElementById("admin-institution-preview");

  if (!saveButton) return;

  let pendingImage = window.localStorage.getItem("uniHubInstitutionImage") || "";

  if (imageInput) {
    imageInput.addEventListener("change", () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        pendingImage = reader.result;
        if (preview) preview.src = pendingImage;
      };
      reader.readAsDataURL(file);
    });
  }

  saveButton.addEventListener("click", () => {
    if (pendingImage) {
      window.localStorage.setItem("uniHubInstitutionImage", pendingImage);
    }

    if (titleInput?.value.trim()) {
      window.localStorage.setItem("uniHubInstitutionTitle", titleInput.value.trim());
    }

    if (captionInput?.value.trim()) {
      window.localStorage.setItem("uniHubInstitutionCaption", captionInput.value.trim());
    }

    loadInstitutionBranding();
    setBrandingMessage("Homepage branding saved.");
  });
}

async function renderHome() {
  const [events, clubs] = await Promise.all([fetchJson("/api/events"), fetchJson("/api/clubs")]);

  const heroEvents = document.getElementById("hero-events");
  const heroClubs = document.getElementById("hero-clubs");
  const phoneEvents = document.getElementById("phone-events");

  if (heroEvents) {
    heroEvents.innerHTML = events.length
      ? events.slice(0, 3).map(previewEventMarkup).join("")
      : emptyStateMarkup("No events uploaded yet.");
  }

  if (heroClubs) {
    heroClubs.innerHTML = clubs.length
      ? clubs.slice(0, 3).map(clubMarkup).join("")
      : emptyStateMarkup("No clubs uploaded yet.");
  }

  if (phoneEvents) {
    phoneEvents.innerHTML = events.length
      ? events.slice(0, 2).map(mobileEventMarkup).join("")
      : emptyStateMarkup("No events yet.");
  }
}

async function renderDashboard() {
  const [events, clubs, stats, announcements] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson("/api/clubs"),
    fetchJson("/api/stats"),
    fetchJson("/api/announcements"),
  ]);

  const currentUser = getCurrentUser();
  const dashboardGreeting = document.getElementById("dashboard-greeting");
  const eventsTable = document.getElementById("events-table");
  const clubsList = document.getElementById("clubs-list");
  const announcementList = document.getElementById("announcement-list");
  const dashboardStats = document.getElementById("dashboard-stats");

  if (dashboardGreeting) {
    dashboardGreeting.textContent = currentUser?.name
      ? `Welcome back, ${currentUser.name}.`
      : "Welcome back.";
  }

  if (eventsTable) {
    eventsTable.innerHTML = eventTableMarkup(events);
  }

  if (clubsList) {
    clubsList.innerHTML = clubs.length
      ? clubs.map(clubMarkup).join("")
      : emptyStateMarkup("No clubs available yet.");
  }

  if (announcementList) {
    announcementList.innerHTML = announcements.length
      ? announcements.map(announcementMarkup).join("")
      : emptyStateMarkup("No announcements have been posted yet.");
  }

  if (dashboardStats) {
    dashboardStats.innerHTML = [
      statMarkup("RSVPs", stats.rsvps),
      statMarkup("Events", stats.eventsThisMonth),
      statMarkup("Check-ins", stats.checkIns),
      statMarkup("Clubs", stats.clubsActive),
    ].join("");
  }
}

async function renderProfile() {
  const profileCard = document.getElementById("profile-card");
  if (!profileCard) return;

  const user = getCurrentUser() || (await fetchJson("/api/users/me"));
  if (!user) {
    profileCard.innerHTML = emptyStateMarkup("No profile data is available yet.");
    return;
  }

  profileCard.innerHTML = `
    <article class="surface-card profile-panel">
      <div class="profile-hero">
        <div class="profile-avatar">${user.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <p class="eyebrow">${user.role || "Student"}</p>
          <h1>${user.name}</h1>
          <p>${user.department || "Department pending"}${user.year ? ` • ${user.year}` : ""}</p>
        </div>
      </div>
      <div class="stat-grid stat-grid-compact">
        ${statMarkup("RSVPs", user.rsvps || 0)}
        ${statMarkup("Check-ins", user.checkIns || 0)}
        ${statMarkup("Joined Clubs", Array.isArray(user.clubs) ? user.clubs.length : 0)}
        ${statMarkup("Student ID", user.studentId || "Not set")}
      </div>
      <div>
        <p class="eyebrow">Joined Clubs</p>
        <div class="joined-clubs">
          ${
            Array.isArray(user.clubs) && user.clubs.length
              ? user.clubs.map((club) => `<span>${club}</span>`).join("")
              : '<span>No club memberships yet</span>'
          }
        </div>
      </div>
    </article>
  `;
}

async function renderAdmin() {
  const [events, clubs, stats] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson("/api/clubs"),
    fetchJson("/api/stats"),
  ]);

  const adminStats = document.getElementById("admin-stats");
  const adminEvents = document.getElementById("admin-events");
  const adminClubs = document.getElementById("admin-clubs");

  if (adminStats) {
    adminStats.innerHTML = [
      statMarkup("RSVPs Recorded", stats.rsvps),
      statMarkup("Monthly Events", stats.eventsThisMonth),
      statMarkup("Check-ins", stats.checkIns),
      statMarkup("Active Clubs", stats.clubsActive),
    ].join("");
  }

  if (adminEvents) {
    adminEvents.innerHTML = events.length
      ? events
          .map(
            (event) => `
              <article class="announcement-card">
                <h4>${event.title}</h4>
                <p>${event.date || "Date pending"}${event.location ? ` • ${event.location}` : ""}</p>
                <span class="status-tag">${event.status || "Scheduled"}</span>
              </article>
            `,
          )
          .join("")
      : emptyStateMarkup("No event records yet.");
  }

  if (adminClubs) {
    adminClubs.innerHTML = clubs.length
      ? clubs.map(clubMarkup).join("")
      : emptyStateMarkup("No club records yet.");
  }
}

if (setupAuthFlows()) {
  if (page === "home") {
    loadInstitutionBranding();
    renderHome();
  }

  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "profile") {
    renderProfile();
  }

  if (page === "admin") {
    setupInstitutionBranding();
    renderAdmin();
  }
}
