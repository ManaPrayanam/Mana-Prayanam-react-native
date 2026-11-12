import { request } from './client';

export type Role = 'rider' | 'driver';
export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  gender?: Gender | null;
  mobile?: string | null;
};
export type Session = { token: string; expiresIn: number; user: User };
export const login = (email: string, password: string) => request<Session>('/auth/login', 'POST', { email, password });
export const register = (name: string, email: string, password: string, role: Role) =>
  request<User>('/auth/register', 'POST', { name, email, password, role });
export const me = (token: string) => request<User>('/auth/me', 'GET', undefined, token);
export const logout = (token: string) => request<void>('/auth/logout', 'POST', undefined, token);

export const checkMobile = (mobile: string) =>
  request<{ exists: boolean }>('/auth/customer/check-mobile', 'POST', { mobile });

export const signupWithMobile = (
  name: string,
  email: string,
  gender: Gender,
  mobile: string,
  otp: string,
) => request<Session>('/auth/customer/signup', 'POST', { name, email, gender, mobile, otp });

export const loginWithMobile = (mobile: string, otp: string) =>
  request<Session>('/auth/customer/login', 'POST', { mobile, otp });
