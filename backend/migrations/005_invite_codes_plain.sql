ALTER TABLE invite_codes
  ADD COLUMN invite_plain VARCHAR(32) NULL COMMENT '邀请码明文副本，供邀请人在列表中复制分享；注册校验仍以 code_hash 为准；上线前历史行可为 NULL' AFTER code_hash;
