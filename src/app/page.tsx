'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { isAuthenticated, verifyPin, createSession } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isAuthenticated()) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
        setTimeout(() => inputRef.current?.focus(), 200)
      }
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) {
      toast.error('PIN deve ter pelo menos 4 dígitos')
      return
    }
    setLoading(true)
    try {
      const ok = await verifyPin(pin)
      if (!ok) {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        toast.error('PIN incorreto', { description: 'Verifique e tente novamente.' })
        setPin('')
        setTimeout(() => inputRef.current?.focus(), 100)
        return
      }
      createSession()
      router.replace('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-gold/20 border-t-gold/60 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center relative overflow-hidden">
      {/* Noise texture */}
      <div className="noise-overlay" />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div
          className="glow-blob absolute"
          style={{
            top: '-15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-20%',
            right: '-10%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--comp-login-blob) 0%, transparent 70%)',
            animation: 'blob-drift 24s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px] mx-5">
        {/* Logo section */}
        <div className="flex flex-col items-center mb-8 animate-fade-up">
          <div className="relative">
            {/* Ambient glow behind logo */}
            <div
              className="absolute inset-0 -m-4 rounded-2xl blur-2xl"
              style={{ background: 'radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
            />
            <Image
              src="/logo.png"
              alt="Gabriella Bento, Perita Contábil"
              width={320}
              height={115}
              className="object-contain relative z-10"
              style={{ maxWidth: '320px', width: '100%' }}
              priority
            />
          </div>
        </div>

        {/* Form card */}
        <div
          className="animate-fade-up-delay relative rounded-2xl p-8 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, var(--comp-login-card-from) 0%, var(--comp-login-card-to) 100%)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }}
          />

          <div className="text-center mb-7">
            <span className="text-[10px] tracking-[0.3em] uppercase text-text/30 font-montserrat font-medium">
              Controle de Perícias
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <label className="text-[10px] text-center tracking-[0.25em] uppercase text-gold/50 font-montserrat">
                PIN de Acesso
              </label>
              <div
                className="relative"
                style={{
                  animation: shake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
                }}
              >
                <style>{`@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-3px)}40%,60%{transform:translateX(3px)}}`}</style>
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={12}
                  className="pin-input"
                  placeholder="••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="btn-gold-shimmer w-full h-12 rounded-xl font-cinzel text-[13px] tracking-[0.15em] font-semibold transition-all duration-300"
              style={{ color: '#1A2535' }}
            >
              {loading ? 'Verificando…' : 'Acessar Sistema'}
            </button>
          </form>

          {/* Bottom gold line */}
          <div className="absolute bottom-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)' }} />
        </div>

        {/* Footer */}
        <div className="animate-fade-up-delay-2 mt-6 text-center">
          <p className="text-[10px] text-text/40 font-montserrat tracking-widest uppercase">
            Acesso restrito · Uso exclusivo
          </p>
        </div>
      </div>
    </div>
  )
}
