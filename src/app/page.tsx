'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { isAuthenticated, login } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [trustDevice, setTrustDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [shake, setShake] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    isAuthenticated().then(authed => {
      if (authed) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
        setTimeout(() => emailRef.current?.focus(), 200)
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || password.length < 6) {
      toast.error('Preencha e-mail e senha (mínimo 6 caracteres)')
      return
    }
    setLoading(true)
    try {
      const res = await login(email, password, trustDevice)
      if (!res.ok) {
        setShake(true)
        setTimeout(() => setShake(false), 600)
        toast.error('Não foi possível entrar', { description: 'Verifique e-mail e senha e tente novamente.' })
        return
      }
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
      <div className="noise-overlay" />

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

      <div className="relative z-10 w-full max-w-[380px] mx-5">
        <div className="flex flex-col items-center mb-8 animate-fade-up">
          <div className="relative">
            <div
              className="absolute inset-0 -m-4 rounded-2xl blur-2xl"
              style={{ background: 'radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
            />
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`}
              alt="Gabriella Bento, Perita Contábil"
              width={320}
              height={115}
              className="object-contain relative z-10"
              style={{ maxWidth: '320px', width: '100%' }}
              priority
            />
          </div>
        </div>

        <div
          className="animate-fade-up-delay relative rounded-2xl p-8 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, var(--comp-login-card-from) 0%, var(--comp-login-card-to) 100%)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="absolute top-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }}
          />

          <div className="text-center mb-7">
            <span className="text-[10px] tracking-[0.3em] uppercase text-text/30 font-montserrat font-medium">
              Controle de Perícias
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" style={{ animation: shake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}>
            <style>{`@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-3px)}40%,60%{transform:translateX(3px)}}`}</style>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-[0.2em] uppercase text-gold/50 font-montserrat">E-mail</label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-[14px] text-text focus:outline-none focus:border-gold/60 transition-colors"
                style={{ background: 'var(--comp-cell-input)', border: '1px solid var(--border)' }}
                placeholder="seu@email.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-[0.2em] uppercase text-gold/50 font-montserrat">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-[14px] text-text focus:outline-none focus:border-gold/60 transition-colors"
                  style={{ background: 'var(--comp-cell-input)', border: '1px solid var(--border)' }}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text/35 hover:text-gold/70 transition-colors"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={e => setTrustDevice(e.target.checked)}
                className="w-4 h-4 rounded accent-[#D4AF37]"
              />
              <span className="text-[12px] text-text/50 font-montserrat">Confiar neste dispositivo</span>
            </label>

            <button
              type="submit"
              disabled={loading || !email || password.length < 6}
              className="btn-gold-shimmer w-full h-12 rounded-xl font-cinzel text-[13px] tracking-[0.15em] font-semibold transition-all duration-300 mt-2"
              style={{ color: '#1A2535' }}
            >
              {loading ? 'Entrando…' : 'Acessar Sistema'}
            </button>
          </form>

          <div className="absolute bottom-0 left-8 right-8 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)' }} />
        </div>

        <div className="animate-fade-up-delay-2 mt-6 text-center">
          <p className="text-[10px] text-text/40 font-montserrat tracking-widest uppercase">
            Acesso restrito · Uso exclusivo
          </p>
        </div>
      </div>
    </div>
  )
}
