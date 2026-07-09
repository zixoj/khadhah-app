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
import { Mail, Lock, Eye, EyeOff, Globe } from 'lucide-react-native';
import VerseCard from '@/components/VerseCard';
import Svg, { Path, Rect, Circle, Line, Defs, RadialGradient, Stop, G as SvgG, LinearGradient } from 'react-native-svg';
import { useLanguage } from '@/lib/LanguageContext';

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
  Saudi Skyline — SVG version.
  Landmarks left → right (scaled to SW × 220 viewport):
    1. Left skyline fill — small Riyadh mid-rises
    2. Al Faisaliah Tower — tapered body, gold sphere, needle
    3. Kingdom Centre Tower — twin legs, sky-bridge arch opening
    4. Makkah Clock Tower — stepped base, hotel block, clock tier, crescent spire
    5. Right skyline fill — modern Riyadh towers
  All strokes: thin neon-green, dark fill, glow via SVG filter approximated
  with layered semi-transparent duplicates.
*/
function SaudiSkyline() {
  const W = SW;
  const H = 220;
  const GND = H - 16; // y of ground line

  // Colour tokens
  const C1 = 'rgba(0,200,83,0.55)';   // main outline
  const C2 = 'rgba(0,200,83,0.85)';   // accent / glow strokes
  const C3 = 'rgba(0,200,83,0.22)';   // faint fill tint
  const DARK = '#050B08';

  // Scale factor so drawing fits any screen width
  // Reference design width = 390 (iPhone 14 width)
  const s = W / 390;
  const x = (v: number) => v * s;
  const y = (v: number) => GND - v * s; // y from ground up

  return (
    <View pointerEvents="none" style={styles.skylineContainer}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          {/* Glow gradient behind skyline */}
          <LinearGradient id="skyGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#00C853" stopOpacity="0.00" />
            <Stop offset="0.55" stopColor="#00C853" stopOpacity="0.04" />
            <Stop offset="1" stopColor="#00C853" stopOpacity="0.13" />
          </LinearGradient>
          {/* Ground line gradient */}
          <LinearGradient id="groundGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#00C853" stopOpacity="0.0" />
            <Stop offset="0.2" stopColor="#00C853" stopOpacity="0.7" />
            <Stop offset="0.5" stopColor="#00C853" stopOpacity="1.0" />
            <Stop offset="0.8" stopColor="#00C853" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#00C853" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Sky glow backdrop */}
        <Rect x={0} y={0} width={W} height={H} fill="url(#skyGlow)" />

        {/* ══════════════════════════════════════════════════
            1. LEFT FILL — small Riyadh towers
        ══════════════════════════════════════════════════ */}

        {/* Tower L1 — 20w × 48h at x=4 */}
        <Rect x={x(4)} y={y(48)} width={x(20)} height={x(48)} fill={DARK} stroke={C1} strokeWidth="1" />
        {/* windows */}
        {[8,18,28,38].map((yy, i) => (
          <Rect key={`l1w${i}`} x={x(7)} y={y(yy+4)} width={x(6)} height={x(3)} fill={C1} opacity={0.30} rx="1" />
        ))}
        {[8,18,28,38].map((yy, i) => (
          <Rect key={`l1w2${i}`} x={x(14)} y={y(yy+4)} width={x(6)} height={x(3)} fill={C1} opacity={0.30} rx="1" />
        ))}

        {/* Tower L2 — 16w × 32h at x=28 */}
        <Rect x={x(28)} y={y(32)} width={x(16)} height={x(32)} fill={DARK} stroke={C1} strokeWidth="1" />
        {[8,18].map((yy, i) => (
          <Rect key={`l2w${i}`} x={x(31)} y={y(yy+4)} width={x(4)} height={x(3)} fill={C1} opacity={0.28} rx="1" />
        ))}
        {[8,18].map((yy, i) => (
          <Rect key={`l2w2${i}`} x={x(37)} y={y(yy+4)} width={x(4)} height={x(3)} fill={C1} opacity={0.28} rx="1" />
        ))}

        {/* Tower L3 — 22w × 60h at x=48 */}
        <Rect x={x(48)} y={y(60)} width={x(22)} height={x(60)} fill={DARK} stroke={C1} strokeWidth="1" />
        {[8,18,28,38,48].map((yy, i) => (
          <Rect key={`l3w${i}`} x={x(51)} y={y(yy+4)} width={x(6)} height={x(3)} fill={C1} opacity={0.28} rx="1" />
        ))}
        {[8,18,28,38,48].map((yy, i) => (
          <Rect key={`l3w2${i}`} x={x(59)} y={y(yy+4)} width={x(6)} height={x(3)} fill={C1} opacity={0.28} rx="1" />
        ))}

        {/* Antenna on L3 */}
        <Line x1={x(59)} y1={y(60)} x2={x(59)} y2={y(68)} stroke={C2} strokeWidth="1.2" />

        {/* Tower L4 narrow — 12w × 40h at x=74 */}
        <Rect x={x(74)} y={y(40)} width={x(12)} height={x(40)} fill={DARK} stroke={C1} strokeWidth="1" />

        {/* ══════════════════════════════════════════════════
            2. AL FAISALIAH TOWER — x≈100
            Tapered rectangular body: wide base narrows toward top,
            gold sphere, thin needle
        ══════════════════════════════════════════════════ */}

        {/* Base skirt (full width) */}
        <Rect x={x(95)} y={y(20)} width={x(36)} height={x(20)} fill={DARK} stroke={C1} strokeWidth="1.2" />
        {/* Wide lower shaft */}
        <Rect x={x(98)} y={y(80)} width={x(30)} height={x(60)} fill={DARK} stroke={C1} strokeWidth="1.2" />
        {/* Taper — upper two thirds narrower */}
        <Rect x={x(102)} y={y(130)} width={x(22)} height={x(50)} fill={DARK} stroke={C1} strokeWidth="1.2" />
        {/* Top shaft very narrow */}
        <Rect x={x(107)} y={y(145)} width={x(12)} height={x(15)} fill={DARK} stroke={C2} strokeWidth="1.2" />
        {/* Window rows on main body */}
        {[10,22,34,46,58,70].map((yy, i) => (
          <Rect key={`fw${i}`} x={x(100)} y={y(yy+8)} width={x(26)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}
        {/* Gold sphere (glow circle) */}
        <Circle cx={x(113)} cy={y(147)} r={x(5)} fill={DARK} stroke={C2} strokeWidth="1.8" />
        {/* Glow duplicate behind sphere */}
        <Circle cx={x(113)} cy={y(147)} r={x(8)} fill="none" stroke={C2} strokeWidth="0.5" opacity={0.3} />
        {/* Needle */}
        <Line x1={x(113)} y1={y(152)} x2={x(113)} y2={y(168)} stroke={C2} strokeWidth="1.5" />
        {/* Needle tip glow */}
        <Circle cx={x(113)} cy={y(168)} r={x(1.5)} fill={C2} opacity={0.9} />

        {/* ══════════════════════════════════════════════════
            3. MID CLUSTER — between Faisaliah and Kingdom
        ══════════════════════════════════════════════════ */}

        <Rect x={x(140)} y={y(52)} width={x(18)} height={x(52)} fill={DARK} stroke={C1} strokeWidth="1" />
        {[10,22,34,44].map((yy, i) => (
          <Rect key={`mc${i}`} x={x(143)} y={y(yy+8)} width={x(5)} height={x(3)} fill={C1} opacity={0.25} rx="1" />
        ))}
        {[10,22,34,44].map((yy, i) => (
          <Rect key={`mc2${i}`} x={x(151)} y={y(yy+8)} width={x(5)} height={x(3)} fill={C1} opacity={0.25} rx="1" />
        ))}
        <Rect x={x(162)} y={y(72)} width={x(24)} height={x(72)} fill={DARK} stroke={C1} strokeWidth="1.1" />
        {[10,22,34,46,58].map((yy, i) => (
          <Rect key={`mc3${i}`} x={x(165)} y={y(yy+8)} width={x(7)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}
        {[10,22,34,46,58].map((yy, i) => (
          <Rect key={`mc4${i}`} x={x(175)} y={y(yy+8)} width={x(7)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}

        {/* ══════════════════════════════════════════════════
            4. KINGDOM CENTRE TOWER — centred ~x=195
            Iconic: twin legs separated by open sky arch at top
        ══════════════════════════════════════════════════ */}

        {/* Left leg */}
        <Rect x={x(192)} y={y(150)} width={x(16)} height={x(150)} fill={DARK} stroke={C2} strokeWidth="1.4" />
        {/* Right leg */}
        <Rect x={x(228)} y={y(150)} width={x(16)} height={x(150)} fill={DARK} stroke={C2} strokeWidth="1.4" />

        {/* Sky bridge — horizontal connector at top quarter of legs */}
        <Rect x={x(192)} y={y(155)} width={x(52)} height={x(16)} fill={DARK} stroke={C2} strokeWidth="1.4" />

        {/* Open arch gap (dark fill over the open space) */}
        <Rect x={x(208)} y={y(149)} width={x(20)} height={x(6)} fill={DARK} />

        {/* Sky bridge glow line (top edge) */}
        <Line x1={x(193)} y1={y(171)} x2={x(243)} y2={y(171)} stroke={C2} strokeWidth="0.7" opacity={0.5} />

        {/* Window rows on left leg */}
        {[10,22,34,46,58,72,86,100,114,128].map((yy, i) => (
          <Rect key={`kl${i}`} x={x(194)} y={y(yy+8)} width={x(12)} height={x(3)} fill={C1} opacity={0.20} rx="1" />
        ))}
        {/* Window rows on right leg */}
        {[10,22,34,46,58,72,86,100,114,128].map((yy, i) => (
          <Rect key={`kr${i}`} x={x(230)} y={y(yy+8)} width={x(12)} height={x(3)} fill={C1} opacity={0.20} rx="1" />
        ))}

        {/* Top antenna nub */}
        <Line x1={x(208)} y1={y(150)} x2={x(208)} y2={y(158)} stroke={C2} strokeWidth="1.2" opacity={0.7} />
        <Line x1={x(228)} y1={y(150)} x2={x(228)} y2={y(158)} stroke={C2} strokeWidth="1.2" opacity={0.7} />

        {/* Kingdom Centre glow aura */}
        <Rect x={x(188)} y={y(160)} width={x(60)} height={x(160)} fill="none" stroke={C2} strokeWidth="0.4" opacity={0.18} rx="2" />

        {/* ══════════════════════════════════════════════════
            5. MAKKAH CLOCK TOWER — x≈265
            Broad stepped base → hotel block → clock tier → spire + crescent
        ══════════════════════════════════════════════════ */}

        {/* Hotel wing towers (left + right flanks) */}
        <Rect x={x(258)} y={y(70)} width={x(14)} height={x(70)} fill={DARK} stroke={C1} strokeWidth="1" />
        <Rect x={x(310)} y={y(70)} width={x(14)} height={x(70)} fill={DARK} stroke={C1} strokeWidth="1" />

        {/* Base plinth (widest) */}
        <Rect x={x(260)} y={y(22)} width={x(62)} height={x(22)} fill={DARK} stroke={C1} strokeWidth="1.2" />

        {/* Hotel tower body */}
        <Rect x={x(268)} y={y(96)} width={x(46)} height={x(74)} fill={DARK} stroke={C1} strokeWidth="1.2" />
        {/* Hotel windows */}
        {[8,20,32,44,56,64].map((yy, i) => (
          <Rect key={`mw${i}`} x={x(271)} y={y(yy+10)} width={x(8)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}
        {[8,20,32,44,56,64].map((yy, i) => (
          <Rect key={`mw2${i}`} x={x(283)} y={y(yy+10)} width={x(8)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}
        {[8,20,32,44,56,64].map((yy, i) => (
          <Rect key={`mw3${i}`} x={x(295)} y={y(yy+10)} width={x(8)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}

        {/* Clock tier (narrower) */}
        <Rect x={x(275)} y={y(126)} width={x(32)} height={x(30)} fill={DARK} stroke={C2} strokeWidth="1.4" />
        {/* Clock faces — 2 visible sides */}
        <Circle cx={x(291)} cy={y(111+10)} r={x(9)} fill={DARK} stroke={C2} strokeWidth="1.4" />
        {/* Clock glow ring */}
        <Circle cx={x(291)} cy={y(111+10)} r={x(11)} fill="none" stroke={C2} strokeWidth="0.5" opacity={0.35} />
        {/* Clock hands */}
        <Line x1={x(291)} y1={y(121)} x2={x(291)} y2={y(126+4)} stroke={C2} strokeWidth="1" opacity={0.7} />
        <Line x1={x(291)} y1={y(121)} x2={x(297)} y2={y(119)} stroke={C2} strokeWidth="1" opacity={0.7} />

        {/* Spire */}
        <Line x1={x(291)} y1={y(126)} x2={x(291)} y2={y(162)} stroke={C2} strokeWidth="2.2" />
        {/* Spire glow line (wider, faint) */}
        <Line x1={x(291)} y1={y(126)} x2={x(291)} y2={y(162)} stroke={C2} strokeWidth="6" opacity={0.08} />

        {/* Crescent at spire tip */}
        <Path
          d={`M ${x(285)} ${y(164)} A ${x(6)} ${x(6)} 0 0 1 ${x(297)} ${y(164)}`}
          fill="none"
          stroke={C2}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Star dot */}
        <Circle cx={x(291)} cy={y(167)} r={x(1.2)} fill={C2} opacity={0.9} />

        {/* Spire tip glow dot */}
        <Circle cx={x(291)} cy={y(163)} r={x(2.5)} fill={C2} opacity={0.5} />

        {/* ══════════════════════════════════════════════════
            6. PALM TREES — between Clock Tower and right fill
        ══════════════════════════════════════════════════ */}

        {[x(330), x(350)].map((px, pi) => (
          <SvgG key={`palm${pi}`}>
            {/* Trunk */}
            <Line x1={px} y1={GND} x2={px} y2={y(28)} stroke={C1} strokeWidth="2" opacity={0.5} />
            {/* Fronds */}
            {[
              [-35, 16], [-18, 18], [0, 19], [18, 18], [35, 16],
            ].map(([angle, len], fi) => {
              const rad = (angle * Math.PI) / 180;
              const ex = px + Math.sin(rad) * x(len);
              const ey = y(28) - Math.cos(rad) * x(len);
              return (
                <Line key={fi} x1={px} y1={y(28)} x2={ex} y2={ey}
                  stroke={C1} strokeWidth="1.2" strokeLinecap="round" opacity={0.45} />
              );
            })}
          </SvgG>
        ))}

        {/* ══════════════════════════════════════════════════
            7. RIGHT FILL — modern Riyadh towers
        ══════════════════════════════════════════════════ */}

        <Rect x={x(364)} y={y(55)} width={x(20)} height={x(55)} fill={DARK} stroke={C1} strokeWidth="1" />
        {[10,22,34,44].map((yy, i) => (
          <Rect key={`r1${i}`} x={x(367)} y={y(yy+6)} width={x(6)} height={x(3)} fill={C1} opacity={0.25} rx="1" />
        ))}

        <Rect x={x(388)} y={y(75)} width={x(26)} height={x(75)} fill={DARK} stroke={C1} strokeWidth="1" />
        {[10,22,34,46,58,68].map((yy, i) => (
          <Rect key={`r2${i}`} x={x(391)} y={y(yy+6)} width={x(7)} height={x(4)} fill={C1} opacity={0.22} rx="1" />
        ))}

        {/* Antenna */}
        <Line x1={x(401)} y1={y(75)} x2={x(401)} y2={y(84)} stroke={C2} strokeWidth="1.2" />

        {/* ══════════════════════════════════════════════════
            GROUND LINE + GLOW
        ══════════════════════════════════════════════════ */}

        {/* Ground glow band */}
        <Rect x={0} y={GND - 4} width={W} height={10} fill="#00C853" opacity={0.07} />
        <Rect x={0} y={GND - 1} width={W} height={4} fill="#00C853" opacity={0.10} />
        {/* Ground line */}
        <Line x1={0} y1={GND} x2={W} y2={GND} stroke="url(#groundGrad)" strokeWidth="1.2" />

      </Svg>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, enterGuestMode } = useAuth();
  const { language, isRTL, setLanguage, t } = useLanguage();

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
      setError(t('emptyFields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err);
      }
    } catch (e: any) {
      setError(t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const glowScale   = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.60] });

  const handleGuest = async () => {
    await enterGuestMode();
  };

  // Dynamic row direction: RTL keeps current layout, LTR mirrors it
  const inputRowDir = isRTL ? 'row' : 'row-reverse';
  const textDir = isRTL ? 'right' : 'left';

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

      {/* Language switcher — absolutely positioned top-right, always visible */}
      <View style={[styles.langBtnWrap, { top: insets.top + 16, right: 16 }]}>
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => {
            setError(null);
            setLanguage(language === 'ar' ? 'en' : 'ar');
          }}
          activeOpacity={0.75}
        >
          <Globe size={13} color={G.primary} strokeWidth={2.2} />
          <Text style={styles.langBtnText}>
            {language === 'ar' ? 'EN' : 'العربية'}
          </Text>
        </TouchableOpacity>
      </View>

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
              {/* Exchange arrows SVG logo */}
              <Svg width={52} height={48} viewBox="0 0 52 48">
                {/* Top arrow — green, pointing right */}
                <Path
                  d="M6 28 C6 14, 20 10, 34 14 L30 8 L46 18 L30 26 L34 20 C22 17, 12 20, 12 30"
                  fill="none"
                  stroke="#00C853"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Bottom arrow — white, pointing left */}
                <Path
                  d="M46 20 C46 34, 32 38, 18 34 L22 40 L6 30 L22 22 L18 28 C30 31, 40 28, 40 18"
                  fill="none"
                  stroke="rgba(255,255,255,0.90)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.appName}>خذها</Text>
            <View style={styles.appNameUnderline} />
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </Animated.View>

          {/* ── Quran verse card ── */}
          <VerseCard isDark delay={400} />

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
                <Text style={[styles.errorText, { textAlign: textDir }]}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={[styles.inputWrap, { flexDirection: inputRowDir }, emailFocused && styles.inputWrapFocus]}>
              <TextInput
                style={[styles.input, { textAlign: textDir }]}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={G.textMuted}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              <View style={[styles.inputIcon, emailFocused && styles.inputIconActive]}>
                <Mail size={17} color={emailFocused ? G.primary : G.textMuted} />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.inputWrap, { flexDirection: inputRowDir }, passFocused && styles.inputWrapFocus]}>
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                {showPass
                  ? <EyeOff size={17} color={G.textMuted} />
                  : <Eye   size={17} color={G.textMuted} />
                }
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { textAlign: textDir }]}
                placeholder={t('passwordPlaceholder')}
                placeholderTextColor={G.textMuted}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                secureTextEntry={!showPass}
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
                {loading ? t('signingIn') : t('signIn')}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryBtnText}>{t('createAccount')}</Text>
            </TouchableOpacity>

            {/* ── Guest Mode Button ── */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuest}
              activeOpacity={0.78}
            >
              <View style={styles.guestBtnInner}>
                <Text style={styles.guestBtnIcon}>👀</Text>
                <View style={[styles.guestBtnTextWrap, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                  <Text style={styles.guestBtnTextAr}>{t('guestMain')}</Text>
                  <Text style={styles.guestBtnTextEn}>{t('guestSub')}</Text>
                </View>
              </View>
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

  // ── Language switcher ──
  langBtnWrap: {
    position: 'absolute',
    zIndex: 100,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,200,83,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,83,0.30)',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: G.primary,
    letterSpacing: 0.3,
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
    height: 220,
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
  errorText: { color: G.error, fontSize: 13, fontWeight: '600' },

  inputWrap: {
    alignItems: 'center',
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
  input: { flex: 1, fontSize: 15, color: G.text, paddingVertical: 12 },
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

  // ── Guest button ──
  guestBtn: {
    height: 56, borderRadius: 20,
    backgroundColor: 'rgba(0,30,14,0.60)',
    borderWidth: 1.5, borderColor: 'rgba(0,200,83,0.28)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  guestBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guestBtnIcon: { fontSize: 18 },
  guestBtnTextWrap: { alignItems: 'flex-end', gap: 1 },
  guestBtnTextAr: { fontSize: 15, fontWeight: '700', color: 'rgba(0,200,83,0.90)', letterSpacing: 0.2 },
  guestBtnTextEn: { fontSize: 10, fontWeight: '500', color: 'rgba(0,200,83,0.55)', letterSpacing: 0.3 },
});
