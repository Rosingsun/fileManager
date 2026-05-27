-- 普通用户每日生成邀请码上限改为 1；管理员单独参数默认 5
INSERT IGNORE INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
VALUES (
  'invite_max_generations_per_day_admin',
  'int',
  5,
  NULL,
  CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
);

UPDATE app_parameters
SET int_value = 1,
    updated_at = CAST(FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS SIGNED)
WHERE param_key = 'invite_max_generations_per_day';

UPDATE app_parameters
SET remark = '邀请：普通用户每个 UTC 自然日内最多生成邀请码的次数（按 invite_codes.created_at 统计）。达到上限后 POST /invites 返回 403 INVITE_DAILY_GENERATION_LIMIT。默认 1。'
WHERE param_key = 'invite_max_generations_per_day';

UPDATE app_parameters
SET remark = '邀请：管理员（users.is_admin=1）每个 UTC 自然日内最多生成邀请码的次数。达到上限后 POST /invites 返回 403 INVITE_DAILY_GENERATION_LIMIT。默认 5。'
WHERE param_key = 'invite_max_generations_per_day_admin';
