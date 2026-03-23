async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

const page = document.body.dataset.page;
const protectedPages = new Set(["dashboard", "profile", "admin"]);

function isAuthenticated() {
  return window.localStorage.getItem("uniHubAuth") === "true";
}

function signIn() {
  window.localStorage.setItem("uniHubAuth", "true");
  window.location.href = "/dashboard";
}

function signOut() {
  window.localStorage.removeItem("uniHubAuth");
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
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      signIn();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      signIn();
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

function clubIcon(icon) {
  const icons = {
    camera: "📷",
    theatre: "🎭",
    science: "🔬",
    rocket: "🚀",
  };
  return icons[icon] || "★";
}

function clubMarkup(club) {
  return `
    <article class="club-card">
      <div class="club-icon">${clubIcon(club.icon)}</div>
      <div>
        <h4>${club.name}</h4>
        <p>${club.focus}</p>
      </div>
      <span class="club-meta">${club.members} members</span>
    </article>
  `;
}

function announcementMarkup(item) {
  return `
    <article class="announcement-card">
      <h4>${item.title}</h4>
      <p>${item.detail}</p>
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

function emptyStateMarkup(message) {
  return `<div class="empty-state">${message}</div>`;
}

function heroEventMarkup(event) {
  return `
    <article class="mock-item">
      <div class="mini-date ${event.status.toLowerCase()}">
        <span>${event.month}</span>
        <strong>${event.day}</strong>
      </div>
      <div>
        <h4>${event.title}</h4>
        <div class="mini-bars">
          <span></span><span></span>
        </div>
      </div>
      <button type="button">${event.actionLabel}</button>
    </article>
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
                <td><span class="table-date">${event.month} ${event.day}</span></td>
                <td>${event.title}</td>
                <td>${event.category}</td>
                <td>${event.location}</td>
                <td>${event.time}</td>
                <td><button type="button" class="table-action">${event.actionLabel}</button></td>
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

    if (titleInput && titleInput.value.trim()) {
      window.localStorage.setItem("uniHubInstitutionTitle", titleInput.value.trim());
    }

    if (captionInput && captionInput.value.trim()) {
      window.localStorage.setItem("uniHubInstitutionCaption", captionInput.value.trim());
    }

    loadInstitutionBranding();
  });
}

async function renderHome() {
  const [events, clubs] = await Promise.all([fetchJson("/api/events"), fetchJson("/api/clubs")]);
  const heroEvents = document.getElementById("hero-events");
  const heroClubs = document.getElementById("hero-clubs");
  const phoneEvents = document.getElementById("phone-events");

  if (heroEvents) {
    heroEvents.innerHTML = events.length
      ? events.slice(0, 3).map(heroEventMarkup).join("")
      : emptyStateMarkup("No events uploaded yet.");
  }

  if (heroClubs) {
    heroClubs.innerHTML = clubs.length
      ? clubs.slice(0, 3).map(clubMarkup).join("")
      : emptyStateMarkup("No clubs uploaded yet.");
  }

  if (phoneEvents) {
    phoneEvents.innerHTML = events.length
      ? events
          .slice(0, 2)
          .map(
            (event) => `
              <article class="phone-card">
                <div class="mini-date featured">
                  <span>${event.month}</span>
                  <strong>${event.day}</strong>
                </div>
                <div>
                  <h4>${event.title}</h4>
                  <div class="mini-bars">
                    <span></span><span></span>
                  </div>
                </div>
              </article>
            `,
          )
          .join("")
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

  const eventsTable = document.getElementById("events-table");
  const clubsList = document.getElementById("clubs-list");
  const announcementList = document.getElementById("announcement-list");
  const dashboardStats = document.getElementById("dashboard-stats");

  if (eventsTable) eventsTable.innerHTML = eventTableMarkup(events);
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

  const user = await fetchJson("/api/users/me");
  if (!user) {
    profileCard.innerHTML = emptyStateMarkup("No profile data is available yet.");
    return;
  }

  profileCard.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${user.name[0]}</div>
      <div>
        <p class="eyebrow">${user.role}</p>
        <h1>${user.name}</h1>
        <p>${user.department} • ${user.year}</p>
      </div>
    </div>
    <div class="profile-grid">
      ${statMarkup("RSVPs", user.rsvps)}
      ${statMarkup("Check-ins", user.checkIns)}
      ${statMarkup("Joined Clubs", user.clubs.length)}
    </div>
    <div class="joined-clubs">
      <h3>Joined Clubs</h3>
      ${user.clubs.map((club) => `<span>${club}</span>`).join("")}
    </div>
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
    adminStats.innerHTML = `
      ${statMarkup("RSVPs Recorded", stats.rsvps)}
      ${statMarkup("Monthly Events", stats.eventsThisMonth)}
      ${statMarkup("Check-Ins", stats.checkIns)}
      ${statMarkup("Active Clubs", stats.clubsActive)}
    `;
  }

  if (adminEvents) {
    adminEvents.innerHTML = events.length
      ? events
          .map(
            (event) => `
              <article class="announcement-card">
                <h4>${event.title}</h4>
                <p>${event.date} • ${event.location}</p>
                <span class="status-tag">${event.status}</span>
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
  if (page === "dashboard") renderDashboard();
  if (page === "profile") renderProfile();
  if (page === "admin") {
    setupInstitutionBranding();
    renderAdmin();
  }
}
