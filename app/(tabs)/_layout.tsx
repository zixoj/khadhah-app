import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ArrowLeftRight, Gift, User, MoreHorizontal } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { ActivityIndicator } from 'react-native';

const PRIMARY = '#22C55E';
const INACTIVE = '#6B7280';
const TAB_BG = 'rgba(10,14,11,0.88)';

function TabIcon({
  Icon,
  focused,
  color,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={tabIconStyles.wrap}>
      <View style={focused ? tabIconStyles.glowWrap : undefined}>
        <Icon
          size={22}
          color={focused ? PRIMARY : INACTIVE}
          strokeWidth={focused ? 2.2 : 1.6}
        />
      </View>
      <View style={[tabIconStyles.indicator, focused && tabIconStyles.indicatorActive]} />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 2,
  },
  glowWrap: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
  },
  indicator: {
    width: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: PRIMARY,
  },
  indicatorActive: {
    width: 16,
  },
});

export default function TabLayout() {
  const { session, loading, isGuest } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!session && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  const bottomPad = Platform.OS !== 'web' ? insets.bottom : 0;
  const barBottom = Platform.OS === 'web' ? 20 : bottomPad + 14;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: TAB_BG }]} />
          ),
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : TAB_BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 60,
          position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
          bottom: barBottom,
          left: 24,
          right: 24,
          borderRadius: 34,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
          elevation: 20,
          overflow: Platform.OS === 'ios' ? 'hidden' : undefined,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Home} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exchange"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={ArrowLeftRight} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="free"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Gift} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={User} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={MoreHorizontal} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050505',
  },
});
