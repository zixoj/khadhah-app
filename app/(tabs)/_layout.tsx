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
  const tabBarHeight = 64 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: isDark ? '#080E0B' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(0,200,83,0.18)' : '#E5E7EB',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 10,
          position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          shadowColor: isDark ? '#000' : '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.6 : 0.06,
          shadowRadius: isDark ? 20 : 10,
          elevation: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ size, color }) => <Home size={size - 2} color={color} strokeWidth={color === colors.primary ? 2.5 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="exchange"
        options={{
          title: 'بدّل',
          tabBarIcon: ({ size, color }) => <ArrowLeftRight size={size - 2} color={color} strokeWidth={color === colors.primary ? 2.5 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="free"
        options={{
          title: 'خذه',
          tabBarIcon: ({ size, color }) => <Gift size={size - 2} color={color} strokeWidth={color === colors.primary ? 2.5 : 1.8} />,
        }}
      />
      {isAgent && (
        <Tabs.Screen
          name="deliveries"
          options={{
            title: 'التوصيل',
            tabBarIcon: ({ size, color }) => <Truck size={size - 2} color={color} strokeWidth={color === colors.primary ? 2.5 : 1.8} />,
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ size, color }) => <User size={size - 2} color={color} strokeWidth={color === colors.primary ? 2.5 : 1.8} />,
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
