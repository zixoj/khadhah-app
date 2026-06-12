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

const G = {
  bg: '#050B08',
  card: 'rgba(17,23,20,0.85)',
  primary: '#00C853',
  primaryGlow: 'rgba(0,200,83,0.30)',
  border: 'rgba(0,200,83,0.18)',
  borderFocus: 'rgba(0,200,83,0.65)',
  inputBg: 'rgba(255,255,255,0.04)',
  text: '#FFFFFF',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.30)',
  error: '#FF4444',
  errorBg: 'rgba(255,68,68,0.10)',
};

// Fixed particle positions
const PARTICLES = [
  { x: 0.08, y: 0.10, size: 2.5, opacity: 0.50, dur: 3200 },
  { x: 0.22, y: 0.25, size: 1.5, opacity: 0.35, dur: 4100 },
  { x: 0.65, y: 0.07, size: 3.0, opacity: 0.45, dur: 3700 },
  { x: 0.80, y: 0.20, size: 2.0, opacity: 0.40, dur: 5000 },
  { x: 0.45, y: 0.16, size: 1.8, opacity: 0.30, dur: 3500 },
  { x: 0.90, y: 0.42, size: 2.2, opacity: 0.50, dur: 4400 },
  { x: 0.15, y: 0.52, size: 1.5, opacity: 0.25, dur: 3900 },
  { x: 0.70, y: 0.60, size: 2.8, opacity: 0.35, dur: 4600 },
  { x: 0.35, y: 0.70, size: 1.8, opacity: 0.28, dur: 3300 },
  { x: 0.05, y: 0.78, size: 1.5, opacity: 0.22, dur: 4000 },
  { x: 0.92, y: 0.75, size: 2.5, opacity: 0.32, dur: 3600 },
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

/*
  Saudi Skyline — landmarks left→right:
  1. Small Riyadh towers (far left fill)
  2. Al Faisaliah Tower — conical needle top, tapered body
  3. Generic Riyadh mid-rise cluster
  4. Kingdom Centre Tower — iconic open arch bridge at top, twin legs
  5. Makkah Clock Tower — broad base, clock face tier, tall spire
  6. Palm trees (2×)
  7. Right-side Riyadh infill towers
  All drawn with View rectangles, triangles (border trick), and thin lines.
*/
function SaudiSkyline() {
  const BASE = 14; // ground line y from bottom of container

  // Helper: a simple rectangular building
  const Bld = ({
    left, w, h, borderColor = 'rgba(0,200,83,0.35)',
    children,
  }: {
    left: number; w: number; h: number;
    borderColor?: string; children?: React.ReactNode;
  }) => (
    <View
      style={{
        position: 'absolute',
        left,
        bottom: BASE,
        width: w,
        height: h,
        backgroundColor: '#050B08',
        borderTopWidth: 1.2,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );

  // Helper: window row
  const WinRow = ({ bottom, cols, w: bw }: { bottom: number; cols: number; w: number }) => (
    <View style={{ position: 'absolute', bottom, left: 3, right: 3, flexDirection: 'row', justifyContent: 'space-around' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <View key={i} style={{ width: Math.max(2, (bw - 6) / cols - 2), height: 4, backgroundColor: G.primary, opacity: 0.35, borderRadius: 1 }} />
      ))}
    </View>
  );

  // ── 1. Left infill small towers ──────────────────────────────
  const leftTowers = [
    { left: 0,  w: 20, h: 45 },
    { left: 24, w: 14, h: 32 },
    { left: 42, w: 18, h: 55 },
    { left: 64, w: 12, h: 28 },
  ];

  // ── 2. Al Faisaliah Tower (tapered body + needle) ─────────────
  // Iconic: wide rectangular base that narrows near the top with a gold ball + needle
  // We approximate with a trapezoid using nested views
  const FAIS_L = 90;
  const FAIS_W = 30;
  const FAIS_H = 110;

  // ── 3. Mid cluster ────────────────────────────────────────────
  const midTowers = [
    { left: 128, w: 16, h: 48 },
    { left: 148, w: 22, h: 65 },
    { left: 174, w: 14, h: 38 },
  ];

  // ── 4. Kingdom Centre Tower ───────────────────────────────────
  // Two tall legs with a sky bridge arch between them at the top third
  const KCL = Math.round(SW / 2) - 28;
  const KC_W_TOTAL = 56;
  const KC_LEG_W = 14;
  const KC_H = 145;
  const KC_BRIDGE_Y = 95; // from bottom of tower
  const KC_BRIDGE_H = 14;

  // ── 5. Makkah Clock Tower ────────────────────────────────────
  // Broad stepped base → hotel tower body → clock tier → spire
  const MCK_L = Math.round(SW / 2) + 48;
  const MCK_BASE_W = 52;
  const MCK_MID_W = 38;
  const MCK_TOP_W = 22;
  const MCK_BASE_H = 30;
  const MCK_MID_H = 80;
  const MCK_TOP_H = 30;
  const MCK_SPIRE_H = 28;

  // ── 6. Palm trees ─────────────────────────────────────────────
  const PALM1_L = MCK_L + MCK_BASE_W + 10;
  const PALM2_L = PALM1_L + 22;

  // ── 7. Right infill ───────────────────────────────────────────
  const rightTowers = [
    { left: PALM2_L + 18, w: 18, h: 52 },
    { left: PALM2_L + 40, w: 26, h: 70 },
    { left: PALM2_L + 70, w: 14, h: 38 },
    { left: PALM2_L + 88, w: 20, h: 55 },
    { left: SW - 24, w: 24, h: 44 },
  ];

  return (
    <View pointerEvents="none" style={styles.skylineContainer}>

      {/* Ground glow line */}
      <View style={styles.groundLine} />
      <View style={styles.groundGlow} />

      {/* ── Left infill ── */}
      {leftTowers.map((t, i) => (
        <Bld key={`lt${i}`} left={t.left} w={t.w} h={t.h}>
          <WinRow bottom={6} cols={2} w={t.w} />
          <WinRow bottom={16} cols={2} w={t.w} />
          <WinRow bottom={26} cols={2} w={t.w} />
        </Bld>
      ))}

      {/* ── Al Faisaliah Tower ── */}
      {/* Body — tapered using a wider bottom layer + narrower top */}
      <Bld left={FAIS_L + 4} w={FAIS_W - 8} h={FAIS_H}>
        {[10, 24, 38, 52, 66, 80].map((b, i) => (
          <WinRow key={i} bottom={b} cols={2} w={FAIS_W - 8} />
        ))}
      </Bld>
      {/* Wide base skirt */}
      <Bld left={FAIS_L} w={FAIS_W} h={24} />
      {/* Narrower upper shaft */}
      <Bld left={FAIS_L + 8} w={FAIS_W - 16} h={FAIS_H - 60} />
      {/* Gold ball tier (circle approximation) */}
      <View style={{
        position: 'absolute',
        left: FAIS_L + FAIS_W / 2 - 6,
        bottom: BASE + FAIS_H,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#050B08',
        borderWidth: 1.5, borderColor: G.primary,
        shadowColor: G.primary, shadowOpacity: 0.8, shadowRadius: 6,
      }} />
      {/* Needle */}
      <View style={{
        position: 'absolute',
        left: FAIS_L + FAIS_W / 2 - 0.75,
        bottom: BASE + FAIS_H + 12,
        width: 1.5, height: 18,
        backgroundColor: G.primary, opacity: 0.8,
      }} />

      {/* ── Mid cluster ── */}
      {midTowers.map((t, i) => (
        <Bld key={`mt${i}`} left={t.left} w={t.w} h={t.h}>
          <WinRow bottom={6} cols={2} w={t.w} />
          <WinRow bottom={18} cols={2} w={t.w} />
          <WinRow bottom={30} cols={2} w={t.w} />
        </Bld>
      ))}

      {/* ── Kingdom Centre Tower ── */}
      {/* Left leg */}
      <View style={{
        position: 'absolute', left: KCL, bottom: BASE,
        width: KC_LEG_W, height: KC_H,
        backgroundColor: '#050B08',
        borderTopWidth: 1.2, borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(0,200,83,0.55)',
      }}>
        {[8, 22, 36, 50, 64, 78].map((b, i) => (
          <View key={i} style={{ position: 'absolute', bottom: b, left: 2, right: 2, height: 3, backgroundColor: G.primary, opacity: 0.25, borderRadius: 1 }} />
        ))}
      </View>
      {/* Right leg */}
      <View style={{
        position: 'absolute', left: KCL + KC_W_TOTAL - KC_LEG_W, bottom: BASE,
        width: KC_LEG_W, height: KC_H,
        backgroundColor: '#050B08',
        borderTopWidth: 1.2, borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(0,200,83,0.55)',
      }}>
        {[8, 22, 36, 50, 64, 78].map((b, i) => (
          <View key={i} style={{ position: 'absolute', bottom: b, left: 2, right: 2, height: 3, backgroundColor: G.primary, opacity: 0.25, borderRadius: 1 }} />
        ))}
      </View>
      {/* Sky bridge */}
      <View style={{
        position: 'absolute',
        left: KCL,
        bottom: BASE + KC_BRIDGE_Y,
        width: KC_W_TOTAL,
        height: KC_BRIDGE_H,
        backgroundColor: '#050B08',
        borderWidth: 1.2,
        borderColor: 'rgba(0,200,83,0.65)',
        shadowColor: G.primary, shadowOpacity: 0.4, shadowRadius: 6,
      }} />
      {/* Arch cutout illusion — inner dark rectangle */}
      <View style={{
        position: 'absolute',
        left: KCL + KC_LEG_W,
        bottom: BASE + KC_BRIDGE_Y + KC_BRIDGE_H,
        width: KC_W_TOTAL - KC_LEG_W * 2,
        height: KC_H - KC_BRIDGE_Y - KC_BRIDGE_H + 2,
        backgroundColor: '#050B08',
      }} />
      {/* Kingdom Centre glow label line */}
      <View style={{
        position: 'absolute',
        left: KCL + KC_W_TOTAL / 2 - 1,
        bottom: BASE + KC_H,
        width: 2, height: 10,
        backgroundColor: G.primary, opacity: 0.6,
      }} />

      {/* ── Makkah Clock Tower ── */}
      {/* Base plinth */}
      <View style={{
        position: 'absolute', left: MCK_L, bottom: BASE,
        width: MCK_BASE_W, height: MCK_BASE_H,
        backgroundColor: '#050B08',
        borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(0,200,83,0.35)',
      }} />
      {/* Hotel tower body */}
      <View style={{
        position: 'absolute',
        left: MCK_L + (MCK_BASE_W - MCK_MID_W) / 2,
        bottom: BASE + MCK_BASE_H,
        width: MCK_MID_W, height: MCK_MID_H,
        backgroundColor: '#050B08',
        borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(0,200,83,0.40)',
        overflow: 'hidden',
      }}>
        {[8, 20, 32, 44, 56, 68].map((b, i) => (
          <WinRow key={i} bottom={b} cols={3} w={MCK_MID_W} />
        ))}
      </View>
      {/* Clock tier */}
      <View style={{
        position: 'absolute',
        left: MCK_L + (MCK_BASE_W - MCK_TOP_W) / 2,
        bottom: BASE + MCK_BASE_H + MCK_MID_H,
        width: MCK_TOP_W, height: MCK_TOP_H,
        backgroundColor: '#050B08',
        borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(0,200,83,0.55)',
      }}>
        {/* Clock face circle */}
        <View style={{
          position: 'absolute',
          top: 4, alignSelf: 'center',
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: '#050B08',
          borderWidth: 1.5, borderColor: G.primary,
          shadowColor: G.primary, shadowOpacity: 0.7, shadowRadius: 5,
        }} />
      </View>
      {/* Spire */}
      <View style={{
        position: 'absolute',
        left: MCK_L + MCK_BASE_W / 2 - 1,
        bottom: BASE + MCK_BASE_H + MCK_MID_H + MCK_TOP_H,
        width: 2, height: MCK_SPIRE_H,
        backgroundColor: G.primary, opacity: 0.75,
        shadowColor: G.primary, shadowOpacity: 0.9, shadowRadius: 6,
      }} />
      {/* Crescent on spire tip */}
      <View style={{
        position: 'absolute',
        left: MCK_L + MCK_BASE_W / 2 - 5,
        bottom: BASE + MCK_BASE_H + MCK_MID_H + MCK_TOP_H + MCK_SPIRE_H,
        width: 10, height: 10,
        borderTopLeftRadius: 5, borderTopRightRadius: 5,
        borderWidth: 1.5, borderBottomWidth: 0,
        borderColor: G.primary,
        opacity: 0.85,
      }} />

      {/* ── Palm trees ── */}
      {[PALM1_L, PALM2_L].map((pl, pi) => (
        <View key={`palm${pi}`}>
          {/* Trunk */}
          <View style={{
            position: 'absolute', left: pl + 3, bottom: BASE,
            width: 2.5, height: 28,
            backgroundColor: G.primary, opacity: 0.45,
            borderRadius: 1,
          }} />
          {/* Fronds — 5 lines fanning out */}
          {[
            { angle: -40, len: 14 },
            { angle: -20, len: 16 },
            { angle:   0, len: 17 },
            { angle:  20, len: 16 },
            { angle:  40, len: 14 },
          ].map((f, fi) => (
            <View key={fi} style={{
              position: 'absolute',
              left: pl + 4,
              bottom: BASE + 26,
              width: f.len,
              height: 1.5,
              backgroundColor: G.primary,
              opacity: 0.40,
              borderRadius: 1,
              transformOrigin: 'left center',
              transform: [{ rotate: `${f.angle}deg` }],
            }} />
          ))}
        </View>
      ))}

      {/* ── Right infill ── */}
      {rightTowers.filter(t => t.left + t.w <= SW).map((t, i) => (
        <Bld key={`rt${i}`} left={t.left} w={t.w} h={t.h}>
          <WinRow bottom={6} cols={2} w={t.w} />
          <WinRow bottom={18} cols={2} w={t.w} />
          <WinRow bottom={30} cols={2} w={t.w} />
        </Bld>
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

  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const btnAnim  = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(logoAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(btnAnim,  { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
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
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) setError(err);
    } catch (e: any) {
      console.error('[Login] Network error:', e);
      setError('مشكلة اتصال بالسيرفر. تحقق من الإنترنت وأعد المحاولة');
    } finally {
      setLoading(false);
    }
  };

  const glowScale   = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.60] });

  return (
    <View style={styles.root}>
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      <Animated.View
        pointerEvents="none"
        style={[styles.ambientGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />
      <View pointerEvents="none" style={styles.ambientGlow2} />

      {/* Saudi skyline — sits at bottom, behind scroll content */}
      <SaudiSkyline />

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 170 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <Animated.View
            style={[
              styles.logoSection,
              {
                opacity: logoAnim,
                transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }) }],
              },
            ]}
          >
            <View style={styles.logoGlowRing} />
            <View style={styles.logoGlowRing2} />
            <View style={styles.logoCard}>
              <View style={styles.logoIconOuter}>
                <View style={styles.logoIconInner}>
                  <View style={styles.logoSymbol}>
                    <View style={styles.logoArrowLeft} />
                    <View style={styles.logoArrowRight} />
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.appName}>خذها</Text>
            <View style={styles.appNameUnderline} />
            <Text style={styles.tagline}>بدّل أو اعطِ بكل سهولة</Text>
          </Animated.View>

          {/* ── Glass form card ── */}
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
                  : <Eye   size={17} color={G.textMuted} />
                }
              </TouchableOpacity>
              <TextInput
                style={styles.input}
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
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.82}
            >
              <View style={styles.primaryBtnShine} />
              <Text style={styles.primaryBtnText}>
                {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو</Text>
              <View style={styles.dividerLine} />
            </View>

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
  root: { flex: 1, backgroundColor: G.bg },
  kav:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 24,
  },

  ambientGlow: {
    position: 'absolute',
    top: -SW * 0.4,
    alignSelf: 'center',
    width: SW * 1.1,
    height: SW * 1.1,
    borderRadius: SW * 0.55,
    backgroundColor: G.primaryGlow,
  },
  ambientGlow2: {
    position: 'absolute',
    top: SH * 0.3,
    left: -SW * 0.25,
    width: SW * 0.8,
    height: SW * 0.8,
    borderRadius: SW * 0.4,
    backgroundColor: 'rgba(0,100,40,0.07)',
  },

  // ── Skyline ──
  skylineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    overflow: 'hidden',
  },
  groundLine: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: G.primary,
    opacity: 0.55,
  },
  groundGlow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(0,200,83,0.12)',
  },

  // ── Logo ──
  logoSection: { alignItems: 'center', gap: 10, paddingTop: 12 },
  logoGlowRing: {
    position: 'absolute', top: -20,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(0,200,83,0.07)',
  },
  logoGlowRing2: {
    position: 'absolute', top: 0,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,200,83,0.12)',
  },
  logoCard: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: 'rgba(0,200,83,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(0,200,83,0.40)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 20, elevation: 0,
  },
  logoIconOuter: {
    width: 62, height: 62, borderRadius: 18,
    backgroundColor: 'rgba(0,200,83,0.15)',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoIconInner: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: G.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 12,
  },
  logoSymbol: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  logoArrowLeft: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderRightWidth: 11,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#000',
  },
  logoArrowRight: {
    width: 0, height: 0,
    borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#000',
  },
  appName: {
    fontSize: 48, fontWeight: '900', color: G.text,
    letterSpacing: -1.5, marginTop: 4,
  },
  appNameUnderline: {
    width: 52, height: 3, borderRadius: 2,
    backgroundColor: G.primary,
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 8, marginTop: -4,
  },
  tagline: { fontSize: 14, color: G.textSub, letterSpacing: 0.3, marginTop: 4 },

  // ── Glass card ──
  glassCard: {
    backgroundColor: G.card,
    borderRadius: 28, borderWidth: 1, borderColor: G.border,
    padding: 22, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 8,
  },
  errorBox: {
    backgroundColor: G.errorBg, borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  errorText: { color: G.error, fontSize: 13, textAlign: 'right', fontWeight: '600' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: G.inputBg,
    borderWidth: 1.5, borderColor: G.border, borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    gap: 10, minHeight: 54,
  },
  inputWrapFocus: {
    borderColor: G.borderFocus,
    backgroundColor: 'rgba(0,200,83,0.04)',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  inputIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
  },
  inputIconActive: { backgroundColor: 'rgba(0,200,83,0.10)' },
  input: { flex: 1, fontSize: 15, color: G.text, paddingVertical: 12, textAlign: 'right' },
  eyeBtn: { padding: 6 },

  // ── Buttons ──
  btnSection: { gap: 14 },
  primaryBtn: {
    height: 58, borderRadius: 20,
    backgroundColor: G.primary,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 8,
  },
  primaryBtnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: '#000', letterSpacing: 0.3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: G.border },
  dividerText: { color: G.textMuted, fontSize: 13, fontWeight: '600' },
  secondaryBtn: {
    height: 56, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: G.text, letterSpacing: 0.2 },
});
