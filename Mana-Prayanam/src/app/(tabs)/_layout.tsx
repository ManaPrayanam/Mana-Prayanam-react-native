import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_GREEN = '#159447';
const ICON = '#FFFFFF';
const ICON_MUTED = 'rgba(255,255,255,0.72)';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  focused,
  outline,
  filled,
}: {
  focused: boolean;
  outline: IconName;
  filled: IconName;
}) {
  return (
    <Ionicons
      name={focused ? filled : outline}
      size={24}
      color={focused ? ICON : ICON_MUTED}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Lift labels above home-indicator / system nav line
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8) + 6;
  const tabBarHeight = 52 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ICON,
        tabBarInactiveTintColor: ICON_MUTED,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarStyle: {
          backgroundColor: NAV_GREEN,
          borderTopColor: NAV_GREEN,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomPad,
        },
        // Keep tab bar mounted — hiding it on keyboard changes the home
        // scene height and makes the gorhom sheet remeasure/bounce.
        tabBarHideOnKeyboard: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="home-outline" filled="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Rides',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="car-outline" filled="car" />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="wallet-outline" filled="wallet" />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="headset-outline" filled="headset" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="person-outline" filled="person" />
          ),
        }}
      />
    </Tabs>
  );
}
