require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const {
  initializeDatabase,
  getUserByUsername,
  listDirectories,
  getDirectoryBySlug,
  createDirectory,
  deleteDirectoryById,
  closeDatabase
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 10000);
const distPath = path.join(__dirname, "dist");
const distIndexPath = path.join(distPath, "index.html");

let dbReady = false;
let dbInitInProgress = false;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }

  next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60
    }
  })
);

if (fs.existsSync(distIndexPath)) {
  app.use(express.static(distPath));
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    dbReady
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ message: "Not logged in" });
    return;
  }

  res.json({ user: req.session.user });
});

app.post("/api/login", async (req, res) => {
  if (!dbReady) {
    res.status(503).json({ message: "Database is not ready yet" });
    return;
  }

  const username = (req.body.username || "").trim();
  const password = req.body.password || "";

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid username or password" });
      return;
    }

    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.json({
      message: "Login successful",
      user: req.session.user
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: "Logout failed" });
      return;
    }

    res.json({ message: "Logged out" });
  });
});

app.get("/api/directories", requireAuth, async (req, res) => {
  try {
    const directories = await listDirectories();
    res.json({ directories });
  } catch (error) {
    console.error("Fetching directories failed:", error);
    res.status(500).json({ message: "Could not load directories" });
  }
});

app.get("/api/directories/:slug", requireAuth, async (req, res) => {
  try {
    const directory = await getDirectoryBySlug(req.params.slug);

    if (!directory) {
      res.status(404).json({ message: "Directory not found" });
      return;
    }

    res.json({ directory });
  } catch (error) {
    console.error("Fetching directory failed:", error);
    res.status(500).json({ message: "Could not load directory" });
  }
});

app.post("/api/directories", requireAuth, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const slugInput = req.body.slug || name;
  const slug = slugify(slugInput);

  if (!name) {
    res.status(400).json({ message: "Directory name is required" });
    return;
  }

  if (!slug) {
    res.status(400).json({ message: "Directory slug is invalid" });
    return;
  }

  try {
    const directory = await createDirectory({
      name,
      slug,
      description
    });

    res.status(201).json({
      message: "Directory created",
      directory
    });
  } catch (error) {
    if (error && error.code === "23505") {
      res.status(409).json({ message: "A directory with that slug already exists" });
      return;
    }

    console.error("Creating directory failed:", error);
    res.status(500).json({ message: "Could not create directory" });
  }
});

app.delete("/api/directories/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Directory id is invalid" });
    return;
  }

  try {
    const deletedDirectory = await deleteDirectoryById(id);

    if (!deletedDirectory) {
      res.status(404).json({ message: "Directory not found" });
      return;
    }

    res.json({
      message: "Directory removed",
      directory: deletedDirectory
    });
  } catch (error) {
    console.error("Deleting directory failed:", error);
    res.status(500).json({ message: "Could not remove directory" });
  }
});

app.get("*", (req, res) => {
  if (fs.existsSync(distIndexPath)) {
    res.sendFile(distIndexPath);
    return;
  }

  res.status(404).send("React build not found. Run `npm run build` or `npm run dev`.");
});

async function initializeDatabaseWithRetry() {
  if (dbInitInProgress) {
    return;
  }

  dbInitInProgress = true;
  try {
    await initializeDatabase();
    dbReady = true;
    console.log("Database initialized");
  } catch (error) {
    dbReady = false;
    console.error("Database initialization failed, retrying:", error.message);
    setTimeout(() => {
      dbInitInProgress = false;
      initializeDatabaseWithRetry();
    }, DB_RETRY_DELAY_MS);
    return;
  }

  dbInitInProgress = false;
}

const server = app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});

initializeDatabaseWithRetry();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
