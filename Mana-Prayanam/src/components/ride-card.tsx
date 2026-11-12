import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { AvailableRide, RideStatus } from '@/api/rides';
import { Card, Label } from './ridego-ui';
import { color, radius, spacing } from '@/theme/brand';

export const statusLabel: Record<RideStatus, string> = {
  requested: 'Requested', accepted: 'Accepted', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};

export function RideCard({ ride, status, children }: {
  ride: AvailableRide; status?: RideStatus; children?: ReactNode;
}) {
  return <Card>
    {status && <Text style={[styles.badge, status === 'requested' && styles.pending,
      status === 'cancelled' && styles.cancelled]}>{statusLabel[status]}</Text>}
    <Label>From · {ride.pickup}</Label>
    <Label>To · {ride.destination}</Label>
    <Label muted>{new Date(ride.created_at).toLocaleString()}</Label>
    {children}
  </Card>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', color: color.brand, backgroundColor: color.tint,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontWeight: '700' },
  pending: { color: color.amber, backgroundColor: color.amberTint },
  cancelled: { color: color.danger, backgroundColor: color.dangerTint },
});
