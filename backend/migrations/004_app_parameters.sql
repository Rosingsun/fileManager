CREATE TABLE IF NOT EXISTS app_parameters (
  param_key VARCHAR(64) NOT NULL COMMENT '参数键，全局唯一，如 invite_max_redemptions_per_inviter',
  value_type ENUM('int', 'string') NOT NULL COMMENT '值类型：int 使用 int_value；string 使用 string_value',
  int_value BIGINT NULL COMMENT '整型参数值；与 value_type 为 int 时配合使用，可为 NULL 表示未配置',
  string_value VARCHAR(1024) NULL COMMENT '字符串参数值；与 value_type 为 string 时配合使用',
  updated_at BIGINT NOT NULL COMMENT '最后更新时间 Unix 毫秒',
  PRIMARY KEY (param_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用级可配置参数，由运维或后续管理端维护';

INSERT INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'invite_max_redemptions_per_inviter',
  'int',
  1,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
)
ON DUPLICATE KEY UPDATE param_key = param_key;
