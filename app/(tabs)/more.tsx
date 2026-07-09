import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, FontSizes } from '@/lib/theme';
import {
  MessageSquare,
  Heart,
  Settings,
  Shield,
  X,
} from 'lucide-react-native';

const SHEET_ITEMS = [
  {
    icon: MessageSquare,
    iconColor: '#0A84FF',
    label: 'محادثاتي',
    path: '/conversations',
  },
  {
    icon: Heart,
    iconColor: '#EF4444',
    label: 'المفضلة',
    path: '/favorites',
  },
  {
    icon: Settings,
    iconColor: '#00C853',
    label: 'الإعدادات',
    path: '/settings/edit-profile',
  },
  {
    icon: Shield,
    iconColor: '#00C853',
    label: 'الخصوصية والأمان',
    path: '/settings/privacy-security',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setSheetVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false);
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
      callback?.();
    });
  };

  const navigate = (path: string) => {
    closeSheet(() => router.push(path as any));
  };

  useFocusEffect(
    useCallback(() => {
      if (!sheetVisible) openSheet();
    }, [sheetVisible])
  );

  const sheetBg = isDark ? '#111714' : '#FFFFFF';
  const handleBg = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';
  const dividerBg = isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0';
  const iconBg = isDark ? '#1A2020' : '#F4F9F6';
  const itemBg = isDark ? '#0D1410' : '#F8FAFB';
  const itemBorder = isDark ? 'rgba(255,255,255,0.07)' : '#E8E8E8';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Tap-to-reopen hint shown under the sheet */}
      <TouchableOpacity style={styles.bgTap} onPress={openSheet} activeOpacity={1}>
        <View style={[styles.dotsWrap, { backgroundColor: iconBg, borderColor: isDark ? 'rgba(0,200,83,0.20)' : 'rgba(0,168,68,0.18)', borderWidth: 1 }]}>
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
          <View style={[styles.dot, { backgroundColor: C.primary }]} />
        </View>
        <Text style={[styles.hint, { color: C.textSecondary }]}>اضغط لفتح القائمة</Text>
      </TouchableOpacity>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeSheet()}
      >
        {/* Dim overlay */}
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeSheet()} />
        </Animated.View>

        {/* Bottom sheet */}
        <Animated.View
          style={[styles.sheet, { backgroundColor: sheetBg, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: handleBg }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: dividerBg }]}>
            <TouchableOpacity
              onPress={() => closeSheet()}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1A2020' : '#F0F0F0' }]}
              hitSlop={10}
            >
              <X size={15} color={C.text} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: C.text }]}>المزيد</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Items */}
          <View style={styles.list}>
            {SHEET_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === SHEET_ITEMS.length - 1;
              return (
                <View key={item.path}>
                  <TouchableOpacity
                    style={[styles.row, { backgroundColor: itemBg, borderColor: itemBorder }]}
                    onPress={() => navigate(item.path)}
                    activeOpacity={0.72}
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                        <Icon size={20} color={item.iconColor} strokeWidth={2} />
                      </View>
                    </View>
                    <Text style={[styles.rowLabel, { color: C.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                  {!isLast && <View style={[styles.divider, { backgroundColor: dividerBg }]} />}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  bgTap: { alignItems: 'center', gap: 14 },
  dotsWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  hint: { fontSize: FontSizes.sm },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 52,
    paddingTop: 10,
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: FontSizes.lg, fontWeight: '700' },

  list: {
    borderRadius: 18,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
    borderWidth: 0,
  },
  rowLeft: {},
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    textAlign: 'right',
  },

  divider: { height: 1, marginHorizontal: 16 },
});
