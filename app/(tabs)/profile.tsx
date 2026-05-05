import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  User,
  ChevronLeft,
  LogOut,
  Edit3,
  Star,
  Heart,
  Wallet,
  Bell,
  Shield,
  List,
  Activity,
  CheckCircle,
  Truck,
  Megaphone,
  Phone,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react-native';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';

interface ExtendedProfile {
  id: string;
  full_name: string;
  phone: string;
  phone_verified: boolean;
  role: string;
  avatar_url: string;
  city: string;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  wallet_balance: number;
  boost_count: number;
  created_at: string;
}

export default function ProfileScreen() {
  const { profile: baseProfile, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [myListingsCount, setMyListingsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);

  useEffect(() => {
    if (baseProfile?.id) {
      fetchProfile();
      fetchCounts();
    }
  }, [baseProfile?.id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', baseProfile!.id)
      .maybeSingle();
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

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const isAgent = profile?.role === 'delivery_agent';

  const renderStars = (avg: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        color={i < Math.round(avg) ? Colors.accent[500] : Colors.neutral[300]}
        fill={i < Math.round(avg) ? Colors.accent[500] : 'transparent'}
      />
    ));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerBg}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>حسابي</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => router.push('/settings/edit-profile')} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={40} color={Colors.primary[600]} />
              </View>
            )}
            <View style={styles.editBadge}>
              <Edit3 size={12} color={Colors.white} />
            </View>
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile?.full_name || 'مستخدم'}</Text>
              {profile?.is_verified && (
                <CheckCircle size={18} color="#1DA1F2" fill="#1DA1F2" />
              )}
            </View>
            <View style={styles.roleRow}>
              {isAgent
                ? <Truck size={13} color={Colors.white} />
                : <Megaphone size={13} color={Colors.white} />
              }
              <Text style={styles.roleText}>{isAgent ? 'مندوب توصيل' : 'معلن'}</Text>
              {profile?.city ? (
                <>
                  <Text style={styles.dotSep}>•</Text>
                  <Text style={styles.roleText}>{profile.city}</Text>
                </>
              ) : null}
            </View>
            <View style={styles.starsRow}>
              {renderStars(profile?.rating_avg || 0)}
              <Text style={styles.ratingText}>
                {profile?.rating_avg ? profile.rating_avg.toFixed(1) : '0.0'} ({profile?.rating_count || 0})
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-listings')} activeOpacity={0.7}>
            <Text style={styles.statNum}>{myListingsCount}</Text>
            <Text style={styles.statLabel}>إعلاناتي</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/favorites')} activeOpacity={0.7}>
            <Text style={styles.statNum}>{favoritesCount}</Text>
            <Text style={styles.statLabel}>المفضلة</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={() => router.push('/wallet')} activeOpacity={0.7}>
            <Text style={styles.statNum}>{profile?.wallet_balance?.toFixed(0) || '0'}</Text>
            <Text style={styles.statLabel}>رصيدي (ر.س)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Boost Banner */}
      {(profile?.boost_count || 0) > 0 && (
        <TouchableOpacity style={styles.boostBanner} onPress={() => router.push('/my-listings')} activeOpacity={0.85}>
          <View style={styles.boostLeft}>
            <Text style={styles.boostEmoji}>🚀</Text>
            <View>
              <Text style={styles.boostTitle}>لديك {profile?.boost_count} بوست مجاني</Text>
              <Text style={styles.boostSub}>ميّز إعلانك الآن مجاناً</Text>
            </View>
          </View>
          <ChevronLeft size={18} color={Colors.primary[700]} />
        </TouchableOpacity>
      )}

      {/* Phone verification banner */}
      {profile && !profile.phone_verified && (
        <TouchableOpacity style={styles.phoneBanner} onPress={() => setPhoneModalVisible(true)} activeOpacity={0.85}>
          <View style={styles.phoneBannerLeft}>
            <Phone size={18} color={Colors.error[500]} />
            <View>
              <Text style={styles.phoneBannerTitle}>وثّق رقم جوالك</Text>
              <Text style={styles.phoneBannerSub}>مطلوب للحجز والتبديل والنشر</Text>
            </View>
          </View>
          <ChevronLeft size={18} color={Colors.error[500]} />
        </TouchableOpacity>
      )}

      {profile?.phone_verified && (
        <View style={styles.phoneVerifiedBanner}>
          <ShieldCheck size={18} color={Colors.primary[600]} />
          <Text style={styles.phoneVerifiedText}>رقم الجوال موثق</Text>
        </View>
      )}

      <PhoneVerifyModal
        visible={phoneModalVisible}
        currentPhone={profile?.phone ?? ''}
        onClose={() => setPhoneModalVisible(false)}
        onVerified={() => {
          setPhoneModalVisible(false);
          fetchProfile();
        }}
      />

      {/* Section: الحساب */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>الحساب</Text>
        <MenuItem icon={<Edit3 size={20} color={Colors.primary[600]} />} label="تعديل الملف الشخصي" onPress={() => router.push('/settings/edit-profile')} />
        <MenuItem icon={<List size={20} color={Colors.primary[600]} />} label="إعلاناتي" badge={myListingsCount > 0 ? `${myListingsCount}` : undefined} onPress={() => router.push('/my-listings')} />
        <MenuItem icon={<MessageSquare size={20} color="#2563eb" />} label="محادثاتي" onPress={() => router.push('/conversations')} />
        <MenuItem icon={<Heart size={20} color="#ef4444" />} label="المفضلة" badge={favoritesCount > 0 ? `${favoritesCount}` : undefined} onPress={() => router.push('/favorites')} />
        <MenuItem icon={<Wallet size={20} color={Colors.accent[600]} />} label="المحفظة" sublabel={`${profile?.wallet_balance?.toFixed(2) || '0.00'} ر.س`} onPress={() => router.push('/wallet')} last />
      </View>

      {/* Section: الإعدادات */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>الإعدادات</Text>
        <MenuItem icon={<Bell size={20} color={Colors.primary[600]} />} label="إعدادات الإشعارات" onPress={() => router.push('/notifications-settings')} />
        <MenuItem icon={<Shield size={20} color={Colors.primary[600]} />} label="الخصوصية والأمان" onPress={() => router.push('/settings/privacy-security')} />
        <MenuItem icon={<Star size={20} color={Colors.accent[500]} />} label="تقييماتي" onPress={() => router.push('/my-ratings')} />
        <MenuItem icon={<Activity size={20} color={Colors.primary[600]} />} label="سجل النشاط" onPress={() => router.push('/activity-log')} last />
      </View>

      {/* تسجيل الخروج */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <LogOut size={20} color={Colors.error[500]} />
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </TouchableOpacity>

      <Text style={styles.version}>خذه v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  sublabel,
  badge,
  onPress,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  badge?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.menuItem,
          pressed && styles.menuItemPressed,
        ]}
        onPress={onPress}
      >
        <ChevronLeft size={18} color={Colors.neutral[300]} />
        <View style={styles.menuRight}>
          <View style={styles.menuLabelRow}>
            <Text style={styles.menuLabel}>{label}</Text>
            {badge && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
          </View>
          {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
        </View>
        <View style={styles.menuIcon}>{icon}</View>
      </Pressable>
      {!last && <View style={styles.menuDivider} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },

  // Header
  headerBg: {
    backgroundColor: Colors.primary[700],
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.white, textAlign: 'right' },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.white },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.white,
  },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  nameBlock: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.white },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleText: { fontSize: FontSizes.sm, color: Colors.primary[200] },
  dotSep: { color: Colors.primary[300], fontSize: FontSizes.sm },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ratingText: { fontSize: FontSizes.xs, color: Colors.primary[200], marginLeft: 4 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.white },
  statLabel: { fontSize: FontSizes.xs, color: Colors.primary[200] },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Boost Banner
  boostBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.accent[50],
    borderWidth: 1.5, borderColor: Colors.accent[400],
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  boostLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  boostEmoji: { fontSize: 24 },
  boostTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.accent[600] },
  boostSub: { fontSize: FontSizes.xs, color: Colors.accent[500] },

  // Phone verification banners
  phoneBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.error[50],
    borderWidth: 1.5, borderColor: Colors.error[400],
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  phoneBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  phoneBannerTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.error[600] },
  phoneBannerSub: { fontSize: FontSizes.xs, color: Colors.error[500], marginTop: 2 },
  phoneVerifiedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[50],
    borderWidth: 1.5, borderColor: Colors.primary[200],
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  phoneVerifiedText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primary[700] },

  // Sections
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary,
    textAlign: 'right', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  menuItemPressed: {
    backgroundColor: Colors.neutral[50],
  },
  menuRight: { flex: 1, alignItems: 'flex-end' },
  menuLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  menuLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  menuSublabel: { fontSize: FontSizes.sm, color: Colors.primary[600], fontWeight: '600' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.neutral[50], justifyContent: 'center', alignItems: 'center' },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  badgePill: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: FontSizes.xs, color: Colors.white, fontWeight: '700' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: Colors.error[50],
    borderWidth: 1, borderColor: Colors.error[400],
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
  },
  signOutText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.error[500] },
  version: { textAlign: 'center', fontSize: FontSizes.xs, color: Colors.neutral[400], marginTop: Spacing.lg },
});
