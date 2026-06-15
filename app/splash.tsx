import { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('screen');

const FADE_IN_MS  = 600;
const HOLD_MS     = 3800;
const FADE_OUT_MS = 600;

export default function SplashScreen() {
  const router = useRouter();
  const opacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    const navigate = () => router.replace('/(auth)/login');

    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }, () => {
      opacity.value = withTiming(
        opacity.value,
        { duration: HOLD_MS },
        () => {
          opacity.value = withTiming(
            0,
            { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
            () => { runOnJS(navigate)(); }
          );
        }
      );
    });
  }, []);

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Animated.Image
        source={require('../assets/images/WhatsApp_Image_2026-06-15_at_5.44.16_AM.jpeg')}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
