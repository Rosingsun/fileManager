-- users.cos_storage_quota_bytes 由 runMigrations.ensureUsersCosStorageQuotaColumn 幂等添加

INSERT INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_user_storage_quota_bytes',
  'int',
  5368709120,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
)
ON DUPLICATE KEY UPDATE param_key = param_key;
