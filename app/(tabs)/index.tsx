import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeftRight, Gift, Plus, Flame, Clock, MapPin,
  Search, SlidersHorizontal, Globe, ChevronDown, PackageOpen,
} from 'lucide-react-native';
import { useGuestGate } from '@/hooks/useGuestGate';
import { useLanguage } from '@/lib/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Rect, Circle, Line, Defs, Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = (SW - 48 - 12) / 2;
const BAR_H = 76;

// ─── Design tokens ───────────────────────────────────────────────────────────
const D = {
  bg:          '#050505',
  cardDark:    'rgba(8,18,12,0.88)',
  primary:     '#22C55E',
  gold:        '#D4AF37',
  white:       '#FFFFFF',
  textSec:     '#CFCFCF',
  textMuted:   'rgba(255,255,255,0.32)',
  border:      'rgba(255,255,255,0.08)',
  greenBorder: 'rgba(34,197,94,0.20)',
  goldBorder:  'rgba(212,175,55,0.20)',
  exchange:    '#38BDF8',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
interface RecentListing {
  id: string; title: string; type: string; city: string;
  image_url: string; is_urgent: boolean; created_at: string; status: string;
}

const STATUS: Record<string, { label: string; bg: string; dot: string }> = {
  available:     { label: 'متاح',  bg: 'rgba(34,197,94,0.18)',  dot: '#22C55E' },
  reserved:      { label: 'محجوز', bg: 'rgba(245,158,11,0.18)', dot: '#F59E0B' },
  reserved_temp: { label: 'محجوز', bg: 'rgba(245,158,11,0.18)', dot: '#F59E0B' },
  taken:         { label: 'مأخوذ', bg: 'rgba(239,68,68,0.18)',  dot: '#EF4444' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `${Math.floor(s / 60)} د`;
  if (s < 86400) return `${Math.floor(s / 3600)} س`;
  return `${Math.floor(s / 86400)} يوم`;
}

// ─── Shimmer skeleton ────────────────────────────────────────────────────────
function SkeletonCard() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.09)'] });
  return (
    <View style={sk.card}>
      <Animated.View style={[sk.img, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <Animated.View style={[sk.line, { width: '80%', backgroundColor: bg }]} />
        <Animated.View style={[sk.line, { width: '52%', backgroundColor: bg, marginTop: 6 }]} />
        <Animated.View style={[sk.line, { width: '36%', backgroundColor: bg, marginTop: 6 }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card: { width: CARD_W, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(12,12,12,0.82)', borderWidth: 1, borderColor: D.border },
  img:  { width: '100%', height: 110 },
  body: { padding: 10 },
  line: { height: 10, borderRadius: 6 },
});

// ─── Background particles ────────────────────────────────────────────────────
const PARTICLES = [
  { x: 0.08, y: 0.06, sz: 2.0, op: 0.42, dur: 4200 },
  { x: 0.82, y: 0.12, sz: 1.5, op: 0.28, dur: 5300 },
  { x: 0.52, y: 0.20, sz: 2.4, op: 0.32, dur: 3600 },
  { x: 0.24, y: 0.36, sz: 1.3, op: 0.20, dur: 4900 },
  { x: 0.91, y: 0.44, sz: 1.7, op: 0.35, dur: 3900 },
];
function Particle({ x, y, sz, op, dur }: (typeof PARTICLES)[0]) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: dur, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x * SW, top: y * SH,
      width: sz, height: sz, borderRadius: sz / 2, backgroundColor: D.primary,
      opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [op * 0.25, op, op * 0.25] }),
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -13] }) }],
      shadowColor: D.primary, shadowOpacity: 0.9, shadowRadius: sz * 4,
    }} />
  );
}

// ─── Riyadh Skyline ───────────────────────────────────────────────────────────
function RiyadhSkyline() {
  const W = SW, H = 260, G = H - 12;
  const s = W / 390;
  const px = (v: number) => v * s;
  const py = (v: number) => G - v * s;
  const C1 = 'rgba(34,197,94,0.13)', C2 = 'rgba(34,197,94,0.24)', BK = '#050505';
  return (
    <View pointerEvents="none" style={bg.skyline}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgLinearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={D.bg} stopOpacity="1" />
            <Stop offset="0.5" stopColor={D.bg} stopOpacity="0.4" />
            <Stop offset="1"   stopColor={D.bg} stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"   stopColor="#22C55E" stopOpacity="0" />
            <Stop offset="0.3" stopColor="#22C55E" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#22C55E" stopOpacity="1" />
            <Stop offset="0.7" stopColor="#22C55E" stopOpacity="0.55" />
            <Stop offset="1"   stopColor="#22C55E" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {/* Left towers */}
        <Rect x={px(4)}  y={py(48)} width={px(18)} height={px(48)} fill={BK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(26)} y={py(34)} width={px(14)} height={px(34)} fill={BK} stroke={C1} strokeWidth="0.7" />
        <Rect x={px(44)} y={py(62)} width={px(19)} height={px(62)} fill={BK} stroke={C1} strokeWidth="0.8" />
        <Line x1={px(53)} y1={py(62)} x2={px(53)} y2={py(72)} stroke={C2} strokeWidth="1.1" />
        {/* Al Faisaliah */}
        <Rect x={px(76)}  y={py(22)} width={px(32)} height={px(22)} fill={BK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(79)}  y={py(82)} width={px(26)} height={px(60)} fill={BK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(83)}  y={py(132)} width={px(18)} height={px(50)} fill={BK} stroke={C2} strokeWidth="1.1" />
        <Rect x={px(88)}  y={py(148)} width={px(8)} height={px(16)} fill={BK} stroke={C2} strokeWidth="0.9" />
        <Circle cx={px(92)} cy={py(150)} r={px(4.5)} fill={BK} stroke={C2} strokeWidth="1.3" />
        <Circle cx={px(92)} cy={py(150)} r={px(7.5)} fill="none" stroke={C2} strokeWidth="0.4" opacity="0.3" />
        <Line x1={px(92)} y1={py(154)} x2={px(92)} y2={py(170)} stroke={C2} strokeWidth="1.4" />
        <Circle cx={px(92)} cy={py(170)} r={px(1.5)} fill={C2} opacity="0.9" />
        {/* Mid cluster */}
        <Rect x={px(122)} y={py(56)} width={px(15)} height={px(56)} fill={BK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(140)} y={py(79)} width={px(21)} height={px(79)} fill={BK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(165)} y={py(60)} width={px(15)} height={px(60)} fill={BK} stroke={C1} strokeWidth="0.8" />
        {/* Kingdom Centre */}
        <Rect x={px(190)} y={py(160)} width={px(15)} height={px(160)} fill={BK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(228)} y={py(160)} width={px(15)} height={px(160)} fill={BK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(190)} y={py(166)} width={px(53)} height={px(16)} fill={BK} stroke={C2} strokeWidth="1.2" />
        <Rect x={px(205)} y={py(160)} width={px(23)} height={px(6)}  fill={BK} />
        {[10,24,38,54,70,88,106,124,142].map((yy, i) => (
          <Rect key={`kl${i}`} x={px(192)} y={py(yy+8)} width={px(11)} height={px(3)} fill={C1} opacity="0.17" rx="0.5" />
        ))}
        {[10,24,38,54,70,88,106,124,142].map((yy, i) => (
          <Rect key={`kr${i}`} x={px(230)} y={py(yy+8)} width={px(11)} height={px(3)} fill={C1} opacity="0.17" rx="0.5" />
        ))}
        {/* PIF Tower */}
        <Rect x={px(258)} y={py(112)} width={px(20)} height={px(112)} fill={BK} stroke={C2} strokeWidth="1.0" />
        <Line x1={px(268)} y1={py(112)} x2={px(268)} y2={py(124)} stroke={C2} strokeWidth="1.5" />
        <Circle cx={px(268)} cy={py(124)} r={px(2)} fill={C2} opacity="0.7" />
        {/* KAFD cluster */}
        <Rect x={px(284)} y={py(90)}  width={px(16)} height={px(90)}  fill={BK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(303)} y={py(104)} width={px(18)} height={px(104)} fill={BK} stroke={C1} strokeWidth="0.9" />
        <Line x1={px(312)} y1={py(104)} x2={px(312)} y2={py(114)} stroke={C2} strokeWidth="1.2" />
        {/* Clock tower */}
        <Rect x={px(328)} y={py(72)}  width={px(12)} height={px(72)}  fill={BK} stroke={C1} strokeWidth="0.8" />
        <Rect x={px(343)} y={py(110)} width={px(40)} height={px(85)}  fill={BK} stroke={C1} strokeWidth="0.9" />
        <Rect x={px(353)} y={py(132)} width={px(20)} height={px(22)}  fill={BK} stroke={C2} strokeWidth="1.1" />
        <Circle cx={px(363)} cy={py(121)} r={px(8)}  fill={BK} stroke={C2} strokeWidth="1.1" />
        <Line x1={px(363)} y1={py(132)} x2={px(363)} y2={py(160)} stroke={C2} strokeWidth="2.0" />
        <Path d={`M ${px(357)} ${py(162)} A ${px(6)} ${px(6)} 0 0 1 ${px(369)} ${py(162)}`}
          fill="none" stroke={C2} strokeWidth="1.6" strokeLinecap="round" />
        {/* Right fill */}
        <Rect x={px(390)} y={py(60)} width={px(20)} height={px(60)} fill={BK} stroke={C1} strokeWidth="0.8" />
        <Line x1={px(400)} y1={py(60)} x2={px(400)} y2={py(70)} stroke={C2} strokeWidth="1.0" />
        {/* Ground */}
        <Rect x={0} y={G - 4} width={W} height={8} fill="#22C55E" opacity="0.05" />
        <Line x1={0} y1={G} x2={W} y2={G} stroke="url(#gg)" strokeWidth="1.2" />
        {/* Fade top */}
        <Rect x={0} y={0} width={W} height={H} fill="url(#sf)" />
      </Svg>
    </View>
  );
}

// ─── Luxury Background ────────────────────────────────────────────────────────
function LuxuryBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: D.bg }]} />
      <View style={bg.r1} /><View style={bg.r2} /><View style={bg.r3} /><View style={bg.r4} />
      <View style={bg.gTop} /><View style={bg.gMid} />
      <RiyadhSkyline />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(4,12,7,0.80)' }]} />
      <LinearGradient colors={['rgba(5,5,5,0.96)', 'rgba(5,5,5,0.45)', 'transparent']}
        style={bg.gradTop} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(5,5,5,0.65)', 'rgba(5,5,5,0.92)']}
        style={bg.gradBot} pointerEvents="none" />
      <LinearGradient colors={['rgba(5,5,5,0.32)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={bg.vigL} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(5,5,5,0.32)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={bg.vigR} pointerEvents="none" />
    </View>
  );
}
const bg = StyleSheet.create({
  skyline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, opacity: 0.62 },
  r1: { position: 'absolute', top: -220, alignSelf: 'center', width: 600, height: 600, borderRadius: 300, borderWidth: 1, borderColor: 'rgba(34,197,94,0.07)', backgroundColor: 'transparent' },
  r2: { position: 'absolute', top: -80,  alignSelf: 'center', width: 400, height: 400, borderRadius: 200, borderWidth: 1, borderColor: 'rgba(34,197,94,0.05)', backgroundColor: 'transparent' },
  r3: { position: 'absolute', top: SH * 0.28, right: -170, width: 420, height: 420, borderRadius: 210, borderWidth: 1, borderColor: 'rgba(212,175,55,0.04)', backgroundColor: 'transparent' },
  r4: { position: 'absolute', top: SH * 0.50, left: -130,  width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(34,197,94,0.04)', backgroundColor: 'transparent' },
  gTop: { position: 'absolute', top: -SW * 0.52, alignSelf: 'center', width: SW * 0.88, height: SW * 0.88, borderRadius: SW * 0.44, backgroundColor: 'rgba(34,197,94,0.055)' },
  gMid: { position: 'absolute', top: SH * 0.22,  right: -SW * 0.32, width: SW * 0.72, height: SW * 0.72, borderRadius: SW * 0.36, backgroundColor: 'rgba(20,83,45,0.055)' },
  gradTop: { position: 'absolute', top: 0,    left: 0, right: 0, height: SH * 0.36 },
  gradBot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SH * 0.28 },
  vigL: { position: 'absolute', top: 0, left: 0,  bottom: 0, width: SW * 0.13 },
  vigR: { position: 'absolute', top: 0, right: 0, bottom: 0, width: SW * 0.13 },
});

// ─── Quran Card ───────────────────────────────────────────────────────────────
function QuranCard({ anim }: { anim: Animated.Value }) {
  return (
    <Animated.View style={[s.qc, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }]}>
      <View style={s.qcGlow} />
      <View style={s.qcCard}>
        <View style={s.qcLeaf} pointerEvents="none">
          <Svg width={52} height={52} viewBox="0 0 52 52">
            <Path d="M 0 52 Q 0 38 14 38 Q 14 24 28 24 Q 28 10 42 10 Q 42 0 52 0"
              fill="none" stroke="rgba(34,197,94,0.30)" strokeWidth="1.0" />
            <Path d="M 0 52 Q 0 32 20 32 Q 20 12 40 12 Q 40 0 52 0"
              fill="none" stroke="rgba(34,197,94,0.17)" strokeWidth="0.8" />
            <Path d="M 44 8 C 48 13, 44 20, 38 18 C 40 12, 44 8, 44 8 Z"
              fill="rgba(34,197,94,0.22)" stroke="rgba(34,197,94,0.40)" strokeWidth="0.6" />
            <Circle cx={5} cy={47} r={1.3} fill="rgba(34,197,94,0.35)" />
            <Circle cx={47} cy={5} r={1.3} fill="rgba(34,197,94,0.35)" />
          </Svg>
        </View>
        <View style={s.qcBar} />
        <View style={s.qcContent}>
          <Text style={s.qcQ}>﴿</Text>
          <Text style={s.qcV}>وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى</Text>
          <Text style={s.qcV}>وَلَا تَعَاوَنُوا عَلَى الْإِثْمِ وَالْعُدْوَانِ</Text>
          <Text style={s.qcQ}>﴾</Text>
          <Text style={s.qcRef}>سورة المائدة — آية ٢</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({
  label, sub, pill, imageUri, accentColor, borderColor, iconEl, gradTop, onPress,
}: {
  label: string; sub: string; pill: string; imageUri: string;
  accentColor: string; borderColor: string; iconEl: React.ReactNode;
  gradTop: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 140, friction: 8 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1.0,  useNativeDriver: true, tension: 80,  friction: 7 }).start();

  return (
    <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
      activeOpacity={1} style={{ flex: 1 }}>
      <Animated.View style={[s.ac, { borderColor, shadowColor: accentColor, transform: [{ scale }] }]}>
        <Image source={{ uri: imageUri }} style={s.acImg} resizeMode="cover" />
        <LinearGradient
          colors={[gradTop, gradTop.replace(/[\d.]+\)$/, '0.33)'), 'transparent']}
          style={s.acGradTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={s.acGradBot}
          pointerEvents="none"
        />
        <View style={s.acContent}>
          <View style={[s.acPill, { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}18` }]}>
            <Text style={[s.acPillText, { color: accentColor }]}>{pill}</Text>
          </View>
          <View style={[s.acIconWrap, { backgroundColor: `${accentColor}1A` }]}>
            {iconEl}
          </View>
          <Text style={s.acLabel}>{label}</Text>
          <Text style={[s.acSub, { color: `${accentColor}CC` }]}>{sub}</Text>
        </View>
        <View style={[s.acArrow, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}40` }]}>
          <Text style={[s.acArrowText, { color: accentColor }]}>←</Text>
        </View>
        <View style={[s.acTopLine, { backgroundColor: accentColor }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({ item, onPress }: { item: RecentListing; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 180, friction: 10 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1.0,  useNativeDriver: true, tension: 100, friction: 8  }).start();

  const sc = STATUS[item.status] ?? { label: item.status, bg: 'rgba(100,116,139,0.18)', dot: '#9CA3AF' };
  const isFree = item.type === 'free';
  const typeColor = isFree ? D.primary : D.exchange;
  const typeLabel = isFree ? 'مجاني' : 'بدّل';
  const TypeIcon  = isFree ? Gift : ArrowLeftRight;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      style={{ width: CARD_W }}
    >
      <Animated.View style={[s.rCard, { transform: [{ scale }] }]}>
        {/* Image or placeholder */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={s.rImg} resizeMode="cover" />
        ) : (
          <View style={[s.rImgPH, { backgroundColor: isFree ? 'rgba(34,197,94,0.08)' : 'rgba(56,189,248,0.08)' }]}>
            <TypeIcon size={26} color={typeColor} strokeWidth={1.5} />
          </View>
        )}

        {/* Image bottom gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.62)']}
          style={s.rImgGrad}
          pointerEvents="none"
        />

        {/* Top badges row */}
        <View style={s.rBadgeRow}>
          {/* Urgent badge */}
          {item.is_urgent && (
            <View style={s.urgBadge}>
              <Flame size={8} color="#fff" strokeWidth={2.5} />
              <Text style={s.urgTxt}>مستعجل</Text>
            </View>
          )}
          {/* Status badge — right-aligned using spacer */}
          <View style={{ flex: 1 }} />
          <View style={[s.stBadge, { backgroundColor: sc.bg }]}>
            <View style={[s.stDot, { backgroundColor: sc.dot }]} />
            <Text style={[s.stTxt, { color: sc.dot }]}>{sc.label}</Text>
          </View>
        </View>

        {/* Type pill — bottom-left of image */}
        <View style={[s.typePill, { backgroundColor: `${typeColor}22`, borderColor: `${typeColor}44` }]}>
          <TypeIcon size={8} color={typeColor} strokeWidth={2.5} />
          <Text style={[s.typeTxt, { color: typeColor }]}>{typeLabel}</Text>
        </View>

        {/* Body */}
        <View style={s.rBody}>
          <Text style={s.rTitle} numberOfLines={2}>{item.title}</Text>
          <View style={s.rMeta}>
            {item.city ? (
              <View style={s.mRow}>
                <MapPin size={9} color={D.textMuted} strokeWidth={2} />
                <Text style={s.mTxt} numberOfLines={1}>{item.city}</Text>
              </View>
            ) : null}
            <View style={s.mRowRight}>
              <Clock size={9} color={D.textMuted} strokeWidth={2} />
              <Text style={s.mTxt}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyListings({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconWrap}>
        <PackageOpen size={36} color="rgba(34,197,94,0.45)" strokeWidth={1.5} />
      </View>
      <Text style={s.emptyTitle}>لا توجد إعلانات بعد</Text>
      <Text style={s.emptySub}>كن أول من ينشر إعلاناً في مجتمعك</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onAdd} activeOpacity={0.82}>
        <Plus size={14} color={D.bg} strokeWidth={2.8} />
        <Text style={s.emptyBtnTxt}>أضف أول إعلان</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const { guard, GuestGateModal } = useGuestGate();
  const { language, setLanguage } = useLanguage();

  const [recent, setRecent]   = useState<RecentListing[]>([]);
  const [loading, setLoading] = useState(true);

  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const a4 = useRef(new Animated.Value(0)).current;
  const a5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.spring(a0, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(a1, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(a2, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(a3, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(a4, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(a5, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
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
      .then(({ data }) => {
        if (data) setRecent(data);
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadRecent);

  const bottomPad = Platform.OS !== 'web'
    ? Math.max(insets.bottom, 8) + BAR_H + 40
    : BAR_H + 50;

  const handleAddPost = () => guard(() => router.push('/add-post'));

  return (
    <View style={s.root}>
      <LuxuryBackground />
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      <GuestGateModal />

      {/* Language toggle — absolute top-right */}
      <View style={[s.langWrap, { top: insets.top + 14, right: 20 }]}>
        <TouchableOpacity
          style={s.langBtn}
          onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          activeOpacity={0.70}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Globe size={13} color="rgba(255,255,255,0.75)" strokeWidth={1.8} />
          <Text style={s.langText}>{language === 'ar' ? 'العربية' : 'EN'}</Text>
          <ChevronDown size={11} color="rgba(255,255,255,0.50)" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: bottomPad }}
      >
        {/* ── 1. Logo / Brand ──────────────────────────────── */}
        <Animated.View style={[s.logoSec, {
          opacity: a0,
          transform: [{ translateY: a0.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        }]}>
          <View style={s.logoIcon}>
            <View style={s.logoIconGlow} />
            <Svg width={36} height={32} viewBox="0 0 52 48">
              <Path d="M6 28 C6 14, 20 10, 34 14 L30 8 L46 18 L30 26 L34 20 C22 17, 12 20, 12 30"
                fill="none" stroke="#22C55E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M46 20 C46 34, 32 38, 18 34 L22 40 L6 30 L22 22 L18 28 C30 31, 40 28, 40 18"
                fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={s.logoName}>خذها</Text>
          <Text style={s.logoTagline}>عطاء اليوم، أجر الغد</Text>
        </Animated.View>

        {/* ── 2. Hero Headline ─────────────────────────────── */}
        <Animated.View style={[s.heroSec, {
          opacity: a1,
          transform: [{ translateY: a1.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }]}>
          <Text style={s.heroTop}>لا ترميها...</Text>
          <View style={s.heroRow}>
            <Text style={s.heroGold}>بدّلها</Text>
            <Text style={s.heroOr}> أو </Text>
            <Text style={s.heroGreen}>خذها</Text>
          </View>
          <Text style={s.heroDesc}>اعرض أغراضك مجانًا أو بدّلها بما تحتاجه</Text>
        </Animated.View>

        {/* ── 3. Quran Card ────────────────────────────────── */}
        <View style={s.pH}>
          <QuranCard anim={a2} />
        </View>

        {/* ── 4. Search + Filter Row ───────────────────────── */}
        <Animated.View style={[s.searchRow, {
          opacity: a3,
          transform: [{ translateY: a3.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }]}>
          <TouchableOpacity
            style={s.filterBtn}
            onPress={() => router.push('/search')}
            activeOpacity={0.78}
          >
            <SlidersHorizontal size={18} color={D.primary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.searchPill}
            onPress={() => router.push('/search')}
            activeOpacity={0.82}
          >
            <Text style={s.searchText}>ابحث عن إعلانات، مدن، فئات...</Text>
            <Search size={16} color={D.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── 5. Action Cards ──────────────────────────────── */}
        <Animated.View style={[s.cardRow, {
          opacity: a4,
          transform: [{ translateY: a4.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }]}>
          <ActionCard
            label="بدّل"
            sub="تبادل بلا مال"
            pill="تبادل بما تحتاجه"
            imageUri="https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=600"
            accentColor={D.primary}
            borderColor={D.greenBorder}
            iconEl={<ArrowLeftRight size={20} color={D.primary} strokeWidth={2.2} />}
            gradTop="rgba(8,20,12,0.96)"
            onPress={() => router.push('/(tabs)/exchange')}
          />
          <ActionCard
            label="خذها"
            sub="مجاني تمامًا"
            pill="أغراض مجانية"
            imageUri="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=600"
            accentColor={D.gold}
            borderColor={D.goldBorder}
            iconEl={<Gift size={20} color={D.gold} strokeWidth={2.2} />}
            gradTop="rgba(16,12,4,0.96)"
            onPress={() => router.push('/(tabs)/free')}
          />
        </Animated.View>

        {/* ── 6. CTA Button ────────────────────────────────── */}
        <Animated.View style={[s.pH, {
          opacity: a4,
          transform: [{ translateY: a4.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }]}>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={handleAddPost}
            activeOpacity={0.86}
          >
            <LinearGradient colors={['#22C55E', '#16A34A', '#15803D']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject} />
            <View style={s.ctaShine} />
            <Plus size={20} color="#fff" strokeWidth={3} />
            <Text style={s.ctaText}>أضف إعلاناً</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 7. Recent Listings ───────────────────────────── */}
        <Animated.View style={{
          opacity: a5,
          transform: [{ translateY: a5.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
        }}>
          <View style={s.secHeader}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/exchange')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}
            >
              <Text style={s.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={s.secTitle}>آخر الإعلانات</Text>
          </View>

          {loading ? (
            <View style={s.rGrid}>
              {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </View>
          ) : recent.length === 0 ? (
            <EmptyListings onAdd={handleAddPost} />
          ) : (
            <View style={s.rGrid}>
              {recent.map((item) => (
                <ListingCard
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: D.bg },
  scroll: { flex: 1 },
  pH:     { paddingHorizontal: 20 },

  // Language toggle
  langWrap: { position: 'absolute', zIndex: 100 },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(6,16,10,0.78)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
    shadowColor: D.primary, shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  langText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.3 },

  // Logo
  logoSec: { alignItems: 'center', paddingTop: 12, paddingBottom: 2, gap: 4, marginBottom: 2 },
  logoIcon: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.30)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 16, position: 'relative',
  },
  logoIconGlow: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  logoName: {
    fontSize: 36, fontWeight: '900', color: D.white,
    letterSpacing: -1.0, marginTop: 4,
  },
  logoTagline: {
    fontSize: 12, fontWeight: '500',
    color: 'rgba(207,207,207,0.60)', letterSpacing: 0.4,
  },

  // Hero
  heroSec: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, gap: 5, marginBottom: 6 },
  heroTop: { fontSize: 19, fontWeight: '700', color: 'rgba(255,255,255,0.70)', textAlign: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 0 },
  heroGreen: {
    fontSize: 38, fontWeight: '900', color: D.primary, letterSpacing: -1.2,
    textShadowColor: 'rgba(34,197,94,0.48)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  heroOr:   { fontSize: 24, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  heroGold: {
    fontSize: 38, fontWeight: '900', color: D.gold, letterSpacing: -1.2,
    textShadowColor: 'rgba(212,175,55,0.42)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  heroDesc: { fontSize: 13.5, color: D.textSec, textAlign: 'center', lineHeight: 21, opacity: 0.80, marginTop: 2 },

  // Quran card
  qc:     { marginBottom: 14 },
  qcGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 38, backgroundColor: 'rgba(34,197,94,0.055)',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 18,
  },
  qcCard: {
    borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(4,12,7,0.72)',
    paddingVertical: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 14,
  },
  qcLeaf: { position: 'absolute', top: 0, right: 0, width: 52, height: 52, opacity: 0.95 },
  qcBar: {
    width: 3, alignSelf: 'stretch', minHeight: 50, borderRadius: 2,
    backgroundColor: 'rgba(34,197,94,0.70)',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5,
  },
  qcContent: { flex: 1, alignItems: 'flex-end', gap: 3 },
  qcQ:   { fontSize: 16, fontWeight: '700', color: 'rgba(34,197,94,0.70)' },
  qcV:   { fontSize: 13.5, fontWeight: '700', color: 'rgba(255,255,255,0.88)', textAlign: 'right', lineHeight: 24, letterSpacing: 0.3, writingDirection: 'rtl' },
  qcRef: { fontSize: 11, fontWeight: '500', color: 'rgba(34,197,94,0.72)', textAlign: 'right', marginTop: 3 },

  // Search row
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 14,
  },
  filterBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(8,20,12,0.88)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10,
  },
  searchPill: {
    flex: 1, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(10,18,13,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 14, paddingRight: 18, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 12,
  },
  searchText: { flex: 1, fontSize: 13, color: D.textMuted, textAlign: 'right' },

  // Action cards
  cardRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 14 },
  ac: {
    flex: 1, height: 240, borderRadius: 26, borderWidth: 1,
    backgroundColor: D.cardDark, overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 10,
    position: 'relative',
  },
  acImg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' },
  acGradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '68%' },
  acGradBot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%' },
  acContent: {
    paddingHorizontal: 14, paddingTop: 14, gap: 5, alignItems: 'flex-end', zIndex: 2,
  },
  acPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
    marginBottom: 2,
  },
  acPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  acIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  acLabel: { fontSize: 26, fontWeight: '900', color: D.white, textAlign: 'right', letterSpacing: -0.8 },
  acSub:   { fontSize: 11, fontWeight: '600', textAlign: 'right' },
  acArrow: {
    position: 'absolute', bottom: 14, left: 14,
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  acArrowText: { fontSize: 14, fontWeight: '900' },
  acTopLine: { position: 'absolute', top: 0, left: 16, right: 16, height: 1, opacity: 0.40 },

  // CTA
  ctaBtn: {
    height: 62, borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    overflow: 'hidden',
    shadowColor: D.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.50, shadowRadius: 20,
    elevation: 10, marginBottom: 24,
  },
  ctaShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '46%',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: D.white, letterSpacing: 0.3 },

  // Section header
  secHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  secTitle: { fontSize: 16, fontWeight: '800', color: D.white, letterSpacing: -0.2 },
  seeAll:   { fontSize: 13, fontWeight: '600', color: D.primary },

  // Listing grid
  rGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },

  // Listing card
  rCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(10,16,12,0.90)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 5,
  },
  rImg:    { width: '100%', height: 116, resizeMode: 'cover' },
  rImgPH:  { width: '100%', height: 116, justifyContent: 'center', alignItems: 'center' },
  rImgGrad: { position: 'absolute', top: 56, left: 0, right: 0, height: 60 },

  rBadgeRow: {
    position: 'absolute', top: 7, left: 7, right: 7,
    flexDirection: 'row', alignItems: 'center',
  },
  urgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99,
  },
  urgTxt: { fontSize: 9, color: '#fff', fontWeight: '700' },
  stBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  stDot: { width: 5, height: 5, borderRadius: 3 },
  stTxt: { fontSize: 9, fontWeight: '700' },

  typePill: {
    position: 'absolute', bottom: 44, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  typeTxt: { fontSize: 9, fontWeight: '700' },

  rBody:  { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 5 },
  rTitle: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.92)', textAlign: 'right', lineHeight: 18 },
  rMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mRow:   { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  mRowRight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mTxt:   { fontSize: 9.5, fontWeight: '500', color: 'rgba(207,207,207,0.58)' },

  // Empty state
  emptyWrap: {
    marginHorizontal: 20, paddingVertical: 36, paddingHorizontal: 24,
    alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(8,18,12,0.60)',
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(34,197,94,0.12)',
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.80)', textAlign: 'center' },
  emptySub:   { fontSize: 13, color: 'rgba(207,207,207,0.52)', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 6,
    backgroundColor: D.primary,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 16,
    shadowColor: D.primary, shadowOpacity: 0.40, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: D.bg },
});
