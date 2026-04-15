require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const net = require("net");
const { Pool } = require("pg");
const { Client: SshClient } = require("ssh2");

function envBool(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
}

const config = {
  useSshTunnel: envBool("USE_SSH_TUNNEL", true),
  seedDefaultAdmin: envBool("SEED_DEFAULT_ADMIN", true),
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || "admin",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "A@kash2026",
  ssh: {
    host: process.env.SSH_HOST,
    port: Number(process.env.SSH_PORT || 22),
    username: process.env.SSH_USER,
    password: process.env.SSH_PASSWORD,
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
    passphrase: process.env.SSH_PASSPHRASE,
    dstHost: process.env.SSH_DST_HOST || "127.0.0.1",
    dstPort: Number(process.env.SSH_DST_PORT || 5432),
    localHost: process.env.SSH_LOCAL_HOST || "127.0.0.1",
    localPort: Number(process.env.SSH_LOCAL_PORT || 55432),
    readyTimeoutMs: Number(process.env.SSH_READY_TIMEOUT_MS || 45000)
  },
  pg: {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 55432),
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15000)
  }
};

let pool = null;
let sshClient = null;
let tunnelServer = null;
let tunnelStarted = false;

function getSshPrivateKey() {
  if (!config.ssh.privateKeyPath) {
    return undefined;
  }

  const privateKeyFile = path.resolve(config.ssh.privateKeyPath);
  return fs.readFileSync(privateKeyFile);
}

function buildSshConnectConfig() {
  const connectConfig = {
    host: config.ssh.host,
    port: config.ssh.port,
    username: config.ssh.username,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    readyTimeout: config.ssh.readyTimeoutMs
  };

  if (config.ssh.password) {
    connectConfig.password = config.ssh.password;
  }

  if (config.ssh.privateKeyPath) {
    connectConfig.privateKey = getSshPrivateKey();
  }

  if (config.ssh.passphrase) {
    connectConfig.passphrase = config.ssh.passphrase;
  }

  return connectConfig;
}

async function createSshTunnelIfNeeded() {
  if (!config.useSshTunnel || tunnelStarted) {
    return;
  }

  if (!config.ssh.host || !config.ssh.username) {
    throw new Error("SSH_HOST and SSH_USER are required when USE_SSH_TUNNEL=true");
  }

  if (!config.ssh.password && !config.ssh.privateKeyPath) {
    throw new Error(
      "SSH_PASSWORD or SSH_PRIVATE_KEY_PATH is required when USE_SSH_TUNNEL=true"
    );
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const client = new SshClient();

    function fail(error) {
      if (settled) {
        return;
      }

      settled = true;
      try {
        if (tunnelServer) {
          tunnelServer.close();
        }
      } catch (closeError) {
        // Ignore tunnel close errors during failed setup.
      }
      client.end();
      reject(error);
    }

    client.on("ready", () => {
      tunnelServer = net.createServer((socket) => {
        client.forwardOut(
          socket.remoteAddress || "127.0.0.1",
          socket.remotePort || 0,
          config.ssh.dstHost,
          config.ssh.dstPort,
          (error, stream) => {
            if (error) {
              socket.destroy(error);
              return;
            }

            socket.pipe(stream).pipe(socket);
          }
        );
      });

      tunnelServer.on("error", fail);
      tunnelServer.listen(config.ssh.localPort, config.ssh.localHost, () => {
        settled = true;
        sshClient = client;
        tunnelStarted = true;
        resolve();
      });
    });

    client.on("error", fail);
    client.on("close", () => {
      tunnelStarted = false;
    });

    client.connect(buildSshConnectConfig());
  });
}

async function ensurePool() {
  if (!pool) {
    await createSshTunnelIfNeeded();

    pool = new Pool({
      host: config.pg.host,
      port: config.pg.port,
      database: config.pg.database,
      user: config.pg.user,
      password: config.pg.password,
      max: config.pg.max,
      idleTimeoutMillis: config.pg.idleTimeoutMillis,
      connectionTimeoutMillis: config.pg.connectionTimeoutMillis
    });

    pool.on("error", (error) => {
      console.error("PostgreSQL pool error:", error);
    });
  }

  return pool;
}

async function query(sql, params) {
  const dbPool = await ensurePool();
  return dbPool.query(sql, params);
}

async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(120) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS directories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(160) NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  if (!config.seedDefaultAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.defaultAdminPassword, 10);
  await query(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [config.defaultAdminUsername, passwordHash]
  );
}

async function getUserByUsername(username) {
  const result = await query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
}

async function listDirectories() {
  const result = await query(
    `SELECT id, name, slug, description, created_at
     FROM directories
     ORDER BY created_at ASC`
  );
  return result.rows;
}

async function getDirectoryBySlug(slug) {
  const result = await query(
    `SELECT id, name, slug, description, created_at
     FROM directories
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

async function createDirectory({ name, slug, description }) {
  const result = await query(
    `INSERT INTO directories (name, slug, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, description, created_at`,
    [name, slug, description]
  );
  return result.rows[0];
}

async function deleteDirectoryById(id) {
  const result = await query(
    "DELETE FROM directories WHERE id = $1 RETURNING id, name, slug",
    [id]
  );
  return result.rows[0] || null;
}

async function testConnection() {
  const result = await query("SELECT NOW() AS connected_at");
  return result.rows[0];
}

async function closeDatabase() {
  const closeTasks = [];

  if (pool) {
    closeTasks.push(pool.end());
    pool = null;
  }

  if (tunnelServer) {
    closeTasks.push(
      new Promise((resolve) => {
        tunnelServer.close(() => resolve());
      })
    );
    tunnelServer = null;
  }

  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }

  if (closeTasks.length > 0) {
    await Promise.allSettled(closeTasks);
  }
}

module.exports = {
  closeDatabase,
  createDirectory,
  deleteDirectoryById,
  getDirectoryBySlug,
  getUserByUsername,
  initializeDatabase,
  listDirectories,
  testConnection
};
