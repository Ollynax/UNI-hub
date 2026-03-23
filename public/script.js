async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

const page = document.body.dataset.page;
const protectedPages = new Set(["dashboard", "profile", "admin", "joinclub", "createclub"]);
const defaultBranding = {
  title: "Your Institution, Presented Clearly",
  caption: "Administrators can manage the institution image, title, and homepage message from the admin workspace.",
  image: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

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

function isAdminUser(user) {
  return (user?.role || "").toLowerCase() === "admin";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setMessage(id, message, status = "info") {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message || "";
  element.dataset.status = status;
}

function setAuthMessage(message, status = "error") {
  setMessage("auth-message", message || "", status);
}

function setBrandingMessage(message, status = "success") {
  setMessage("branding-message", message || "", status);
}

function setJoinClubMessage(message, status = "success") {
  setMessage("join-club-message", message || "", status);
}

function setCreateClubMessage(message, status = "success") {
  setMessage("create-club-message", message || "", status);
}

function setAdminEventMessage(message, status = "success") {
  setMessage("admin-event-message", message || "", status);
}

function setAdminAnnouncementMessage(message, status = "success") {
  setMessage("admin-announcement-message", message || "", status);
}

function setAdminClubMessage(message, status = "success") {
  setMessage("admin-club-message", message || "", status);
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

async function getLatestCurrentUser() {
  const currentUser = getCurrentUser();
  if (!currentUser?.email) return currentUser;

  try {
    const latestUser = await fetchJson(`/api/users/me?email=${encodeURIComponent(currentUser.email)}`);
    if (latestUser?.email) {
      setCurrentUser(latestUser);
      return latestUser;
    }
  } catch {
    return currentUser;
  }

  return currentUser;
}

function setupAuthFlows() {
  const currentUser = getCurrentUser();

  if (protectedPages.has(page) && !isAuthenticated()) {
    window.location.href = "/login";
    return false;
  }

  if (page === "admin" && !isAdminUser(currentUser)) {
    window.location.href = "/dashboard";
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
        setAuthMessage("", "info");
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
        setAuthMessage(error.message, "error");
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
        setAuthMessage("Passwords do not match.", "error");
        return;
      }

      try {
        setAuthMessage("", "info");
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
        setAuthMessage(error.message, "error");
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

function setupAdminVisibility() {
  const currentUser = getCurrentUser();
  const adminLinks = document.querySelectorAll("[data-admin-link]");
  adminLinks.forEach((link) => {
    link.style.display = isAdminUser(currentUser) ? "" : "none";
  });
}

function emptyStateMarkup(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
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
        <span>${escapeHtml(event.month || "TBD")}</span>
        <strong>${escapeHtml(event.day || "--")}</strong>
      </div>
      <div class="preview-copy">
        <h4>${escapeHtml(event.title)}</h4>
        <p>${escapeHtml(event.location || "Location pending")}</p>
        <small>${escapeHtml(event.category || "Campus activity")}</small>
      </div>
      <button type="button" class="table-action">${escapeHtml(event.actionLabel || "View")}</button>
    </article>
  `;
}

function mobileEventMarkup(event) {
  return `
    <article class="phone-card">
      <div class="preview-date">
        <span>${escapeHtml(event.month || "TBD")}</span>
        <strong>${escapeHtml(event.day || "--")}</strong>
      </div>
      <div class="preview-copy">
        <h4>${escapeHtml(event.title)}</h4>
        <p>${escapeHtml(event.location || "Location pending")}</p>
      </div>
    </article>
  `;
}

function clubMarkup(club) {
  return `
    <article class="club-card">
      <div class="club-icon">${escapeHtml(getClubBadge(club))}</div>
      <div>
        <h4>${escapeHtml(club.name)}</h4>
        <p>${escapeHtml(club.focus || "Club information will appear here.")}</p>
      </div>
      <span class="club-meta">${escapeHtml(club.members || 0)} members</span>
    </article>
  `;
}

function joinClubItemMarkup(club) {
  return `
    <article class="club-card">
      <div class="club-icon">${escapeHtml(getClubBadge(club))}</div>
      <div>
        <h4>${escapeHtml(club.name)}</h4>
        <p>${escapeHtml(club.focus || "Club information will appear here.")}</p>
      </div>
      <button type="button" class="table-action join-club-button" data-club-id="${escapeHtml(club.id)}">Join</button>
    </article>
  `;
}

function announcementMarkup(item) {
  return `
    <article class="announcement-card">
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.detail || "Announcement details will appear here.")}</p>
    </article>
  `;
}

function statMarkup(label, value) {
  return `
    <div class="stat-pill">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
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
                <td><span class="table-date">${escapeHtml(event.month || "TBD")} ${escapeHtml(event.day || "--")}</span></td>
                <td>${escapeHtml(event.title)}</td>
                <td>${escapeHtml(event.category || "Campus activity")}</td>
                <td>${escapeHtml(event.location || "Location pending")}</td>
                <td>${escapeHtml(event.time || "TBD")}</td>
                <td><button type="button" class="table-action">${escapeHtml(event.actionLabel || "View")}</button></td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function adminEventMarkup(event) {
  const meta = [
    event.date || "Date pending",
    event.time || "Time pending",
    event.location || "Location pending",
    event.category || "Campus activity",
    event.status || "Scheduled",
  ];

  return `
    <article class="admin-record">
      <div class="admin-record-header">
        <div>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.description || "No event description added yet.")}</p>
        </div>
        <div class="admin-record-actions">
          <button type="button" class="button danger" data-delete-event="${escapeHtml(event.id)}">Delete</button>
        </div>
      </div>
      <div class="admin-record-meta">
        ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>
  `;
}

function adminAnnouncementMarkup(item) {
  return `
    <article class="admin-record">
      <div class="admin-record-header">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.detail || "No announcement detail provided.")}</p>
        </div>
        <div class="admin-record-actions">
          <button type="button" class="button danger" data-delete-announcement="${escapeHtml(item.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function adminClubMarkup(club) {
  const meta = [
    `${club.members || 0} members`,
    club.category || "General",
    club.contactEmail || "No contact email",
    club.createdBy ? `Created by ${club.createdBy}` : "Creator not listed",
  ];

  return `
    <article class="admin-record">
      <div class="admin-record-header">
        <div>
          <h3>${escapeHtml(club.name)}</h3>
          <p>${escapeHtml(club.focus || "No club focus provided.")}</p>
        </div>
        <div class="admin-record-actions">
          <button type="button" class="button danger" data-delete-club="${escapeHtml(club.id)}">Delete</button>
        </div>
      </div>
      <div class="admin-record-meta">
        ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>
  `;
}

function adminUserMarkup(user) {
  const joinedClubs = Array.isArray(user.clubs) ? user.clubs.length : 0;
  return `
    <article class="admin-user-card">
      <div class="admin-user-header">
        <div>
          <p class="eyebrow">Account</p>
          <h3>${escapeHtml(user.name || "Unnamed user")}</h3>
          <p>${escapeHtml(user.email || "No email provided")}</p>
        </div>
        <span class="role-chip">${escapeHtml(user.role || "Student")}</span>
      </div>
      <div class="admin-record-meta">
        <span>${escapeHtml(user.department || "Department pending")}</span>
        <span>${escapeHtml(user.year || "Year pending")}</span>
        <span>${escapeHtml(user.studentId || "Student ID pending")}</span>
        <span>${escapeHtml(joinedClubs)} clubs</span>
      </div>
    </article>
  `;
}

function applyBranding(branding) {
  const landingImage = document.getElementById("institution-image");
  const landingTitle = document.getElementById("institution-name");
  const landingCaption = document.getElementById("institution-caption");
  const adminPreview = document.getElementById("admin-institution-preview");
  const adminTitle = document.getElementById("institution-title");
  const adminCaption = document.getElementById("institution-caption-input");

  if (landingImage) landingImage.src = branding.image;
  if (landingTitle) landingTitle.textContent = branding.title;
  if (landingCaption) landingCaption.textContent = branding.caption;
  if (adminPreview) adminPreview.src = branding.image;
  if (adminTitle) adminTitle.value = branding.title;
  if (adminCaption) adminCaption.value = branding.caption;
}

async function loadInstitutionBranding() {
  try {
    const branding = await fetchJson("/api/branding");
    applyBranding({ ...defaultBranding, ...branding });
    return { ...defaultBranding, ...branding };
  } catch {
    applyBranding(defaultBranding);
    return defaultBranding;
  }
}

function setupInstitutionBranding() {
  const saveButton = document.getElementById("save-institution-branding");
  if (!saveButton || saveButton.dataset.bound === "true") return;
  saveButton.dataset.bound = "true";

  const imageInput = document.getElementById("institution-image-input");
  const titleInput = document.getElementById("institution-title");
  const captionInput = document.getElementById("institution-caption-input");
  const preview = document.getElementById("admin-institution-preview");

  let pendingImage = defaultBranding.image;

  loadInstitutionBranding().then((branding) => {
    pendingImage = branding.image;
  });

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

  saveButton.addEventListener("click", async () => {
    const currentUser = getCurrentUser();

    try {
      setBrandingMessage("Saving branding...", "info");
      const result = await fetchJson("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorEmail: currentUser?.email,
          title: titleInput?.value || "",
          caption: captionInput?.value || "",
          image: pendingImage,
        }),
      });

      pendingImage = result.branding.image;
      applyBranding(result.branding);
      setBrandingMessage("Homepage branding saved.", "success");
    } catch (error) {
      setBrandingMessage(error.message, "error");
    }
  });
}

function setupCreateClubForm() {
  const form = document.getElementById("create-club-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = getCurrentUser();
    const formData = new FormData(form);

    try {
      setCreateClubMessage("Creating club...", "info");
      const result = await fetchJson("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          category: formData.get("category"),
          focus: formData.get("focus"),
          contactEmail: formData.get("contactEmail"),
          currentUserEmail: currentUser?.email,
          createdBy: currentUser?.name,
        }),
      });

      if (currentUser && result.club?.name) {
        const nextUser = { ...currentUser, clubs: Array.isArray(currentUser.clubs) ? [...currentUser.clubs] : [] };
        if (!nextUser.clubs.includes(result.club.name)) {
          nextUser.clubs.push(result.club.name);
        }
        setCurrentUser(nextUser);
      }

      form.reset();
      setCreateClubMessage("Club created successfully.", "success");
    } catch (error) {
      setCreateClubMessage(error.message, "error");
    }
  });
}

function setupAdminForms() {
  const eventForm = document.getElementById("admin-event-form");
  const announcementForm = document.getElementById("admin-announcement-form");

  if (eventForm && eventForm.dataset.bound !== "true") {
    eventForm.dataset.bound = "true";
    eventForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUser = getCurrentUser();
      const formData = new FormData(eventForm);

      try {
        setAdminEventMessage("Creating event...", "info");
        await fetchJson("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorEmail: currentUser?.email,
            title: formData.get("title"),
            date: formData.get("date"),
            time: formData.get("time"),
            location: formData.get("location"),
            category: formData.get("category"),
            status: formData.get("status"),
            description: formData.get("description"),
            actionLabel: "View",
          }),
        });

        eventForm.reset();
        setAdminEventMessage("Event published successfully.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminEventMessage(error.message, "error");
      }
    });
  }

  if (announcementForm && announcementForm.dataset.bound !== "true") {
    announcementForm.dataset.bound = "true";
    announcementForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUser = getCurrentUser();
      const formData = new FormData(announcementForm);

      try {
        setAdminAnnouncementMessage("Publishing announcement...", "info");
        await fetchJson("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorEmail: currentUser?.email,
            title: formData.get("title"),
            detail: formData.get("detail"),
          }),
        });

        announcementForm.reset();
        setAdminAnnouncementMessage("Announcement published successfully.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminAnnouncementMessage(error.message, "error");
      }
    });
  }
}

function setupAdminListActions() {
  const adminEvents = document.getElementById("admin-events");
  const adminAnnouncements = document.getElementById("admin-announcements");
  const adminClubs = document.getElementById("admin-clubs");

  if (adminEvents && adminEvents.dataset.bound !== "true") {
    adminEvents.dataset.bound = "true";
    adminEvents.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-event]");
      if (!button) return;

      if (!window.confirm("Delete this event?")) return;

      try {
        setAdminEventMessage("Removing event...", "info");
        await deleteAdminRecord(`/api/events/${button.dataset.deleteEvent}`);
        setAdminEventMessage("Event deleted.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminEventMessage(error.message, "error");
      }
    });
  }

  if (adminAnnouncements && adminAnnouncements.dataset.bound !== "true") {
    adminAnnouncements.dataset.bound = "true";
    adminAnnouncements.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-announcement]");
      if (!button) return;

      if (!window.confirm("Delete this announcement?")) return;

      try {
        setAdminAnnouncementMessage("Removing announcement...", "info");
        await deleteAdminRecord(`/api/announcements/${button.dataset.deleteAnnouncement}`);
        setAdminAnnouncementMessage("Announcement deleted.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminAnnouncementMessage(error.message, "error");
      }
    });
  }

  if (adminClubs && adminClubs.dataset.bound !== "true") {
    adminClubs.dataset.bound = "true";
    adminClubs.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-club]");
      if (!button) return;

      if (!window.confirm("Delete this club?")) return;

      try {
        setAdminClubMessage("Removing club...", "info");
        await deleteAdminRecord(`/api/clubs/${button.dataset.deleteClub}`);
        setAdminClubMessage("Club deleted.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminClubMessage(error.message, "error");
      }
    });
  }
}

async function deleteAdminRecord(url) {
  const currentUser = getCurrentUser();
  return fetchJson(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actorEmail: currentUser?.email,
    }),
  });
}

async function renderHome() {
  const [events, clubs] = await Promise.all([fetchJson("/api/events"), fetchJson("/api/clubs"), loadInstitutionBranding()]);

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
  const [events, clubs, stats, announcements, currentUser] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson("/api/clubs"),
    fetchJson("/api/stats"),
    fetchJson("/api/announcements"),
    getLatestCurrentUser(),
  ]);

  const dashboardGreeting = document.getElementById("dashboard-greeting");
  const eventsTable = document.getElementById("events-table");
  const clubsList = document.getElementById("clubs-list");
  const announcementList = document.getElementById("announcement-list");
  const dashboardStats = document.getElementById("dashboard-stats");
  const dashboardRole = document.getElementById("dashboard-role");
  const dashboardEmail = document.getElementById("dashboard-email");

  if (dashboardGreeting) {
    dashboardGreeting.textContent = currentUser?.name
      ? `Welcome back, ${currentUser.name}.`
      : "Welcome back.";
  }

  if (dashboardRole && currentUser?.role) {
    dashboardRole.textContent = currentUser.role;
  }

  if (dashboardEmail && currentUser?.email) {
    dashboardEmail.textContent = currentUser.email;
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

  const user = await getLatestCurrentUser();
  if (!user) {
    profileCard.innerHTML = emptyStateMarkup("No profile data is available yet.");
    return;
  }

  profileCard.innerHTML = `
    <article class="surface-card profile-panel">
      <div class="profile-hero">
        <div class="profile-avatar">${escapeHtml((user.name || "U").slice(0, 1).toUpperCase())}</div>
        <div>
          <p class="eyebrow">${escapeHtml(user.role || "Student")}</p>
          <h1>${escapeHtml(user.name || "Unnamed user")}</h1>
          <p>${escapeHtml(user.department || "Department pending")}${user.year ? ` - ${escapeHtml(user.year)}` : ""}</p>
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
              ? user.clubs.map((club) => `<span>${escapeHtml(club)}</span>`).join("")
              : "<span>No club memberships yet</span>"
          }
        </div>
      </div>
    </article>
  `;
}

async function renderAdmin() {
  const currentUser = await getLatestCurrentUser();
  const [events, clubs, stats, announcements, users, branding] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson("/api/clubs"),
    fetchJson("/api/stats"),
    fetchJson("/api/announcements"),
    fetchJson(`/api/users?email=${encodeURIComponent(currentUser?.email || "")}`),
    fetchJson("/api/branding"),
  ]);

  const adminStats = document.getElementById("admin-stats");
  const adminEvents = document.getElementById("admin-events");
  const adminClubs = document.getElementById("admin-clubs");
  const adminAnnouncements = document.getElementById("admin-announcements");
  const adminUsers = document.getElementById("admin-users");
  const adminAccountEmail = document.getElementById("admin-account-email");
  const adminAccountName = document.getElementById("admin-account-name");
  const adminPreview = document.getElementById("admin-institution-preview");
  const adminTitle = document.getElementById("institution-title");
  const adminCaption = document.getElementById("institution-caption-input");

  if (adminAccountEmail) {
    adminAccountEmail.textContent = currentUser?.email || "Signed-in admin account";
  }

  if (adminAccountName) {
    adminAccountName.textContent = currentUser?.name || "Administrator";
  }

  if (adminPreview) {
    adminPreview.src = branding.image || defaultBranding.image;
  }

  if (adminTitle) {
    adminTitle.value = branding.title || defaultBranding.title;
  }

  if (adminCaption) {
    adminCaption.value = branding.caption || defaultBranding.caption;
  }

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
      ? events.map(adminEventMarkup).join("")
      : emptyStateMarkup("No event records yet.");
  }

  if (adminAnnouncements) {
    adminAnnouncements.innerHTML = announcements.length
      ? announcements.map(adminAnnouncementMarkup).join("")
      : emptyStateMarkup("No announcements posted yet.");
  }

  if (adminClubs) {
    adminClubs.innerHTML = clubs.length
      ? clubs.map(adminClubMarkup).join("")
      : emptyStateMarkup("No club records yet.");
  }

  if (adminUsers) {
    adminUsers.innerHTML = users.length
      ? users.map(adminUserMarkup).join("")
      : emptyStateMarkup("No user accounts found yet.");
  }
}

async function renderJoinClub() {
  const clubList = document.getElementById("join-club-list");
  if (!clubList) return;

  const clubs = await fetchJson("/api/clubs");
  clubList.innerHTML = clubs.length
    ? clubs.map(joinClubItemMarkup).join("")
    : emptyStateMarkup("No clubs are available to join yet.");

  const currentUser = await getLatestCurrentUser();
  const joinedCount = Array.isArray(currentUser?.clubs) ? currentUser.clubs.length : 0;
  setText(
    "club-membership-count",
    joinedCount ? `You are currently in ${joinedCount} club${joinedCount === 1 ? "" : "s"}.` : "You have not joined any clubs yet.",
  );

  clubList.querySelectorAll(".join-club-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const latestUser = getCurrentUser();

      try {
        setJoinClubMessage("Joining club...", "info");
        const result = await fetchJson("/api/clubs/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubId: button.dataset.clubId,
            email: latestUser?.email,
          }),
        });
        setCurrentUser(result.user);
        const newCount = Array.isArray(result.user?.clubs) ? result.user.clubs.length : 0;
        setText(
          "club-membership-count",
          newCount ? `You are currently in ${newCount} club${newCount === 1 ? "" : "s"}.` : "You have not joined any clubs yet.",
        );
        setJoinClubMessage("Club joined successfully.", "success");
      } catch (error) {
        setJoinClubMessage(error.message, "error");
      }
    });
  });
}

async function initPage() {
  if (!setupAuthFlows()) return;

  setupAdminVisibility();

  if (page === "home") {
    await renderHome();
  }

  if (page === "dashboard") {
    await renderDashboard();
  }

  if (page === "profile") {
    await renderProfile();
  }

  if (page === "admin") {
    setupInstitutionBranding();
    setupAdminForms();
    setupAdminListActions();
    await renderAdmin();
  }

  if (page === "joinclub") {
    await renderJoinClub();
  }

  if (page === "createclub") {
    setupCreateClubForm();
  }
}

initPage();
