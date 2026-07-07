import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeftRight,
  Gift,
  Plus,
  Flame,
  Clock,
  MapPin,
  Heart,
  Search,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useGuestGate } from '@/hooks/useGuestGate';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
  Defs,
  Stop,
  G as SvgG,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Design Tokens ──────────────────────────────────────────────────────────
const D = {
  bg:           '#050505',
  primary:      '#22C55E',
  darkGreen:    '#14532D',
  card:         'rgba(15,15,15,0.78)',
  gold:         '#D4AF37',
  white:        '#FFFFFF',
  textSec:      '#CFCFCF',
  textMuted:    'rgba(255,255,255,0.35)',
  border:       'rgba(255,255,255,0.08)',
  primaryGlow:  'rgba(34,197,94,0.22)',
  goldGlow:     'rgba(212,175,55,0.22)',
  exchange:     '#38BDF8',
  exchangeDark: '#0EA5E9',
};

// ─── Interfaces & Helpers ───────────────────────────────────────────────────
interface RecentListing {
  id: string;
  title: string;
  type: string;
  city: string;
  image_url: string;
  is_urgent: boolean;
  created_at: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string }> = {
  available:     { label: 'متاح',  bg: 'rgba(34,197,94,0.20)',  dot: '#22C55E' },
  reserved:      { label: 'محجوز', bg: 'rgba(245,158,11,0.20)', dot: '#F59E0B' },
  reserved_temp: { label: 'محجوز', bg: 'rgba(245,158,11,0.20)', dot: '#F59E0B' },
  taken:         { label: 'مأخوذ', bg: 'rgba(239,68,68,0.20)',  dot: '#EF4444' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

// ─── Floating Particles ─────────────────────────────────────────────────────
const PARTICLES = [
  { x: 0.10, y: 0.09, size: 2.0, opacity: 0.45, dur: 4200 },
  { x: 0.80, y: 0.15, size: 1.6, opacity: 0.30, dur: 5100 },
  { x: 0.55, y: 0.24, size: 2.6, opacity: 0.35, dur: 3400 },
  { x: 0.28, y: 0.40, size: 1.4, opacity: 0.22, dur: 4800 },
  { x: 0.90, y: 0.48, size: 1.8, opacity: 0.38, dur: 3800 },
];

function Particle({ x, y, size, opacity, dur }: (typeof PARTICLES)[0]) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dur, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const op = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [opacity * 0.3, opacity, opacity * 0.3] });
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
        backgroundColor: D.primary,
        opacity: op,
        transform: [{ translateY: ty }],
        shadowColor: D.primary,
        shadowOpacity: 0.9,
        shadowRadius: size * 4,
      }}
    />
  );
}

// ─── Riyadh Skyline SVG ─────────────────────────────────────────────────────
function RiyadhSkyline() {
  const W = SW;
  const H = 240;
  const GND = H - 14;
  const s = W / 390;
  const px = (v: number) => v * s;
  const py = (v: number) => GND - v * s;

  const C1 = 'rgba(34,197,94,0.14)';
  const C2 = 'rgba(34,197,94,0.26)';
  const DARK = '#050505';

  return (
    <View pointerEvents="none" style={bStyles.skylineWrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <SvgLinearGradient id="skyFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={D.bg} stopOpacity="1" />
            <Stop offset="0.45" stopColor={D.bg} stopOpacity="0.5" />
            <Stop offset="1" stopColor={D.bg} stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="groundGlow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"   stopColor="#22C55E" stopOpacity="0" />
            <Stop offset="0.3" stopColor="#22C55E" stopOpacity="0.5" />
            <Stop offset="0.5" stopColor="#22C55E" stopOpacity="0.9" />
            <Stop offset="0.7" stopColor="#22C55E" stopOpacity="0.5" />
            <Stop offset="1"   stopColor="#22C55E" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Left fill towers */}
        <Rect x={px(4)}  y={py(46)} width={px(18)} height={px(46)} fill={DARK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(25)} y={py(32)} width={px(14)} height={px(32)} fill={DARK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(42)} y={py(60)} width={px(18)} height={px(60)} fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Line x1={px(51)} y1={py(60)} x2={px(51)} y2={py(69)} stroke={C2} strokeWidth="1.1" />

        {/* Al Faisaliah Tower */}
        <Rect x={px(76)}  y={py(20)} width={px(32)} height={px(20)} fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(79)}  y={py(80)} width={px(26)} height={px(60)} fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(83)}  y={py(130)} width={px(18)} height={px(50)} fill={DARK} stroke={C2} strokeWidth="1.1" />
        <Rect x={px(87)}  y={py(146)} width={px(10)} height={px(16)} fill={DARK} stroke={C2} strokeWidth="1" />
        <Circle cx={px(92)} cy={py(148)} r={px(4.5)} fill={DARK} stroke={C2} strokeWidth="1.3" />
        <Circle cx={px(92)} cy={py(148)} r={px(7)}   fill="none"  stroke={C2} strokeWidth="0.4" opacity="0.35" />
        <Line x1={px(92)} y1={py(152)} x2={px(92)} y2={py(166)} stroke={C2} strokeWidth="1.4" />
        <Circle cx={px(92)} cy={py(166)} r={px(1.5)} fill={C2} opacity="0.9" />

        {/* Mid cluster */}
        <Rect x={px(122)} y={py(54)} width={px(15)} height={px(54)} fill={DARK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(140)} y={py(76)} width={px(20)} height={px(76)} fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(163)} y={py(58)} width={px(14)} height={px(58)} fill={DARK} stroke={C1} strokeWidth="0.8" />

        {/* Kingdom Centre Tower */}
        <Rect x={px(188)} y={py(156)} width={px(15)} height={px(156)} fill={DARK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(227)} y={py(156)} width={px(15)} height={px(156)} fill={DARK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(188)} y={py(162)} width={px(54)} height={px(16)} fill={DARK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(204)} y={py(155)} width={px(22)} height={px(6)}  fill={DARK} />
        <Line x1={px(200)} y1={py(172)} x2={px(230)} y2={py(172)} stroke={C2} strokeWidth="0.6" opacity="0.4" />
        {[10,22,36,50,68,86,104,120,136].map((yy, i) => (
          <Rect key={`kl${i}`} x={px(190)} y={py(yy+8)} width={px(11)} height={px(3)} fill={C1} opacity={0.18} rx="0.5" />
        ))}
        {[10,22,36,50,68,86,104,120,136].map((yy, i) => (
          <Rect key={`kr${i}`} x={px(229)} y={py(yy+8)} width={px(11)} height={px(3)} fill={C1} opacity={0.18} rx="0.5" />
        ))}
        <Rect x={px(184)} y={py(164)} width={px(62)} height={px(164)} fill="none" stroke={C2} strokeWidth="0.3" opacity="0.15" rx="2" />

        {/* PIF Tower */}
        <Rect x={px(258)} y={py(110)} width={px(20)} height={px(110)} fill={DARK} stroke={C2} strokeWidth="1" />
        <Rect x={px(261)} y={py(128)} width={px(14)} height={px(18)} fill={DARK} stroke={C2} strokeWidth="0.8" />
        <Line x1={px(268)} y1={py(110)} x2={px(268)} y2={py(122)} stroke={C2} strokeWidth="1.4" />
        <Circle cx={px(268)} cy={py(122)} r={px(2)} fill={C2} opacity="0.7" />

        {/* KAFD towers cluster */}
        <Rect x={px(285)} y={py(88)}  width={px(16)} height={px(88)}  fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(304)} y={py(102)} width={px(18)} height={px(102)} fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Line x1={px(313)} y1={py(102)} x2={px(313)} y2={py(112)} stroke={C2} strokeWidth="1.2" />

        {/* Makkah Clock Tower style */}
        <Rect x={px(328)} y={py(68)}  width={px(12)} height={px(68)}  fill={DARK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(342)} y={py(108)} width={px(40)} height={px(84)}  fill={DARK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(352)} y={py(130)} width={px(20)} height={px(22)}  fill={DARK} stroke={C2} strokeWidth="1.1" />
        <Circle cx={px(362)} cy={py(120)} r={px(8)} fill={DARK} stroke={C2} strokeWidth="1.1" />
        <Circle cx={px(362)} cy={py(120)} r={px(10)} fill="none" stroke={C2} strokeWidth="0.4" opacity="0.3" />
        <Line x1={px(362)} y1={py(130)} x2={px(362)} y2={py(158)} stroke={C2} strokeWidth="2" />
        <Line x1={px(362)} y1={py(130)} x2={px(362)} y2={py(158)} stroke={C2} strokeWidth="6" opacity="0.07" />
        <Path
          d={`M ${px(356)} ${py(160)} A ${px(6)} ${px(6)} 0 0 1 ${px(368)} ${py(160)}`}
          fill="none" stroke={C2} strokeWidth="1.6" strokeLinecap="round"
        />
        <Circle cx={px(362)} cy={py(163)} r={px(1.2)} fill={C2} opacity="0.9" />

        {/* Right fill */}
        <Rect x={px(388)} y={py(58)} width={px(20)} height={px(58)} fill={DARK} stroke={C1} strokeWidth="0.8" />
        <Line x1={px(398)} y1={py(58)} x2={px(398)} y2={py(68)} stroke={C2} strokeWidth="1" />

        {/* Ground glow */}
        <Rect x={0} y={GND - 4} width={W} height={8} fill="#22C55E" opacity="0.06" />
        <Line x1={0} y1={GND} x2={W} y2={GND} stroke="url(#groundGlow)" strokeWidth="1.2" />

        {/* Top-to-mid fade overlay */}
        <Rect x={0} y={0} width={W} height={H} fill="url(#skyFade)" />
      </Svg>
    </View>
  );
}

// ─── Luxury Background ──────────────────────────────────────────────────────
function LuxuryBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: D.bg }]} />

      {/* Large glass rings */}
      <View style={bStyles.ring1} />
      <View style={bStyles.ring2} />
      <View style={bStyles.ring3} />
      <View style={bStyles.ring4} />

      {/* Ambient glow blobs */}
      <View style={bStyles.glowTop} />
      <View style={bStyles.glowMid} />

      {/* Skyline */}
      <RiyadhSkyline />

      {/* Dark green tint over everything */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(4,14,8,0.80)' }]} />

      {/* Top gradient – black fade */}
      <LinearGradient
        colors={['rgba(5,5,5,0.97)', 'rgba(5,5,5,0.50)', 'transparent']}
        style={bStyles.gradTop}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(5,5,5,0.70)', 'rgba(5,5,5,0.95)']}
        style={bStyles.gradBottom}
        pointerEvents="none"
      />

      {/* Edge vignette */}
      <LinearGradient
        colors={['rgba(5,5,5,0.35)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={bStyles.vigLeft}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(5,5,5,0.35)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={bStyles.vigRight}
        pointerEvents="none"
      />
    </View>
  );
}

const bStyles = StyleSheet.create({
  skylineWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
    opacity: 0.65,
  },
  ring1: {
    position: 'absolute',
    top: -240,
    alignSelf: 'center',
    width: 620,
    height: 620,
    borderRadius: 310,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.07)',
    backgroundColor: 'transparent',
  },
  ring2: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.05)',
    backgroundColor: 'transparent',
  },
  ring3: {
    position: 'absolute',
    top: SH * 0.25,
    right: -180,
    width: 440,
    height: 440,
    borderRadius: 220,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.05)',
    backgroundColor: 'transparent',
  },
  ring4: {
    position: 'absolute',
    top: SH * 0.45,
    left: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.04)',
    backgroundColor: 'transparent',
  },
  glowTop: {
    position: 'absolute',
    top: -SW * 0.55,
    alignSelf: 'center',
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    backgroundColor: 'rgba(34,197,94,0.055)',
  },
  glowMid: {
    position: 'absolute',
    top: SH * 0.2,
    right: -SW * 0.3,
    width: SW * 0.7,
    height: SW * 0.7,
    borderRadius: SW * 0.35,
    backgroundColor: 'rgba(20,83,45,0.06)',
  },
  gradTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SH * 0.38,
  },
  gradBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SH * 0.30,
  },
  vigLeft: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: SW * 0.14,
  },
  vigRight: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: SW * 0.14,
  },
});

// ─── Logo Header ────────────────────────────────────────────────────────────
function LogoHeader({ anim }: { anim: Animated.Value }) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] });
  return (
    <Animated.View style={[s.logoSection, { opacity: anim, transform: [{ translateY: ty }] }]}>
      {/* Icon */}
      <View style={s.logoCard}>
        <View style={s.logoGlow} />
        <Svg width={44} height={40} viewBox="0 0 52 48">
          <Path
            d="M6 28 C6 14, 20 10, 34 14 L30 8 L46 18 L30 26 L34 20 C22 17, 12 20, 12 30"
            fill="none" stroke="#22C55E" strokeWidth="3.2"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <Path
            d="M46 20 C46 34, 32 38, 18 34 L22 40 L6 30 L22 22 L18 28 C30 31, 40 28, 40 18"
            fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="3.2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={s.logoName}>خذها</Text>
      <Text style={s.logoTagline}>عطاء اليوم أجر الغد</Text>
    </Animated.View>
  );
}

// ─── Hero Title ─────────────────────────────────────────────────────────────
function HeroTitle({ anim }: { anim: Animated.Value }) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  return (
    <Animated.View style={[s.titleSection, { opacity: anim, transform: [{ translateY: ty }] }]}>
      <Text style={s.titleTop}>لا ترميها...</Text>
      <View style={s.titleRow}>
        <Text style={s.titleGold}>بدّلها</Text>
        <Text style={s.titleWhite}> أو </Text>
        <Text style={s.titleGreen}>خذها</Text>
      </View>
      <Text style={s.titleDesc}>اعرض أغراضك مجانًا أو بدّلها بما تحتاجه</Text>
    </Animated.View>
  );
}

// ─── Inline Quran Card (spec verse + Islamic decoration) ────────────────────
function QuranCard({ anim }: { anim: Animated.Value }) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  return (
    <Animated.View style={[s.verseCardOuter, { opacity: anim, transform: [{ translateY: ty }] }]}>
      <View style={s.verseCard}>
        {/* Soft green glow behind card */}
        <View style={s.verseGlow} />

        {/* Glass body */}
        <View style={s.verseGlass}>
          {/* Islamic leaf corner decoration */}
          <View style={s.leafWrap} pointerEvents="none">
            <Svg width={56} height={56} viewBox="0 0 56 56">
              <Path d="M 0 56 Q 0 42 14 42 Q 14 28 28 28 Q 28 14 42 14 Q 42 0 56 0"
                fill="none" stroke="rgba(34,197,94,0.28)" strokeWidth="1.1" />
              <Path d="M 0 56 Q 0 36 20 36 Q 20 16 40 16 Q 40 0 56 0"
                fill="none" stroke="rgba(34,197,94,0.16)" strokeWidth="0.8" />
              <Path d="M 0 56 Q 0 30 26 30 Q 26 0 56 0"
                fill="none" stroke="rgba(34,197,94,0.08)" strokeWidth="0.6" />
              {/* Small leaf flourish */}
              <Path d="M 48 8 C 52 12, 48 20, 42 17 C 44 12, 48 8, 48 8 Z"
                fill="rgba(34,197,94,0.20)" stroke="rgba(34,197,94,0.38)" strokeWidth="0.7" />
              <Circle cx={6}  cy={50} r={1.4} fill="rgba(34,197,94,0.32)" />
              <Circle cx={50} cy={6}  r={1.4} fill="rgba(34,197,94,0.32)" />
              <Circle cx={14} cy={42} r={0.9} fill="rgba(34,197,94,0.22)" />
              <Circle cx={42} cy={14} r={0.9} fill="rgba(34,197,94,0.22)" />
            </Svg>
          </View>

          {/* Accent bar */}
          <View style={s.verseBar} />

          <View style={s.verseContent}>
            <Text style={s.verseText}>
              ﴿ وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى
            </Text>
            <Text style={s.verseText}>
              وَلَا تَعَاوَنُوا عَلَى الْإِثْمِ وَالْعُدْوَانِ ﴾
            </Text>
            <Text style={s.verseRef}>سورة المائدة — آية ٢</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Search Bar ─────────────────────────────────────────────────────────────
function LuxurySearchBar({
  anim,
  onPress,
}: {
  anim: Animated.Value;
  onPress: () => void;
}) {
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  return (
    <Animated.View style={[s.searchWrap, { opacity: anim, transform: [{ translateY: ty }] }]}>
      <TouchableOpacity style={s.searchBar} onPress={onPress} activeOpacity={0.88}>
        {/* Filter button - right side (RTL) */}
        <View style={s.filterBtn}>
          <SlidersHorizontal size={16} color={D.primary} strokeWidth={2} />
        </View>

        <Text style={s.searchPlaceholder}>ابحث عن إعلانات، مدن، فئات...</Text>

        {/* Search icon - left side (RTL) */}
        <View style={s.searchIconWrap}>
          <Search size={16} color={D.textMuted} strokeWidth={2} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Category Card ──────────────────────────────────────────────────────────
function CategoryCard({
  label,
  sub,
  imageUri,
  glowColor,
  borderColor,
  iconBg,
  iconEl,
  gradColors,
  onPress,
}: {
  label: string;
  sub: string;
  imageUri: string;
  glowColor: string;
  borderColor: string;
  iconBg: string;
  iconEl: React.ReactNode;
  gradColors: readonly [string, string, ...string[]];
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(glow, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.0, useNativeDriver: true, tension: 80, friction: 7 }),
      Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.18] });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      style={s.catCardTouchable}
    >
      <Animated.View
        style={[
          s.catCard,
          { borderColor, shadowColor: glowColor, transform: [{ scale }] },
        ]}
      >
        {/* Furniture image (bottom half) */}
        <Image
          source={{ uri: imageUri }}
          style={s.catCardImage}
          resizeMode="cover"
        />

        {/* Image gradient fade */}
        <LinearGradient
          colors={gradColors}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Press glow overlay */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: glowColor, opacity: glowOpacity, borderRadius: 28 }]}
        />

        {/* Content */}
        <View style={s.catCardContent}>
          <View style={[s.catIconWrap, { backgroundColor: iconBg }]}>
            {iconEl}
          </View>
          <Text style={s.catLabel}>{label}</Text>
          <Text style={s.catSub}>{sub}</Text>
        </View>

        {/* Thin top glow line */}
        <View style={[s.catTopLine, { backgroundColor: glowColor }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Recent Listing Card ────────────────────────────────────────────────────
function RecentCard({ item, onPress }: { item: RecentListing; onPress: () => void }) {
  const sConf = STATUS_CONFIG[item.status] ?? { label: item.status, bg: 'rgba(100,116,139,0.18)', dot: '#9CA3AF' };
  return (
    <TouchableOpacity style={s.recentCard} onPress={onPress} activeOpacity={0.82}>
      {/* Image */}
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={s.recentImg} />
      ) : (
        <View style={[
          s.recentImgPlaceholder,
          { backgroundColor: item.type === 'free' ? 'rgba(34,197,94,0.08)' : 'rgba(56,189,248,0.08)' },
        ]}>
          {item.type === 'free'
            ? <Gift size={26} color={D.primary} />
            : <ArrowLeftRight size={26} color={D.exchange} />
          }
        </View>
      )}

      {/* Image gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.60)']}
        style={s.recentImgGrad}
        pointerEvents="none"
      />

      {/* Badges */}
      <View style={s.badgeRow}>
        {item.is_urgent && (
          <View style={s.urgentBadge}>
            <Flame size={9} color="#fff" />
            <Text style={s.urgentText}>مستعجل</Text>
          </View>
        )}
        <View style={[s.statusBadge, { backgroundColor: sConf.bg }]}>
          <View style={[s.statusDot, { backgroundColor: sConf.dot }]} />
          <Text style={[s.statusText, { color: sConf.dot }]}>{sConf.label}</Text>
        </View>
      </View>

      {/* Heart */}
      <View style={s.heartBtn}>
        <Heart size={12} color="#9CA3AF" />
      </View>

      {/* Body */}
      <View style={s.recentBody}>
        <Text style={s.recentTitle} numberOfLines={2}>{item.title}</Text>
        <View style={s.recentMeta}>
          {item.city ? (
            <View style={s.metaRow}>
              <MapPin size={10} color={D.textSec} />
              <Text style={s.metaText}>{item.city}</Text>
            </View>
          ) : null}
          <View style={s.metaRow}>
            <Clock size={10} color={D.textSec} />
            <Text style={s.metaText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Home Screen ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const { guard, GuestGateModal } = useGuestGate();

  const [recent, setRecent]           = useState<RecentListing[]>([]);
  const [recentLoading, setLoading]   = useState(true);

  // Entry animations — staggered
  const anim0 = useRef(new Animated.Value(0)).current; // logo
  const anim1 = useRef(new Animated.Value(0)).current; // title
  const anim2 = useRef(new Animated.Value(0)).current; // verse
  const anim3 = useRef(new Animated.Value(0)).current; // search
  const anim4 = useRef(new Animated.Value(0)).current; // cards + cta
  const anim5 = useRef(new Animated.Value(0)).current; // recent

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(anim0, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(anim1, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(anim2, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(anim3, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(anim4, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(anim5, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadRecent = useCallback(() => {
    setLoading(true);
    supabase
      .from('listings')
      .select('id, title, type, city, image_url, is_urgent, created_at, status')
      .in('status', ['available', 'reserved', 'reserved_temp'])
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (error) console.error('[HomeScreen] loadRecent:', error.message);
        if (data) setRecent(data);
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadRecent);

  const handleSearch = () =>
    router.push('/search');

  return (
    <View style={s.root}>
      {/* ── Background ── */}
      <LuxuryBackground />
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      <GuestGateModal />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ── Logo + Tagline ── */}
        <LogoHeader anim={anim0} />

        {/* ── Hero Title ── */}
        <HeroTitle anim={anim1} />

        {/* ── Quran Card ── */}
        <View style={s.padH}>
          <QuranCard anim={anim2} />
        </View>

        {/* ── Search Bar ── */}
        <View style={s.padH}>
          <LuxurySearchBar anim={anim3} onPress={handleSearch} />
        </View>

        {/* ── Category Cards ── */}
        <Animated.View
          style={[
            s.catRow,
            {
              opacity: anim4,
              transform: [{ translateY: anim4.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            },
          ]}
        >
          {/* بدّل card */}
          <CategoryCard
            label="بدّل"
            sub="تبادل بلا مال"
            imageUri="https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=600"
            glowColor={D.exchange}
            borderColor="rgba(56,189,248,0.22)"
            iconBg="rgba(56,189,248,0.15)"
            iconEl={<ArrowLeftRight size={22} color={D.exchange} strokeWidth={2.2} />}
            gradColors={['rgba(10,18,26,0.92)', 'rgba(10,18,26,0.70)', 'rgba(10,18,26,0.20)', 'transparent']}
            onPress={() => router.push('/(tabs)/exchange')}
          />

          {/* خذها card */}
          <CategoryCard
            label="خذها"
            sub="مجاني تمامًا"
            imageUri="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=600"
            glowColor={D.primary}
            borderColor="rgba(34,197,94,0.22)"
            iconBg="rgba(34,197,94,0.15)"
            iconEl={<Gift size={22} color={D.primary} strokeWidth={2.2} />}
            gradColors={['rgba(4,14,8,0.92)', 'rgba(4,14,8,0.70)', 'rgba(4,14,8,0.20)', 'transparent']}
            onPress={() => router.push('/(tabs)/free')}
          />
        </Animated.View>

        {/* ── Add Post CTA ── */}
        <Animated.View
          style={[
            s.ctaWrap,
            {
              opacity: anim4,
              transform: [{ translateY: anim4.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => guard(() => router.push('/add-post'))}
            activeOpacity={0.86}
          >
            <LinearGradient
              colors={['#22C55E', '#15803D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.ctaBtnShine} />
            <Plus size={20} color="#fff" strokeWidth={2.8} />
            <Text style={s.ctaBtnText}>أضف إعلان</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Recent Listings ── */}
        <Animated.View
          style={{
            opacity: anim5,
            transform: [{ translateY: anim5.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <View style={s.sectionHeader}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/free')} activeOpacity={0.7}>
              <Text style={s.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>آخر الإعلانات ✨</Text>
          </View>

          {recentLoading ? (
            <View style={s.recentCenter}>
              <ActivityIndicator size="large" color={D.primary} />
              <Text style={s.recentEmpty}>جاري تحميل الإعلانات...</Text>
            </View>
          ) : recent.length === 0 ? (
            <View style={s.recentCenter}>
              <Gift size={40} color="rgba(255,255,255,0.10)" />
              <Text style={s.recentEmpty}>لا توجد إعلانات حالياً</Text>
            </View>
          ) : (
            <View style={s.recentGrid}>
              {recent.map((item) => (
                <RecentCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/post-detail?id=${item.id}`)}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const CARD_W = (SW - 48 - 12) / 2;

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: D.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 0,
  },
  padH: { paddingHorizontal: 20 },

  // ── Logo ──
  logoSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
    marginBottom: 4,
  },
  logoCard: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.60,
    shadowRadius: 18,
    overflow: 'visible',
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(34,197,94,0.09)',
  },
  logoName: {
    fontSize: 38,
    fontWeight: '900',
    color: D.white,
    letterSpacing: -1.2,
    marginTop: 2,
  },
  logoTagline: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(207,207,207,0.70)',
    letterSpacing: 0.5,
    marginTop: -2,
  },

  // ── Hero Title ──
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 6,
    marginBottom: 4,
  },
  titleTop: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 0,
  },
  titleGreen: {
    fontSize: 40,
    fontWeight: '900',
    color: D.primary,
    letterSpacing: -1.5,
    textShadowColor: 'rgba(34,197,94,0.50)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  titleWhite: {
    fontSize: 26,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.80)',
  },
  titleGold: {
    fontSize: 40,
    fontWeight: '900',
    color: D.gold,
    letterSpacing: -1.5,
    textShadowColor: 'rgba(212,175,55,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  titleDesc: {
    fontSize: 14,
    color: D.textSec,
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
    marginTop: 4,
    opacity: 0.80,
  },

  // ── Quran Card ──
  verseCardOuter: {
    marginBottom: 14,
  },
  verseCard: {
    position: 'relative',
  },
  verseGlow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 38,
    backgroundColor: 'rgba(34,197,94,0.06)',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
  },
  verseGlass: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  leafWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 56,
    height: 56,
    opacity: 0.9,
  },
  verseBar: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 2,
    backgroundColor: 'rgba(34,197,94,0.65)',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  verseContent: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 5,
  },
  verseText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'right',
    lineHeight: 25,
    letterSpacing: 0.3,
    writingDirection: 'rtl',
  },
  verseRef: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(34,197,94,0.75)',
    textAlign: 'right',
    letterSpacing: 0.4,
    marginTop: 2,
  },

  // ── Search Bar ──
  searchWrap: {
    marginBottom: 16,
  },
  searchBar: {
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(15,15,15,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  searchIconWrap: {
    paddingHorizontal: 8,
  },

  // ── Category Cards ──
  catRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  catCardTouchable: {
    flex: 1,
  },
  catCard: {
    height: 210,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: 'rgba(12,12,12,0.80)',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 10,
    position: 'relative',
  },
  catCardImage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  catCardContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  catLabel: {
    fontSize: 24,
    fontWeight: '900',
    color: D.white,
    textAlign: 'right',
    letterSpacing: -0.8,
  },
  catSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(207,207,207,0.65)',
    textAlign: 'right',
  },
  catTopLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    opacity: 0.35,
  },

  // ── CTA Button ──
  ctaWrap: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  ctaBtn: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 10,
  },
  ctaBtnShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  ctaBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: D.white,
    letterSpacing: 0.4,
  },

  // ── Recent Section ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: D.white,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: D.primary,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  recentCard: {
    width: CARD_W,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(14,14,14,0.80)',
    borderWidth: 1,
    borderColor: D.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 6,
  },
  recentImg: {
    width: '100%',
    height: 118,
    resizeMode: 'cover',
  },
  recentImgPlaceholder: {
    width: '100%',
    height: 118,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentImgGrad: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 58,
  },
  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentBody: { padding: 10, gap: 5 },
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: D.white,
    textAlign: 'right',
    lineHeight: 19,
  },
  recentMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, fontWeight: '500', color: D.textSec },
  recentCenter: {
    paddingVertical: 44,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  recentEmpty: {
    fontSize: 14,
    color: D.textSec,
    textAlign: 'center',
  },
});
