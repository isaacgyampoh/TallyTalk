import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME, COUNTRIES } from '@/lib/config'
import { WandIcon, BackIcon, PhoneIcon } from '@/components/icons'

type Step = 'phone' | 'code'

export function AuthFlow() {
  const { mode, sendCode, verifyCode, enterPreview } = useAuth()
  const [step, setStep] = useState<Step>('phone')
  const [country, setCountry] = useState(COUNTRIES[0])
  const [local, setLocal] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phone = `${country.dial}${local.replace(/\D/g, '').replace(/^0+/, '')}`

  async function onSendCode() {
    setError(null)
    if (local.replace(/\D/g, '').length < 6) {
      setError('Enter a valid mobile number.')
      return
    }
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

  return (
    <div className="app-frame">
      <div className="flex flex-1 flex-col px-6" style={{ paddingTop: 'calc(var(--safe-top) + 20px)' }}>
        {/* Brand hero — the wand is the one bold thing here. */}
        <div className="flex flex-1 flex-col justify-center">
          {step === 'phone' ? (
            <div className="animate-rise-in">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet text-white shadow-float">
                <WandIcon width={28} height={28} />
              </div>
              <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-tight">
                {APP_NAME}
              </h1>
              <p className="mt-3 max-w-[19rem] text-[16px] leading-snug text-ink-soft">
                Know what you asked others to do, what they asked you, and what is actually done.
              </p>

              <div className="mt-9 space-y-3">
                <label className="eyebrow block">Your mobile number</label>
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
                          {c.flag} {c.dial}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    inputMode="tel"
                    autoFocus
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSendCode()}
                    placeholder="24 000 0000"
                    className="field nums flex-1"
                    aria-label="Phone number"
                  />
                </div>
                {error && <p className="text-[13px] font-medium text-overdue">{error}</p>}
                <button className="btn-primary mt-2 w-full" onClick={onSendCode} disabled={busy}>
                  <PhoneIcon width={18} height={18} />
                  {busy ? 'Sending code…' : 'Send code'}
                </button>
              </div>

              {mode === 'preview' && (
                <div className="mt-8 rounded-card border border-line bg-wash p-4">
                  <p className="text-[13px] leading-snug text-ink-soft">
                    Backend isn't connected yet. You can still explore the app with sample data.
                  </p>
                  <button className="btn-ghost mt-3 w-full" onClick={enterPreview}>
                    Explore with sample data
                  </button>
                </div>
              )}
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
