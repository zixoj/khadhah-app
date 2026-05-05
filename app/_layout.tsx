import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

function AppStack() {
  const { isDark } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="add-post" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="conversations" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-listings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="favorites" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-ratings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="activity-log" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
