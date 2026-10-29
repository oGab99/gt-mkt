import {
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  GalleryVerticalEnd,
  LayoutGrid,
  ListChecks,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutGrid,
  posts: GalleryVerticalEnd,
  tasks: ListChecks,
  calendar: CalendarDays,
  finance: Wallet,
  reports: ChartNoAxesColumn,
  companies: Building2,
  settings: Settings,
};
