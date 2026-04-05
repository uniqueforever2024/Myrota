CREATE TABLE IF NOT EXISTS apf_directory_entries (
  id TEXT PRIMARY KEY,
  bu VARCHAR(16) NOT NULL,
  section_type VARCHAR(100) NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  backup_contact TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apf_directory_entries_bu_section_idx
  ON apf_directory_entries (bu, section_type);

CREATE UNIQUE INDEX IF NOT EXISTS apf_directory_entries_bu_section_label_uniq
  ON apf_directory_entries (bu, section_type, lower(label));


CREATE TABLE IF NOT EXISTS documentation_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  body TEXT NOT NULL,
  media_name TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT '',
  media_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documentation_notes_updated_at_idx
  ON documentation_notes (updated_at DESC);

CREATE INDEX IF NOT EXISTS documentation_notes_tag_idx
  ON documentation_notes (tag);


CREATE TABLE IF NOT EXISTS certificate_records (
  id TEXT PRIMARY KEY,
  partner_name TEXT NOT NULL,
  certificate_type TEXT NOT NULL,
  contact_team TEXT NOT NULL,
  issued_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  upload_name TEXT NOT NULL DEFAULT '',
  upload_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT certificate_records_dates_chk CHECK (expiry_date >= issued_date)
);

CREATE INDEX IF NOT EXISTS certificate_records_expiry_date_idx
  ON certificate_records (expiry_date);

CREATE INDEX IF NOT EXISTS certificate_records_partner_name_idx
  ON certificate_records (partner_name);


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
);

CREATE INDEX IF NOT EXISTS sftp_partner_records_partner_name_idx
  ON sftp_partner_records (partner_name);

CREATE INDEX IF NOT EXISTS sftp_partner_records_connection_type_idx
  ON sftp_partner_records (connection_type);

CREATE UNIQUE INDEX IF NOT EXISTS sftp_partner_records_partner_type_host_uniq
  ON sftp_partner_records (lower(partner_name), upper(connection_type), lower(host));
