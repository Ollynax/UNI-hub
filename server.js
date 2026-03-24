const http = require("http");
const fs = require("fs");
const path = require("path");

const events = require("./models/events");
const clubs = require("./models/clubs");
const users = require("./models/users");

const publicDir = path.join(__dirname, "public");
const port = process.env.PORT || 3000;
let mongoClient;
let db;

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const routes = {
  "/": "index.html",
  "/index.html": "index.html",
  "/landingpage": "landingpage.html",
  "/login": "login.html",
  "/register": "register.html",
  "/dashboard": "dashboard.html",
  "/profile": "profile.html",
  "/adminpanel": "adminpanel.html",
  "/joinclub": "joinclub.html",
  "/createclub": "createclub.html",
};

const stats = {
  rsvps: 0,
  eventsThisMonth: 0,
  checkIns: 0,
  clubsActive: 0,
};

const announcements = [];
const defaultBranding = {
  title: "Your Institution, Presented Clearly",
  caption: "Administrators can manage the institution image, title, and homepage message from the admin workspace.",
  image: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80",
};
let branding = { ...defaultBranding };

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id || user._id?.toString() || null,
    name: user.name || "",
    email: user.email || "",
    role: user.role || "Student",
    department: user.department || "",
    year: user.year || "",
    studentId: user.studentId || "",
    rsvps: user.rsvps || 0,
    checkIns: user.checkIns || 0,
    clubs: Array.isArray(user.clubs) ? user.clubs : [],
  };
}

function sanitizeClub(club) {
  if (!club) return null;

  return {
    id: club.id || club._id?.toString() || null,
    name: club.name || "",
    focus: club.focus || "",
    members: club.members || 0,
    contactEmail: club.contactEmail || "",
    category: club.category || "",
    createdBy: club.createdBy || "",
  };
}

function sanitizeEvent(event) {
  if (!event) return null;

  return {
    id: event.id || event._id?.toString() || null,
    title: event.title || "",
    date: event.date || "",
    month: event.month || "",
    day: event.day || "",
    category: event.category || "",
    location: event.location || "",
    time: event.time || "",
    description: event.description || "",
    actionLabel: event.actionLabel || "View",
    status: event.status || "Scheduled",
  };
}

function sanitizeAnnouncement(item) {
  if (!item) return null;

  return {
    id: item.id || item._id?.toString() || null,
    title: item.title || "",
    detail: item.detail || "",
  };
}

function sanitizeBranding(item) {
  return {
    title: item?.title?.trim() || defaultBranding.title,
    caption: item?.caption?.trim() || defaultBranding.caption,
    image: item?.image?.trim() || defaultBranding.image,
  };
}

async function connectToDatabase() {
  if (!process.env.MONGODB_URI) return;

  try {
    const { MongoClient } = require("mongodb");
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(process.env.MONGODB_DB || "uni_hub");
    console.log("Connected to MongoDB");
  } catch (error) {
    db = null;
    console.warn("MongoDB unavailable, using local empty data.");
    console.warn(error.message);
  }
}

async function readCollection(name, fallback) {
  if (!db) return fallback;

  try {
    const collection = await db.collection(name).find({}).toArray();
    return collection.length ? collection : fallback;
  } catch (error) {
    console.warn(`Failed to read ${name}, using local empty data.`);
    return fallback;
  }
}

async function getStats() {
  if (!db) return stats;

  const [eventItems, clubItems, userItems] = await Promise.all([
    readCollection("events", events),
    readCollection("clubs", clubs),
    readCollection("users", users),
  ]);

  return {
    rsvps: userItems.reduce((total, user) => total + (user.rsvps || 0), 0),
    eventsThisMonth: eventItems.length,
    checkIns: userItems.reduce((total, user) => total + (user.checkIns || 0), 0),
    clubsActive: clubItems.length,
  };
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

async function findUserByEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (db) {
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    return user || null;
  }

  return users.find((user) => user.email === normalizedEmail) || null;
}

async function createUser(userData) {
  const normalizedEmail = userData.email.trim().toLowerCase();
  const nextUser = {
    name: userData.name.trim(),
    email: normalizedEmail,
    password: userData.password,
    studentId: userData.studentId?.trim() || "",
    department: userData.department?.trim() || "",
    year: userData.year?.trim() || "",
    role: "Student",
    rsvps: 0,
    checkIns: 0,
    clubs: [],
  };

  if (db) {
    const result = await db.collection("users").insertOne(nextUser);
    return { ...nextUser, _id: result.insertedId };
  }

  const localUser = { ...nextUser, id: Date.now() };
  users.push(localUser);
  return localUser;
}

async function createClub(clubData) {
  const nextClub = {
    name: clubData.name.trim(),
    focus: clubData.focus?.trim() || "",
    category: clubData.category?.trim() || "",
    contactEmail: (clubData.contactEmail || clubData.currentUserEmail || "").trim().toLowerCase(),
    createdBy: (clubData.createdBy || "").trim(),
    members: clubData.currentUserEmail ? 1 : 0,
  };

  if (db) {
    const result = await db.collection("clubs").insertOne(nextClub);

    if (clubData.currentUserEmail) {
      await db.collection("users").updateOne(
        { email: clubData.currentUserEmail.trim().toLowerCase() },
        { $addToSet: { clubs: nextClub.name } },
      );
    }

    return { ...nextClub, _id: result.insertedId };
  }

  const localClub = { ...nextClub, id: Date.now().toString() };
  clubs.push(localClub);

  if (clubData.currentUserEmail) {
    const localUser = users.find((user) => user.email === clubData.currentUserEmail.trim().toLowerCase());
    if (localUser && !localUser.clubs.includes(localClub.name)) {
      localUser.clubs.push(localClub.name);
    }
  }

  return localClub;
}

async function ensureAdminUser(email) {
  const user = await findUserByEmail(email);
  if (!user || (user.role || "").toLowerCase() !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

function buildEventRecord(eventData) {
  const parsedDate = eventData.date ? new Date(eventData.date) : null;
  const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());

  return {
    title: eventData.title.trim(),
    date: eventData.date || "",
    month: isValidDate ? monthLabels[parsedDate.getUTCMonth()] : "TBD",
    day: isValidDate ? String(parsedDate.getUTCDate()).padStart(2, "0") : "--",
    category: eventData.category?.trim() || "",
    location: eventData.location?.trim() || "",
    time: eventData.time?.trim() || "",
    description: eventData.description?.trim() || "",
    actionLabel: eventData.actionLabel?.trim() || "View",
    status: eventData.status?.trim() || "Scheduled",
  };
}

async function createEvent(eventData) {
  const nextEvent = buildEventRecord(eventData);

  if (db) {
    const result = await db.collection("events").insertOne(nextEvent);
    return { ...nextEvent, _id: result.insertedId };
  }

  const localEvent = { ...nextEvent, id: Date.now().toString() };
  events.push(localEvent);
  return localEvent;
}

async function createAnnouncement(data) {
  const nextAnnouncement = {
    title: data.title.trim(),
    detail: data.detail?.trim() || "",
  };

  if (db) {
    const result = await db.collection("announcements").insertOne(nextAnnouncement);
    return { ...nextAnnouncement, _id: result.insertedId };
  }

  const localAnnouncement = { ...nextAnnouncement, id: Date.now().toString() };
  announcements.push(localAnnouncement);
  return localAnnouncement;
}

async function deleteRecord(collectionName, id, fallback) {
  if (db) {
    const { ObjectId } = require("mongodb");
    await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
    return;
  }

  const index = fallback.findIndex((item) => String(item.id) === String(id));
  if (index !== -1) {
    fallback.splice(index, 1);
  }
}

async function getBranding() {
  if (db) {
    const record = await db.collection("settings").findOne({ key: "branding" });
    return sanitizeBranding(record);
  }

  return sanitizeBranding(branding);
}

async function saveBranding(data) {
  const nextBranding = sanitizeBranding(data);

  if (db) {
    await db.collection("settings").updateOne(
      { key: "branding" },
      { $set: { key: "branding", ...nextBranding } },
      { upsert: true },
    );
    return nextBranding;
  }

  branding = nextBranding;
  return branding;
}

async function joinClubMembership(clubId, userEmail) {
  const normalizedEmail = (userEmail || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("A signed-in user is required");
  }

  if (db) {
    const { ObjectId } = require("mongodb");
    const club = await db.collection("clubs").findOne({ _id: new ObjectId(clubId) });
    if (!club) throw new Error("Club not found");

    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) throw new Error("User not found");

    const alreadyJoined = Array.isArray(user.clubs) && user.clubs.includes(club.name);
    if (!alreadyJoined) {
      await db.collection("users").updateOne({ email: normalizedEmail }, { $addToSet: { clubs: club.name } });
      await db.collection("clubs").updateOne({ _id: club._id }, { $inc: { members: 1 } });
    }

    const updatedUser = await db.collection("users").findOne({ email: normalizedEmail });
    return sanitizeUser(updatedUser);
  }

  const club = clubs.find((item) => String(item.id) === String(clubId));
  const user = users.find((item) => item.email === normalizedEmail);

  if (!club) throw new Error("Club not found");
  if (!user) throw new Error("User not found");

  if (!user.clubs.includes(club.name)) {
    user.clubs.push(club.name);
    club.members = (club.members || 0) + 1;
  }

  return sanitizeUser(user);
}

function sendJson(response, payload, statusCode = 200) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function serveFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error.code === "ENOENT" ? "Page not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    };

    // Keep the browser from reusing stale app shells after role or UI changes.
    if ([".html", ".css", ".js", ".json"].includes(extension)) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
      headers.Pragma = "no-cache";
      headers.Expires = "0";
    }

    response.writeHead(200, headers);
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);
      const user = await findUserByEmail(body.email);

      if (!user || user.password !== body.password) {
        return sendJson(response, { error: "Invalid email or password" }, 401);
      }

      return sendJson(response, { user: sanitizeUser(user) });
    } catch (error) {
      return sendJson(response, { error: error.message }, 400);
    }
  }

  if (pathname === "/api/auth/register" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);

      if (!body.name || !body.email || !body.password) {
        return sendJson(response, { error: "Name, email, and password are required" }, 400);
      }

      const existingUser = await findUserByEmail(body.email);
      if (existingUser) {
        return sendJson(response, { error: "An account with that email already exists" }, 409);
      }

      const createdUser = await createUser(body);
      return sendJson(response, { user: sanitizeUser(createdUser) }, 201);
    } catch (error) {
      return sendJson(response, { error: error.message }, 400);
    }
  }

  if (pathname === "/api/events" && request.method === "GET") {
    const eventItems = await readCollection("events", events);
    return sendJson(response, eventItems.map(sanitizeEvent));
  }

  if (pathname === "/api/events" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);

      if (!body.title) {
        return sendJson(response, { error: "Event title is required" }, 400);
      }

      const createdEvent = await createEvent(body);
      return sendJson(response, { event: sanitizeEvent(createdEvent) }, 201);
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  if (pathname.startsWith("/api/events/") && request.method === "DELETE") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);

      const eventId = pathname.split("/").pop();
      await deleteRecord("events", eventId, events);
      return sendJson(response, { ok: true });
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  if (pathname === "/api/clubs" && request.method === "GET") {
    const clubItems = await readCollection("clubs", clubs);
    return sendJson(response, clubItems.map(sanitizeClub));
  }

  if (pathname === "/api/clubs" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);

      if (!body.name) {
        return sendJson(response, { error: "Club name is required" }, 400);
      }

      const createdClub = await createClub(body);
      return sendJson(response, { club: sanitizeClub(createdClub) }, 201);
    } catch (error) {
      return sendJson(response, { error: error.message }, 400);
    }
  }

  if (pathname === "/api/clubs/join" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);
      const updatedUser = await joinClubMembership(body.clubId, body.email);
      return sendJson(response, { user: updatedUser });
    } catch (error) {
      return sendJson(response, { error: error.message }, 400);
    }
  }

  if (pathname.startsWith("/api/clubs/") && request.method === "DELETE") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);

      const clubId = pathname.split("/").pop();
      await deleteRecord("clubs", clubId, clubs);
      return sendJson(response, { ok: true });
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  if (pathname === "/api/users/me") {
    const requestedEmail = parsedUrl.searchParams.get("email");
    if (requestedEmail) {
      const user = await findUserByEmail(requestedEmail);
      return sendJson(response, sanitizeUser(user));
    }

    const userList = await readCollection("users", users);
    return sendJson(response, sanitizeUser(userList[0] || null));
  }

  if (pathname === "/api/users" && request.method === "GET") {
    try {
      const actorEmail = parsedUrl.searchParams.get("email");
      await ensureAdminUser(actorEmail);

      const userList = await readCollection("users", users);
      return sendJson(response, userList.map(sanitizeUser));
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }
  if (pathname === "/api/stats") return sendJson(response, await getStats());

  if (pathname === "/api/announcements" && request.method === "GET") {
    const announcementItems = await readCollection("announcements", announcements);
    return sendJson(response, announcementItems.map(sanitizeAnnouncement));
  }

  if (pathname === "/api/announcements" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);

      if (!body.title) {
        return sendJson(response, { error: "Announcement title is required" }, 400);
      }

      const createdAnnouncement = await createAnnouncement(body);
      return sendJson(response, { announcement: sanitizeAnnouncement(createdAnnouncement) }, 201);
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  if (pathname.startsWith("/api/announcements/") && request.method === "DELETE") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);

      const announcementId = pathname.split("/").pop();
      await deleteRecord("announcements", announcementId, announcements);
      return sendJson(response, { ok: true });
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  if (pathname === "/api/branding" && request.method === "GET") {
    return sendJson(response, await getBranding());
  }

  if (pathname === "/api/branding" && request.method === "POST") {
    try {
      const body = await parseRequestBody(request);
      await ensureAdminUser(body.actorEmail);
      const savedBranding = await saveBranding(body);
      return sendJson(response, { branding: savedBranding });
    } catch (error) {
      const statusCode = error.message === "Admin access required" ? 403 : 400;
      return sendJson(response, { error: error.message }, statusCode);
    }
  }

  const resolvedRoute = routes[pathname];
  const requestedPath = resolvedRoute || pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, statsResult) => {
    if (!error && statsResult.isFile()) {
      serveFile(filePath, response);
      return;
    }

    serveFile(path.join(publicDir, "index.html"), response);
  });
});

server.listen(port, () => {
  console.log(`UNI hub server running at http://localhost:${port}`);
});

connectToDatabase();
