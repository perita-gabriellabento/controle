'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { RefreshCw, LogOut, Settings, Scale, Sun, Moon, Eye, EyeOff, CalendarDays, CalendarCheck } from 'lucide-react'

import { isAuthenticated, logout, changePassword } from '@/lib/auth'
import { fetchPericias, fetchChecklist, subscribeToChanges } from '@/lib/sheets'
import { authedFetch } from '@/lib/supabaseClient'
import type { Pericia } from '@/lib/types'

import KPICards from '@/components/KPICards'
import PericiasTable from '@/components/PericiasTable'
import FilterBar, { type Filters } from '@/components/FilterBar'
import NovaPericia from '@/components/NovaPericia'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMPTY_FILTERS: Filters = { search: '', fase: '', tipo: '', uf: '', origem: '', cardFilter: '', sortBy: 'entrega_asc' }

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold/20 border-t-gold/60 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null)
  const [pericias, setPericias] = useState<Pericia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [privacyMode, setPrivacyMode] = useState(false)

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as 'dark' | 'light' | null
    const t = saved || 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  function togglePrivacy() {
    const next = !privacyMode
    setPrivacyMode(next)
    document.documentElement.setAttribute('data-privacy', String(next))
  }

  useEffect(() => {
    isAuthenticated().then(authed => {
      if (!authed) router.replace('/')
    })
  }, [router])

  useEffect(() => {
    authedFetch('/api/calendar/status').then(r => r.json()).then(d => setCalendarConnected(!!d.connected)).catch(() => setCalendarConnected(false))
  }, [])

  const [connectingCalendar, setConnectingCalendar] = useState(false)
  async function handleConnectCalendar() {
    setConnectingCalendar(true)
    try {
      const res = await authedFetch('/api/calendar/connect', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Falha ao iniciar conexão')
      window.location.href = data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar Google Calendar')
      setConnectingCalendar(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('calendar_connected')) {
      toast.success('Google Calendar conectado com sucesso')
      setCalendarConnected(true)
      router.replace('/dashboard')
    } else if (searchParams.get('calendar_error')) {
      toast.error('Erro ao conectar Google Calendar', { description: searchParams.get('calendar_error') || undefined })
      router.replace('/dashboard')
    }
  }, [searchParams, router])

  const load = useCallback(async (force = false) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError('Configure a variável NEXT_PUBLIC_SUPABASE_URL no arquivo .env.local com a URL do projeto Supabase.')
      setLoading(false)
      return
    }
    try {
      const [data] = await Promise.all([fetchPericias(force), fetchChecklist(force)])
      setPericias([...data])
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Tempo real: só recarrega quando algo de fato muda no banco (Realtime),
    // nunca um polling cego repetindo em intervalo fixo.
    const unsubscribe = subscribeToChanges(() => load())
    return unsubscribe
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load(true)
    toast.success('Dados atualizados')
  }

  const handleUpdate = useCallback(() => { load() }, [load])

  const handleLogout = async () => {
    await logout()
    router.replace('/')
  }

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error('As senhas não conferem'); return }
    setSavingPin(true)
    try {
      const res = await changePassword(newPassword)
      if (!res.ok) { toast.error(res.error || 'Erro ao trocar senha'); return }
      toast.success('Senha alterada com sucesso')
      setPinDialogOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setSavingPin(false)
    }
  }

  const timeStr = lastRefresh
    ? lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="header-glass sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand — clica para recarregar */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 flex-shrink-0 rounded-xl px-2 py-1 -ml-2 transition-opacity duration-150 hover:opacity-75 active:opacity-50"
            title="Recarregar"
          >
            <div className="logo-mark w-9 h-9 relative flex-shrink-0">
              <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo-mark.png`} alt="GB" fill className="object-contain" priority />
            </div>
            <div className="hidden sm:flex flex-col leading-none text-left">
              <span className="font-cinzel text-[15px] text-gold tracking-wider">Controle de Perícias</span>
              <span className="text-[10px] font-montserrat tracking-[0.18em] uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
                Gabriella Bento · Perita Contábil
              </span>
            </div>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {timeStr && (
              <span className="text-[11px] text-text/50 hidden lg:block font-montserrat tabular-nums mr-3 tracking-wider">
                {timeStr}
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="icon-btn w-8 h-8 sm:w-9 sm:h-9"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={togglePrivacy}
              className="icon-btn w-8 h-8 sm:w-9 sm:h-9"
              title={privacyMode ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
              style={privacyMode ? { color: 'var(--gold)', borderColor: 'rgba(var(--color-gold)/0.35)', background: 'rgba(var(--color-gold)/0.08)' } : undefined}
            >
              {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="icon-btn w-8 h-8 sm:w-9 sm:h-9"
              title="Atualizar"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setPinDialogOpen(true)}
              className="icon-btn w-8 h-8 sm:w-9 sm:h-9"
              title="Configurações"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="icon-btn icon-btn-danger w-8 h-8 sm:w-9 sm:h-9"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="flex-1 w-full px-4 sm:px-6 py-5 flex flex-col gap-5">

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-40 gap-5">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border border-gold/10" />
              <div className="absolute inset-0 rounded-full border-t-2 border-gold/50 animate-spin" />
              <div className="absolute inset-2 rounded-full border border-gold/5" />
            </div>
            <div className="text-center">
              <p className="text-text/40 text-sm font-montserrat font-medium">Carregando processos</p>
              <p className="text-text/20 text-xs mt-1 font-montserrat">Conectando ao banco de dados…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center py-32 gap-5 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <Scale size={24} className="text-red-400/50" />
            </div>
            <div className="max-w-sm">
              <p className="font-cinzel text-sm text-red-400/70 mb-2">Erro ao carregar</p>
              <p className="text-text/40 text-xs font-montserrat leading-relaxed">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>Tentar novamente</Button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* KPIs */}
            <section>
              <KPICards
                pericias={pericias}
                activeFilter={filters.cardFilter}
                onCardClick={id => setFilters(f => ({ ...f, cardFilter: f.cardFilter === id ? '' : id }))}
              />
            </section>

            {/* Table section */}
            <section className="flex flex-col gap-3 flex-1">
              {/* Toolbar */}
              <div
                className="flex flex-wrap items-center gap-3 justify-between px-4 py-3 rounded-xl toolbar-elevated"
                style={{
                  background: 'var(--comp-toolbar)',
                  border: '1px solid var(--comp-toolbar-border)',
                  boxShadow: 'var(--comp-toolbar-shadow)',
                }}
              >
                <FilterBar filters={filters} onChange={setFilters} />
                <NovaPericia onCreated={handleUpdate} />
              </div>

              {/* Table */}
              <PericiasTable pericias={pericias} filters={filters} onUpdate={handleUpdate} />
            </section>
          </>
        )}
      </main>

      {/* ── Change Password Dialog ───────────────────────────── */}
      <Dialog open={pinDialogOpen} onOpenChange={v => { setPinDialogOpen(v); if (!v) { setNewPassword(''); setConfirmPassword('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha de Acesso</DialogTitle>
            <p className="text-xs text-text/40 mt-1 font-montserrat">
              A nova senha será solicitada no próximo login.
            </p>
          </DialogHeader>
          <form onSubmit={handleChangePasswordSubmit}>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="np">Nova senha (mínimo 6 caracteres)</Label>
                <Input id="np" type="password"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cp">Confirmar Nova Senha</Label>
                <Input id="cp" type="password"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" />
              </div>

              <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <Label>Google Calendar</Label>
                {calendarConnected ? (
                  <div className="flex items-center gap-2 text-[13px] text-green-400/80 font-montserrat">
                    <CalendarCheck size={14} /> Conectado — prazos sincronizam automaticamente
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectCalendar}
                    disabled={connectingCalendar}
                    className="flex items-center justify-center gap-2 h-9 rounded-lg text-[13px] font-montserrat font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <CalendarDays size={14} /> {connectingCalendar ? 'Conectando…' : 'Conectar Google Calendar'}
                  </button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPinDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingPin}>
                {savingPin ? 'Salvando…' : 'Salvar Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
