import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'calendar',
  password: process.env.DB_PASSWORD || 'calendar',
  database: process.env.DB_NAME || 'calendar',
  connectionLimit: 10,
  // Dates are kept as plain strings ("YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS") to avoid timezone shifts.
  dateStrings: true,
  charset: 'utf8mb4',
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token CHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NULL,
    email VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS occasions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    edit_deadline DATETIME NULL,
    creator_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_occ_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS participants (
    occasion_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (occasion_id, user_id),
    CONSTRAINT fk_part_occ FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE CASCADE,
    CONSTRAINT fk_part_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS availabilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    occasion_id INT NOT NULL,
    user_id INT NOT NULL,
    day DATE NOT NULL,
    start_min SMALLINT NOT NULL,
    end_min SMALLINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_av_occ_day (occasion_id, day),
    CONSTRAINT fk_av_occ FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE CASCADE,
    CONSTRAINT fk_av_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

SCHEMA.push(
  `CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mode ENUM('free', 'restricted') NOT NULL DEFAULT 'free',
    owner_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_org_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS organization_members (
    organization_id INT NOT NULL,
    user_id INT NOT NULL,
    can_create TINYINT(1) NOT NULL DEFAULT 0,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id),
    CONSTRAINT fk_orgm_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_orgm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
);

SCHEMA.push(
  // Days open for availabilities, chosen one by one when the occasion is created.
  `CREATE TABLE IF NOT EXISTS occasion_days (
    occasion_id INT NOT NULL,
    day DATE NOT NULL,
    PRIMARY KEY (occasion_id, day),
    CONSTRAINT fk_oday_occ FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
);

SCHEMA.push(
  // Logos of the organizations: everything that makes a logo.
  // background: 'theme' (follows the application's light / dark mode), 'light' (always on white) or 'dark'
  // (always on the dark blue). data_dark: version of the image for a dark background (gallery logo, 'theme'). An organization keeps at most one of each kind —
  // 'custom' (file uploaded) and 'generic' (gallery: symbol + text composed by the browser, with the choices made
  // to show them again) — and points to the one shown (organizations.logo_id).
  `CREATE TABLE IF NOT EXISTS logos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    kind ENUM('custom', 'generic') NOT NULL,
    mime VARCHAR(50) NOT NULL,
    data MEDIUMBLOB NOT NULL,
    background ENUM('theme', 'light', 'dark') NOT NULL DEFAULT 'theme',
    data_dark MEDIUMBLOB NULL,
    emblem VARCHAR(40) NULL,
    font VARCHAR(40) NULL,
    caption VARCHAR(150) NULL,
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_logo_org (organization_id, kind),
    CONSTRAINT fk_logo_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
);

SCHEMA.push(
  // One-time tokens shown as a QR code to link another device (phone) to the same user.
  `CREATE TABLE IF NOT EXISTS link_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_link_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
);

/** Columns added after the first version (MySQL has no ADD COLUMN IF NOT EXISTS). */
const COLUMNS = [
  {
    table: 'occasions',
    column: 'organization_id',
    sql: `ALTER TABLE occasions ADD COLUMN organization_id INT NULL AFTER creator_id,
          ADD CONSTRAINT fk_occ_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL`,
  },
  {
    // 1 = every member of the organization (current and future) is invited automatically.
    table: 'occasions',
    column: 'all_members',
    sql: 'ALTER TABLE occasions ADD COLUMN all_members TINYINT(1) NOT NULL DEFAULT 0 AFTER organization_id',
  },
  {
    // Set when the creator archives the occasion before its end date.
    table: 'occasions',
    column: 'archived_at',
    sql: 'ALTER TABLE occasions ADD COLUMN archived_at DATETIME NULL AFTER edit_deadline',
  },
  {
    // Hours of the day shown and allowed for availabilities (minutes; 0–1440 = whole day).
    table: 'occasions',
    column: 'day_start_min',
    sql: `ALTER TABLE occasions ADD COLUMN day_start_min SMALLINT NOT NULL DEFAULT 0,
          ADD COLUMN day_end_min SMALLINT NOT NULL DEFAULT 1440`,
  },
  {
    // Removed by the owner: kept so that opening a link does not re-add the person automatically.
    table: 'organization_members',
    column: 'removed_at',
    sql: 'ALTER TABLE organization_members ADD COLUMN removed_at DATETIME NULL',
  },
  {
    // Administrators manage the organization (members, rights, logo) like its owner.
    table: 'organization_members',
    column: 'is_admin',
    sql: 'ALTER TABLE organization_members ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER can_create',
  },
  {
    // Removed by the occasion's creator (same reason).
    table: 'participants',
    column: 'removed_at',
    sql: 'ALTER TABLE participants ADD COLUMN removed_at DATETIME NULL',
  },
  {
    // Optional password (scrypt), to sign back in with the email when the cookie is lost.
    table: 'users',
    column: 'password_hash',
    sql: 'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email',
  },
  {
    // Site administrator: manages every organization, occasion and account (see admin.js).
    table: 'users',
    column: 'is_site_admin',
    sql: 'ALTER TABLE users ADD COLUMN is_site_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash',
  },
  {
    // First real use of the account (a request with its cookie). NULL: prepared by an invitation by email
    // or by the administrator, never used yet ("invité" in the occasion's list, greyed out).
    table: 'users',
    column: 'activated_at',
    sql: 'ALTER TABLE users ADD COLUMN activated_at DATETIME NULL AFTER created_at',
    // Existing accounts: used if they came back after their creation or hold ranges
    // (an account prepared by the administrator was never seen after its creation).
    then: `UPDATE users u SET u.activated_at = u.last_seen_at
           WHERE u.last_seen_at > u.created_at OR EXISTS (SELECT 1 FROM availabilities a WHERE a.user_id = u.id)`,
  },
  {
    // Logo shown for the organization (see the logos table).
    table: 'organizations',
    column: 'logo_id',
    sql: `ALTER TABLE organizations ADD COLUMN logo_id INT NULL AFTER mode,
          ADD CONSTRAINT fk_org_logo FOREIGN KEY (logo_id) REFERENCES logos(id) ON DELETE SET NULL`,
  },
  {
    // Background of a logo: 'theme', 'light' or 'dark' (replaces dark_bg: 1 → 'dark', 0 → 'theme', as shown so far).
    table: 'logos',
    column: 'background',
    sql: `ALTER TABLE logos ADD COLUMN background ENUM('theme', 'light', 'dark') NOT NULL DEFAULT 'theme' AFTER data,
          ADD COLUMN data_dark MEDIUMBLOB NULL AFTER background`,
    then: ["UPDATE logos SET background = IF(dark_bg = 1, 'dark', 'theme')", 'ALTER TABLE logos DROP COLUMN dark_bg'],
  },
  {
    // 'link': QR code or sign-in link (only the latest one works); 'invite': invitation to an occasion
    // by email (one per occasion, they do not replace each other).
    table: 'link_tokens',
    column: 'kind',
    sql: "ALTER TABLE link_tokens ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'link' AFTER user_id",
  },
  {
    // Language chosen in the application ('fr', 'en'), for the emails sent to this person. NULL: unknown.
    table: 'users',
    column: 'locale',
    sql: 'ALTER TABLE users ADD COLUMN locale VARCHAR(5) NULL AFTER email',
  },
];

async function addMissingColumns() {
  for (const { table, column, sql, then } of COLUMNS) {
    if (await hasColumn(table, column)) continue;
    await pool.query(sql);
    for (const query of [].concat(then ?? [])) await pool.query(query);
  }
}

const hasColumn = async (table, column) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
};

/**
 * Former format: an occasion covered every day from start_date to end_date.
 * Each of those days becomes a row of occasion_days, then the two columns are dropped.
 */
async function migrateDateRangeToDays() {
  if (!(await hasColumn('occasions', 'start_date'))) return;
  const conn = await pool.getConnection();
  try {
    await conn.query('SET SESSION cte_max_recursion_depth = 100000');
    await conn.query(
      `INSERT IGNORE INTO occasion_days (occasion_id, day)
       WITH RECURSIVE d AS (
         SELECT id, start_date AS day, end_date FROM occasions
         UNION ALL
         SELECT id, day + INTERVAL 1 DAY, end_date FROM d WHERE day < end_date
       )
       SELECT id, day FROM d`,
    );
    const [missing] = await conn.query(
      'SELECT COUNT(*) AS n FROM occasions o WHERE NOT EXISTS (SELECT 1 FROM occasion_days d WHERE d.occasion_id = o.id)',
    );
    if (Number(missing[0].n) > 0) throw new Error(`${missing[0].n} occasion(s) sans jour après migration : colonnes conservées`);
    await conn.query('ALTER TABLE occasions DROP COLUMN start_date, DROP COLUMN end_date');
    console.log('[db] dates de début/fin migrées vers occasion_days');
  } finally {
    conn.release();
  }
}

/** Several gallery logos per organization: the unique key (organization, kind) becomes a plain index. */
async function allowSeveralLogos() {
  const [rows] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logos' AND INDEX_NAME IN ('uq_logo_org_kind', 'idx_logo_org')`,
  );
  const names = new Set(rows.map((r) => r.INDEX_NAME));
  if (!names.has('uq_logo_org_kind')) return;
  // The foreign key on organization_id needs an index: add the new one before dropping the old one.
  if (!names.has('idx_logo_org')) await pool.query('ALTER TABLE logos ADD INDEX idx_logo_org (organization_id, kind)');
  await pool.query('ALTER TABLE logos DROP INDEX uq_logo_org_kind');
}

/**
 * Former format: the logo (and, briefly, the gallery logo) lived in columns of organizations.
 * Each one becomes a row of logos; once every row is checked, the old columns are dropped.
 */
async function migrateLogosToTable() {
  if (!(await hasColumn('organizations', 'logo_mime'))) return;
  const withGeneric = await hasColumn('organizations', 'generic_mime');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT IGNORE INTO logos (organization_id, kind, mime, data, background, version)
       SELECT id, 'custom', logo_mime, logo, IF(logo_dark_bg = 1, 'dark', 'theme'), logo_version + 1 FROM organizations
       WHERE logo_mime IS NOT NULL AND logo IS NOT NULL`,
    );
    if (withGeneric) {
      await conn.query(
        `INSERT IGNORE INTO logos (organization_id, kind, mime, data, background, emblem, font, caption, version)
         SELECT id, 'generic', generic_mime, generic_logo, IF(generic_dark_bg = 1, 'dark', 'light'), generic_emblem, generic_font,
           ${(await hasColumn('organizations', 'generic_caption')) ? 'generic_caption' : 'NULL'}, logo_version + 1
         FROM organizations WHERE generic_mime IS NOT NULL AND generic_logo IS NOT NULL`,
      );
    }
    // Logo shown: the one of the mode, otherwise the other one.
    const preferGeneric = withGeneric ? "o.logo_mode = 'generic'" : '0';
    await conn.query(
      `UPDATE organizations o SET o.logo_id = (
         SELECT l.id FROM logos l WHERE l.organization_id = o.id
         ORDER BY (l.kind = 'generic') = (${preferGeneric}) DESC LIMIT 1)`,
    );
    // Check before dropping anything: same number of logos and same bytes.
    const [[expected]] = await conn.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(logo)), 0) AS bytes FROM organizations
       WHERE logo_mime IS NOT NULL AND logo IS NOT NULL`,
    );
    const [[copied]] = await conn.query(
      "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM logos WHERE kind = 'custom'",
    );
    if (Number(expected.n) !== Number(copied.n) || Number(expected.bytes) !== Number(copied.bytes)) {
      throw new Error(`logos : ${copied.n}/${expected.n} copiés, colonnes conservées`);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const old = ['logo', 'logo_mime', 'logo_dark_bg', 'logo_version'];
  if (withGeneric) old.push('logo_mode', 'generic_logo', 'generic_mime', 'generic_emblem', 'generic_font', 'generic_dark_bg');
  if (await hasColumn('organizations', 'generic_caption')) old.push('generic_caption');
  await pool.query(`ALTER TABLE organizations ${old.map((c) => `DROP COLUMN ${c}`).join(', ')}`);
  console.log('[db] logos déplacés dans la table logos');
}

/** Waits for MySQL to accept connections, then creates the tables. */
export async function migrate({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      for (const sql of SCHEMA) await pool.query(sql);
      await addMissingColumns();
      await migrateDateRangeToDays();
      await migrateLogosToTable();
      await allowSeveralLogos();
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`[db] MySQL indisponible (${err.code || err.message}), nouvel essai ${attempt}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
