-- 历史邀请码：将未设置过期的记录统一为「创建时间 + 3 天」（毫秒时间戳）
UPDATE invite_codes
SET expires_at = created_at + (3 * 24 * 60 * 60 * 1000)
WHERE expires_at IS NULL;
