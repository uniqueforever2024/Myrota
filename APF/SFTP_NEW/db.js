require("dotenv").config();

const fs = require("fs");
const path = require("path");
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
    localPort: Number(process.env.SSH_LOCAL_PORT || 55433),
    readyTimeoutMs: Number(process.env.SSH_READY_TIMEOUT_MS || 45000)
  },
  pg: {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 55433),
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

  return fs.readFileSync(path.resolve(config.ssh.privateKeyPath));
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
        // Ignore tunnel close errors on setup failure.
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

async function query(sql, params, client = null) {
  if (client) {
    return client.query(sql, params);
  }

  const dbPool = await ensurePool();
  return dbPool.query(sql, params);
}

function mapRecord(row) {
  return {
    id: row.id,
    partnerName: row.partner_name,
    connectionType: row.connection_type,
    host: row.host,
    port: row.port,
    username: row.username,
    password: row.password_value,
    contactPerson: row.contact_person,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS sftp_partner_records (
      id TEXT PRIMARY KEY,
      partner_name TEXT NOT NULL,
      connection_type VARCHAR(20) NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      password_value TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sftp_partner_records_port_chk CHECK (port BETWEEN 1 AND 65535)
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sftp_partner_records_partner_type_host_uniq
      ON sftp_partner_records (lower(partner_name), upper(connection_type), lower(host))
  `);
}

async function listSftpRecords() {
  const result = await query(`
    SELECT
      id,
      partner_name,
      connection_type,
      host,
      port,
      username,
      password_value,
      contact_person,
      notes,
      created_at,
      updated_at
    FROM sftp_partner_records
    ORDER BY updated_at DESC, partner_name ASC
  `);

  return result.rows.map(mapRecord);
}

async function upsertSftpRecord(record, client = null) {
  const result = await query(
    `
      INSERT INTO sftp_partner_records (
        id,
        partner_name,
        connection_type,
        host,
        port,
        username,
        password_value,
        contact_person,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id)
      DO UPDATE SET
        partner_name = EXCLUDED.partner_name,
        connection_type = EXCLUDED.connection_type,
        host = EXCLUDED.host,
        port = EXCLUDED.port,
        username = EXCLUDED.username,
        password_value = EXCLUDED.password_value,
        contact_person = EXCLUDED.contact_person,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING
        id,
        partner_name,
        connection_type,
        host,
        port,
        username,
        password_value,
        contact_person,
        notes,
        created_at,
        updated_at
    `,
    [
      record.id,
      record.partnerName,
      record.connectionType,
      record.host,
      record.port,
      record.username,
      record.password,
      record.contactPerson,
      record.notes || ""
    ],
    client
  );

  return mapRecord(result.rows[0]);
}

async function bulkUpsertSftpRecords(records) {
  const dbPool = await ensurePool();
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    for (const record of records) {
      await upsertSftpRecord(record, client);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listSftpRecords();
}

async function deleteSftpRecord(id) {
  await query("DELETE FROM sftp_partner_records WHERE id = $1", [id]);
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
  initializeDatabase,
  listSftpRecords,
  upsertSftpRecord,
  bulkUpsertSftpRecords,
  deleteSftpRecord,
  testConnection
};
