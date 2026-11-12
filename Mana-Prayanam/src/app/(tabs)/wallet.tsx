import { Card, Label, Screen } from '@/components/ridego-ui';

export default function WalletTab() {
  return (
    <Screen title="Wallet">
      <Card>
        <Label>Wallet balance</Label>
        <Label muted>₹0.00</Label>
        <Label muted>Payments and ride credits will show up here.</Label>
      </Card>
    </Screen>
  );
}
