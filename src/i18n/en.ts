/**
 * English, the source catalogue.
 *
 * Every string the interface shows lives here under a key, and English is the
 * one catalogue that must be complete — a missing key anywhere else falls back
 * to this one. Keys are grouped by where they appear, and the value is the
 * exact wording, including punctuation, so a translator never has to guess at
 * context from a fragment.
 */
export const en = {
  // --- first run: language -------------------------------------------------
  'lang.title': 'Welcome to {app}',
  'lang.subtitle': 'Choose your language to get started',
  'lang.group': 'Language',
  'lang.continue': 'Continue',
  'lang.englishOnly':
    'The interface is in English for now. Your choice is saved, and the rest follows as translations are ready.',

  // --- first run: what the product is -------------------------------------
  'intro.next': 'Next',
  'intro.start': 'Get started',
  'intro.tasks.title': 'Send tasks, not just messages',
  'intro.tasks.body':
    'Ask someone to do something and it becomes a real, trackable task — with a priority and a due date.',
  'intro.tally.title': 'Every contact is a two-sided tally',
  'intro.tally.body':
    'One side is what they owe you, the other is what you owe them. Nothing quietly slips through.',
  'intro.poke.title': 'Poke to nudge, gently',
  'intro.poke.body':
    'A tap of the wand lifts your task to the top of their screen — a friendly reminder, not a nag.',
  'intro.art.sample': 'Send me the Ecobank document',
  'intro.art.urgent': 'Urgent',
  'intro.art.today': 'Today',
  'intro.art.done': 'Marked done',
  'intro.art.theyOwe': 'they owe you',
  'intro.art.youOwe': 'you owe',
  'intro.art.contact': 'A contact',
  'intro.art.otherContact': 'Another contact',
  'intro.art.venue': 'Confirm the venue booking',
  'intro.art.thisWeek': 'This Week',
  'intro.art.poke': 'Poke',
  'intro.art.poked': 'You poked a contact',

  // --- welcome ------------------------------------------------------------
  'welcome.pitch':
    'Keep everyone to their word — a two-sided tally of what they owe you and what you owe them.',
  'welcome.consent': 'Tap “Agree and continue” to accept the Terms of Service and Privacy Policy.',
  'welcome.cta': 'Agree and continue',

  // --- sign in ------------------------------------------------------------
  'auth.back': 'Back',
  'auth.phone.title': 'What’s your number?',
  'auth.phone.body': 'We’ll text you a 6-digit code to confirm it’s you.',
  'auth.phone.label': 'Mobile number',
  'auth.phone.placeholder': '24 000 0000',
  'auth.phone.aria': 'Phone number',
  'auth.phone.country': 'Country code',
  'auth.phone.send': 'Send code',
  'auth.phone.invalid': 'Enter a valid mobile number.',
  'auth.confirm.title': 'You entered the phone number:',
  'auth.confirm.question': 'Is this correct, or would you like to edit the number?',
  'auth.confirm.edit': 'Edit',
  'auth.confirm.send': 'Yes, send code',
  'auth.code.title': 'Enter the code',
  'auth.code.body': 'We texted a code to {phone}.',
  'auth.code.label': 'Verification code',
  'auth.code.verify': 'Verify',
  'auth.code.missing': 'Enter the code we texted you.',
  'auth.code.resend': 'Send it again',
  'auth.code.change': 'Change number',
  'auth.legal': 'By continuing you agree to the {terms} and {privacy}.',
  'auth.legal.terms': 'Terms of Service',
  'auth.legal.privacy': 'Privacy Policy',
  'auth.sending': 'Sending code…',
  'auth.verifying': 'Verifying…',

  // --- the app's main sections -------------------------------------------
  'nav.contacts': 'Contacts',
  'nav.personal': 'Personal',
  'nav.groups': 'Groups',
  'nav.profile': 'Profile',

  // --- connection ---------------------------------------------------------
  'offline.notice': 'No connection — showing what was last loaded',
  'offline.waiting': 'No connection — waiting for it to come back',

  // --- settings: language -------------------------------------------------
  'settings.language': 'Language',
  'settings.language.note': 'Interface translations are still being written.',
} as const

export type TranslationKey = keyof typeof en
