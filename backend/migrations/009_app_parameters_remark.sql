-- remark 列由 runMigrations.ensureAppParametersRemarkColumn 幂等添加

UPDATE app_parameters SET remark = '邀请：每位邀请人通过邀请码成功邀请他人的上限人数（统计 invite_redemptions）。达到上限后 POST /invites 返回 403 INVITE_QUOTA_EXCEEDED。默认 1。'
WHERE param_key = 'invite_max_redemptions_per_inviter';

UPDATE app_parameters SET remark = '邀请：每位邀请人每个 UTC 自然日内最多生成邀请码的次数（按 invite_codes.created_at 统计）。达到上限后 POST /invites 返回 403 INVITE_DAILY_GENERATION_LIMIT。默认 2。'
WHERE param_key = 'invite_max_generations_per_day';

UPDATE app_parameters SET remark = '腾讯云 COS SecretId。与 secret_key、region、bucket 四项均非空时启用 /cos/*。敏感信息，仅通过管理 API 或库内维护，勿写入 .env 或提交仓库。'
WHERE param_key = 'cos_secret_id';

UPDATE app_parameters SET remark = '腾讯云 COS SecretKey。与 secret_id、region、bucket 配合使用。敏感信息，勿泄露或记录到日志。'
WHERE param_key = 'cos_secret_key';

UPDATE app_parameters SET remark = '腾讯云 COS 地域标识，如 ap-shanghai。须与存储桶所在地域一致。'
WHERE param_key = 'cos_region';

UPDATE app_parameters SET remark = '腾讯云 COS 存储桶名称（Bucket），如 my-bucket-1234567890。'
WHERE param_key = 'cos_bucket';

UPDATE app_parameters SET remark = 'COS 对象键全局前缀（可选），如 filedeal/；不要以 / 开头，系统会自动补尾部斜杠。用户对象实际路径为 {前缀}users/{userId}/...。空表示无前缀。'
WHERE param_key = 'cos_key_prefix';

UPDATE app_parameters SET remark = '单文件上传大小上限（字节）。约束 POST /cos/upload 与 presign-upload 的 maxBytes。默认 20971520（20MB），有效范围 1～1073741824。'
WHERE param_key = 'cos_upload_max_bytes';

UPDATE app_parameters SET remark = '预签名 PUT 上传 URL 有效期（秒）。用于 POST /cos/presign-upload。默认 900，有效范围 60～3600。'
WHERE param_key = 'cos_presign_put_expires_sec';

UPDATE app_parameters SET remark = '预签名 GET 预览 URL 有效期（秒）。用于 POST /cos/presign-get（含 thumb 缩略图）。默认 600，有效范围 60～3600。'
WHERE param_key = 'cos_presign_get_expires_sec';
