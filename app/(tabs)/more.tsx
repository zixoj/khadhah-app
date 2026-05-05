import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  MessageSquare,
  Heart,
  Settings,
  Shield,
  User,
  Star,
  Activity,
  Bell,
  ChevronLeft,
  X,
  LogOut,
} from 'lucide-react-native';

interface SheetItem {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
}

export default function MoreScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setSheetVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false);
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      callback?.();
    });
  };

  const navigate = (path: string) => {
    closeSheet(() => router.push(path as any));
  };

  const handleSignOut = () => {
    closeSheet(async () => {
      await signOut();
      router.replace('/(auth)/login');
    });
  };

  // Auto-open sheet whenever this tab gains focus
  useFocusEffect(
    useCallback(() => {
      openSheet();
    }, [])
  );

  const sheetBg = isDark ? '#111714' : '#FFFFFF';
  const handleBg = isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB';
  const dividerBg = isDark ? 'rgba(255,255,255,0.07)' : '#F0F0F0';
  const iconBg = isDark ? '#1A2020' : '#F0FDF4';

  const items: SheetItem[] = [
    {
      icon: <User size={20} color={C.primary} />,
      label: 'حسابي',
      sublabel: profile?.full_name || '',
      onPress: () => navigate('/profile' as any),
    },
    {
      icon: <MessageSquare size={20} color={C.exchange} />,
      label: 'محادثاتي',
      onPress: () => navigate('/conversations'),
    },
    {
      icon: <Heart size={20} color="#EF4444" />,
      label: 'المفضلة',
      onPress: () => navigate('/favorites'),
    },
    {
      icon: <Bell size={20} color={C.primary} />,
      label: 'إعدادات الإشعارات',
      onPress: () => navigate('/notifications-settings'),
    },
    {
      icon: <Settings size={20} color={C.primary} />,
      label: 'الإعدادات',
      onPress: () => navigate('/settings/edit-profile'),
    },
    {
      icon: <Shield size={20} color={C.primary} />,
      label: 'الخصوصية والأمان',
      onPress: () => navigate('/settings/privacy-security'),
    },
    {
      icon: <Star size={20} color="#F59E0B" />,
      label: 'تقييماتي',
      onPress: () => navigate('/my-ratings'),
    },
    {
      icon: <Activity size={20} color={C.primary} />,
      label: 'سجل النشاط',
      onPress: () => navigate('/activity-log'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Background page — tapping it reopens sheet */}
      <TouchableOpacity style={styles.bgTap} onPress={openSheet} activeOpacity={1}>
        <View style={[styles.dotsCircle, { backgroundColor: isDark ? '#1A2020' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.20)' : 'rgba(0,168,68,0.20)', borderWidth: 1 }]}>
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
        </View>
        <Text style={[styles.tapHint, { color: C.textSecondary }]}>اضغط لفتح القائمة</Text>
      </TouchableOpacity>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeSheet()}
      >
        {/* Overlay */}
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={styles.overlayPress} onPress={() => closeSheet()} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: handleBg }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: dividerBg }]}>
            <TouchableOpacity
              onPress={() => closeSheet()}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1A2020' : '#F5F5F5' }]}
              hitSlop={8}
            >
              <X size={16} color={C.text} />
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: C.text }]}>المزيد</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Avatar row */}
          {profile && (
            <TouchableOpacity
              style={[styles.profileRow, { backgroundColor: isDark ? '#0D1410' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.15)' : '#D1FAE5' }]}
              onPress={() => navigate('/profile' as any)}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} color={C.textSecondary} />
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: C.text }]} numberOfLines={1}>{profile.full_name}</Text>
                <Text style={[styles.profileSub, { color: C.textSecondary }]}>عرض الملف الشخصي</Text>
              </View>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { borderColor: C.primary }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: iconBg, borderColor: C.primary }]}>
                  <User size={22} color={C.primary} />
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Menu items — two columns grid */}
          <View style={styles.grid}>
            {items.slice(1).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.gridItem, { backgroundColor: isDark ? '#0D1410' : '#F9FAFB', borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB' }]}
                onPress={item.onPress}
                activeOpacity={0.75}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: iconBg }]}>
                  {item.icon}
                </View>
                <Text style={[styles.gridLabel, { color: C.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#FFF5F5', borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FECACA' }]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <LogOut size={18} color="#EF4444" />
            <Text style={[styles.signOutText, { color: '#EF4444' }]}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bgTap: { alignItems: 'center', gap: 12 },
  dotsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tapHint: { fontSize: FontSizes.sm },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayPress: { flex: 1 },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  profileInfo: { flex: 1, alignItems: 'flex-end', gap: 2 },
  profileName: { fontSize: FontSizes.md, fontWeight: '700' },
  profileSub: { fontSize: FontSizes.xs },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridItem: {
    width: '47.5%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  gridIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  signOutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
  signOutText: { fontSize: FontSizes.md, fontWeight: '700' },
});
