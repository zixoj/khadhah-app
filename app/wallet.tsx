import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Wallet, Plus, Zap, Truck, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react-native';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

const PACKAGES = [
  { amount: 10, label: '10 ر.س', desc: 'بوست واحد + توصيل واحد' },
  { amount: 25, label: '25 ر.س', desc: '3 بوست + 3 توصيل' },
  { amount: 50, label: '50 ر.س', desc: '7 بوست + 5 توصيل' },
  { amount: 100, label: '100 ر.س', desc: '15 بوست + 12 توصيل' },
];

export default function WalletScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topping, setTopping] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, [profile?.id]);

  const fetchWallet = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const [profileRes, txRes] = await Promise.all([
        supabase.from('profiles').select('wallet_balance').eq('id', profile.id).maybeSingle(),
        supabase.from('wallet_transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (profileRes.data) setBalance(profileRes.data.wallet_balance || 0);
      if (txRes.data) setTransactions(txRes.data);
    } catch (e) {
      console.error('[wallet] fetchWallet:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!profile?.id) return;
    setTopping(true);
    const newBalance = balance + amount;
    const { error: balanceErr } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', profile.id);
    if (balanceErr) {
      setTopping(false);
      Alert.alert('خطأ', 'فشل تحديث الرصيد. حاول مرة أخرى');
      return;
    }
    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      user_id: profile.id,
      amount,
      type: 'credit',
      description: `إضافة رصيد ${amount} ر.س`,
    });
    if (txErr) {
      setTopping(false);
      Alert.alert('خطأ', 'فشل تسجيل المعاملة');
      return;
    }
    await supabase.from('activity_log').insert({
      user_id: profile.id,
      action: 'wallet_topup',
      description: `تم إضافة ${amount} ر.س إلى المحفظة`,
    });
    await fetchWallet();
    setTopping(false);
    setShowTopUp(false);
    Alert.alert('تم', `تم إضافة ${amount} ر.س إلى محفظتك`);
  };

  const handleBoostPurchase = async () => {
    const cost = 5;
    if (balance < cost) {
      Alert.alert('رصيد غير كافٍ', `تحتاج ${cost} ر.س لشراء بوست. اشحن محفظتك أولاً.`);
      return;
    }
    Alert.alert('شراء بوست', `سيتم خصم ${cost} ر.س من رصيدك. هل تريد الاستمرار؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'شراء',
        onPress: async () => {
          // Use secure RPC: debit is handled server-side, no direct debit insert from client
          const { error } = await supabase.rpc('spend_wallet', {
            p_user_id: profile?.id ?? '',
            p_amount: cost,
            p_desc: 'شراء بوست لتمييز إعلان',
          });
          if (error) {
            Alert.alert('خطأ', error.message);
            return;
          }
          await fetchWallet();
          Alert.alert('تم', 'تم إضافة بوست واحد لحسابك');
        },
      },
    ]);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>المحفظة</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Wallet size={32} color={Colors.white} />
            <Text style={styles.balanceLabel}>رصيدك الحالي</Text>
            <Text style={styles.balanceAmount}>{balance.toFixed(2)} ر.س</Text>
            <TouchableOpacity style={styles.topUpBtn} onPress={() => setShowTopUp(true)} activeOpacity={0.8}>
              <Plus size={18} color={Colors.primary[700]} />
              <Text style={styles.topUpBtnText}>إضافة رصيد</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>استخدم رصيدك</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionCard} onPress={handleBoostPurchase} activeOpacity={0.7}>
              <Zap size={26} color={Colors.accent[500]} />
              <Text style={styles.actionLabel}>شراء بوست</Text>
              <Text style={styles.actionPrice}>5 ر.س</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => Alert.alert('قريباً', 'خدمة طلب مندوب ستكون متاحة قريباً')} activeOpacity={0.7}>
              <Truck size={26} color={Colors.primary[600]} />
              <Text style={styles.actionLabel}>طلب مندوب</Text>
              <Text style={styles.actionPrice}>15 ر.س</Text>
            </TouchableOpacity>
          </View>

          {/* Transactions */}
          <Text style={styles.sectionTitle}>سجل المعاملات</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <Text style={styles.emptyTxText}>لا توجد معاملات بعد</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                  <View style={[styles.txIcon, tx.type === 'credit' ? styles.txIconCredit : styles.txIconDebit]}>
                    {tx.type === 'credit'
                      ? <ArrowDownLeft size={18} color={Colors.primary[600]} />
                      : <ArrowUpRight size={18} color={Colors.error[500]} />
                    }
                  </View>
                  <View style={styles.txBody}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'credit' ? styles.txAmountCredit : styles.txAmountDebit]}>
                    {tx.type === 'credit' ? '+' : ''}{tx.amount.toFixed(2)} ر.س
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Top Up Modal */}
      <Modal visible={showTopUp} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر باقة الشحن</Text>
              <TouchableOpacity onPress={() => setShowTopUp(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.amount}
                style={styles.pkgCard}
                onPress={() => handleTopUp(pkg.amount)}
                disabled={topping}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.pkgAmount}>{pkg.label}</Text>
                  <Text style={styles.pkgDesc}>{pkg.desc}</Text>
                </View>
                {topping ? <ActivityIndicator size="small" color={Colors.primary[600]} /> : <ChevronLeft size={18} color={Colors.primary[600]} />}
              </TouchableOpacity>
            ))}
            <Text style={styles.modalNote}>* هذا نظام تجريبي - لا يوجد دفع حقيقي</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  balanceCard: {
    backgroundColor: Colors.primary[700], borderRadius: BorderRadius.xl,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
  },
  balanceLabel: { fontSize: FontSizes.md, color: Colors.primary[200] },
  balanceAmount: { fontSize: 42, fontWeight: '700', color: Colors.white },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  topUpBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary[700] },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  actionCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionLabel: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  actionPrice: { fontSize: FontSizes.md, color: Colors.primary[600], fontWeight: '700' },
  emptyTx: { backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyTxText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  txList: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txIconCredit: { backgroundColor: Colors.primary[50] },
  txIconDebit: { backgroundColor: Colors.error[50] },
  txBody: { flex: 1 },
  txDesc: { fontSize: FontSizes.sm, color: Colors.text, textAlign: 'right', fontWeight: '500' },
  txDate: { fontSize: FontSizes.xs, color: Colors.neutral[400], textAlign: 'right' },
  txAmount: { fontSize: FontSizes.md, fontWeight: '700' },
  txAmountCredit: { color: Colors.primary[600] },
  txAmountDebit: { color: Colors.error[500] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  pkgCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primary[50], borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary[100],
  },
  pkgAmount: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.primary[700], textAlign: 'right' },
  pkgDesc: { fontSize: FontSizes.sm, color: Colors.primary[500], textAlign: 'right' },
  modalNote: { fontSize: FontSizes.xs, color: Colors.neutral[400], textAlign: 'center', marginTop: 4 },
});
