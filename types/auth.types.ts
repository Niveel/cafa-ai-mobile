export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  subscriptionTier?: 'free' | 'cafa_smart' | 'cafa_pro' | 'cafa_max';
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type SignupRequest = {
  username: string;
  name: string;
  email: string;
  password: string;
};

export type VerifyOtpRequest = {
  email: string;
  otp: string;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};
