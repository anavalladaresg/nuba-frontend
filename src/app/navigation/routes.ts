import {
  BarChart3,
  CalendarDays,
  Clock3,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AppRouteHandle = {
  title: string
  description: string
}

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const desktopNavItems: NavItem[] = [
  { label: 'Hoy', to: '/', icon: Clock3 },
  { label: 'Calendario', to: '/calendar', icon: CalendarDays },
  { label: 'Insights', to: '/insights', icon: BarChart3 },
  { label: 'Ajustes', to: '/settings', icon: Settings },
]

export const mobileNavItems: NavItem[] = [
  { label: 'Hoy', to: '/', icon: Clock3 },
  { label: 'Calendario', to: '/calendar', icon: CalendarDays },
  { label: 'Insights', to: '/insights', icon: BarChart3 },
  { label: 'Ajustes', to: '/settings', icon: Settings },
]
