import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/lib/theme';
import { Home, ArrowLeftRight, Gift, Truck, User } from 'lucide-react-native';

export default function TabLayout() {
  const { session, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const isAgent = profile?.role === 'delivery_agent';
  const bottomPad = Platform.OS !== 'web' ? insets.bottom : 10;
  const tabBarHeight = 56 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary[600],
        tabBarInactiveTintColor: Colors.neutral[400],
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          // Force fixed position on web
          position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 1,
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
    backgroundColor: Colors.white,
  },
});
