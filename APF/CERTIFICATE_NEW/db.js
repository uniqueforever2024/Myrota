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

const TABLE_NAME = "MYROTA_CERTIFICATE";

function mapCertificate(row) {
  return {
    id: row.ID,
    partnerName: row.PARTNER_NAME,
    certificateType: row.CERTIFICATE_TYPE,
    contactTeam: row.CONTACT_TEAM,
    issuedDate: row.ISSUED_DATE,
    expiryDate: row.EXPIRY_DATE,
    uploadName: row.UPLOAD_NAME || "",
    uploadType: row.UPLOAD_TYPE || "",
    uploadDataUrl: row.UPLOAD_DATA || "",
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
          CERTIFICATE_TYPE VARCHAR2(120) NOT NULL,
          CONTACT_TEAM VARCHAR2(300) NOT NULL,
          ISSUED_DATE VARCHAR2(20) NOT NULL,
          EXPIRY_DATE VARCHAR2(20) NOT NULL,
          UPLOAD_NAME VARCHAR2(500),
          UPLOAD_TYPE VARCHAR2(200),
          UPLOAD_DATA CLOB,
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
      "CERTIFICATE_TYPE",
      "CERTIFICATE_TYPE VARCHAR2(120)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "CONTACT_TEAM",
      "CONTACT_TEAM VARCHAR2(300)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "ISSUED_DATE",
      "ISSUED_DATE VARCHAR2(20)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "EXPIRY_DATE",
      "EXPIRY_DATE VARCHAR2(20)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "UPLOAD_NAME",
      "UPLOAD_NAME VARCHAR2(500)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "UPLOAD_TYPE",
      "UPLOAD_TYPE VARCHAR2(200)"
    );
    await addColumnIfMissing(connection, TABLE_NAME, "UPLOAD_DATA", "UPLOAD_DATA CLOB");
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
        `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT MYR_CERT_PK PRIMARY KEY (ID)`
      );
    }

    const columnNames = await getTableColumnNames(connection, TABLE_NAME);

    if (columnNames.has("EXPIRY_DATE")) {
      await executeIgnoreAlreadyExists(
        connection,
        `CREATE INDEX MYR_CERT_EXP_IDX ON ${TABLE_NAME} (EXPIRY_DATE)`
      );
    }
  });
}

async function listCertificates() {
  const result = await execute(
    `
      SELECT
        ID,
        PARTNER_NAME,
        CERTIFICATE_TYPE,
        CONTACT_TEAM,
        ISSUED_DATE,
        EXPIRY_DATE,
        UPLOAD_NAME,
        UPLOAD_TYPE,
        UPLOAD_DATA,
        NOTES,
        CREATED_AT,
        UPDATED_AT
      FROM ${TABLE_NAME}
      ORDER BY EXPIRY_DATE ASC, PARTNER_NAME ASC
    `
  );

  return result.rows.map(mapCertificate);
}

async function upsertCertificate(record, connection = null) {
  const runner = async (activeConnection) => {
    await activeConnection.execute(
      `
        MERGE INTO ${TABLE_NAME} target
        USING (
          SELECT
            :id AS ID,
            :partnerName AS PARTNER_NAME,
            :certificateType AS CERTIFICATE_TYPE,
            :contactTeam AS CONTACT_TEAM,
            :issuedDate AS ISSUED_DATE,
            :expiryDate AS EXPIRY_DATE,
            :uploadName AS UPLOAD_NAME,
            :uploadType AS UPLOAD_TYPE,
            :uploadDataUrl AS UPLOAD_DATA,
            :notes AS NOTES
          FROM dual
        ) source
        ON (target.ID = source.ID)
        WHEN MATCHED THEN UPDATE SET
          target.PARTNER_NAME = source.PARTNER_NAME,
          target.CERTIFICATE_TYPE = source.CERTIFICATE_TYPE,
          target.CONTACT_TEAM = source.CONTACT_TEAM,
          target.ISSUED_DATE = source.ISSUED_DATE,
          target.EXPIRY_DATE = source.EXPIRY_DATE,
          target.UPLOAD_NAME = source.UPLOAD_NAME,
          target.UPLOAD_TYPE = source.UPLOAD_TYPE,
          target.UPLOAD_DATA = source.UPLOAD_DATA,
          target.NOTES = source.NOTES,
          target.UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (
          ID,
          PARTNER_NAME,
          CERTIFICATE_TYPE,
          CONTACT_TEAM,
          ISSUED_DATE,
          EXPIRY_DATE,
          UPLOAD_NAME,
          UPLOAD_TYPE,
          UPLOAD_DATA,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        ) VALUES (
          source.ID,
          source.PARTNER_NAME,
          source.CERTIFICATE_TYPE,
          source.CONTACT_TEAM,
          source.ISSUED_DATE,
          source.EXPIRY_DATE,
          source.UPLOAD_NAME,
          source.UPLOAD_TYPE,
          source.UPLOAD_DATA,
          source.NOTES,
          SYSTIMESTAMP,
          SYSTIMESTAMP
        )
      `,
      {
        id: record.id,
        partnerName: record.partnerName,
        certificateType: record.certificateType,
        contactTeam: record.contactTeam,
        issuedDate: record.issuedDate,
        expiryDate: record.expiryDate,
        uploadName: record.uploadName || "",
        uploadType: record.uploadType || "",
        uploadDataUrl: record.uploadDataUrl || "",
        notes: record.notes || "",
      }
    );

    const savedResult = await activeConnection.execute(
      `
        SELECT
          ID,
          PARTNER_NAME,
          CERTIFICATE_TYPE,
          CONTACT_TEAM,
          ISSUED_DATE,
          EXPIRY_DATE,
          UPLOAD_NAME,
          UPLOAD_TYPE,
          UPLOAD_DATA,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        WHERE ID = :id
      `,
      { id: record.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return mapCertificate(savedResult.rows[0]);
  };

  if (connection) {
    return runner(connection);
  }

  return withTransaction((activeConnection) => runner(activeConnection));
}

async function bulkUpsertCertificates(records) {
  return withTransaction(async (connection) => {
    await connection.execute(`DELETE FROM ${TABLE_NAME}`);

    if (records.length > 0) {
      await connection.executeMany(
        `
          INSERT INTO ${TABLE_NAME} (
            ID,
            PARTNER_NAME,
            CERTIFICATE_TYPE,
            CONTACT_TEAM,
            ISSUED_DATE,
            EXPIRY_DATE,
            UPLOAD_NAME,
            UPLOAD_TYPE,
            UPLOAD_DATA,
            NOTES,
            CREATED_AT,
            UPDATED_AT
          ) VALUES (
            :id,
            :partnerName,
            :certificateType,
            :contactTeam,
            :issuedDate,
            :expiryDate,
            :uploadName,
            :uploadType,
            :uploadDataUrl,
            :notes,
            SYSTIMESTAMP,
            SYSTIMESTAMP
          )
        `,
        records.map((record) => ({
          id: record.id,
          partnerName: record.partnerName,
          certificateType: record.certificateType,
          contactTeam: record.contactTeam,
          issuedDate: record.issuedDate,
          expiryDate: record.expiryDate,
          uploadName: record.uploadName || "",
          uploadType: record.uploadType || "",
          uploadDataUrl: record.uploadDataUrl || "",
          notes: record.notes || "",
        }))
      );
    }

    const result = await connection.execute(
      `
        SELECT
          ID,
          PARTNER_NAME,
          CERTIFICATE_TYPE,
          CONTACT_TEAM,
          ISSUED_DATE,
          EXPIRY_DATE,
          UPLOAD_NAME,
          UPLOAD_TYPE,
          UPLOAD_DATA,
          NOTES,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        ORDER BY EXPIRY_DATE ASC, PARTNER_NAME ASC
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.map(mapCertificate);
  });
}

async function deleteCertificate(id) {
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
  bulkUpsertCertificates,
  closeDatabase,
  deleteCertificate,
  initializeDatabase,
  listCertificates,
  testConnection,
  upsertCertificate,
};
