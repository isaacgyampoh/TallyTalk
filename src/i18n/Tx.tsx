import { Fragment, type ReactNode } from 'react'
import { useT } from './useT'
import type { TranslationKey, Vars } from './index'

/**
 * A translated string with React nodes in its placeholders.
 *
 * Some sentences have a link or an emphasised value in the middle of them, and
 * where that falls differs by language — so the sentence has to stay one
 * catalogue entry rather than being cut into fragments a translator cannot
 * reorder. `{terms}` in the string is replaced by `slots.terms`.
 */
export function Tx({
  k,
  vars,
  slots,
}: {
  k: TranslationKey
  vars?: Vars
  slots: Record<string, ReactNode>
}) {
  const { t } = useT()
  return (
    <>
      {t(k, vars)
        .split(/(\{\w+\})/g)
        .map((piece, i) => {
          const name = /^\{(\w+)\}$/.exec(piece)?.[1]
          return name && name in slots ? (
            <Fragment key={i}>{slots[name]}</Fragment>
          ) : (
            <Fragment key={i}>{piece}</Fragment>
          )
        })}
    </>
  )
}
