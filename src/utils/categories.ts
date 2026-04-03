/**
 * Auto-categorize an expense based on description keywords.
 * Supports both English and Arabic/Egyptian terms.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    // English
    'restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'cafe', 'coffee',
    'pizza', 'burger', 'chicken', 'sushi', 'steak', 'meal',
    // Arabic/Egyptian
    'مطعم', 'أكل', 'غداء', 'عشاء', 'فطار', 'قهوة', 'كافيه',
    'كشري', 'شاورما', 'فول', 'طعمية', 'حواوشي', 'فطير',
    // Egyptian delivery apps
    'talabat', 'طلبات', 'elmenus', 'المنيوز', 'breadfast',
  ],
  transport: [
    'uber', 'careem', 'كريم', 'taxi', 'تاكسي', 'microbus', 'ميكروباص',
    'metro', 'مترو', 'bus', 'اتوبيس', 'gas', 'بنزين', 'fuel', 'parking',
    'swvl', 'indriver',
  ],
  shopping: [
    'shopping', 'تسوق', 'clothes', 'هدوم', 'shoes', 'جزم',
    'mall', 'مول', 'amazon', 'jumia', 'جوميا', 'noon', 'نون',
  ],
  bills: [
    'electricity', 'كهربا', 'water', 'ميه', 'gas', 'غاز',
    'internet', 'نت', 'phone', 'موبايل', 'rent', 'إيجار', 'ايجار',
    'we', 'orange', 'vodafone', 'فودافون', 'etisalat', 'اتصالات',
  ],
  entertainment: [
    'movie', 'فيلم', 'cinema', 'سينما', 'netflix', 'spotify',
    'game', 'لعبة', 'concert', 'حفلة', 'club', 'pool', 'حمام سباحة',
  ],
  health: [
    'pharmacy', 'صيدلية', 'doctor', 'دكتور', 'hospital', 'مستشفى',
    'medicine', 'دوا', 'clinic', 'عيادة', 'lab', 'معمل', 'تحاليل',
  ],
  travel: [
    'hotel', 'فندق', 'flight', 'طيران', 'airbnb', 'booking',
    'sahel', 'ساحل', 'gouna', 'جونة', 'sharm', 'شرم', 'hurghada', 'غردقة',
    'marsa', 'مرسى', 'ain sokhna', 'العين السخنة',
  ],
  groceries: [
    'supermarket', 'سوبر', 'grocery', 'بقالة', 'vegetables', 'خضار',
    'fruit', 'فاكهة', 'meat', 'لحمة', 'chicken', 'فراخ',
    'carrefour', 'كارفور', 'kazyon', 'كازيون', 'seoudi', 'سعودي',
    'oscar', 'خير زمان',
  ],
};

export function categorizeExpense(description: string): string {
  const lower = description.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'other';
}
