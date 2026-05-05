import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ArrowLeftRight, Gift, Truck, User } from 'lucide-react-native';

export default function TabLayout() {
  const { session, profile, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const isAgent = profile?.role === 'delivery_agent';
  const bottomPad = Platform.OS !== 'web' ? insets.bottom : 10;
  const tabBarHeight = 62 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: isDark ? 1 : 0.5,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 8,
          position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          ...(isDark && {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 20,
          }),
          ...(!isDark && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 8,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ size, color }) => <Home size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exchange"
        options={{
          title: 'بدّل',
          tabBarIcon: ({ size, color }) => <ArrowLeftRight size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="free"
        options={{
          title: 'خذه',
          tabBarIcon: ({ size, color }) => <Gift size={size - 2} color={color} />,
        }}
      />
      {isAgent && (
        <Tabs.Screen
          name="deliveries"
          options={{
            title: 'التوصيل',
            tabBarIcon: ({ size, color }) => <Truck size={size - 2} color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ size, color }) => <User size={size - 2} color={color} />,
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
  },
});
