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
    logo MEDIUMBLOB NULL,
    logo_mime VARCHAR(50) NULL,
    logo_dark_bg TINYINT(1) NOT NULL DEFAULT 0,
    logo_version INT NOT NULL DEFAULT 0,
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
];

async function addMissingColumns() {
  for (const { table, column, sql } of COLUMNS) {
    if (!(await hasColumn(table, column))) await pool.query(sql);
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

/** Waits for MySQL to accept connections, then creates the tables. */
export async function migrate({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      for (const sql of SCHEMA) await pool.query(sql);
      await addMissingColumns();
      await migrateDateRangeToDays();
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`[db] MySQL indisponible (${err.code || err.message}), nouvel essai ${attempt}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
