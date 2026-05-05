import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="post-detail"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="add-post"
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-listings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="favorites" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="wallet" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-ratings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="activity-log" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
