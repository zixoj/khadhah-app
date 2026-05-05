import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  User, ChevronLeft, LogOut, Edit3, Star, Heart, Wallet, Bell, Shield,
  List, Activity, CheckCircle, Truck, Megaphone, Phone, ShieldCheck, MessageSquare,
} from 'lucide-react-native';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';

interface ExtendedProfile {
  id: string; full_name: string; phone: string; phone_verified: boolean;
  role: string; avatar_url: string; city: string; is_verified: boolean;
  rating_avg: number; rating_count: number; wallet_balance: number;
  boost_count: number; created_at: string;
}

export default function ProfileScreen() {
  const { profile: baseProfile, signOut } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const C = colors;
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [myListingsCount, setMyListingsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);

  useEffect(() => {
    if (baseProfile?.id) { fetchProfile(); fetchCounts(); }
  }, [baseProfile?.id]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', baseProfile!.id).maybeSingle();
    if (data) setProfile(data as ExtendedProfile);
  };

  const fetchCounts = async () => {
    const [listingsRes, favRes] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', baseProfile!.id),
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', baseProfile!.id),
    ]);
    setMyListingsCount(listingsRes.count || 0);
    setFavoritesCount(favRes.count || 0);
  };

  const handleSignOut = async () => { await signOut(); router.replace('/(auth)/login'); };
  const isAgent = profile?.role === 'delivery_agent';

  const renderStars = (avg: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={13} color={i < Math.round(avg) ? '#F59E0B' : (isDark ? C.border : '#E0E8EF')} fill={i < Math.round(avg) ? '#F59E0B' : 'transparent'} />
    ));

  return (
    <ScrollView style={[styles.container, { backgroundColor: C.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.headerBg, { backgroundColor: isDark ? C.surface : '#0F2318', borderBottomColor: isDark ? C.cardBorder : 'transparent', borderBottomWidth: isDark ? 1 : 0 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: isDark ? C.text : '#fff' }]}>حسابي</Text>
        </View>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => router.push('/settings/edit-profile')} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { borderColor: isDark ? C.primary : 'rgba(255,255,255,0.3)' }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? C.card : 'rgba(255,255,255,0.15)', borderColor: isDark ? C.primary : 'rgba(255,255,255,0.3)' }]}>
                <User size={38} color={isDark ? C.primary : '#fff'} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: isDark ? C.primary : '#fff' }]}>
              <Edit3 size={11} color={isDark ? '#000' : C.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: isDark ? C.text : '#fff' }]}>{profile?.full_name || 'مستخدم'}</Text>
              {profile?.is_verified && <CheckCircle size={17} color="#1DA1F2" fill="#1DA1F2" />}
            </View>
            <View style={styles.roleRow}>
              {isAgent ? <Truck size={12} color={isDark ? C.textSecondary : 'rgba(255,255,255,0.7)'} /> : <Megaphone size={12} color={isDark ? C.textSecondary : 'rgba(255,255,255,0.7)'} />}
              <Text style={[styles.roleText, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.7)' }]}>{isAgent ? 'مندوب توصيل' : 'معلن'}</Text>
              {profile?.city ? (<><Text style={[styles.dotSep, { color: isDark ? C.border : 'rgba(255,255,255,0.4)' }]}>•</Text><Text style={[styles.roleText, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.7)' }]}>{profile.city}</Text></>) : null}
            </View>
            <View style={styles.starsRow}>
              {renderStars(profile?.rating_avg || 0)}
              <Text style={[styles.ratingText, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.6)' }]}>
                {profile?.rating_avg ? profile.rating_avg.toFixed(1) : '0.0'} ({profile?.rating_count || 0})
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: isDark ? C.card : 'rgba(255,255,255,0.1)', borderColor: isDark ? C.cardBorder : 'rgba(255,255,255,0.15)' }]}>
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-listings')} activeOpacity={0.7}>
            <Text style={[styles.statNum, { color: isDark ? C.primary : '#fff' }]}>{myListingsCount}</Text>
            <Text style={[styles.statLabel, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.65)' }]}>إعلاناتي</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: isDark ? C.border : 'rgba(255,255,255,0.15)' }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/favorites')} activeOpacity={0.7}>
            <Text style={[styles.statNum, { color: isDark ? C.primary : '#fff' }]}>{favoritesCount}</Text>
            <Text style={[styles.statLabel, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.65)' }]}>المفضلة</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: isDark ? C.border : 'rgba(255,255,255,0.15)' }]} />
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/wallet')} activeOpacity={0.7}>
            <Text style={[styles.statNum, { color: isDark ? C.primary : '#fff' }]}>{profile?.wallet_balance?.toFixed(0) || '0'}</Text>
            <Text style={[styles.statLabel, { color: isDark ? C.textSecondary : 'rgba(255,255,255,0.65)' }]}>رصيدي (ر.س)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Boost Banner */}
      {(profile?.boost_count || 0) > 0 && (
        <TouchableOpacity style={[styles.banner, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D' }]} onPress={() => router.push('/my-listings')} activeOpacity={0.85}>
          <ChevronLeft size={17} color="#F59E0B" />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.bannerTitle, { color: '#D97706' }]}>لديك {profile?.boost_count} بوست مجاني</Text>
            <Text style={[styles.bannerSub, { color: '#F59E0B' }]}>ميّز إعلانك الآن مجاناً</Text>
          </View>
          <Text style={{ fontSize: 22 }}>🚀</Text>
        </TouchableOpacity>
      )}

      {/* Phone verification */}
      {profile && !profile.phone_verified && (
        <TouchableOpacity style={[styles.banner, { backgroundColor: C.errorBg, borderColor: `${C.error}44` }]} onPress={() => setPhoneModalVisible(true)} activeOpacity={0.85}>
          <ChevronLeft size={17} color={C.error} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[styles.bannerTitle, { color: C.error }]}>وثّق رقم جوالك</Text>
            <Text style={[styles.bannerSub, { color: C.error, opacity: 0.75 }]}>مطلوب للحجز والتبديل والنشر</Text>
          </View>
          <Phone size={20} color={C.error} />
        </TouchableOpacity>
      )}

      {profile?.phone_verified && (
        <View style={[styles.verifiedBanner, { backgroundColor: isDark ? `${C.primary}10` : '#F0FDF4', borderColor: isDark ? `${C.primary}30` : '#86EFAC' }]}>
          <ShieldCheck size={17} color={C.primary} />
          <Text style={[styles.verifiedBannerText, { color: C.primary }]}>رقم الجوال موثق</Text>
        </View>
      )}

      <PhoneVerifyModal
        visible={phoneModalVisible}
        currentPhone={profile?.phone ?? ''}
        onClose={() => setPhoneModalVisible(false)}
        onVerified={() => { setPhoneModalVisible(false); fetchProfile(); }}
      />

      {/* Section: الحساب */}
      <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
        <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>الحساب</Text>
        <MenuItem icon={<Edit3 size={18} color={C.primary} />} label="تعديل الملف الشخصي" onPress={() => router.push('/settings/edit-profile')} colors={C} isDark={isDark} />
        <MenuItem icon={<List size={18} color={C.primary} />} label="إعلاناتي" badge={myListingsCount > 0 ? `${myListingsCount}` : undefined} onPress={() => router.push('/my-listings')} colors={C} isDark={isDark} />
        <MenuItem icon={<MessageSquare size={18} color={C.exchange} />} label="محادثاتي" onPress={() => router.push('/conversations')} colors={C} isDark={isDark} />
        <MenuItem icon={<Heart size={18} color={C.error} />} label="المفضلة" badge={favoritesCount > 0 ? `${favoritesCount}` : undefined} onPress={() => router.push('/favorites')} colors={C} isDark={isDark} />
        <MenuItem icon={<Wallet size={18} color="#F59E0B" />} label="المحفظة" sublabel={`${profile?.wallet_balance?.toFixed(2) || '0.00'} ر.س`} onPress={() => router.push('/wallet')} colors={C} isDark={isDark} last />
      </View>

      {/* Section: الإعدادات */}
      <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
        <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>الإعدادات</Text>
        <MenuItem icon={<Bell size={18} color={C.primary} />} label="إعدادات الإشعارات" onPress={() => router.push('/notifications-settings')} colors={C} isDark={isDark} />
        <MenuItem icon={<Shield size={18} color={C.primary} />} label="الخصوصية والأمان" onPress={() => router.push('/settings/privacy-security')} colors={C} isDark={isDark} />
        <MenuItem icon={<Star size={18} color="#F59E0B" />} label="تقييماتي" onPress={() => router.push('/my-ratings')} colors={C} isDark={isDark} />
        <MenuItem icon={<Activity size={18} color={C.primary} />} label="سجل النشاط" onPress={() => router.push('/activity-log')} colors={C} isDark={isDark} last />
      </View>

      <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: C.errorBg, borderColor: `${C.error}44` }]} onPress={handleSignOut} activeOpacity={0.7}>
        <LogOut size={18} color={C.error} />
        <Text style={[styles.signOutText, { color: C.error }]}>تسجيل الخروج</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: C.textMuted }]}>خذه v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({
  icon, label, sublabel, badge, onPress, last = false, colors: C, isDark,
}: {
  icon: React.ReactNode; label: string; sublabel?: string; badge?: string;
  onPress: () => void; last?: boolean; colors: any; isDark: boolean;
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}
        onPress={onPress}
      >
        <ChevronLeft size={16} color={C.textMuted} />
        <View style={styles.menuRight}>
          <View style={styles.menuLabelRow}>
            <Text style={[styles.menuLabel, { color: C.text }]}>{label}</Text>
            {badge && (
              <View style={[styles.badgePill, { backgroundColor: isDark ? `${C.primary}20` : C.primary, borderColor: isDark ? C.primary : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                <Text style={[styles.badgeText, { color: isDark ? C.primary : '#fff' }]}>{badge}</Text>
              </View>
            )}
          </View>
          {sublabel && <Text style={[styles.menuSublabel, { color: C.primary }]}>{sublabel}</Text>}
        </View>
        <View style={[styles.menuIcon, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>{icon}</View>
      </Pressable>
      {!last && <View style={[styles.menuDivider, { backgroundColor: isDark ? C.border : '#F0F4F8' }]} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 110 },
  headerBg: { paddingBottom: Spacing.lg },
  headerTop: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'right' },
  avatarSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5 },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  nameBlock: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: FontSizes.xl, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleText: { fontSize: FontSizes.sm },
  dotSep: { fontSize: FontSizes.sm },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ratingText: { fontSize: FontSizes.xs, marginLeft: 4 },
  statsRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md, borderWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontSize: FontSizes.xl, fontWeight: '700' },
  statLabel: { fontSize: FontSizes.xs },
  statDivider: { width: 1 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md, padding: Spacing.md,
  },
  bannerTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  bannerSub: { fontSize: FontSizes.xs, marginTop: 2, textAlign: 'right' },
  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  verifiedBannerText: { fontSize: FontSizes.sm, fontWeight: '700' },

  sectionCard: {
    borderRadius: BorderRadius.xl, marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderWidth: 1, overflow: 'hidden',
  },
  sectionTitle: { fontSize: FontSizes.xs, fontWeight: '700', textAlign: 'right', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm },
  menuRight: { flex: 1, alignItems: 'flex-end' },
  menuLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  menuLabel: { fontSize: FontSizes.md, fontWeight: '500' },
  menuSublabel: { fontSize: FontSizes.sm, fontWeight: '600', marginTop: 2 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuDivider: { height: 1, marginLeft: Spacing.md },
  badgePill: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700' },

  signOutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md,
  },
  signOutText: { fontSize: FontSizes.lg, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: FontSizes.xs, marginTop: Spacing.lg },
});
