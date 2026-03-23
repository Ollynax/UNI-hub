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
};

const stats = {
  rsvps: 0,
  eventsThisMonth: 0,
  checkIns: 0,
  clubsActive: 0,
};

const announcements = [];

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
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
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

  if (pathname === "/api/events") return sendJson(response, await readCollection("events", events));
  if (pathname === "/api/clubs") return sendJson(response, await readCollection("clubs", clubs));
  if (pathname === "/api/users/me") {
    const userList = await readCollection("users", users);
    return sendJson(response, userList[0] || null);
  }
  if (pathname === "/api/stats") return sendJson(response, await getStats());
  if (pathname === "/api/announcements") {
    return sendJson(response, await readCollection("announcements", announcements));
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
