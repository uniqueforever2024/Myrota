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

const TABLE_NAME = "MYROTA_DOCUMENTATION";

function mapNote(row) {
  const mediaName = row.MEDIA_NAME || "";
  const mediaType = row.MEDIA_TYPE || "";
  const mediaDataUrl = row.MEDIA_DATA || "";

  return {
    id: row.ID,
    title: row.TITLE,
    tag: row.NOTE_TAG,
    body: row.BODY_TEXT || "",
    media:
      mediaName || mediaType || mediaDataUrl
        ? {
            name: mediaName,
            type: mediaType,
            dataUrl: mediaDataUrl,
          }
        : null,
    mediaName,
    updatedAt: row.UPDATED_AT,
    createdAt: row.CREATED_AT,
  };
}

async function ensureSchema() {
  await withConnection(async (connection) => {
    await executeIgnoreAlreadyExists(
      connection,
      `
        CREATE TABLE ${TABLE_NAME} (
          ID VARCHAR2(120) PRIMARY KEY,
          TITLE VARCHAR2(300) NOT NULL,
          NOTE_TAG VARCHAR2(120) NOT NULL,
          BODY_TEXT CLOB NOT NULL,
          MEDIA_NAME VARCHAR2(500),
          MEDIA_TYPE VARCHAR2(200),
          MEDIA_DATA CLOB,
          CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
          UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
        )
      `
    );

    await addColumnIfMissing(connection, TABLE_NAME, "ID", "ID VARCHAR2(120)");
    await addColumnIfMissing(connection, TABLE_NAME, "TITLE", "TITLE VARCHAR2(300)");
    await addColumnIfMissing(connection, TABLE_NAME, "NOTE_TAG", "NOTE_TAG VARCHAR2(120)");
    await addColumnIfMissing(connection, TABLE_NAME, "BODY_TEXT", "BODY_TEXT CLOB");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "MEDIA_NAME",
      "MEDIA_NAME VARCHAR2(500)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "MEDIA_TYPE",
      "MEDIA_TYPE VARCHAR2(200)"
    );
    await addColumnIfMissing(connection, TABLE_NAME, "MEDIA_DATA", "MEDIA_DATA CLOB");
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
        `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT MYR_DOC_PK PRIMARY KEY (ID)`
      );
    }

    const columnNames = await getTableColumnNames(connection, TABLE_NAME);

    if (columnNames.has("UPDATED_AT")) {
      await executeIgnoreAlreadyExists(
        connection,
        `CREATE INDEX MYR_DOC_UPD_IDX ON ${TABLE_NAME} (UPDATED_AT)`
      );
    }
  });
}

async function listDocumentationNotes() {
  const result = await execute(
    `
      SELECT
        ID,
        TITLE,
        NOTE_TAG,
        BODY_TEXT,
        MEDIA_NAME,
        MEDIA_TYPE,
        MEDIA_DATA,
        CREATED_AT,
        UPDATED_AT
      FROM ${TABLE_NAME}
      ORDER BY UPDATED_AT DESC, TITLE ASC
    `
  );

  return result.rows.map(mapNote);
}

async function upsertDocumentationNote(note, connection = null) {
  const runner = async (activeConnection) => {
    await activeConnection.execute(
      `
        MERGE INTO ${TABLE_NAME} target
        USING (
          SELECT
            :id AS ID,
            :title AS TITLE,
            :tag AS NOTE_TAG,
            :body AS BODY_TEXT,
            :mediaName AS MEDIA_NAME,
            :mediaType AS MEDIA_TYPE,
            :mediaData AS MEDIA_DATA
          FROM dual
        ) source
        ON (target.ID = source.ID)
        WHEN MATCHED THEN UPDATE SET
          target.TITLE = source.TITLE,
          target.NOTE_TAG = source.NOTE_TAG,
          target.BODY_TEXT = source.BODY_TEXT,
          target.MEDIA_NAME = source.MEDIA_NAME,
          target.MEDIA_TYPE = source.MEDIA_TYPE,
          target.MEDIA_DATA = source.MEDIA_DATA,
          target.UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT (
          ID,
          TITLE,
          NOTE_TAG,
          BODY_TEXT,
          MEDIA_NAME,
          MEDIA_TYPE,
          MEDIA_DATA,
          CREATED_AT,
          UPDATED_AT
        ) VALUES (
          source.ID,
          source.TITLE,
          source.NOTE_TAG,
          source.BODY_TEXT,
          source.MEDIA_NAME,
          source.MEDIA_TYPE,
          source.MEDIA_DATA,
          SYSTIMESTAMP,
          SYSTIMESTAMP
        )
      `,
      {
        id: note.id,
        title: note.title,
        tag: note.tag,
        body: note.body,
        mediaName: note.media?.name || "",
        mediaType: note.media?.type || "",
        mediaData: note.media?.dataUrl || "",
      }
    );

    const savedResult = await activeConnection.execute(
      `
        SELECT
          ID,
          TITLE,
          NOTE_TAG,
          BODY_TEXT,
          MEDIA_NAME,
          MEDIA_TYPE,
          MEDIA_DATA,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        WHERE ID = :id
      `,
      { id: note.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return mapNote(savedResult.rows[0]);
  };

  if (connection) {
    return runner(connection);
  }

  return withTransaction((activeConnection) => runner(activeConnection));
}

async function deleteDocumentationNote(id) {
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
  closeDatabase,
  deleteDocumentationNote,
  initializeDatabase,
  listDocumentationNotes,
  testConnection,
  upsertDocumentationNote,
};
