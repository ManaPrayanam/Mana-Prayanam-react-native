import type { MapCoords } from '@/api/geocode';

/** Shared draft between home, destination, map pick, and quote screens. */

type Listener = () => void;

export type RideVehicle = 'bike' | 'auto';

export type RideDraft = {
  pickupLabel: string;
  dropLabel: string;
  pickup: MapCoords | null;
  drop: MapCoords | null;
  vehicle: RideVehicle;
};

let draft: RideDraft = {
  pickupLabel: '',
  dropLabel: '',
  pickup: null,
  drop: null,
  vehicle: 'bike',
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listen) => listen());
}

export function getRideDraft(): RideDraft {
  return { ...draft };
}

/** @deprecated prefer getRideDraft().dropLabel */
export function getRideDestination() {
  return draft.dropLabel;
}

export function setRideDestination(value: string) {
  draft = { ...draft, dropLabel: value.trim() };
  emit();
}

export function setRideDraft(next: Partial<RideDraft>) {
  draft = {
    pickupLabel: next.pickupLabel !== undefined ? next.pickupLabel.trim() : draft.pickupLabel,
    dropLabel: next.dropLabel !== undefined ? next.dropLabel.trim() : draft.dropLabel,
    pickup: next.pickup !== undefined ? next.pickup : draft.pickup,
    drop: next.drop !== undefined ? next.drop : draft.drop,
    vehicle: next.vehicle !== undefined ? next.vehicle : draft.vehicle,
  };
  emit();
}

export function clearRideDraft() {
  draft = {
    pickupLabel: '',
    dropLabel: '',
    pickup: null,
    drop: null,
    vehicle: draft.vehicle,
  };
  emit();
}

export function subscribeRideDestination(listen: Listener) {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}
