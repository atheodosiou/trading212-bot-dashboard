export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  /**
   * Google OAuth 2.0 Client ID.
   * Create one at https://console.cloud.google.com/apis/credentials
   * and add your localhost origin to "Authorized JavaScript origins".
   */
  googleClientId: '279272754114-akc4uql0cc5hrjj28d70m6eaute3r9gg.apps.googleusercontent.com',
  /**
   * When true, a "Dev mock login" link appears on the sign-in page so you can
   * bypass Google auth during local development.
   * Must be false in production.
   */
  enableMockLogin: true,
} as const;


// https://chatgpt.com/c/6a305eed-13cc-83eb-bc83-61e3bf4101a0 