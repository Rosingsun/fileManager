CREATE TABLE IF NOT EXISTS invite_codes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  inviter_user_id CHAR(36) NOT NULL,
  note VARCHAR(255) NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  revoked_at BIGINT NULL,
  UNIQUE KEY uq_invite_code_hash (code_hash),
  KEY idx_invite_inviter (inviter_user_id),
  CONSTRAINT fk_invite_inviter FOREIGN KEY (inviter_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invite_redemptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  invite_code_id CHAR(36) NOT NULL,
  inviter_user_id CHAR(36) NOT NULL,
  invitee_user_id CHAR(36) NOT NULL,
  invitee_email_snapshot VARCHAR(255) NOT NULL,
  redeemed_at BIGINT NOT NULL,
  UNIQUE KEY uq_redemption_invitee (invitee_user_id),
  KEY idx_redemption_inviter (inviter_user_id),
  KEY idx_redemption_code (invite_code_id),
  CONSTRAINT fk_redemption_code FOREIGN KEY (invite_code_id) REFERENCES invite_codes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_redemption_inviter FOREIGN KEY (inviter_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_redemption_invitee FOREIGN KEY (invitee_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
