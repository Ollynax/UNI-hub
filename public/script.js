async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

function clubIcon(icon) {
  const icons = {
    camera: "📷",
    theatre: "🎭",
    science: "🔬",
    rocket: "🚀",
  };
  return icons[icon] || "⭐";
}

function eventMarkup(event) {
  return `
    <article class="event-card">
      <div class="date-badge">
        <span>${event.month}</span>
        <strong>${event.day}</strong>
      </div>
      <div class="event-copy">
        <h4>${event.title}</h4>
        <p>${event.location} • ${event.time}</p>
        <small>${event.category}</small>
      </div>
      <button type="button">${event.actionLabel}</button>
    </article>
  `;
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

async function renderHome() {
  const [events, clubs] = await Promise.all([fetchJson("/api/events"), fetchJson("/api/clubs")]);

  const heroEvents = document.getElementById("hero-events");
  const heroClubs = document.getElementById("hero-clubs");
  const phoneEvents = document.getElementById("phone-events");

  if (heroEvents) heroEvents.innerHTML = events.slice(0, 3).map(heroEventMarkup).join("");
  if (heroClubs) heroClubs.innerHTML = clubs.slice(0, 3).map(clubMarkup).join("");

  if (phoneEvents) {
    phoneEvents.innerHTML = events
      .slice(1, 3)
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
      .join("");
  }
}

async function renderDashboard() {
  const [events, clubs, stats, announcements] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson("/api/clubs"),
    fetchJson("/api/stats"),
    fetchJson("/api/announcements"),
  ]);

  const eventsList = document.getElementById("events-list");
  const clubsList = document.getElementById("clubs-list");
  const announcementList = document.getElementById("announcement-list");
  const dashboardStats = document.getElementById("dashboard-stats");

  if (eventsList) eventsList.innerHTML = events.map(eventMarkup).join("");
  if (clubsList) clubsList.innerHTML = clubs.map(clubMarkup).join("");
  if (announcementList) announcementList.innerHTML = announcements.map(announcementMarkup).join("");

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
    adminEvents.innerHTML = events
      .map(
        (event) => `
          <article class="announcement-card">
            <h4>${event.title}</h4>
            <p>${event.date} • ${event.location}</p>
            <span class="status-tag">${event.status}</span>
          </article>
        `,
      )
      .join("");
  }

  if (adminClubs) adminClubs.innerHTML = clubs.map(clubMarkup).join("");
}

const page = document.body.dataset.page;

if (page === "home") renderHome();
if (page === "dashboard") renderDashboard();
if (page === "profile") renderProfile();
if (page === "admin") renderAdmin();
