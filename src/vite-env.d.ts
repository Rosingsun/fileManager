/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_BASE_URL?: string
  /** 忘记密码页完整 URL，可选；配置后在登录页打开外链 */
  readonly VITE_PASSWORD_RESET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
