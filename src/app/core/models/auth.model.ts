export interface User {
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
  roles?: string[];
}

/** Response from POST /auth/google */
export interface AuthResponse {
  accessToken: string;
  user: User;
}
