-- 若该行已存在（重复执行迁移或手工插入），忽略重复主键，避免 1062
INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'invite_max_generations_per_day',
  'int',
  2,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);
