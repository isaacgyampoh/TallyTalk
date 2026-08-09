export const APP_NAME = import.meta.env.VITE_APP_NAME || 'TallyTalk'

export const ACCENT = '#6600FF'

export interface Country {
  code: string
  name: string
  dial: string
  flag: string
}

// A small starter set; Ghana first since that's the launch market.
export const COUNTRIES: Country[] = [
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
] as const

export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type ExpectedPeriod = 'today' | 'this_week' | 'next_week' | 'this_month'

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

export const EXPECTED_PERIODS: { value: ExpectedPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'this_month', label: 'This Month' },
]

// Predefined personal checklists from the spec.
export const PREDEFINED_CHECKLISTS = [
  { key: 'daily', title: 'Daily', behavior: 'daily_reset' },
  { key: 'call', title: 'Call', behavior: 'call' },
  { key: 'visit', title: 'Visit', behavior: 'normal' },
  { key: 'meetings', title: 'Meetings', behavior: 'normal' },
  { key: 'follow_up', title: 'Follow Up', behavior: 'normal' },
  { key: 'errands', title: 'Personal Errands', behavior: 'normal' },
  { key: 'remember', title: 'Remember', behavior: 'normal' },
  { key: 'inspect', title: 'Inspect', behavior: 'normal' },
  { key: 'waiting', title: 'Waiting', behavior: 'normal' },
  { key: 'buy', title: 'Buy', behavior: 'normal' },
  { key: 'pay', title: 'Pay', behavior: 'normal' },
  { key: 'read', title: 'Read', behavior: 'normal' },
  { key: 'travel', title: 'Travel Checklist', behavior: 'manual_reset' },
  { key: 'later', title: 'Later', behavior: 'normal' },
] as const

export const TASK_TITLE_MAX = 60

export const APP_VERSION = '1.0'
export const BUILD_ID = __BUILD_ID__
