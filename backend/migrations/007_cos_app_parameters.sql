INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_secret_id',
  'string',
  NULL,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_secret_key',
  'string',
  NULL,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_region',
  'string',
  NULL,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_bucket',
  'string',
  NULL,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_key_prefix',
  'string',
  NULL,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_upload_max_bytes',
  'int',
  20971520,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_presign_put_expires_sec',
  'int',
  900,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'cos_presign_get_expires_sec',
  'int',
  600,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);
