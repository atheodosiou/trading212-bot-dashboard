export const environment = {
  production: true,
  /** Set via CI/CD or server environment config. Leave as empty string for same-origin deployment. */
  apiBaseUrl: '',
  /** Set via CI/CD or runtime injection — never hard-code the client ID in source control. */
  googleClientId: '',
  enableMockLogin: false,
} as const;
