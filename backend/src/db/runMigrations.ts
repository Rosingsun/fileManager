import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(pool: Pool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const migrationsDir = join(__dirname, '../../migrations')
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const filename of files) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT filename FROM schema_migrations WHERE filename = ?',
        [filename]
      )
      if (Array.isArray(rows) && rows.length > 0) continue

      if (filename === '008_users_is_admin.sql') {
        await ensureUsersIsAdminColumn(conn)
      }
      if (filename === '009_app_parameters_remark.sql') {
        await ensureAppParametersRemarkColumn(conn)
      }
      if (filename === '010_users_cos_storage_quota.sql') {
        await ensureUsersCosStorageQuotaColumn(conn)
      }
      if (filename === '011_user_cos_quota_adjustments.sql') {
        await ensureUserCosQuotaAdjustmentsTable(conn)
      }
      if (filename === '012_cos_shares.sql') {
        await ensureCosSharesTable(conn)
      }
      if (filename === '013_cos_share_selections.sql') {
        await ensureCosShareSelectionTables(conn)
      }
      if (filename === '014_cos_share_enhancements.sql') {
        await ensureCosShareEnhancements(conn)
        await ensureCosObjectMetaTable(conn)
      }

      const sql = await readFile(join(migrationsDir, filename), 'utf8')
      await conn.beginTransaction()
      try {
        for (const statement of splitSqlStatements(sql)) {
          if (statement) await conn.query(statement)
        }
        await conn.query('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)', [
          filename,
          Date.now(),
        ])
        await conn.commit()
        console.info(`[migrate] applied ${filename}`)
      } catch (e) {
        await conn.rollback()
        throw e
      }
    }

    await ensureUsersIsAdminColumn(conn)
    await ensureAppParametersRemarkColumn(conn)
    await ensureUsersInvitedByColumn(conn)
    await ensureUsersCosStorageQuotaColumn(conn)
    await ensureUserCosQuotaAdjustmentsTable(conn)
    await ensureCosSharesTable(conn)
    await ensureCosShareSelectionTables(conn)
    await ensureCosShareEnhancements(conn)
    await ensureCosObjectMetaTable(conn)
  } finally {
    conn.release()
  }
}

async function ensureCosSharesTable(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_shares'`
  )
  if (Number(tables[0]?.c)) return

  await conn.query(`
    CREATE TABLE cos_shares (
      id CHAR(36) NOT NULL COMMENT '分享主键 UUID',
      token CHAR(32) NOT NULL COMMENT '对外分享令牌（URL 安全字符）',
      owner_user_id CHAR(36) NOT NULL COMMENT '资源所有者用户 ID',
      resource_type ENUM('file','folder') NOT NULL COMMENT '分享资源类型：单文件或文件夹前缀',
      cos_key VARCHAR(1024) NULL COMMENT '单文件 COS 完整 Key；folder 时为 NULL',
      cos_prefix VARCHAR(1024) NULL COMMENT '文件夹 COS 前缀（须以 / 结尾）；file 时为 NULL',
      display_name VARCHAR(255) NOT NULL COMMENT '展示名（文件名或文件夹名）',
      permission ENUM('read','download') NOT NULL DEFAULT 'read' COMMENT 'read=仅预览；download=允许下载',
      expires_at BIGINT NULL COMMENT '过期时间 Unix 毫秒；NULL 表示永不过期',
      revoked_at BIGINT NULL COMMENT '撤销时间 Unix 毫秒；非 NULL 即失效',
      access_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计访问次数',
      last_accessed_at BIGINT NULL COMMENT '最近访问时间 Unix 毫秒',
      created_at BIGINT NOT NULL COMMENT '创建时间 Unix 毫秒',
      updated_at BIGINT NOT NULL COMMENT '更新时间 Unix 毫秒',
      PRIMARY KEY (id),
      UNIQUE KEY uq_cos_shares_token (token),
      KEY idx_cos_shares_owner (owner_user_id, created_at),
      KEY idx_cos_shares_expires (expires_at),
      CONSTRAINT fk_cos_shares_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='COS 云图库分享链接'
  `)
  console.info('[migrate] created cos_shares')
}

async function ensureCosShareSelectionTables(conn: PoolConnection): Promise<void> {
  const [shareTables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_shares'`
  )
  if (Number(shareTables[0]?.c)) {
    const [cols] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_shares' AND COLUMN_NAME = 'selection_enabled'`
    )
    if (!Number(cols[0]?.c)) {
      await conn.query(
        `ALTER TABLE cos_shares ADD COLUMN selection_enabled TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '是否允许访客选片并提交反馈（仅文件夹分享）'`
      )
      console.info('[migrate] added cos_shares.selection_enabled')
    }
  }

  const [subTables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_share_selection_submissions'`
  )
  if (!Number(subTables[0]?.c)) {
    await conn.query(`
      CREATE TABLE cos_share_selection_submissions (
        id CHAR(36) NOT NULL COMMENT '选片提交主键 UUID',
        share_id CHAR(36) NOT NULL COMMENT '关联分享 ID',
        picker_client_id CHAR(36) NOT NULL COMMENT '访客客户端匿名 ID',
        picker_label VARCHAR(64) NULL COMMENT '访客自填昵称',
        item_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本次选中图片张数',
        created_at BIGINT NOT NULL COMMENT '提交时间 Unix 毫秒',
        PRIMARY KEY (id),
        KEY idx_share_sel_sub_share_created (share_id, created_at),
        CONSTRAINT fk_share_sel_sub_share FOREIGN KEY (share_id) REFERENCES cos_shares (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='分享选片提交记录（追加模式，每次提交一条）'
    `)
    console.info('[migrate] created cos_share_selection_submissions')
  }

  const [itemTables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_share_selection_items'`
  )
  if (Number(itemTables[0]?.c)) return

  await conn.query(`
    CREATE TABLE cos_share_selection_items (
      id CHAR(36) NOT NULL COMMENT '选片项主键 UUID',
      submission_id CHAR(36) NOT NULL COMMENT '所属提交 ID',
      share_id CHAR(36) NOT NULL COMMENT '冗余分享 ID，便于按 share 聚合',
      cos_key VARCHAR(1024) NOT NULL COMMENT '被选中的 COS 对象完整 Key',
      created_at BIGINT NOT NULL COMMENT '创建时间 Unix 毫秒',
      PRIMARY KEY (id),
      UNIQUE KEY uq_sel_item_sub_key (submission_id, cos_key(191)),
      KEY idx_sel_item_share_key (share_id, cos_key(191)),
      CONSTRAINT fk_share_sel_item_sub FOREIGN KEY (submission_id) REFERENCES cos_share_selection_submissions (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_share_sel_item_share FOREIGN KEY (share_id) REFERENCES cos_shares (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='分享选片提交内的单张图片'
  `)
  console.info('[migrate] created cos_share_selection_items')
}

async function ensureCosShareEnhancements(conn: PoolConnection): Promise<void> {
  const shareColMigrations: { col: string; ddl: string }[] = [
    {
      col: 'selection_round',
      ddl: `ALTER TABLE cos_shares ADD COLUMN selection_round INT UNSIGNED NOT NULL DEFAULT 1
         COMMENT '当前选片轮次（访客提交默认归属此轮）'`,
    },
    {
      col: 'recommended_keys_json',
      ddl: `ALTER TABLE cos_shares ADD COLUMN recommended_keys_json TEXT NULL
         COMMENT '摄影师推荐图片 COS Key 列表 JSON 数组'`,
    },
    {
      col: 'asset_variant',
      ddl: `ALTER TABLE cos_shares ADD COLUMN asset_variant VARCHAR(16) NOT NULL DEFAULT 'original'
         COMMENT '分享资源集：original 原图 / edited 精修版（_edited 后缀）'`,
    },
    {
      col: 'hide_quality_failed',
      ddl: `ALTER TABLE cos_shares ADD COLUMN hide_quality_failed TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '访客浏览时隐藏质检未通过的图片'`,
    },
  ]
  for (const { col, ddl } of shareColMigrations) {
    const [cols] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_shares' AND COLUMN_NAME = ?`,
      [col]
    )
    if (!Number(cols[0]?.c)) {
      await conn.query(ddl)
      console.info(`[migrate] added cos_shares.${col}`)
    }
  }

  const [subRound] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_share_selection_submissions' AND COLUMN_NAME = 'selection_round'`
  )
  if (Number(subRound[0]?.c) === 0) {
    await conn.query(
      `ALTER TABLE cos_share_selection_submissions ADD COLUMN selection_round INT UNSIGNED NOT NULL DEFAULT 1
       COMMENT '选片轮次' AFTER picker_label`
    )
    console.info('[migrate] added cos_share_selection_submissions.selection_round')
  }

  const itemColMigrations: { col: string; ddl: string }[] = [
    {
      col: 'tier',
      ddl: `ALTER TABLE cos_share_selection_items ADD COLUMN tier VARCHAR(16) NOT NULL DEFAULT 'must'
         COMMENT '选片分级：must 必选 / maybe 备选 / reject 淘汰'`,
    },
    {
      col: 'note',
      ddl: `ALTER TABLE cos_share_selection_items ADD COLUMN note VARCHAR(512) NULL
         COMMENT '访客对该图的备注'`,
    },
  ]
  for (const { col, ddl } of itemColMigrations) {
    const [cols] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_share_selection_items' AND COLUMN_NAME = ?`,
      [col]
    )
    if (!Number(cols[0]?.c)) {
      await conn.query(ddl)
      console.info(`[migrate] added cos_share_selection_items.${col}`)
    }
  }
}

async function ensureCosObjectMetaTable(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cos_object_meta'`
  )
  if (Number(tables[0]?.c)) return

  await conn.query(`
    CREATE TABLE cos_object_meta (
      id CHAR(36) NOT NULL COMMENT '元数据主键 UUID',
      owner_user_id CHAR(36) NOT NULL COMMENT '所属用户 ID',
      cos_key VARCHAR(1024) NOT NULL COMMENT 'COS 对象完整 Key',
      content_category VARCHAR(32) NULL COMMENT 'AI 内容分类（九大类之一）',
      quality_pass TINYINT(1) NULL COMMENT '质检是否通过：1 通过 / 0 未通过',
      quality_issues_json TEXT NULL COMMENT '质检问题列表 JSON',
      exif_capture_at BIGINT NULL COMMENT '拍摄时间 Unix 毫秒（来自 EXIF）',
      created_at BIGINT NOT NULL COMMENT '创建时间 Unix 毫秒',
      updated_at BIGINT NOT NULL COMMENT '更新时间 Unix 毫秒',
      PRIMARY KEY (id),
      UNIQUE KEY uq_cos_meta_owner_key (owner_user_id, cos_key(191)),
      KEY idx_cos_meta_category (owner_user_id, content_category),
      KEY idx_cos_meta_quality (owner_user_id, quality_pass),
      CONSTRAINT fk_cos_meta_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='COS 图片对象元数据（分类、质检等）'
  `)
  console.info('[migrate] created cos_object_meta')
}

/** 列可能已手工添加但 008 未记入 schema_migrations，避免重复 ADD 导致启动失败 */
async function ensureUsersIsAdminColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      `ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0
       COMMENT '是否系统管理员：1 可调用 /admin/* 维护 app_parameters'`
    )
    console.info('[migrate] added users.is_admin')
  }
}

async function ensureAppParametersRemarkColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_parameters'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_parameters' AND COLUMN_NAME = 'remark'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      `ALTER TABLE app_parameters ADD COLUMN remark VARCHAR(512) NULL
       COMMENT '参数说明，便于运维与开发查阅维护'`
    )
    console.info('[migrate] added app_parameters.remark')
  }
}

/** 列或外键可能已由手工执行过 002 旧版 SQL，避免重复 ADD 导致启动失败 */
async function ensureUsersCosStorageQuotaColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'cos_storage_quota_bytes'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      `ALTER TABLE users ADD COLUMN cos_storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120
       COMMENT '云图库存储空间上限（字节），统计与上传校验使用'`
    )
    console.info('[migrate] added users.cos_storage_quota_bytes')
  }
}

async function ensureUserCosQuotaAdjustmentsTable(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_cos_quota_adjustments'`
  )
  if (Number(tables[0]?.c)) return

  await conn.query(`
    CREATE TABLE user_cos_quota_adjustments (
      id CHAR(36) NOT NULL COMMENT '主键 UUID',
      user_id CHAR(36) NOT NULL COMMENT '被调整配额的用户 ID',
      operator_user_id CHAR(36) NULL COMMENT '操作人用户 ID（管理员）；系统任务可为 NULL',
      previous_quota_bytes BIGINT NOT NULL COMMENT '调整前云图库配额（字节）',
      new_quota_bytes BIGINT NOT NULL COMMENT '调整后云图库配额（字节）',
      delta_bytes BIGINT NOT NULL COMMENT '变更量（字节），new - previous',
      remark VARCHAR(256) NULL COMMENT '备注，如充值订单号',
      created_at BIGINT NOT NULL COMMENT '创建时间 Unix 毫秒',
      PRIMARY KEY (id),
      KEY idx_quota_adj_user (user_id),
      KEY idx_quota_adj_created (created_at),
      CONSTRAINT fk_quota_adj_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_quota_adj_operator FOREIGN KEY (operator_user_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='用户云图库配额调整记录（充值/运维调额）'
  `)
  console.info('[migrate] created user_cos_quota_adjustments')
}

async function ensureUsersInvitedByColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'invited_by_user_id'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      'ALTER TABLE users ADD COLUMN invited_by_user_id CHAR(36) NULL'
    )
    console.info('[migrate] added users.invited_by_user_id')
  }

  const [fks] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_invited_by'`
  )
  if (!Number(fks[0]?.c)) {
    await conn.query(
      `ALTER TABLE users
       ADD CONSTRAINT fk_users_invited_by FOREIGN KEY (invited_by_user_id) REFERENCES users (id) ON DELETE SET NULL`
    )
    console.info('[migrate] added fk_users_invited_by')
  }
}

function splitSqlStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/)
  let cur = ''
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('--')) continue
    cur += line + '\n'
  }
  return cur
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
}
