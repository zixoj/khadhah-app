import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Neon green palette (always dark on this screen)
const G = {
  bg: '#050B08',
  surface: '#0D1410',
  card: 'rgba(17,23,20,0.85)',
  primary: '#00C853',
  primaryBright: '#00E676',
  primaryGlow: 'rgba(0,200,83,0.30)',
  primaryGlowSoft: 'rgba(0,200,83,0.10)',
  border: 'rgba(0,200,83,0.18)',
  borderFocus: 'rgba(0,200,83,0.65)',
  inputBg: 'rgba(255,255,255,0.04)',
  text: '#FFFFFF',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.30)',
  error: '#FF4444',
  errorBg: 'rgba(255,68,68,0.10)',
};

// Fixed positions for background particles so they don't re-randomize
const PARTICLES = [
  { x: 0.08, y: 0.12, size: 2.5, opacity: 0.5, dur: 3200 },
  { x: 0.22, y: 0.28, size: 1.5, opacity: 0.35, dur: 4100 },
  { x: 0.65, y: 0.08, size: 3, opacity: 0.45, dur: 3700 },
  { x: 0.80, y: 0.22, size: 2, opacity: 0.40, dur: 5000 },
  { x: 0.45, y: 0.18, size: 1.8, opacity: 0.30, dur: 3500 },
  { x: 0.90, y: 0.45, size: 2.2, opacity: 0.50, dur: 4400 },
  { x: 0.15, y: 0.55, size: 1.5, opacity: 0.25, dur: 3900 },
  { x: 0.70, y: 0.62, size: 2.8, opacity: 0.35, dur: 4600 },
  { x: 0.35, y: 0.72, size: 1.8, opacity: 0.28, dur: 3300 },
  { x: 0.55, y: 0.85, size: 2, opacity: 0.20, dur: 5200 },
  { x: 0.05, y: 0.80, size: 1.5, opacity: 0.22, dur: 4000 },
  { x: 0.92, y: 0.78, size: 2.5, opacity: 0.32, dur: 3600 },
];

function Particle({ x, y, size, opacity, dur }: typeof PARTICLES[0]) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dur, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const op = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [opacity * 0.4, opacity, opacity * 0.4] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * SW,
        top: y * SH,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: G.primary,
        opacity: op,
        transform: [{ translateY }],
        shadowColor: G.primary,
        shadowOpacity: 0.9,
        shadowRadius: size * 3,
        elevation: 0,
      }}
    />
  );
}

// SVG-style city skyline drawn with Views
function CitySkyline() {
  const buildings = [
    { x: 0, w: 38, h: 70 },
    { x: 42, w: 26, h: 50 },
    { x: 72, w: 32, h: 95 },
    { x: 108, w: 24, h: 60 },
    { x: 136, w: 44, h: 120 },
    { x: 184, w: 28, h: 80 },
    { x: 216, w: 22, h: 55 },
    { x: 242, w: 36, h: 105 },
    { x: 282, w: 30, h: 70 },
    { x: 316, w: 20, h: 45 },
    { x: 340, w: 42, h: 90 },
    { x: 386, w: 26, h: 65 },
    // right side
    { x: SW - 38, w: 38, h: 75 },
    { x: SW - 74, w: 30, h: 50 },
    { x: SW - 116, w: 36, h: 100 },
    { x: SW - 158, w: 24, h: 60 },
  ];

  return (
    <View pointerEvents="none" style={styles.skylineContainer}>
      {/* Horizontal neon glow line */}
      <View style={styles.horizLine} />
      <View style={styles.horizLineGlow} />
      {buildings.map((b, i) => (
        <View
          key={i}
          style={[
            styles.building,
            {
              left: b.x,
              width: b.w,
              height: b.h,
              bottom: 12,
            },
          ]}
        >
          {/* Antenna on taller buildings */}
          {b.h > 85 && (
            <View style={[styles.antenna, { left: b.w / 2 - 1 }]} />
          )}
          {/* Window grid */}
          {Array.from({ length: Math.floor(b.h / 14) }).map((_, wi) => (
            <View key={wi} style={[styles.windowRow, { bottom: 8 + wi * 14 }]}>
              {Array.from({ length: Math.floor(b.w / 10) }).map((_, wj) => (
                <View
                  key={wj}
                  style={[
                    styles.window,
                    {
                      opacity: Math.random() > 0.45 ? 0.7 : 0.12,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  // Entry animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(logoAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  };

  const glowScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.60] });

  return (
    <View style={styles.root}>
      {/* Background particles */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      {/* Ambient top glow */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ambientGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />
      <View pointerEvents="none" style={styles.ambientGlow2} />

      {/* City skyline at bottom */}
      <CitySkyline />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo section ── */}
          <Animated.View
            style={[
              styles.logoSection,
              {
                opacity: logoAnim,
                transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }) }],
              },
            ]}
          >
            {/* Outer glow ring */}
            <View style={styles.logoGlowRing} />
            <View style={styles.logoGlowRing2} />
            {/* Logo card */}
            <View style={styles.logoCard}>
              <View style={styles.logoIconOuter}>
                <View style={styles.logoIconInner}>
                  {/* Custom icon: two arrows + gift hint */}
                  <View style={styles.logoSymbol}>
                    <View style={styles.logoArrowLeft} />
                    <View style={styles.logoArrowRight} />
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.appName}>خذه</Text>
            <View style={styles.appNameUnderline} />
            <Text style={styles.tagline}>بدّل أو اعطِ بكل سهولة</Text>
          </Animated.View>

          {/* ── Glass card (form) ── */}
          <Animated.View
            style={[
              styles.glassCard,
              {
                opacity: formAnim,
                transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocus]}>
              <TextInput
                style={styles.input}
                placeholder="البريد الإلكتروني"
                placeholderTextColor={G.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              <View style={[styles.inputIcon, emailFocused && styles.inputIconActive]}>
                <Mail size={17} color={emailFocused ? G.primary : G.textMuted} />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.inputWrap, passFocused && styles.inputWrapFocus]}>
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                {showPass
                  ? <EyeOff size={17} color={G.textMuted} />
                  : <Eye size={17} color={G.textMuted} />
                }
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { paddingLeft: 0 }]}
                placeholder="كلمة المرور"
                placeholderTextColor={G.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                secureTextEntry={!showPass}
                textAlign="right"
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <View style={[styles.inputIcon, passFocused && styles.inputIconActive]}>
                <Lock size={17} color={passFocused ? G.primary : G.textMuted} />
              </View>
            </View>
          </Animated.View>

          {/* ── Buttons ── */}
          <Animated.View
            style={[
              styles.btnSection,
              {
                opacity: btnAnim,
                transform: [{ translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            {/* Primary: login */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.82}
            >
              <View style={styles.primaryBtnGlow} />
              <Text style={styles.primaryBtnText}>
                {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Secondary: register */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryBtnText}>إنشاء حساب جديد</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: G.bg,
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 24,
  },

  // ── Ambient background ──
  ambientGlow: {
    position: 'absolute',
    top: -SW * 0.4,
    alignSelf: 'center',
    width: SW * 1.1,
    height: SW * 1.1,
    borderRadius: SW * 0.55,
    backgroundColor: G.primaryGlow,
    // blur would be ideal but not available in RN — use large shadowRadius via elevation:0 trick
  },
  ambientGlow2: {
    position: 'absolute',
    top: SH * 0.3,
    left: -SW * 0.25,
    width: SW * 0.8,
    height: SW * 0.8,
    borderRadius: SW * 0.4,
    backgroundColor: 'rgba(0,100,40,0.08)',
    pointerEvents: 'none',
  },

  // ── Skyline ──
  skylineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  horizLine: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: G.primary,
    opacity: 0.5,
  },
  horizLineGlow: {
    position: 'absolute',
    bottom: 7,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: G.primaryGlow,
  },
  building: {
    position: 'absolute',
    backgroundColor: '#0A0F0C',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,200,83,0.25)',
    overflow: 'hidden',
  },
  antenna: {
    position: 'absolute',
    top: -10,
    width: 2,
    height: 12,
    backgroundColor: G.primary,
    opacity: 0.7,
  },
  windowRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 3,
    left: 4,
    right: 4,
  },
  window: {
    width: 5,
    height: 6,
    backgroundColor: G.primary,
    borderRadius: 1,
  },

  // ── Logo ──
  logoSection: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },
  logoGlowRing: {
    position: 'absolute',
    top: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,200,83,0.07)',
  },
  logoGlowRing2: {
    position: 'absolute',
    top: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,200,83,0.12)',
  },
  logoCard: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(0,200,83,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,200,83,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: G.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 0,
  },
  logoIconOuter: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(0,200,83,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,83,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconInner: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: G.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: G.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  logoSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  logoArrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#000',
  },
  logoArrowRight: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#000',
  },
  appName: {
    fontSize: 48,
    fontWeight: '900',
    color: G.text,
    letterSpacing: -1.5,
    marginTop: 4,
  },
  appNameUnderline: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: G.primary,
    shadowColor: G.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    marginTop: -4,
  },
  tagline: {
    fontSize: 14,
    color: G.textSub,
    letterSpacing: 0.3,
    marginTop: 4,
  },

  // ── Glass card ──
  glassCard: {
    backgroundColor: G.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: G.border,
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },

  errorBox: {
    backgroundColor: G.errorBg,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    color: G.error,
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: G.inputBg,
    borderWidth: 1.5,
    borderColor: G.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    gap: 10,
    minHeight: 54,
  },
  inputWrapFocus: {
    borderColor: G.borderFocus,
    backgroundColor: 'rgba(0,200,83,0.04)',
    shadowColor: G.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  inputIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIconActive: {
    backgroundColor: 'rgba(0,200,83,0.10)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: G.text,
    paddingVertical: 12,
    textAlign: 'right',
  },
  eyeBtn: {
    padding: 6,
  },

  // ── Buttons ──
  btnSection: { gap: 14 },

  primaryBtn: {
    height: 58,
    borderRadius: 20,
    backgroundColor: G.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: G.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryBtnGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: G.border,
  },
  dividerText: {
    color: G.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },

  secondaryBtn: {
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: G.text,
    letterSpacing: 0.2,
  },
});
