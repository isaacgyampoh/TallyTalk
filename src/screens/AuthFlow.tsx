import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/authState'
import { COUNTRIES } from '@/lib/config'
import { BackIcon, PhoneIcon } from '@/components/icons'
import { isAppMode } from '@/lib/platform'
import { OfflineBar } from '@/components/OfflineBar'

type Step = 'phone' | 'code'

export function AuthFlow() {
  const { mode, sendCode, verifyCode, enterPreview } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [country, setCountry] = useState(COUNTRIES[0])
  const [local, setLocal] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phone = `${country.dial}${local.replace(/\D/g, '').replace(/^0+/, '')}`

  function onNext() {
    setError(null)
    if (local.replace(/\D/g, '').length < 6) {
      setError('Enter a valid mobile number.')
      return
    }
    setConfirming(true)
  }

  async function onSendCode() {
    setConfirming(false)
    setError(null)
    setBusy(true)
    const { error } = await sendCode(phone)
    setBusy(false)
    if (error) setError(error)
    else setStep('code')
  }

  async function onVerify() {
    setError(null)
    if (code.replace(/\D/g, '').length < 4) {
      setError('Enter the code we texted you.')
      return
    }
    setBusy(true)
    const { error } = await verifyCode(phone, code)
    setBusy(false)
    if (error) setError(error)
  }

  const confirmDialog = confirming ? (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-number"
      onClick={() => setConfirming(false)}
    >
      <div
        className="animate-rise-in w-full max-w-[380px] rounded-[20px] bg-paper p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-number" className="text-[15px] text-ink-soft">
          You entered the phone number:
        </p>
        <p className="nums mt-1.5 text-[20px] font-semibold text-ink">{phone}</p>
        <p className="mt-3 text-[14.5px] text-ink-soft">
          Is this correct, or would you like to edit the number?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="press rounded-full px-5 py-2.5 text-[15px] font-semibold text-violet-ink"
          >
            Edit
          </button>
          <button
            onClick={onSendCode}
            className="press rounded-full bg-violet px-6 py-2.5 text-[15px] font-semibold text-white"
          >
            Yes, send code
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="app-frame relative overflow-hidden">
      <OfflineBar />
      {confirmDialog}
      <div
        className="relative flex flex-1 flex-col px-6"
        style={{ paddingTop: 'calc(var(--safe-top) + 20px)' }}
      >
        {/* Brand hero — the wand is the one bold thing here. */}
        <div className="flex flex-1 flex-col justify-center pb-6 pt-4">
          {step === 'phone' ? (
            <div className="animate-rise-in">
              <button
                className="press mb-8 flex w-fit items-center gap-1 text-[14px] font-semibold text-ink-soft"
                onClick={() => nav('/')}
              >
                <BackIcon width={18} height={18} /> {!isAppMode && 'Back'}
              </button>
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
                What&rsquo;s your number?
              </h1>
              <p className="mt-2.5 max-w-[20rem] text-[15px] leading-snug text-ink-soft">
                We&rsquo;ll text you a 6-digit code to confirm it&rsquo;s you.
              </p>

              <div className="mt-8 space-y-3">
                <label className="eyebrow block">Mobile number</label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      value={country.code}
                      onChange={(e) =>
                        setCountry(COUNTRIES.find((c) => c.code === e.target.value) ?? COUNTRIES[0])
                      }
                      className="field h-12 w-[104px] appearance-none pr-6 font-semibold"
                      aria-label="Country code"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} {c.dial}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    inputMode="tel"
                    autoFocus
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onNext()}
                    placeholder="24 000 0000"
                    className="field nums flex-1"
                    aria-label="Phone number"
                  />
                </div>
                {error && <p className="text-[13px] font-medium text-overdue">{error}</p>}
                <button className="btn-primary mt-2 w-full" onClick={onNext} disabled={busy}>
                  <PhoneIcon width={18} height={18} />
                  {busy ? 'Sending code…' : 'Send code'}
                </button>
              </div>

              <div className="mt-8 rounded-card border border-line bg-wash p-4">
                <p className="text-[13px] leading-snug text-ink-soft">
                  {mode === 'preview'
                    ? "Backend isn't connected yet. You can still explore the app with sample data."
                    : 'Just want to look around? Explore the app with sample data.'}
                </p>
                <button className="btn-ghost mt-3 w-full" onClick={enterPreview}>
                  Explore with sample data
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-rise-in">
              <button
                className="press mb-6 inline-flex items-center gap-1 text-[14px] font-semibold text-ink-soft"
                onClick={() => {
                  setStep('phone')
                  setCode('')
                  setError(null)
                }}
              >
                <BackIcon width={18} height={18} /> Change number
              </button>
              <h1 className="font-display text-[30px] font-bold tracking-tight">Enter the code</h1>
              <p className="mt-2 text-[15px] text-ink-soft">
                We texted a code to <span className="font-semibold text-ink">{phone}</span>.
              </p>

              <input
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && onVerify()}
                placeholder="• • • • • •"
                className="field nums mt-7 text-center text-[24px] tracking-[0.5em]"
                aria-label="Verification code"
              />
              {error && <p className="mt-3 text-[13px] font-medium text-overdue">{error}</p>}

              <button className="btn-primary mt-5 w-full" onClick={onVerify} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          )}
        </div>

        <p
          className="pb-6 pt-4 text-center text-[12px] text-ink-faint"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        >
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
