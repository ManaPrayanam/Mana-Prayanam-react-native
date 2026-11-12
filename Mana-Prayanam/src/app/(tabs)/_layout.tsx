import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { color } from '@/theme/brand';

const ACTIVE = color.ink;
const INACTIVE = '#B8A878';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  focused,
  tint,
  outline,
  filled,
}: {
  focused: boolean;
  tint: string;
  outline: IconName;
  filled: IconName;
}) {
  return <Ionicons name={focused ? filled : outline} size={22} color={tint} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.line,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color: tint }) => (
            <TabIcon focused={focused} tint={String(tint)} outline="home-outline" filled="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Rides',
          tabBarIcon: ({ focused, color: tint }) => (
            <TabIcon focused={focused} tint={String(tint)} outline="car-outline" filled="car" />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused, color: tint }) => (
            <TabIcon focused={focused} tint={String(tint)} outline="wallet-outline" filled="wallet" />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ focused, color: tint }) => (
            <TabIcon focused={focused} tint={String(tint)} outline="headset-outline" filled="headset" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color: tint }) => (
            <TabIcon focused={focused} tint={String(tint)} outline="person-outline" filled="person" />
          ),
        }}
      />
    </Tabs>
  );
}
