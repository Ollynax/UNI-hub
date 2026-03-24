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

function truncateText(value, maxLength = 110) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function getInitials(value, fallback = "U") {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return fallback;

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
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

function getSignedInHome(user) {
  return isAdminUser(user) ? "/adminpanel" : "/dashboard";
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

function setAdminDepartmentMessage(message, status = "success") {
  setMessage("admin-department-message", message || "", status);
}

function signIn(user) {
  window.localStorage.setItem("uniHubAuth", "true");
  setCurrentUser(user);
  window.location.href = getSignedInHome(user);
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

async function setupAuthFlows() {
  let currentUser = getCurrentUser();

  if (isAuthenticated() && currentUser?.email) {
    currentUser = await getLatestCurrentUser();
  }

  if (protectedPages.has(page) && !isAuthenticated()) {
    window.location.href = "/login";
    return false;
  }

  if (page === "admin" && !isAdminUser(currentUser)) {
    window.location.href = "/dashboard";
    return false;
  }

  if (page === "dashboard" && isAdminUser(currentUser)) {
    window.location.href = "/adminpanel";
    return false;
  }

  if ((page === "login" || page === "register") && isAuthenticated()) {
    window.location.href = getSignedInHome(currentUser);
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

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isVisible(element) {
  if (!element || element.hidden) return false;
  const styles = window.getComputedStyle(element);
  return styles.display !== "none" && styles.visibility !== "hidden";
}

function ensureSearchTargetId(element, index) {
  if (element.id) return element.id;

  const heading = element.querySelector("h1, h2, h3");
  const base = slugify(heading?.textContent || `section-${index + 1}`) || `section-${index + 1}`;
  let candidate = base;
  let suffix = 1;

  while (document.getElementById(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  element.id = candidate;
  return candidate;
}

function collectHeaderSearchItems() {
  const items = [];
  const seen = new Set();
  const currentPageLabel = document.querySelector(".brand-name")?.textContent.trim() || document.title;

  const pushItem = (item) => {
    const key = `${item.href}::${item.label}`.toLowerCase();
    if (!item.label || !item.href || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  document.querySelectorAll(".site-nav a[href]").forEach((link) => {
    if (!isVisible(link)) return;

    const href = link.getAttribute("href") || "";
    const label = link.textContent.trim();
    const type = href.startsWith("#") ? "Section" : "Page";
    const description = href === window.location.pathname ? "You are already here." : "Open this quick link.";
    const meta = href.startsWith("#") ? currentPageLabel : "Primary navigation";

    pushItem({ href, label, type, description, meta });
  });

  document.querySelectorAll("main > section, main > article, main .page-hero, main .section-block, main .admin-section-card").forEach((section, index) => {
    const heading = section.querySelector("h1, h2, h3");
    if (!heading) return;

    const label = heading.textContent.trim();
    if (!label) return;

    const descriptionSource = section.querySelector("p");
    const description = truncateText(descriptionSource?.textContent || "Jump to this section.", 96);
    const id = section.id || ensureSearchTargetId(section, index);

    pushItem({
      href: `#${id}`,
      label,
      type: "Section",
      description,
      meta: currentPageLabel,
    });
  });

  return items;
}

function renderHeaderSearchResults(resultsNode, items) {
  if (!resultsNode) return;

  if (!items.length) {
    resultsNode.innerHTML = '<div class="header-search-empty">No matches yet. Try a page name, section title, or action.</div>';
    return;
  }

  resultsNode.innerHTML = items
    .slice(0, 8)
    .map(
      (item) => `
        <a href="${escapeHtml(item.href)}" class="header-search-result">
          <span class="header-search-result-type">${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.description)}</p>
          <span class="header-search-result-meta">${escapeHtml(item.meta)}</span>
        </a>
      `,
    )
    .join("");
}

function setupHeaderInteractions() {
  const header = document.querySelector(".site-header");
  if (!header || header.dataset.bound === "true") return;
  header.dataset.bound = "true";

  const frame = header.querySelector(".header-frame");
  const menuToggle = header.querySelector(".header-menu-toggle");
  const nav = header.querySelector(".site-nav");
  const searchToggle = header.querySelector("[data-header-search-toggle]");
  const searchPanel = header.querySelector(".header-search-panel");
  const searchInput = header.querySelector(".header-search-input");
  const resultsNode = header.querySelector("[data-header-search-results]");
  const canUsePointerParallax = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const setCondensedState = () => {
    header.classList.toggle("is-condensed", window.scrollY > 18);
  };

  const syncOverlayState = () => {
    document.body.classList.toggle(
      "header-overlay-open",
      window.innerWidth <= 960 &&
        (header.classList.contains("is-menu-open") || header.classList.contains("is-search-open")),
    );
  };

  const closeMenu = () => {
    header.classList.remove("is-menu-open");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
    syncOverlayState();
  };

  const openMenu = () => {
    closeSearch();
    header.classList.add("is-menu-open");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
    syncOverlayState();
  };

  const updateSearchResults = (query = "") => {
    const normalizedQuery = query.trim().toLowerCase();
    const allItems = collectHeaderSearchItems();
    const filteredItems = normalizedQuery
      ? allItems.filter((item) => `${item.label} ${item.description} ${item.meta}`.toLowerCase().includes(normalizedQuery))
      : allItems;

    renderHeaderSearchResults(resultsNode, filteredItems);
  };

  const closeSearch = () => {
    header.classList.remove("is-search-open");
    if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
    if (searchPanel) searchPanel.hidden = true;
    syncOverlayState();
  };

  const openSearch = () => {
    if (!searchPanel) return;
    closeMenu();
    header.classList.add("is-search-open");
    if (searchToggle) searchToggle.setAttribute("aria-expanded", "true");
    searchPanel.hidden = false;
    updateSearchResults(searchInput?.value || "");
    syncOverlayState();
    window.requestAnimationFrame(() => {
      searchInput?.focus();
      searchInput?.select();
    });
  };

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      if (header.classList.contains("is-menu-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link && window.innerWidth <= 960) {
        closeMenu();
      }
    });
  }

  if (searchToggle && searchPanel) {
    searchToggle.addEventListener("click", () => {
      if (header.classList.contains("is-search-open")) {
        closeSearch();
      } else {
        openSearch();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      updateSearchResults(searchInput.value);
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      const firstResult = resultsNode?.querySelector("a[href]");
      if (!firstResult) return;

      event.preventDefault();
      firstResult.click();
    });
  }

  if (resultsNode) {
    resultsNode.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      closeSearch();

      if (href.startsWith("#")) {
        event.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (header.contains(event.target)) return;
    closeMenu();
    closeSearch();
  });

  document.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    const isTypingField =
      document.activeElement?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag);

    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingField) {
      event.preventDefault();
      openSearch();
    }

    if (event.key === "Escape") {
      closeMenu();
      closeSearch();
    }
  });

  window.addEventListener("scroll", setCondensedState, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) closeMenu();
    syncOverlayState();
  });

  if (frame && canUsePointerParallax) {
    frame.addEventListener("pointermove", (event) => {
      const bounds = frame.getBoundingClientRect();
      const relativeX = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0.5;
      const relativeY = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
      frame.style.setProperty("--header-glow-x", `${Math.round(relativeX * 100)}%`);
      frame.style.setProperty("--header-glow-y", `${Math.round(relativeY * 100)}%`);
      frame.style.setProperty("--scene-shift-x", `${((relativeX - 0.5) * 10).toFixed(2)}px`);
      frame.style.setProperty("--scene-shift-y", `${((relativeY - 0.5) * 6).toFixed(2)}px`);
    });

    frame.addEventListener("pointerleave", () => {
      frame.style.setProperty("--header-glow-x", "50%");
      frame.style.setProperty("--header-glow-y", "18%");
      frame.style.setProperty("--scene-shift-x", "0px");
      frame.style.setProperty("--scene-shift-y", "0px");
    });
  }

  setCondensedState();
  updateSearchResults();
  syncOverlayState();
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

function departmentOptionMarkup(department, selectedId = "") {
  const departmentId = String(department?.id || "");
  const selected = departmentId === String(selectedId || "") ? " selected" : "";
  const code = department?.code ? `${department.code} - ` : "";
  return `<option value="${escapeHtml(departmentId)}"${selected}>${escapeHtml(`${code}${department?.name || "Department"}`)}</option>`;
}

function departmentGroupMarkup(department, clubItems) {
  if (!clubItems.length) return "";

  return `
    <section class="department-cluster">
      <div class="department-cluster-header">
        <div>
          <p class="eyebrow">${escapeHtml(department.code || "Department")}</p>
          <h3>${escapeHtml(department.name || "Unassigned")}</h3>
        </div>
        <span class="department-count">${escapeHtml(clubItems.length)} clubs</span>
      </div>
      ${department.description ? `<p class="department-cluster-copy">${escapeHtml(department.description)}</p>` : ""}
      <div class="stack-list">
        ${clubItems.map(joinClubItemMarkup).join("")}
      </div>
    </section>
  `;
}

function previewEventMarkup(event) {
  const metaLine = [event.category || "Campus activity", event.time].filter(Boolean).join(" - ");

  return `
    <article class="preview-item">
      <div class="preview-date">
        <span>${escapeHtml(event.month || "TBD")}</span>
        <strong>${escapeHtml(event.day || "--")}</strong>
      </div>
      <div class="preview-copy">
        <h4>${escapeHtml(event.title)}</h4>
        <p>${escapeHtml(event.location || "Location pending")}</p>
        <small>${escapeHtml(metaLine || "Campus activity")}</small>
      </div>
      <button type="button" class="table-action">${escapeHtml(event.actionLabel || "View")}</button>
    </article>
  `;
}

function mobileEventMarkup(event) {
  const metaLine = [event.location || "Location pending", event.time].filter(Boolean).join(" - ");

  return `
    <article class="phone-card">
      <div class="preview-date">
        <span>${escapeHtml(event.month || "TBD")}</span>
        <strong>${escapeHtml(event.day || "--")}</strong>
      </div>
      <div class="preview-copy">
        <h4>${escapeHtml(event.title)}</h4>
        <p>${escapeHtml(metaLine)}</p>
      </div>
    </article>
  `;
}

function clubMarkup(club) {
  const clubSecondary = [club.departmentName, club.category, club.contactEmail].filter(Boolean).join(" - ") || "Student organization";

  return `
    <article class="club-card">
      <div class="club-icon">${escapeHtml(getClubBadge(club))}</div>
      <div class="club-card-copy">
        <h4>${escapeHtml(club.name)}</h4>
        <p>${escapeHtml(club.focus || "Club information will appear here.")}</p>
        <small class="club-secondary">${escapeHtml(clubSecondary)}</small>
      </div>
      <span class="club-meta">${escapeHtml(club.members || 0)} members</span>
    </article>
  `;
}

function joinClubItemMarkup(club) {
  const clubSecondary = [club.departmentName, club.category, club.contactEmail].filter(Boolean).join(" - ") || "Student organization";

  return `
    <article class="club-card">
      <div class="club-icon">${escapeHtml(getClubBadge(club))}</div>
      <div class="club-card-copy">
        <h4>${escapeHtml(club.name)}</h4>
        <p>${escapeHtml(club.focus || "Club information will appear here.")}</p>
        <small class="club-secondary">${escapeHtml(clubSecondary)}</small>
      </div>
      <button type="button" class="table-action join-club-button" data-club-id="${escapeHtml(club.id)}">Join</button>
    </article>
  `;
}

function announcementMarkup(item) {
  return `
    <article class="announcement-card">
      <span class="announcement-kicker">Campus note</span>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(truncateText(item.detail || "Announcement details will appear here.", 160))}</p>
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

function mobileEventCardMarkup(event) {
  const note = truncateText(
    event.description || `${event.category || "Campus activity"} at ${event.location || "Location pending"}.`,
    120,
  );
  const meta = [event.category || "Campus activity", event.location || "Location pending", event.time || "TBD"];

  return `
    <article class="event-mobile-card">
      <div class="event-mobile-header">
        <span class="table-date">${escapeHtml(event.month || "TBD")} ${escapeHtml(event.day || "--")}</span>
        <button type="button" class="table-action">${escapeHtml(event.actionLabel || "View")}</button>
      </div>
      <div class="table-event-cell">
        <span class="table-event-title">${escapeHtml(event.title)}</span>
        <p class="table-event-note">${escapeHtml(note)}</p>
      </div>
      <div class="event-mobile-meta">
        ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>
  `;
}

function eventTableMarkup(events) {
  if (!events.length) {
    return emptyStateMarkup("No upcoming events yet. Events will appear here after they are uploaded.");
  }

  return `
    <div class="event-card-list">
      ${events.map(mobileEventCardMarkup).join("")}
    </div>
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
            (event) => {
              const note = truncateText(
                event.description || `${event.category || "Campus activity"} at ${event.location || "Location pending"}.`,
                100,
              );

              return `
              <tr>
                <td><span class="table-date">${escapeHtml(event.month || "TBD")} ${escapeHtml(event.day || "--")}</span></td>
                <td>
                  <div class="table-event-cell">
                    <span class="table-event-title">${escapeHtml(event.title)}</span>
                    <p class="table-event-note">${escapeHtml(note)}</p>
                  </div>
                </td>
                <td><span class="table-meta-text">${escapeHtml(event.category || "Campus activity")}</span></td>
                <td><span class="table-meta-text">${escapeHtml(event.location || "Location pending")}</span></td>
                <td><span class="table-meta-text">${escapeHtml(event.time || "TBD")}</span></td>
                <td><button type="button" class="table-action">${escapeHtml(event.actionLabel || "View")}</button></td>
              </tr>
            `;
            },
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
          <p class="record-kicker">Event</p>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(truncateText(event.description || "No event description added yet.", 180))}</p>
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
          <p class="record-kicker">Announcement</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(truncateText(item.detail || "No announcement detail provided.", 180))}</p>
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
    club.departmentName || "No department assigned",
    club.approvalStatus || "Pending Approval",
    `${club.members || 0} members`,
    club.category || "General",
    club.contactEmail || "No contact email",
    club.requestedByEmail ? `Requested by ${club.requestedByEmail}` : club.createdBy ? `Created by ${club.createdBy}` : "Creator not listed",
  ];
  const statusAction =
    String(club.approvalStatus || "").toLowerCase() === "approved"
      ? ""
      : `<button type="button" class="button" data-approve-club="${escapeHtml(club.id)}">Approve</button>`;
  const departmentOptions = (window.uniHubDepartments || [])
    .map((department) => departmentOptionMarkup(department, club.departmentId))
    .join("");

  return `
    <article class="admin-record">
      <div class="admin-record-header">
        <div>
          <p class="record-kicker">Club</p>
          <h3>${escapeHtml(club.name)}</h3>
          <p>${escapeHtml(truncateText(club.focus || "No club focus provided.", 180))}</p>
        </div>
        <div class="admin-record-actions">
          ${statusAction}
          <button type="button" class="button danger" data-delete-club="${escapeHtml(club.id)}">Delete</button>
        </div>
      </div>
      <div class="admin-record-meta">
        ${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="admin-inline-form">
        <label>
          Department
          <select data-club-department="${escapeHtml(club.id)}">
            <option value="">Select a department</option>
            ${departmentOptions}
          </select>
        </label>
        <button type="button" class="button secondary" data-save-club="${escapeHtml(club.id)}">Save Department</button>
      </div>
    </article>
  `;
}

function adminDepartmentMarkup(department, clubItems) {
  const assignedClubs = clubItems.filter((club) => String(club.departmentId || "") === String(department.id || ""));

  return `
    <article class="admin-record">
      <div class="admin-record-header">
        <div>
          <p class="record-kicker">${escapeHtml(department.code || "Department")}</p>
          <h3>${escapeHtml(department.name || "Department")}</h3>
          <p>${escapeHtml(department.description || "No description added yet.")}</p>
        </div>
        <div class="admin-record-actions">
          <button type="button" class="button danger" data-delete-department="${escapeHtml(department.id)}">Delete</button>
        </div>
      </div>
      <div class="admin-record-meta">
        <span>${escapeHtml(assignedClubs.length)} assigned clubs</span>
      </div>
    </article>
  `;
}

function adminUserMarkup(user) {
  const joinedClubs = Array.isArray(user.clubs) ? user.clubs.length : 0;
  return `
    <article class="admin-user-card">
      <div class="admin-user-header">
        <div class="admin-user-heading">
          <div class="admin-user-avatar">${escapeHtml(getInitials(user.name || "User"))}</div>
          <div>
            <p class="record-kicker">Account</p>
            <h3>${escapeHtml(user.name || "Unnamed user")}</h3>
            <p>${escapeHtml(user.email || "No email provided")}</p>
          </div>
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

async function loadDepartments() {
  const departments = await fetchJson("/api/departments");
  window.uniHubDepartments = Array.isArray(departments) ? departments : [];
  return window.uniHubDepartments;
}

function populateDepartmentSelect(selectElement, departments, selectedId = "") {
  if (!selectElement) return;

  selectElement.innerHTML = `
    <option value="">Select a department</option>
    ${departments.map((department) => departmentOptionMarkup(department, selectedId)).join("")}
  `;
}

function setupCreateClubForm() {
  const form = document.getElementById("create-club-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  const departmentSelect = document.getElementById("club-department-select");

  loadDepartments()
    .then((departments) => {
      populateDepartmentSelect(departmentSelect, departments);
    })
    .catch(() => {
      setCreateClubMessage("Departments could not be loaded right now.", "error");
    });

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
          departmentId: formData.get("departmentId"),
          category: formData.get("category"),
          focus: formData.get("focus"),
          contactEmail: formData.get("contactEmail"),
          currentUserEmail: currentUser?.email,
          createdBy: currentUser?.name,
          createdByEmail: currentUser?.email,
        }),
      });

      form.reset();
      populateDepartmentSelect(departmentSelect, window.uniHubDepartments || []);
      setCreateClubMessage("Club request submitted. An admin must approve and assign it before students can join.", "success");
    } catch (error) {
      setCreateClubMessage(error.message, "error");
    }
  });
}

function setupAdminForms() {
  const eventForm = document.getElementById("admin-event-form");
  const announcementForm = document.getElementById("admin-announcement-form");
  const departmentForm = document.getElementById("admin-department-form");
  const clubForm = document.getElementById("admin-club-form");
  const adminClubDepartmentSelect = document.getElementById("admin-club-department-select");

  loadDepartments()
    .then((departments) => {
      populateDepartmentSelect(adminClubDepartmentSelect, departments);
    })
    .catch(() => {});

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

  if (departmentForm && departmentForm.dataset.bound !== "true") {
    departmentForm.dataset.bound = "true";
    departmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUser = getCurrentUser();
      const formData = new FormData(departmentForm);

      try {
        setAdminDepartmentMessage("Adding department...", "info");
        await fetchJson("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorEmail: currentUser?.email,
            code: formData.get("code"),
            name: formData.get("name"),
            description: formData.get("description"),
          }),
        });

        departmentForm.reset();
        setAdminDepartmentMessage("Department added successfully.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminDepartmentMessage(error.message, "error");
      }
    });
  }

  if (clubForm && clubForm.dataset.bound !== "true") {
    clubForm.dataset.bound = "true";
    clubForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentUser = getCurrentUser();
      const formData = new FormData(clubForm);

      try {
        setAdminClubMessage("Adding approved club...", "info");
        await fetchJson("/api/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorEmail: currentUser?.email,
            name: formData.get("name"),
            departmentId: formData.get("departmentId"),
            category: formData.get("category"),
            focus: formData.get("focus"),
            contactEmail: formData.get("contactEmail"),
            createdBy: currentUser?.name,
            createdByEmail: currentUser?.email,
          }),
        });

        clubForm.reset();
        populateDepartmentSelect(adminClubDepartmentSelect, window.uniHubDepartments || []);
        setAdminClubMessage("Approved club added successfully.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminClubMessage(error.message, "error");
      }
    });
  }
}

function setupAdminListActions() {
  const adminEvents = document.getElementById("admin-events");
  const adminAnnouncements = document.getElementById("admin-announcements");
  const adminClubs = document.getElementById("admin-clubs");
  const adminDepartments = document.getElementById("admin-departments");

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
      const approveButton = event.target.closest("[data-approve-club]");
      if (approveButton) {
        const record = approveButton.closest(".admin-record");
        const departmentSelect = record?.querySelector(`[data-club-department="${approveButton.dataset.approveClub}"]`);

        try {
          setAdminClubMessage("Approving club...", "info");
          await fetchJson(`/api/clubs/${approveButton.dataset.approveClub}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actorEmail: getCurrentUser()?.email,
              departmentId: departmentSelect?.value || "",
              approvalStatus: "Approved",
            }),
          });
          setAdminClubMessage("Club approved and assigned.", "success");
          await renderAdmin();
        } catch (error) {
          setAdminClubMessage(error.message, "error");
        }
        return;
      }

      const saveButton = event.target.closest("[data-save-club]");
      if (saveButton) {
        const record = saveButton.closest(".admin-record");
        const departmentSelect = record?.querySelector(`[data-club-department="${saveButton.dataset.saveClub}"]`);
        const approvalStatus = record?.querySelector("[data-approve-club]") ? "Pending Approval" : "Approved";

        try {
          setAdminClubMessage("Saving club department...", "info");
          await fetchJson(`/api/clubs/${saveButton.dataset.saveClub}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actorEmail: getCurrentUser()?.email,
              departmentId: departmentSelect?.value || "",
              approvalStatus,
            }),
          });
          setAdminClubMessage("Club department updated.", "success");
          await renderAdmin();
        } catch (error) {
          setAdminClubMessage(error.message, "error");
        }
        return;
      }

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

  if (adminDepartments && adminDepartments.dataset.bound !== "true") {
    adminDepartments.dataset.bound = "true";
    adminDepartments.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-department]");
      if (!button) return;

      if (!window.confirm("Delete this department? Clubs under it will need reassignment.")) return;

      try {
        setAdminDepartmentMessage("Removing department...", "info");
        await deleteAdminRecord(`/api/departments/${button.dataset.deleteDepartment}`);
        setAdminDepartmentMessage("Department deleted.", "success");
        await renderAdmin();
      } catch (error) {
        setAdminDepartmentMessage(error.message, "error");
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

  const joinedCount = Array.isArray(user.clubs) ? user.clubs.length : 0;
  const profileLine = [user.department || "", user.year || ""].filter(Boolean).join(" - ") || "Department pending";

  profileCard.innerHTML = `
    <article class="surface-card profile-panel profile-summary-panel">
      <div class="profile-hero">
        <div class="profile-avatar">${escapeHtml(getInitials(user.name || "User"))}</div>
        <div>
          <p class="eyebrow">${escapeHtml(user.role || "Student")}</p>
          <h1>${escapeHtml(user.name || "Unnamed user")}</h1>
          <p>${escapeHtml(profileLine)}</p>
        </div>
        <div class="profile-side-note">
          <span class="status-tag">${escapeHtml(joinedCount)} joined ${joinedCount === 1 ? "club" : "clubs"}</span>
          <p>${escapeHtml(user.email || "No email provided")}</p>
        </div>
      </div>
      <div class="stat-grid stat-grid-compact profile-stat-grid">
        ${statMarkup("RSVPs", user.rsvps || 0)}
        ${statMarkup("Check-ins", user.checkIns || 0)}
        ${statMarkup("Joined Clubs", joinedCount)}
        ${statMarkup("Student ID", user.studentId || "Not set")}
      </div>
      <div class="profile-columns">
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
        <aside class="profile-mini-card">
          <p class="eyebrow">Account Snapshot</p>
          <p><strong>Email:</strong> ${escapeHtml(user.email || "No email provided")}</p>
          <p><strong>Student ID:</strong> ${escapeHtml(user.studentId || "Not set")}</p>
          <p><strong>Role:</strong> ${escapeHtml(user.role || "Student")}</p>
        </aside>
      </div>
    </article>
  `;
}

async function renderAdmin() {
  const currentUser = await getLatestCurrentUser();
  const [events, clubs, departments, stats, announcements, users, branding] = await Promise.all([
    fetchJson("/api/events"),
    fetchJson(`/api/clubs?scope=admin&email=${encodeURIComponent(currentUser?.email || "")}`),
    fetchJson("/api/departments"),
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
  const adminDepartments = document.getElementById("admin-departments");
  const adminAccountEmail = document.getElementById("admin-account-email");
  const adminAccountName = document.getElementById("admin-account-name");
  const adminPreview = document.getElementById("admin-institution-preview");
  const adminTitle = document.getElementById("institution-title");
  const adminCaption = document.getElementById("institution-caption-input");
  const adminClubDepartmentSelect = document.getElementById("admin-club-department-select");

  window.uniHubDepartments = Array.isArray(departments) ? departments : [];

  populateDepartmentSelect(adminClubDepartmentSelect, window.uniHubDepartments);

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
      ? clubs.map((club) => adminClubMarkup(club)).join("")
      : emptyStateMarkup("No club records yet.");
  }

  if (adminDepartments) {
    adminDepartments.innerHTML = departments.length
      ? departments.map((department) => adminDepartmentMarkup(department, clubs)).join("")
      : emptyStateMarkup("No departments have been added yet.");
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

  const [clubs, departments] = await Promise.all([fetchJson("/api/clubs"), fetchJson("/api/departments")]);
  const groupedMarkup = departments
    .map((department) =>
      departmentGroupMarkup(
        department,
        clubs.filter((club) => String(club.departmentId || "") === String(department.id || "")),
      ),
    )
    .join("");
  const unassignedClubs = clubs.filter((club) => !club.departmentId);
  const unassignedMarkup = unassignedClubs.length
    ? departmentGroupMarkup(
        {
          id: "unassigned",
          code: "GENERAL",
          name: "Independent Clubs",
          description: "Approved clubs waiting for a department reassignment.",
        },
        unassignedClubs,
      )
    : "";

  clubList.innerHTML = groupedMarkup || unassignedMarkup ? `${groupedMarkup}${unassignedMarkup}` : emptyStateMarkup("No clubs are available to join yet.");

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
  if (!(await setupAuthFlows())) return;

  setupAdminVisibility();
  setupHeaderInteractions();

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
