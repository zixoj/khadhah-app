import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

const SPLASH_IMAGE = require('../assets/images/WhatsApp_Image_2026-06-15_at_5.44.16_AM.jpeg');

const FADE_IN_MS = 600;
const HOLD_MS = 3800;
const FADE_OUT_MS = 600;

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('screen');

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View
      style={[
        styles.splash,
        {
          opacity,
          width,
          height,
        },
      ]}
    >
      <Image
        source={SPLASH_IMAGE}
        style={{ width, height }}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

function AppStack() {
  const { isDark } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="splash" options={{ animation: 'none' }} />
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
        <Stack.Screen name="admin" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="user-profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" hidden />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <View style={styles.root}>
          <AppStack />
          {!splashDone && (
            <SplashOverlay onDone={() => setSplashDone(true)} />
          )}
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 9999,
    elevation: 9999,
  },
});
