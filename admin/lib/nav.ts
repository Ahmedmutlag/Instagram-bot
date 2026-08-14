export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "📊" },
  { href: "/users", label: "المستخدمون", icon: "👥" },
  { href: "/services", label: "الخدمات", icon: "🛠️" },
  { href: "/providers", label: "المزودون", icon: "🔌" },
  { href: "/orders", label: "الطلبات", icon: "📦" },
  { href: "/payments", label: "المدفوعات", icon: "💳" },
  { href: "/coupons", label: "الكوبونات", icon: "🎟️" },
  { href: "/referral", label: "الإحالة", icon: "🔗" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];
