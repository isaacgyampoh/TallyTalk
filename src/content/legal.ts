/**
 * The Terms of Service and Privacy Policy.
 *
 * Written against the actual schema rather than from a template: every category
 * below corresponds to a real table, bucket or third party in this project. If
 * the schema changes, this has to change with it.
 *
 * NOT LEGAL ADVICE. A qualified person should review both before launch,
 * particularly the Ghana Data Protection Act 2012 (Act 843) obligations, which
 * apply to the launch market and which this text describes only in outline.
 */

export interface LegalDoc {
  title: string
  updated: string
  intro: string
  sections: { heading: string; body: string[] }[]
}

const UPDATED = '12 October 2026'

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: UPDATED,
  intro:
    'TaskTally is a shared record of what people have agreed to do for each other. That only works if the record is accurate and private to the people in it. This explains exactly what we hold, why, and who can see it.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Your phone number. It is how you sign in and how other people find you, and it is the one thing we cannot work without. We never ask for a password.',
        'Your name, and a photo if you add one.',
        'The tasks you send and receive, including their titles, notes, priorities and due dates, and the comments and files attached to them.',
        'Your private checklists and their items.',
        'The groups you belong to, who else is in them, and the tasks shared there.',
        'Your contacts inside TaskTally — the people you have added, and whether you have marked them as work, favourite, archived or blocked.',
        'A device token for each device you install on, so notifications can reach you.',
      ],
    },
    {
      heading: 'What we do not collect',
      body: [
        'We do not read your phone’s address book. Contacts in TaskTally are only the people you deliberately add by number.',
        'We do not track your location.',
        'We do not use advertising identifiers, and there are no advertising or analytics trackers in the app.',
        'We do not sell anything to anyone.',
      ],
    },
    {
      heading: 'Who can see your information',
      body: [
        'A task is visible to the person who asked and the person asked, and to group members if it was shared with a group. Nobody else, including people who have your number.',
        'Your private checklists are visible only to you.',
        'Your name is visible to people you are connected to. Your photo follows the visibility you choose in Settings.',
        'Whether you can be found by your phone number is your choice, and you can turn it off in Settings.',
        'These rules are enforced by the database itself, not only by the app, so they hold regardless of which client is used.',
      ],
    },
    {
      heading: 'Who we share it with',
      body: [
        'Supabase, which hosts the database, authentication and file storage.',
        'Arkesel, which delivers the one-time code by SMS. They receive your phone number and the code, and nothing else.',
        'Google Firebase Cloud Messaging, which delivers push notifications. Notification payloads carry identifiers only — never the content of a task or a message.',
        'Vercel, which serves the website and the app’s web build.',
        'We do not share your information with anyone else, and we do not sell it.',
      ],
    },
    {
      heading: 'Keeping it, and deleting it',
      body: [
        'We keep your information for as long as your account exists.',
        'You can export everything we hold about you from Settings, as a file.',
        'You can delete your account from Settings. That removes your profile, your contacts, your checklists, your device tokens, and the tasks you raised. Tasks you agreed to do for someone else remain in their record, because deleting your account should not quietly rewrite what another person is owed.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can see, correct, export and delete your information from within the app.',
        'In Ghana, the Data Protection Act 2012 (Act 843) gives you further rights over your personal data, including the right to complain to the Data Protection Commission.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'TaskTally is not intended for people under 13, and we do not knowingly create accounts for them.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If we change this policy in a way that affects what we collect or who sees it, we will say so in the app before the change takes effect.',
      ],
    },
  ],
}

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  updated: UPDATED,
  intro:
    'These are the rules for using TaskTally. They are deliberately short, because you should be able to read them.',
  sections: [
    {
      heading: 'Your account',
      body: [
        'You need a working mobile number to sign in. Keep access to it — it is the only way back into your account.',
        'One account per person. Do not sign up with someone else’s number.',
        'You are responsible for what happens under your account.',
      ],
    },
    {
      heading: 'What TaskTally is, and is not',
      body: [
        'TaskTally records what people have agreed to do. It is a record, not a contract, and it does not create a legal obligation between you and anyone else.',
        'We do not mediate disputes about whether a task was done.',
      ],
    },
    {
      heading: 'Using it decently',
      body: [
        'Do not use TaskTally to harass anyone. If someone blocks you, you cannot send them tasks, messages or nudges, and you should not work around that.',
        'Do not upload anything unlawful, or anything you do not have the right to share.',
        'Do not attempt to reach other people’s data, or to interfere with the service.',
        'We may suspend an account that does these things.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'What you write and upload stays yours. You give us only the permission needed to store it and show it to the people you shared it with.',
      ],
    },
    {
      heading: 'Availability',
      body: [
        'TaskTally is provided as it is. We work to keep it running, but we do not promise it will always be available or free of faults.',
        'SMS delivery depends on mobile networks we do not control.',
      ],
    },
    {
      heading: 'Ending it',
      body: [
        'You can delete your account at any time from Settings.',
        'We may close an account that breaks these terms, and will say why where we can.',
      ],
    },
    {
      heading: 'Contact',
      body: [
        'Questions about these terms or your data can be sent to the support address on the TaskTally website.',
      ],
    },
  ],
}
