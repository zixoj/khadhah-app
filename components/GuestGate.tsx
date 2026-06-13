import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { UserPlus, LogIn, X } from 'lucide-react-native';

interface GuestGateProps {
  visible: boolean;
  onClose: () => void;
}

const { width: SW } = Dimensions.get('window');

export default function GuestGate({ visible, onClose }: GuestGateProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const goRegister = () => {
    onClose();
    setTimeout(() => router.push('/(auth)/register'), 260);
  };

  const goLogin = () => {
    onClose();
    setTimeout(() => router.push('/(auth)/login'), 260);
  };

  const sheetBg = isDark ? '#0D1A12' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const subColor = isDark ? 'rgba(255,255,255,0.60)' : '#6B7280';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: sheetBg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB' }]} />

        {/* Close */}
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]} onPress={onClose} activeOpacity={0.7} hitSlop={10}>
          <X size={15} color={textColor} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(0,200,83,0.30)' : 'rgba(0,168,68,0.20)' }]}>
            <Text style={styles.iconEmoji}>🔒</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: textColor }]}>أنشئ حساباً مجانياً</Text>
        <Text style={[styles.subtitle, { color: subColor }]}>
          انشئ حساباً مجانياً للوصول إلى المراسلة، والنشر،{'\n'}والمفضلة، وجميع مميزات المجتمع.
        </Text>

        {/* Feature pills */}
        <View style={styles.featuresRow}>
          {['💬 رسائل', '📋 إعلانات', '❤️ مفضلة', '⭐ تقييمات'].map((f) => (
            <View key={f} style={[styles.featurePill, { backgroundColor: isDark ? 'rgba(0,200,83,0.10)' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.22)' : 'rgba(0,168,68,0.18)' }]}>
              <Text style={[styles.featureText, { color: isDark ? 'rgba(0,200,83,0.90)' : '#065f46' }]}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.registerBtn} onPress={goRegister} activeOpacity={0.85}>
          <View style={styles.registerBtnShine} />
          <UserPlus size={18} color="#000" strokeWidth={2.5} />
          <Text style={styles.registerBtnText}>إنشاء حساب</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFB', borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#E5E7EB' }]}
          onPress={goLogin}
          activeOpacity={0.8}
        >
          <LogIn size={17} color={isDark ? 'rgba(255,255,255,0.80)' : '#374151'} strokeWidth={2} />
          <Text style={[styles.loginBtnText, { color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }]}>تسجيل الدخول</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.laterBtn}>
          <Text style={[styles.laterText, { color: subColor }]}>ربما لاحقاً</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 52,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 20,
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },

  closeBtn: {
    position: 'absolute',
    top: 18,
    left: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconWrap: { marginBottom: 16, marginTop: 4 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: { fontSize: 32 },

  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },

  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  featurePill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureText: { fontSize: 12.5, fontWeight: '600' },

  registerBtn: {
    width: '100%',
    height: 56,
    borderRadius: 20,
    backgroundColor: '#00C853',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50,
    shadowRadius: 18,
    elevation: 8,
  },
  registerBtnShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  registerBtnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 0.2 },

  loginBtn: {
    width: '100%',
    height: 52,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  loginBtnText: { fontSize: 15, fontWeight: '700' },

  laterBtn: { paddingVertical: 8 },
  laterText: { fontSize: 14, fontWeight: '500' },
});
