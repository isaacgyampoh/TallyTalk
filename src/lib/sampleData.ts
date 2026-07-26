import type { Priority } from './config'

export interface SampleTask {
  id: string
  title: string
  direction: 'they_owe_me' | 'i_owe_them'
  status: 'pending_acceptance' | 'active' | 'completed'
  priority: Priority
  expected: string
  overdue?: boolean
}

export interface SampleContact {
  id: string
  name: string
  initials: string
  color: string // avatar tint
  forThem: number // active tasks they owe me
  forYou: number // active tasks I owe them
  overdue: number
  urgent: number
  unread: boolean
  work?: boolean
  favorite?: boolean
  lastActivity: string
  tasks: SampleTask[]
}

const avatarColors = ['#6600FF', '#0E7C86', '#B4530A', '#8A3BFF', '#2B7A3B', '#B02A6F']

export const SAMPLE_CONTACTS: SampleContact[] = [
  {
    id: 'ben',
    name: 'Ben Owusu',
    initials: 'BO',
    color: avatarColors[0],
    forThem: 3,
    forYou: 2,
    overdue: 1,
    urgent: 1,
    unread: true,
    work: true,
    favorite: true,
    lastActivity: 'Send me the final Ecobank document',
    tasks: [
      { id: 't1', title: 'Send me the final Ecobank document', direction: 'they_owe_me', status: 'active', priority: 'urgent', expected: 'Today', overdue: true },
      { id: 't2', title: 'Share the programme outline', direction: 'they_owe_me', status: 'active', priority: 'high', expected: 'This Week' },
      { id: 't3', title: 'Confirm the venue booking', direction: 'they_owe_me', status: 'pending_acceptance', priority: 'normal', expected: 'This Week' },
      { id: 't4', title: 'Pay back the taxi money', direction: 'i_owe_them', status: 'active', priority: 'normal', expected: 'This Week' },
      { id: 't5', title: 'Review his CV', direction: 'i_owe_them', status: 'active', priority: 'low', expected: 'Next Week' },
    ],
  },
  {
    id: 'ama',
    name: 'Ama Serwaa',
    initials: 'AS',
    color: avatarColors[1],
    forThem: 1,
    forYou: 0,
    overdue: 0,
    urgent: 0,
    unread: false,
    favorite: true,
    lastActivity: 'Drop the keys with the caretaker',
    tasks: [
      { id: 't6', title: 'Drop the keys with the caretaker', direction: 'they_owe_me', status: 'active', priority: 'normal', expected: 'This Month' },
    ],
  },
  {
    id: 'kwame',
    name: 'Kwame Mensah',
    initials: 'KM',
    color: avatarColors[2],
    forThem: 0,
    forYou: 2,
    overdue: 0,
    urgent: 1,
    unread: true,
    work: true,
    lastActivity: 'Finish the Q3 slide deck',
    tasks: [
      { id: 't7', title: 'Finish the Q3 slide deck', direction: 'i_owe_them', status: 'active', priority: 'urgent', expected: 'Today' },
      { id: 't8', title: 'Send the signed contract', direction: 'i_owe_them', status: 'active', priority: 'normal', expected: 'This Week' },
    ],
  },
  {
    id: 'efua',
    name: 'Efua Boateng',
    initials: 'EB',
    color: avatarColors[3],
    forThem: 1,
    forYou: 1,
    overdue: 0,
    urgent: 0,
    unread: false,
    lastActivity: 'Return the borrowed charger',
    tasks: [
      { id: 't9', title: 'Return the borrowed charger', direction: 'they_owe_me', status: 'active', priority: 'low', expected: 'This Week' },
      { id: 't10', title: 'Send the birthday list', direction: 'i_owe_them', status: 'active', priority: 'normal', expected: 'Next Week' },
    ],
  },
]

export const SAMPLE_GROUPS = [
  { id: 'g1', name: 'Wedding Committee', members: 6, open: 4, done: 12, color: avatarColors[0] },
  { id: 'g2', name: 'Sales Team', members: 4, open: 7, done: 31, color: avatarColors[1] },
]

export const SAMPLE_PROFILE = {
  name: 'Isaac',
  phone: '+233 24 000 0000',
  description: 'Building TallyTalk.',
}
