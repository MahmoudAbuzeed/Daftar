/**
 * Auto-categorize an expense based on description keywords.
 * Supports English, Arabic/Egyptian, and common global brands.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    // Global
    'restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'cafe', 'coffee',
    'pizza', 'burger', 'chicken', 'sushi', 'steak', 'meal', 'snack',
    'bakery', 'dessert', 'ice cream', 'juice', 'drink', 'bar', 'grill', 'bbq',
    'mcdonald', 'kfc', 'starbucks', 'subway', 'domino', 'papa john',
    // Arabic/Egyptian
    'مطعم', 'أكل', 'غداء', 'عشاء', 'فطار', 'قهوة', 'كافيه',
    'كشري', 'شاورما', 'فول', 'طعمية', 'حواوشي', 'فطير',
    // Delivery apps (global + regional)
    'uber eats', 'doordash', 'grubhub', 'deliveroo', 'just eat',
    'talabat', 'طلبات', 'elmenus', 'المنيوز', 'breadfast',
    'zomato', 'swiggy', 'hungerstation', 'carriage', 'toters',
  ],
  transport: [
    // Global
    'uber', 'lyft', 'taxi', 'bus', 'metro', 'train', 'subway',
    'fuel', 'gas', 'petrol', 'parking', 'toll', 'ride',
    'bolt', 'grab', 'gojek', 'didi',
    // Regional
    'careem', 'كريم', 'تاكسي', 'ميكروباص', 'مترو', 'اتوبيس',
    'بنزين', 'swvl', 'indriver',
  ],
  shopping: [
    // Global
    'shopping', 'clothes', 'shoes', 'electronics', 'gift', 'present', 'mall',
    'amazon', 'ebay', 'walmart', 'target', 'ikea', 'zara', 'h&m',
    // Regional
    'تسوق', 'هدوم', 'جزم', 'مول',
    'noon', 'نون', 'jumia', 'جوميا', 'namshi', 'shein',
  ],
  bills: [
    // Global
    'electricity', 'water', 'gas', 'internet', 'wifi', 'phone', 'mobile',
    'rent', 'subscription', 'netflix', 'spotify', 'youtube', 'apple',
    'insurance', 'utility',
    // Regional
    'كهربا', 'ميه', 'غاز', 'نت', 'موبايل', 'إيجار', 'ايجار',
    'we', 'orange', 'vodafone', 'فودافون', 'etisalat', 'اتصالات',
    'stc', 'du', 'zain',
  ],
  entertainment: [
    // Global
    'movie', 'cinema', 'game', 'concert', 'ticket', 'party',
    'club', 'pool', 'bowling', 'karaoke', 'museum', 'theater', 'show',
    // Regional
    'فيلم', 'سينما', 'لعبة', 'حفلة', 'حمام سباحة',
  ],
  health: [
    // Global
    'pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'dental',
    'gym', 'health', 'medical', 'lab', 'therapy', 'vitamin',
    // Regional
    'صيدلية', 'دوا', 'دكتور', 'مستشفى', 'عيادة', 'معمل', 'تحاليل',
  ],
  travel: [
    // Global
    'hotel', 'flight', 'airbnb', 'booking', 'resort', 'hostel',
    'airport', 'airline', 'cruise', 'vacation', 'trip',
    // Regional
    'فندق', 'طيران',
    'sahel', 'ساحل', 'gouna', 'جونة', 'sharm', 'شرم',
    'hurghada', 'غردقة', 'dubai', 'دبي',
  ],
  groceries: [
    // Global
    'supermarket', 'grocery', 'vegetables', 'fruit', 'meat',
    'chicken', 'milk', 'bread', 'eggs', 'organic',
    'costco', 'aldi', 'lidl', 'whole foods', 'trader joe',
    // Regional
    'سوبر', 'بقالة', 'خضار', 'فاكهة', 'لحمة', 'فراخ',
    'carrefour', 'كارفور', 'kazyon', 'كازيون', 'seoudi', 'سعودي',
    'خير زمان', 'lulu', 'لولو', 'panda', 'باندا',
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
