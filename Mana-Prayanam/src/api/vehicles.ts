import { request } from './client';

export type VehicleInput = { registration: string; make: string; model: string; seats: number };
export type Vehicle = VehicleInput & { id: string };
export const listVehicles = (token: string) => request<Vehicle[]>('/vehicles', 'GET', undefined, token);
export const addVehicle = (token: string, input: VehicleInput) => request<Vehicle>('/vehicles', 'POST', input, token);
