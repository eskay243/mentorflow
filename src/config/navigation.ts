import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  MessageSquare,
  Bell,
  Settings,
  Calendar,
  UserCheck,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Platform Overview', icon: LayoutDashboard },
  { id: 'mentors',     label: 'Mentors',            icon: UserCheck },
  { id: 'students',    label: 'Students',           icon: Users },
  { id: 'assignments', label: 'Assignments',        icon: ClipboardList },
  { id: 'courses',     label: 'Courses',            icon: BookOpen },
  { id: 'payments',    label: 'Payments',           icon: CreditCard },
  { id: 'payouts',     label: 'Payouts',            icon: TrendingUp },
  { id: 'messages',    label: 'Messages',           icon: MessageSquare },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'settings',   label: 'Settings',            icon: Settings },
];

export const MENTOR_NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'students',    label: 'My Students',    icon: Users },
  { id: 'courses',     label: 'My Courses',     icon: BookOpen },
  { id: 'sessions',    label: 'Sessions',       icon: Calendar },
  { id: 'commissions', label: 'Commissions',   icon: TrendingUp },
  { id: 'payouts',     label: 'Payouts',        icon: CreditCard },
  { id: 'messages',    label: 'Messages',       icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings',   label: 'Profile & KYC',  icon: Settings },
];

export const STUDENT_NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'courses',     label: 'Browse Courses',  icon: BookOpen },
  { id: 'mentors',     label: 'My Mentors',      icon: UserCheck },
  { id: 'sessions',    label: 'My Sessions',     icon: Calendar },
  { id: 'payments',    label: 'Payments',        icon: CreditCard },
  { id: 'messages',    label: 'Messages',        icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings',   label: 'Settings',         icon: Settings },
];

export type UserRole = 'admin' | 'mentor' | 'student';

export function navForRole(role: UserRole): NavItem[] {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'mentor') return MENTOR_NAV;
  return STUDENT_NAV;
}
