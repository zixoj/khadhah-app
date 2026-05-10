import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile || !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [profile, loading, isAdmin]);

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
