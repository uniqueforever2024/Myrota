try {
  require("dotenv").config();
} catch {}

const {
  addColumnIfMissing,
  closePool,
  execute,
  executeIgnoreAlreadyExists,
  getTableColumnNames,
  healthCheck,
  oracledb,
  primaryKeyExists,
  withConnection,
  withTransaction,
} = require("../shared/oracle-db");

const TABLE_NAME = "MYROTA_SFTP";

function mapRecord(row) {
  return {
    id: row.ID,
    partnerName: row.PARTNER_NAME,
    connectionType: row.CONNECTION_TYPE,
    host: row.HOST,
    port: Number(row.PORT || 22),
    username: row.USERNAME,
    password: row.PASSWORD_VALUE,
    contactPerson: row.CONTACT_PERSON,
    notes: row.NOTES || "",
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
  };
}

async function ensureSchema() {
  await withConnection(async (connection) => {
    await executeIgnoreAlreadyExists(
      connection,
      `
        CREATE TABLE ${TABLE_NAME} (
          ID VARCHAR2(120) PRIMARY KEY,
          PARTNER_NAME VARCHAR2(300) NOT NULL,
          CONNECTION_TYPE VARCHAR2(20) NOT NULL,
          HOST VARCHAR2(500) NOT NULL,
          PORT NUMBER(5) DEFAULT 22 NOT NULL,
          USERNAME VARCHAR2(300) NOT NULL,
          PASSWORD_VALUE VARCHAR2(300) NOT NULL,
          CONTACT_PERSON VARCHAR2(300) NOT NULL,
          NOTES CLOB,
          CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
          UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
        )
      `
    );

    await addColumnIfMissing(connection, TABLE_NAME, "ID", "ID VARCHAR2(120)");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "PARTNER_NAME",
      "PARTNER_NAME VARCHAR2(300)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "CONNECTION_TYPE",
      "CONNECTION_TYPE VARCHAR2(20)"
    );
    await addColumnIfMissing(connection, TABLE_NAME, "HOST", "HOST VARCHAR2(500)");
    await addColumnIfMissing(connection, TABLE_NAME, "PORT", "PORT NUMBER(5) DEFAULT 22");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "USERNAME",
      "USERNAME VARCHAR2(300)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "PASSWORD_VALUE",
      "PASSWORD_VALUE VARCHAR2(300)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "CONTACT_PERSON",
      "CONTACT_PERSON VARCHAR2(300)"
    );
    await addColumnIfMissing(connection, TABLE_NAME, "NOTES", "NOTES CLOB");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "CREATED_AT",
      "CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "UPDATED_AT",
      "UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP"
    );

    const hasPrimaryKey = await primaryKeyExists(connection, TABLE_NAME);

    if (!hasPrimaryKey) {
      await executeIgnoreAlreadyExists(
        connection,
        `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT MYR_SFTP_PK PRIMARY KEY (ID)`
      );
    }

    const columnNames = await getTableColumnNames(connection, TABLE_NAME);

    if (columnNames.has("UPDATED_AT")) {
      await executeIgnoreAlreadyExists(
        connection,
        `CREATE INDEX MYR_SFTP_UPD_IDX ON ${TABLE_NAME} (UPDATED_AT)`
      );
    }

  });
}

async function listSftpRecords() {
  const result = await execute(
    `
      SELECT
        ID,
        PARTNER_NAME,
        CONNECTION_TYPE,
        HOST,
        PORT,
        USERNAME,
        PASSWORD_VALUE,
        CONTACT_PERSON,
        NOTES,
        CREATED_AT,
        UPDATED_AT
      FROM ${TABLE_NAME}
      ORDER BY UPDATED_AT DESC, PARTNER_NAME ASC
    `
  );

  return result.rows.map(mapRecord);
}

async function upsertSftpRecord(record, connection = null) {
  const runner = async (activeConnection) => {
    await activeConnection.execute(
      `
        MERGE INTO ${TABLE_NAME} target
        USING (
          SELECT
            :id AS ID,
            :partnerName AS PARTNER_NAME,
            :connectionType AS CONNECTION_TYPE,
            :host AS HOST,
            :port AS PORT,
            :username AS USERNAME,
            :password AS PASSWORD_VALUE,
            :contactPerson AS CONTACT_PERSON,
            :notes AS NOTES
          FROM dual
        ) source
        ON (target.ID = source.ID)
        WHEN MATCHED THEN UPDATE SET
          target.PARTNER_NAME = source.PARTNER_NAME,
          target.CONNECTION_TYPE = source.CONNECTION_TYPE,
          target.HOST = source.HOST,
          target.PORT = source.PORT,
          target.USERNAME = source.USERNAME,
          target.PASSWORD_VALUE = source.PASSWORD_VALUE,
          target.CONTACT_PERSON = source.CONTACT_PERSON,
          target.NOTES = source.NOTES,
          target.UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (
          ID,
          PARTNER_NAME,
          CONNECTION_TYPE,
          HOST,
          PORT,
          USERNAME,
          PASSWORD_VALUE,
          CONTACT_PERSON,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        ) VALUES (
          source.ID,
          source.PARTNER_NAME,
          source.CONNECTION_TYPE,
          source.HOST,
          source.PORT,
          source.USERNAME,
          source.PASSWORD_VALUE,
          source.CONTACT_PERSON,
          source.NOTES,
          SYSTIMESTAMP,
          SYSTIMESTAMP
        )
      `,
      {
        id: record.id,
        partnerName: record.partnerName,
        connectionType: record.connectionType,
        host: record.host,
        port: Number(record.port || 22),
        username: record.username,
        password: record.password,
        contactPerson: record.contactPerson,
        notes: record.notes || "",
      }
    );

    const savedResult = await activeConnection.execute(
      `
        SELECT
          ID,
          PARTNER_NAME,
          CONNECTION_TYPE,
          HOST,
          PORT,
          USERNAME,
          PASSWORD_VALUE,
          CONTACT_PERSON,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        WHERE ID = :id
      `,
      { id: record.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return mapRecord(savedResult.rows[0]);
  };

  if (connection) {
    return runner(connection);
  }

  return withTransaction((activeConnection) => runner(activeConnection));
}

async function bulkUpsertSftpRecords(records) {
  return withTransaction(async (connection) => {
    await connection.execute(`DELETE FROM ${TABLE_NAME}`);

    if (records.length > 0) {
      await connection.executeMany(
        `
          INSERT INTO ${TABLE_NAME} (
            ID,
            PARTNER_NAME,
            CONNECTION_TYPE,
            HOST,
            PORT,
            USERNAME,
            PASSWORD_VALUE,
            CONTACT_PERSON,
            NOTES,
            CREATED_AT,
            UPDATED_AT
          ) VALUES (
            :id,
            :partnerName,
            :connectionType,
            :host,
            :port,
            :username,
            :password,
            :contactPerson,
            :notes,
            SYSTIMESTAMP,
            SYSTIMESTAMP
          )
        `,
        records.map((record) => ({
          id: record.id,
          partnerName: record.partnerName,
          connectionType: record.connectionType,
          host: record.host,
          port: Number(record.port || 22),
          username: record.username,
          password: record.password,
          contactPerson: record.contactPerson,
          notes: record.notes || "",
        }))
      );
    }

    const result = await connection.execute(
      `
        SELECT
          ID,
          PARTNER_NAME,
          CONNECTION_TYPE,
          HOST,
          PORT,
          USERNAME,
          PASSWORD_VALUE,
          CONTACT_PERSON,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        ORDER BY UPDATED_AT DESC, PARTNER_NAME ASC
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.map(mapRecord);
  });
}

async function deleteSftpRecord(id) {
  await withTransaction((connection) =>
    connection.execute(`DELETE FROM ${TABLE_NAME} WHERE ID = :id`, { id })
  );
}

async function initializeDatabase() {
  await ensureSchema();
}

async function testConnection() {
  const result = await healthCheck();
  return result.rows[0];
}

async function closeDatabase() {
  await closePool();
}

module.exports = {
  bulkUpsertSftpRecords,
  closeDatabase,
  deleteSftpRecord,
  initializeDatabase,
  listSftpRecords,
  testConnection,
  upsertSftpRecord,
};
