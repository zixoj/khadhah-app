import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    // Not admin — kick out immediately
    if (!profile || !isAdmin) {
      router.replace('/(tabs)');
      return;
    }

    // Admin but must change password — force to change-password screen
    // unless they are already on the change-password screen
    const onChangePassword = segments.includes('change-password');
    if (profile.must_change_password && !onChangePassword) {
      router.replace('/admin/change-password');
    }
  }, [profile, loading, isAdmin, segments]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00C853" size="large" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>غير مصرح بالدخول</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="change-password" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="reports" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="users" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="listings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="conversations" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="couriers" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="logs" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#050B08', justifyContent: 'center', alignItems: 'center' },
  denied: { color: '#FF3B30', fontSize: 18, fontWeight: '700' },
});
