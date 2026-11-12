import { Card, Label, Screen } from '@/components/ridego-ui';

export default function SupportTab() {
  return (
    <Screen title="Support">
      <Card>
        <Label>Need help?</Label>
        <Label muted>Chat and call support will be available here soon.</Label>
        <Label muted>Email: support@manaprayanam.com</Label>
      </Card>
    </Screen>
  );
}
