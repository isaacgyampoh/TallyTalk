import type { Priority } from './config'

export interface SampleTask {
  id: string
  title: string
  direction: 'they_owe_me' | 'i_owe_them'
  status: 'pending_acceptance' | 'active' | 'completed'
  priority: Priority
  expected: string
  note?: string
  overdue?: boolean
}

export interface SampleContact {
  id: string
  name: string
  initials: string
  color: string
  forThem: number
  forYou: number
  overdue: number
  urgent: number
  unread: boolean
  work?: boolean
  favorite?: boolean
  lastActivity: string
  tasks: SampleTask[]
}

const C = {
  violet: '#6600FF',
  teal: '#0E7C86',
  amber: '#B4530A',
  glow: '#8A3BFF',
  green: '#2B7A3B',
  rose: '#B02A6F',
  blue: '#2457C5',
}

export const SAMPLE_CONTACTS: SampleContact[] = [
  {
    id: 'ben',
    name: 'Ben Owusu',
    initials: 'BO',
    color: C.violet,
    forThem: 3,
    forYou: 2,
    overdue: 1,
    urgent: 1,
    unread: true,
    work: true,
    favorite: true,
    lastActivity: 'Send me the final Ecobank document',
    tasks: [
      {
        id: 't1',
        title: 'Send me the final Ecobank document',
        direction: 'they_owe_me',
        status: 'active',
        priority: 'urgent',
        expected: 'Today',
        overdue: true,
        note: 'The signed PDF, not the scan.',
      },
      {
        id: 't2',
        title: 'Share the programme outline',
        direction: 'they_owe_me',
        status: 'active',
        priority: 'high',
        expected: 'This Week',
      },
      {
        id: 't3',
        title: 'Confirm the venue booking',
        direction: 'they_owe_me',
        status: 'pending_acceptance',
        priority: 'normal',
        expected: 'This Week',
      },
      {
        id: 't4',
        title: 'Pay back the taxi money',
        direction: 'i_owe_them',
        status: 'active',
        priority: 'normal',
        expected: 'This Week',
        note: 'GHS 60',
      },
      {
        id: 't5',
        title: 'Review his CV',
        direction: 'i_owe_them',
        status: 'active',
        priority: 'low',
        expected: 'Next Week',
      },
    ],
  },
  {
    id: 'ama',
    name: 'Ama Serwaa',
    initials: 'AS',
    color: C.teal,
    forThem: 2,
    forYou: 0,
    overdue: 0,
    urgent: 0,
    unread: false,
    favorite: true,
    lastActivity: 'Drop the keys with the caretaker',
    tasks: [
      {
        id: 't6',
        title: 'Drop the keys with the caretaker',
        direction: 'they_owe_me',
        status: 'active',
        priority: 'normal',
        expected: 'This Month',
      },
      {
        id: 't6b',
        title: 'Send the guest list',
        direction: 'they_owe_me',
        status: 'active',
        priority: 'low',
        expected: 'Next Week',
      },
    ],
  },
  {
    id: 'kwame',
    name: 'Kwame Mensah',
    initials: 'KM',
    color: C.amber,
    forThem: 0,
    forYou: 2,
    overdue: 0,
    urgent: 1,
    unread: true,
    work: true,
    lastActivity: 'Finish the Q3 slide deck',
    tasks: [
      {
        id: 't7',
        title: 'Finish the Q3 slide deck',
        direction: 'i_owe_them',
        status: 'active',
        priority: 'urgent',
        expected: 'Today',
        note: '12 slides, board review Friday.',
      },
      {
        id: 't8',
        title: 'Send the signed contract',
        direction: 'i_owe_them',
        status: 'active',
        priority: 'normal',
        expected: 'This Week',
      },
    ],
  },
  {
    id: 'efua',
    name: 'Efua Boateng',
    initials: 'EB',
    color: C.glow,
    forThem: 1,
    forYou: 1,
    overdue: 0,
    urgent: 0,
    unread: false,
    lastActivity: 'Return the borrowed charger',
    tasks: [
      {
        id: 't9',
        title: 'Return the borrowed charger',
        direction: 'they_owe_me',
        status: 'active',
        priority: 'low',
        expected: 'This Week',
      },
      {
        id: 't10',
        title: 'Send the birthday list',
        direction: 'i_owe_them',
        status: 'active',
        priority: 'normal',
        expected: 'Next Week',
      },
    ],
  },
  {
    id: 'yaw',
    name: 'Yaw Darko',
    initials: 'YD',
    color: C.green,
    forThem: 0,
    forYou: 0,
    overdue: 0,
    urgent: 0,
    unread: false,
    work: true,
    lastActivity: 'All settled — nice work',
    tasks: [
      {
        id: 't11',
        title: 'Approve the invoice',
        direction: 'they_owe_me',
        status: 'completed',
        priority: 'normal',
        expected: 'This Week',
      },
    ],
  },
  {
    id: 'adjoa',
    name: 'Adjoa Nyarko',
    initials: 'AN',
    color: C.rose,
    forThem: 1,
    forYou: 0,
    overdue: 0,
    urgent: 0,
    unread: true,
    lastActivity: 'Send the fabric samples',
    tasks: [
      {
        id: 't12',
        title: 'Send the fabric samples',
        direction: 'they_owe_me',
        status: 'pending_acceptance',
        priority: 'normal',
        expected: 'This Week',
      },
    ],
  },
]

// ---- Personal checklists ----
export interface ChecklistItem {
  id: string
  title: string
  done: boolean
  phone?: string
}

export const SAMPLE_CHECKLIST_ITEMS: Record<string, ChecklistItem[]> = {
  daily: [
    { id: 'd1', title: 'Morning devotion', done: true },
    { id: 'd2', title: 'Check overnight orders', done: true },
    { id: 'd3', title: 'Gym — 30 mins', done: false },
    { id: 'd4', title: 'Reply to pending emails', done: false },
    { id: 'd5', title: 'Post to Instagram', done: false },
  ],
  call: [
    { id: 'c1', title: 'Auntie Grace', done: false, phone: '+233241234567' },
    { id: 'c2', title: 'Landlord about the rent', done: false, phone: '+233209876543' },
    { id: 'c3', title: 'Dr. Mensah — reschedule', done: true, phone: '+233551112233' },
  ],
  buy: [
    { id: 'b1', title: 'Rice — 5kg', done: false },
    { id: 'b2', title: 'Cooking oil', done: false },
    { id: 'b3', title: 'Phone charger', done: false },
    { id: 'b4', title: 'Milo', done: true },
  ],
  pay: [
    { id: 'p1', title: 'ECG electricity', done: false },
    { id: 'p2', title: 'DSTV subscription', done: true },
    { id: 'p3', title: "Kofi's school fees", done: false },
  ],
  follow_up: [
    { id: 'f1', title: 'Bank on the loan application', done: false },
    { id: 'f2', title: 'Supplier on the delayed order', done: false },
  ],
  travel: [
    { id: 'tr1', title: 'Passport & Ghana Card', done: true },
    { id: 'tr2', title: 'Chargers & power bank', done: true },
    { id: 'tr3', title: 'Book airport pickup', done: false },
    { id: 'tr4', title: 'Travel insurance', done: false },
  ],
}

// ---- Groups ----
export interface GroupMember {
  id: string
  name: string
  initials: string
  color: string
  role: 'administrator' | 'member'
}
export interface GroupTask {
  id: string
  title: string
  assignee: string
  done: boolean
  priority: Priority
}
export interface SampleGroup {
  id: string
  name: string
  members: number
  open: number
  done: number
  color: string
  description: string
  memberList: GroupMember[]
  tasks: GroupTask[]
}

export const SAMPLE_GROUPS: SampleGroup[] = [
  {
    id: 'g1',
    name: 'Wedding Committee',
    members: 6,
    open: 4,
    done: 12,
    color: C.violet,
    description: 'Planning Kwabena & Efua’s big day — 14 December.',
    memberList: [
      { id: 'm1', name: 'You', initials: 'IS', color: C.violet, role: 'administrator' },
      { id: 'm2', name: 'Ben Owusu', initials: 'BO', color: C.teal, role: 'member' },
      { id: 'm3', name: 'Ama Serwaa', initials: 'AS', color: C.amber, role: 'member' },
      { id: 'm4', name: 'Efua Boateng', initials: 'EB', color: C.glow, role: 'administrator' },
      { id: 'm5', name: 'Adjoa Nyarko', initials: 'AN', color: C.rose, role: 'member' },
      { id: 'm6', name: 'Yaw Darko', initials: 'YD', color: C.green, role: 'member' },
    ],
    tasks: [
      {
        id: 'gt1',
        title: 'Confirm the caterer headcount',
        assignee: 'Ama Serwaa',
        done: false,
        priority: 'high',
      },
      {
        id: 'gt2',
        title: 'Finalise the seating chart',
        assignee: 'You',
        done: false,
        priority: 'normal',
      },
      {
        id: 'gt3',
        title: 'Order the invitation cards',
        assignee: 'Efua Boateng',
        done: false,
        priority: 'urgent',
      },
      {
        id: 'gt4',
        title: 'Book the decorator',
        assignee: 'Adjoa Nyarko',
        done: false,
        priority: 'normal',
      },
      {
        id: 'gt5',
        title: 'Pay the venue deposit',
        assignee: 'Ben Owusu',
        done: true,
        priority: 'high',
      },
      {
        id: 'gt6',
        title: 'Send the save-the-dates',
        assignee: 'You',
        done: true,
        priority: 'normal',
      },
    ],
  },
  {
    id: 'g2',
    name: 'Sales Team',
    members: 4,
    open: 7,
    done: 31,
    color: C.teal,
    description: 'Q3 targets and daily pipeline follow-ups.',
    memberList: [
      { id: 's1', name: 'You', initials: 'IS', color: C.violet, role: 'administrator' },
      { id: 's2', name: 'Kwame Mensah', initials: 'KM', color: C.amber, role: 'member' },
      { id: 's3', name: 'Yaw Darko', initials: 'YD', color: C.green, role: 'member' },
      { id: 's4', name: 'Adjoa Nyarko', initials: 'AN', color: C.rose, role: 'member' },
    ],
    tasks: [
      {
        id: 'st1',
        title: 'Follow up with Melcom account',
        assignee: 'Kwame Mensah',
        done: false,
        priority: 'urgent',
      },
      {
        id: 'st2',
        title: 'Send July pipeline report',
        assignee: 'You',
        done: false,
        priority: 'high',
      },
      {
        id: 'st3',
        title: 'Onboard the new distributor',
        assignee: 'Yaw Darko',
        done: false,
        priority: 'normal',
      },
      {
        id: 'st4',
        title: 'Update the CRM records',
        assignee: 'Adjoa Nyarko',
        done: true,
        priority: 'low',
      },
    ],
  },
]

export const SAMPLE_PROFILE = {
  name: 'Isaac',
  phone: '+233 24 000 0000',
  description: 'Building TaskTally.',
}
