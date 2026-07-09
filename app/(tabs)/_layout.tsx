import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ArrowLeftRight, Gift, User, MoreHorizontal } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const PRIMARY   = '#22C55E';
const INACTIVE  = 'rgba(255,255,255,0.36)';
const BAR_H     = 76;
const BAR_INSET = 24;

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

function TabIcon({ Icon, label, focused }: { Icon: IconComp; label: string; focused: boolean }) {
  return (
    <View style={ti.wrap}>
      <View style={focused ? ti.bubbleOn : ti.bubbleOff}>
        <Icon size={20} color={focused ? PRIMARY : INACTIVE} strokeWidth={focused ? 2.2 : 1.5} />
      </View>
      {focused && <View style={ti.indicator} />}
      <Text style={[ti.label, { color: focused ? PRIMARY : INACTIVE }]}>{label}</Text>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:      { alignItems: 'center', gap: 1, paddingVertical: 1 },
  bubbleOn:  {
    width: 44, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(34,197,94,0.14)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.60, shadowRadius: 8,
  },
  bubbleOff: { width: 44, height: 34, justifyContent: 'center', alignItems: 'center' },
  indicator: {
    width: 16, height: 2.5, borderRadius: 1.5,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1 },
});

export default function TabLayout() {
  const { session, loading, isGuest } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!session && !isGuest) {
    return <Redirect href="/(auth)/login" />;
  }

  const safeBot = Platform.OS !== 'web' ? Math.max(insets.bottom, 6) : 0;
  const barBot  = Platform.OS === 'web' ? BAR_INSET : safeBot + 14;

  return (
    <Tabs
      screenOptions={{
        headerShown:      false,
        tabBarShowLabel:  false,
        tabBarActiveTintColor:   PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(7,13,9,0.94)' }]} />
          ),
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(7,13,9,0.94)',
          borderTopWidth: 0,
          height: BAR_H,
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          bottom:  barBot,
          left:    BAR_INSET,
          right:   BAR_INSET,
          borderRadius: 34,
          borderWidth: 1,
          borderColor: 'rgba(34,197,94,0.15)',
          paddingTop: 4,
          paddingBottom: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.60,
          shadowRadius: 30,
          elevation: 24,
          overflow: Platform.OS === 'ios' ? 'hidden' : undefined,
        },
        tabBarItemStyle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={Home} label="الرئيسية" focused={focused} /> }}
      />
      <Tabs.Screen
        name="exchange"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={ArrowLeftRight} label="بدّل" focused={focused} /> }}
      />
      <Tabs.Screen
        name="free"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={Gift} label="خذها" focused={focused} /> }}
      />
      <Tabs.Screen name="deliveries" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={User} label="حسابي" focused={focused} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={MoreHorizontal} label="المزيد" focused={focused} /> }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
});
