const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");

function loadEnvFromFileIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");

  fileContent.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      return;
    }

    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  });
}

try {
  require("dotenv").config();
} catch {
  loadEnvFromFileIfPresent(path.join(process.cwd(), ".env"));
}

oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB];

let oracleClientInitialized = false;
let poolPromise = null;

function buildClientLibCandidates() {
  const candidates = [];

  if (process.env.ORACLE_CLIENT_LIB_DIR) {
    candidates.push(process.env.ORACLE_CLIENT_LIB_DIR);
  }

  if (process.env.ORACLE_HOME) {
    candidates.push(path.join(process.env.ORACLE_HOME, "bin"));
  }

  if (process.platform === "win32") {
    candidates.push("E:\\app\\kumarski\\product\\11.2.0\\client_1\\bin");
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function initOracleClientIfNeeded() {
  if (oracleClientInitialized) {
    return;
  }

  const candidates = buildClientLibCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    try {
      oracledb.initOracleClient({ libDir: candidate });
      oracleClientInitialized = true;
      return;
    } catch (error) {
      if (String(error.message || "").includes("NJS-077")) {
        oracleClientInitialized = true;
        return;
      }

      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function buildConnectStringFromParts() {
  const host = String(process.env.ORACLE_HOST || "").trim();
  const port = String(process.env.ORACLE_PORT || "1521").trim();
  const serviceName = String(process.env.ORACLE_SERVICE_NAME || "").trim();
  const sid = String(process.env.ORACLE_SID || "").trim();

  if (!host) {
    return "";
  }

  if (serviceName) {
    return `${host}:${port}/${serviceName}`;
  }

  if (sid) {
    return `${host}:${port}:${sid}`;
  }

  return "";
}

function getOracleConfig() {
  const user = String(process.env.ORACLE_USER || "").trim();
  const password = String(process.env.ORACLE_PASSWORD || "").trim();
  const connectString = String(
    process.env.ORACLE_CONNECT_STRING || buildConnectStringFromParts()
  ).trim();
  const host = String(process.env.ORACLE_HOST || "").trim();
  const missingConfig = [];

  if (!user) {
    missingConfig.push("ORACLE_USER");
  }

  if (!password) {
    missingConfig.push("ORACLE_PASSWORD");
  }

  if (!connectString) {
    missingConfig.push(
      host
        ? "ORACLE_SERVICE_NAME or ORACLE_SID"
        : "ORACLE_CONNECT_STRING or ORACLE_HOST with ORACLE_SERVICE_NAME/ORACLE_SID"
    );
  }

  if (missingConfig.length > 0) {
    throw new Error(
      `Missing Oracle configuration: ${missingConfig.join(", ")}.`
    );
  }

  if (
    process.env.ORACLE_CONNECT_STRING &&
    !/[/:=()]/.test(connectString) &&
    !process.env.TNS_ADMIN &&
    !process.env.ORACLE_CONFIG_DIR
  ) {
    throw new Error(
      "ORACLE_CONNECT_STRING looks like a TNS alias. On Netlify, use a full Easy Connect string such as host:1521/service_name, or configure TNS_ADMIN/ORACLE_CONFIG_DIR with tnsnames.ora."
    );
  }

  return {
    user,
    password,
    connectString,
  };
}

async function getPool() {
  if (!poolPromise) {
    initOracleClientIfNeeded();
    const config = getOracleConfig();

    poolPromise = oracledb.createPool({
      ...config,
      poolMin: Number(process.env.ORACLE_POOL_MIN || 0),
      poolMax: Number(process.env.ORACLE_POOL_MAX || 6),
      poolIncrement: Number(process.env.ORACLE_POOL_INCREMENT || 1),
      stmtCacheSize: Number(process.env.ORACLE_STMT_CACHE_SIZE || 30),
    });
  }

  return poolPromise;
}

async function withConnection(callback) {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    return await callback(connection);
  } finally {
    try {
      await connection.close();
    } catch {}
  }
}

async function withTransaction(callback) {
  return withConnection(async (connection) => {
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {}
      throw error;
    }
  });
}

async function execute(sql, binds = {}, options = {}) {
  return withConnection((connection) =>
    connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: false,
      ...options,
    })
  );
}

async function getTableColumnNames(connection, tableName) {
  const result = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM user_tab_columns
      WHERE table_name = :tableName
    `,
    { tableName: String(tableName || "").toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return new Set(result.rows.map((row) => row.COLUMN_NAME));
}

async function primaryKeyExists(connection, tableName) {
  const result = await connection.execute(
    `
      SELECT COUNT(*) AS COUNT
      FROM user_constraints
      WHERE table_name = :tableName
        AND constraint_type = 'P'
    `,
    { tableName: String(tableName || "").toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return Number(result.rows[0]?.COUNT || 0) > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, columnDefinition) {
  const existingColumns = await getTableColumnNames(connection, tableName);

  if (existingColumns.has(String(columnName || "").toUpperCase())) {
    return;
  }

  await connection.execute(
    `ALTER TABLE ${tableName} ADD (${columnDefinition})`
  );
}

async function executeIgnoreAlreadyExists(connection, sql) {
  try {
    await connection.execute(sql);
  } catch (error) {
    if (![955, 1408].includes(Number(error.errorNum || 0))) {
      throw error;
    }
  }
}

async function healthCheck() {
  return execute("SELECT 1 AS OK FROM dual");
}

async function closePool() {
  if (!poolPromise) {
    return;
  }

  try {
    const pool = await poolPromise;
    await pool.close(10);
  } finally {
    poolPromise = null;
  }
}

module.exports = {
  oracledb,
  closePool,
  execute,
  executeIgnoreAlreadyExists,
  addColumnIfMissing,
  getOracleConfig,
  getTableColumnNames,
  healthCheck,
  primaryKeyExists,
  withConnection,
  withTransaction,
};
