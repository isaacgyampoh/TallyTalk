# Adding a language

The interface reads every string from a catalogue keyed by `src/i18n/en.ts`,
which is the source and the fallback. A language with no catalogue, or with a
key missing from its catalogue, shows the English string — never the key.

## The rule

**Only a catalogue written by someone who speaks the language goes in here.**

TaskTally is an accountability product. Its wording carries obligation —
"owes you", "agree and continue", "poke", "overdue" — and a plausible-looking
mistranslation of that does real damage: it changes what someone believes they
have committed to. English, which most people in the launch market recognise
as not their own language, is the safer default until a speaker has written the
replacement.

So: no machine translation, and no "close enough" draft from someone working
from a dictionary. A partial catalogue from a speaker is welcome; the keys they
have not reached fall back on their own.

## How

1. Copy the keys from `en.ts` into `src/i18n/<code>.ts`, keeping the keys
   exactly and translating only the values. The code is the one already used in
   `src/lib/language.ts` (`tw`, `gaa`, `ee`, `ha`, `pcm`).
2. Keep `{app}`, `{phone}`, `{terms}` and the other `{placeholders}` intact —
   they are substituted at runtime, and a renamed one shows as literal text.
3. Register it in `CATALOGUES` in `src/i18n/index.ts`.
4. Run `npm test`. `i18n.test.ts` fails on a key that does not exist in English
   (a typo, or a key removed since) and reports each catalogue's coverage.

A language is offered as translated in the picker once it covers more than 90%
of the keys; below that it is still selectable, and still mostly English.

## What is converted so far

The first-run path: the language step, the three intro slides, the welcome
screen, sign-in, the tab labels, and the connection notices. Everything else is
still English in JSX — that is the follow-up card, not an oversight.
