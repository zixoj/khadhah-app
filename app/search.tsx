import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, ScrollView, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search, X, SlidersHorizontal, ArrowLeftRight, Gift,
  MapPin, Clock, Flame, ChevronLeft, ArrowUpDown,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, FontSizes, BorderRadius } from '@/lib/theme';

// ── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  city: string;
  image_url: string;
  created_at: string;
  status: string;
  is_urgent: boolean;
  dual_mode: boolean;
  views_count: number;
  interest_count: number;
  owner_name: string;
  owner_username: string | null;
  owner_avatar: string | null;
  owner_verified: boolean;
}

type SortOption = 'newest_first' | 'oldest_first';
type TypeFilter = '' | 'exchange' | 'free';

const CATEGORIES = [
  { label: 'الكل', value: '' },
  { label: 'إلكترونيات', value: 'electronics' },
  { label: 'ملابس', value: 'clothing' },
  { label: 'أثاث', value: 'furniture' },
  { label: 'كتب', value: 'books' },
  { label: 'ألعاب', value: 'toys' },
  { label: 'أدوات منزلية', value: 'home_tools' },
  { label: 'سيارات', value: 'cars' },
  { label: 'رياضة', value: 'sports' },
  { label: 'حيوانات', value: 'animals' },
  { label: 'أخرى', value: 'other' },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter(c => c.value).map(c => [c.value, c.label])
);

const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الخبر', 'الأحساء', 'تبوك', 'أبها', 'القصيم',
  'حائل', 'جازان', 'نجران', 'الطائف', 'ينبع',
];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const { colors: C, isDark } = useTheme();

  const [query, setQuery] = useState(params.q ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [sort, setSort] = useState<SortOption>('newest_first');

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount =
    (category ? 1 : 0) + (city ? 1 : 0) + (typeFilter ? 1 : 0) + (sort !== 'newest_first' ? 1 : 0);

  const runSearch = useCallback(async (q: string, cat: string, ct: string, tp: TypeFilter, s: SortOption) => {
    setLoading(true);
    setSearched(true);
    const { data } = await supabase.rpc('search_listings', {
      p_query: q.trim(),
      p_category: cat || null,
      p_city: ct || null,
      p_type: tp || null,
      p_sort: s,
      p_limit: 40,
      p_offset: 0,
    });
    setResults((data as SearchResult[]) ?? []);
    setLoading(false);
  }, []);

  // Auto-search with debounce on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0 && !category && !city && !typeFilter) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query, category, city, typeFilter, sort);
    }, 380);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category, city, typeFilter, sort, runSearch]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // If opened with ?q= param, run immediately
  useEffect(() => {
    if (params.q) runSearch(params.q, '', '', '', 'newest_first');
  }, []);

  const clearQuery = () => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); };

  const clearFilters = () => { setCategory(''); setCity(''); setTypeFilter(''); setSort('newest_first'); };

  // ── Render item ─────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: SearchResult }) => {
    const typeColor = item.type === 'exchange' ? C.exchange : C.primary;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.82}
      >
        {/* Image */}
        <View style={styles.cardImageWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>
              {item.type === 'free'
                ? <Gift size={24} color={C.primary} />
                : <ArrowLeftRight size={24} color={C.exchange} />}
            </View>
          )}
          {item.is_urgent && (
            <View style={styles.urgentBadge}>
              <Flame size={9} color="#fff" />
              <Text style={styles.urgentText}>مستعجل</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={[styles.typePill, {
              backgroundColor: typeColor + '18',
              borderColor: typeColor + '40',
            }]}>
              {item.type === 'free'
                ? <Gift size={9} color={typeColor} />
                : <ArrowLeftRight size={9} color={typeColor} />}
              <Text style={[styles.typePillText, { color: typeColor }]}>
                {item.type === 'free' ? 'خذه' : 'بدّل'}
              </Text>
            </View>
            {item.category && (
              <Text style={[styles.categoryText, { color: C.textMuted }]}>
                {CATEGORY_LABEL[item.category] ?? item.category}
              </Text>
            )}
          </View>

          <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          {item.description ? (
            <Text style={[styles.cardDesc, { color: C.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.cardMeta}>
            {item.city ? (
              <View style={styles.metaChip}>
                <MapPin size={10} color={C.textMuted} />
                <Text style={[styles.metaText, { color: C.textMuted }]}>{item.city}</Text>
              </View>
            ) : null}
            <View style={styles.metaChip}>
              <Clock size={10} color={C.textMuted} />
              <Text style={[styles.metaText, { color: C.textMuted }]}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>

          {/* Owner */}
          <TouchableOpacity
            style={styles.ownerRow}
            onPress={() => router.push(`/user-profile?id=${item.user_id}`)}
            activeOpacity={0.75}
          >
            {item.owner_avatar ? (
              <Image source={{ uri: item.owner_avatar }} style={styles.ownerAvatar} />
            ) : (
              <View style={[styles.ownerAvatarFallback, { backgroundColor: C.primary + '20' }]}>
                <Text style={[styles.ownerInitial, { color: C.primary }]}>
                  {(item.owner_name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.ownerName, { color: C.textSecondary }]} numberOfLines={1}>
              {item.owner_username ? `@${item.owner_username}` : item.owner_name}
              {item.owner_verified ? ' ✓' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Filter Panel ────────────────────────────────────────────────────────────
  const FilterPanel = () => (
    <View style={[styles.filterPanel, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
      {/* Type */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupLabel, { color: C.textSecondary }]}>النوع</Text>
        <View style={styles.filterChips}>
          {([['', 'الكل'], ['exchange', 'بدّل'], ['free', 'خذه']] as [TypeFilter, string][]).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.filterChip, typeFilter === val && styles.filterChipActive, {
                backgroundColor: typeFilter === val ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
                borderColor: typeFilter === val ? C.primary : (isDark ? C.border : '#E0E0E0'),
              }]}
              onPress={() => setTypeFilter(val)}
            >
              <Text style={[styles.filterChipText, { color: typeFilter === val ? C.primary : C.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sort */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupLabel, { color: C.textSecondary }]}>الترتيب</Text>
        <View style={styles.filterChips}>
          {([['newest_first', 'الأحدث أولاً'], ['oldest_first', 'الأقدم أولاً']] as [SortOption, string][]).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.filterChip, sort === val && styles.filterChipActive, {
                backgroundColor: sort === val ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
                borderColor: sort === val ? C.primary : (isDark ? C.border : '#E0E0E0'),
              }]}
              onPress={() => setSort(val)}
            >
              <Text style={[styles.filterChipText, { color: sort === val ? C.primary : C.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupLabel, { color: C.textSecondary }]}>الفئة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.filterChip, category === c.value && styles.filterChipActive, {
                backgroundColor: category === c.value ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
                borderColor: category === c.value ? C.primary : (isDark ? C.border : '#E0E0E0'),
              }]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={[styles.filterChipText, { color: category === c.value ? C.primary : C.textSecondary }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* City */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupLabel, { color: C.textSecondary }]}>المدينة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          <TouchableOpacity
            style={[styles.filterChip, city === '' && styles.filterChipActive, {
              backgroundColor: city === '' ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
              borderColor: city === '' ? C.primary : (isDark ? C.border : '#E0E0E0'),
            }]}
            onPress={() => setCity('')}
          >
            <Text style={[styles.filterChipText, { color: city === '' ? C.primary : C.textSecondary }]}>الكل</Text>
          </TouchableOpacity>
          {CITIES.map(ct => (
            <TouchableOpacity
              key={ct}
              style={[styles.filterChip, city === ct && styles.filterChipActive, {
                backgroundColor: city === ct ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
                borderColor: city === ct ? C.primary : (isDark ? C.border : '#E0E0E0'),
              }]}
              onPress={() => setCity(ct)}
            >
              <Text style={[styles.filterChipText, { color: city === ct ? C.primary : C.textSecondary }]}>{ct}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilterCount > 0 && (
        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
          <Text style={[styles.clearFiltersText, { color: C.error }]}>مسح الفلاتر</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.background, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>

        {/* Search input */}
        <View style={[styles.searchBar, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.border : '#E0E8EF' }]}>
          <Search size={16} color={C.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: C.text }]}
            placeholder="ابحث عن إعلانات، مدن، فئات..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            textAlign="right"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters toggle */}
        <TouchableOpacity
          style={[styles.filterToggleBtn, {
            backgroundColor: (showFilters || activeFilterCount > 0) ? C.primary + '18' : (isDark ? C.card : '#F4F7FA'),
            borderColor: (showFilters || activeFilterCount > 0) ? C.primary + '60' : (isDark ? C.border : '#E0E8EF'),
          }]}
          onPress={() => setShowFilters(p => !p)}
          activeOpacity={0.8}
        >
          <SlidersHorizontal size={17} color={(showFilters || activeFilterCount > 0) ? C.primary : C.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: C.primary }]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilters && <FilterPanel />}

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Search size={48} color={C.textMuted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>لا توجد نتائج</Text>
          <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
            جرّب كلمات مختلفة أو غيّر الفلاتر
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity style={[styles.clearFiltersBtn2, { borderColor: C.primary }]} onPress={clearFilters}>
              <Text style={[styles.clearFiltersText, { color: C.primary }]}>مسح الفلاتر</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : !searched ? (
        <View style={styles.empty}>
          <Search size={48} color={C.textMuted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>ابحث في الإعلانات</Text>
          <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
            ابحث بالعنوان أو الوصف أو الفئة أو المدينة أو اسم المستخدم
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: C.textSecondary }]}>
              {results.length} نتيجة
            </Text>
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: BorderRadius.xl, borderWidth: 1,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: FontSizes.md, paddingVertical: 0 },
  filterToggleBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 14, height: 14, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#000', fontSize: 9, fontWeight: '800' },

  filterPanel: {
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
    borderBottomWidth: 1,
  },
  filterGroup: { gap: 8 },
  filterGroupLabel: { fontSize: FontSizes.xs, fontWeight: '700', textAlign: 'right' },
  filterChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipActive: {},
  filterChipText: { fontSize: FontSizes.xs, fontWeight: '600' },
  clearFiltersBtn: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  clearFiltersBtn2: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  clearFiltersText: { fontSize: FontSizes.sm, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 22 },

  resultCount: { fontSize: FontSizes.xs, textAlign: 'right', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },

  list: { paddingHorizontal: 12, paddingTop: 4, gap: 10 },

  card: {
    flexDirection: 'row', borderRadius: BorderRadius.lg,
    borderWidth: 1, overflow: 'hidden',
  },
  cardImageWrap: { width: 100, position: 'relative' },
  cardImage: { width: 100, height: '100%', minHeight: 100 },
  cardImagePlaceholder: {
    width: 100, minHeight: 100, justifyContent: 'center', alignItems: 'center',
  },
  urgentBadge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  typePillText: { fontSize: 10, fontWeight: '700' },
  categoryText: { fontSize: 10, fontWeight: '600' },

  cardTitle: { fontSize: FontSizes.md, fontWeight: '700', lineHeight: 22, textAlign: 'right' },
  cardDesc: { fontSize: FontSizes.xs, lineHeight: 18, textAlign: 'right' },

  cardMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, fontWeight: '500' },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ownerAvatar: { width: 20, height: 20, borderRadius: 10 },
  ownerAvatarFallback: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  ownerInitial: { fontSize: 10, fontWeight: '700' },
  ownerName: { fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'right' },
});
