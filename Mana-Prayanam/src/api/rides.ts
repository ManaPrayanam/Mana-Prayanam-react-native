import { request } from './client';

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type AvailableRide = { id: string; pickup: string; destination: string; created_at: string };
export type Ride = AvailableRide & { status: RideStatus; driver_id: string | null; vehicle_id: string | null };
export type RideEvent = { status: RideStatus; actor_id: string; created_at: string };

export const listRides = (token: string) => request<Ride[]>('/rides', 'GET', undefined, token);
export const availableRides = (token: string) => request<AvailableRide[]>('/rides/available', 'GET', undefined, token);
export const requestRide = (token: string, pickup: string, destination: string) =>
  request<Ride>('/rides', 'POST', { pickup, destination }, token);
export const acceptRide = (token: string, id: string, vehicleId: string) =>
  request<Ride>(`/rides/${id}/accept`, 'POST', { vehicleId }, token);
export const updateRide = (token: string, id: string, status: 'in_progress' | 'completed' | 'cancelled') =>
  request<Ride>(`/rides/${id}/status`, 'PATCH', { status }, token);
export const rideHistory = (token: string, id: string) =>
  request<RideEvent[]>(`/rides/${id}/history`, 'GET', undefined, token);
