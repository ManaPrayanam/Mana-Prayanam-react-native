import { Platform } from 'react-native';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
const localHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const base = (configured || `http://${localHost}:3000/api`).replace(/\/$/, '');

export async function request<T>(path: string, method = 'GET', body?: object, token?: string): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    response = await fetch(base + path, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach Mana Prayanam. Check that the API is running and reachable from this device.');
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? 'The API request failed.');
  if (data === null) throw new Error('The API returned an invalid response.');
  return data;
}
