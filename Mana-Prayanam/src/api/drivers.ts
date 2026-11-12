import { request } from './client';

export const updatePhone = (token: string, phone: string) =>
  request<{ phone: string }>('/drivers/me', 'PATCH', { phone }, token);
