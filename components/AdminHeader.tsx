import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export function AdminHeader({ title, subtitle, showBack = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowRight size={20} color="#00C853" />
          </TouchableOpacity>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ADMIN</Text>
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0D1410',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,200,83,0.15)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,200,83,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(0,200,83,0.15)',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
  },
  badgeText: { color: '#00C853', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 0 },
});
