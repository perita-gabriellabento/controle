'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { RefreshCw, LogOut, Settings, Scale, Sun, Moon, Eye, EyeOff } from 'lucide-react'

import { isAuthenticated, logout, changePin } from '@/lib/auth'
import { fetchPericias, invalidateCache, GAS_URL } from '@/lib/sheets'
import type { Pericia } from '@/lib/types'

import KPICards from '@/components/KPICards'
import PericiasTable from '@/components/PericiasTable'
import FilterBar, { type Filters } from '@/components/FilterBar'
import NovaPericia from '@/components/NovaPericia'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMPTY_FILTERS: Filters = { search: '', fase: '', tipo: '', uf: '', origem: '', cardFilter: '' }

export default function DashboardPage() {
  const router = useRouter()
  const [pericias, setPericias] = useState<Pericia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [privacyMode, setPrivacyMode] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('theme') : null) as 'dark' | 'light' | null
    const t = saved || 'light'
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
    if (typeof window !== 'undefined' && !isAuthenticated()) {
      router.replace('/')
    }
  }, [router])

  const load = useCallback(async (force = false) => {
    if (!GAS_URL || (GAS_URL !== 'demo' && !GAS_URL.startsWith('http'))) {
      setError('Configure a variável NEXT_PUBLIC_GAS_URL no arquivo .env.local com a URL do Google Apps Script.')
      setLoading(false)
      return
    }
    try {
      const data = await fetchPericias(force)
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
    intervalRef.current = setInterval(() => load(true), 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    invalidateCache()
    await load(true)
    toast.success('Dados atualizados')
  }

  const handleUpdate = useCallback(() => { load() }, [load])

  const handleLogout = () => {
    logout()
    router.replace('/')
  }

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPin.length < 4) { toast.error('PIN deve ter pelo menos 4 dígitos'); return }
    if (newPin !== confirmPin) { toast.error('Os PINs não conferem'); return }
    setSavingPin(true)
    try {
      await changePin(newPin)
      toast.success('PIN alterado com sucesso')
      setPinDialogOpen(false)
      setNewPin('')
      setConfirmPin('')
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
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="logo-mark w-9 h-9 relative flex-shrink-0">
              <Image src="/logo-mark.png" alt="GB" fill className="object-contain" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-cinzel text-[15px] text-gold tracking-wider">Controle de Perícias</span>
              <span className="text-[10px] font-montserrat tracking-[0.18em] uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
                Gabriella Bento · Perita Contábil
              </span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {timeStr && (
              <span className="text-[11px] text-text/50 hidden lg:block font-montserrat tabular-nums mr-3 tracking-wider">
                {timeStr}
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="icon-btn w-9 h-9"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={togglePrivacy}
              className="icon-btn w-9 h-9"
              title={privacyMode ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
              style={privacyMode ? { color: 'var(--gold)', borderColor: 'rgba(var(--color-gold)/0.35)', background: 'rgba(var(--color-gold)/0.08)' } : undefined}
            >
              {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="icon-btn w-9 h-9"
              title="Atualizar"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setPinDialogOpen(true)}
              className="icon-btn w-9 h-9"
              title="Configurações"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="icon-btn icon-btn-danger w-9 h-9"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-7 flex flex-col gap-6">

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
              <p className="text-text/20 text-xs mt-1 font-montserrat">Conectando ao Google Sheets…</p>
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

      {/* ── Change PIN Dialog ───────────────────────────────── */}
      <Dialog open={pinDialogOpen} onOpenChange={v => { setPinDialogOpen(v); if (!v) { setNewPin(''); setConfirmPin('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar PIN de Acesso</DialogTitle>
            <p className="text-xs text-text/40 mt-1 font-montserrat">
              O novo PIN será solicitado no próximo login.
            </p>
          </DialogHeader>
          <form onSubmit={handleChangePinSubmit}>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="np">Novo PIN (mínimo 4 dígitos)</Label>
                <Input id="np" type="password" inputMode="numeric"
                  value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={12} placeholder="••••" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cp">Confirmar Novo PIN</Label>
                <Input id="cp" type="password" inputMode="numeric"
                  value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={12} placeholder="••••" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPinDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingPin}>
                {savingPin ? 'Salvando…' : 'Salvar PIN'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
