export interface Country {
  nameAr: string;
  nameEn: string;
  code: string;
  cities: string[];
}

export const COUNTRIES: Country[] = [
  {
    nameAr: 'المملكة العربية السعودية',
    nameEn: 'Saudi Arabia',
    code: '+966',
    cities: [
      'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
      'الخبر', 'الطائف', 'أبها', 'خميس مشيط', 'تبوك',
      'حائل', 'بريدة', 'عنيزة', 'جازان', 'نجران',
      'ينبع', 'الأحساء', 'الخرج',
    ],
  },
  {
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    code: '+965',
    cities: [
      'مدينة الكويت', 'حولي', 'السالمية', 'الفروانية', 'الجهراء',
      'الأحمدي', 'مبارك الكبير',
    ],
  },
  {
    nameAr: 'قطر',
    nameEn: 'Qatar',
    code: '+974',
    cities: [
      'الدوحة', 'الريان', 'الوكرة', 'الخور', 'لوسيل', 'أم صلال',
    ],
  },
  {
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    code: '+973',
    cities: [
      'المنامة', 'المحرق', 'الرفاع', 'مدينة حمد', 'سترة', 'مدينة عيسى',
    ],
  },
  {
    nameAr: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    code: '+971',
    cities: [
      'دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة',
      'الفجيرة', 'أم القيوين', 'العين',
    ],
  },
  {
    nameAr: 'عُمان',
    nameEn: 'Oman',
    code: '+968',
    cities: [
      'مسقط', 'صلالة', 'صحار', 'نزوى', 'بركاء',
      'عبري', 'صور', 'السيب',
    ],
  },
  {
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    code: '+962',
    cities: [
      'عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط',
      'مادبا', 'جرش', 'عجلون',
    ],
  },
  {
    nameAr: 'سوريا',
    nameEn: 'Syria',
    code: '+963',
    cities: [
      'دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية',
      'طرطوس', 'دير الزور',
    ],
  },
  {
    nameAr: 'مصر',
    nameEn: 'Egypt',
    code: '+20',
    cities: [
      'القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا',
      'أسيوط', 'سوهاج', 'الأقصر', 'أسوان',
    ],
  },
];

export const COUNTRY_MAP: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.nameEn, c])
);

export const ALL_CITIES: string[] = COUNTRIES.flatMap((c) => c.cities);

/** Returns only the cities for a specific country, or ALL_CITIES as a fallback. */
export function getCitiesByCountry(countryNameEn: string | null | undefined): string[] {
  if (!countryNameEn) return ALL_CITIES;
  return COUNTRY_MAP[countryNameEn]?.cities ?? ALL_CITIES;
}

/** Returns the cities for a specific country only — empty array if unknown/missing. */
export function getStrictCitiesByCountry(countryNameEn: string | null | undefined): string[] {
  if (!countryNameEn) return [];
  return COUNTRY_MAP[countryNameEn]?.cities ?? [];
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
