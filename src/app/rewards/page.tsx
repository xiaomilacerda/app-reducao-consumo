'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Check, Lock, Coins, Sparkles } from 'lucide-react'

type AvatarItem = {
  code: string // A1..A20
  name: string
  description: string
  coins: number
  rarity: 'Gratuito' | 'Comum' | 'Raro' | 'Épico' | 'Lendário'
}

// ⚠️ No schema atual, o XP fica em `profiles.xp` (não em user_wallet)
type Wallet = { coins: number }

type ProfileLite = { xp?: number | null; equipped_icon?: string | null }

function isAvatarId(v: string): boolean {
  return /^A(?:[1-9]|1\d|20)$/i.test(String(v ?? '').trim())
}

function avatarSrc(code: string): string {
  const clean = String(code ?? '').trim().toUpperCase()
  return `/avatars/${clean}.png`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatCoins(n: number) {
  return (n ?? 0).toLocaleString('pt-BR')
}

// Manter igual ao /missions
const XP_PER_LEVEL = 500

// Referência de ganho (aprox.): diária 10 moedas + semanal 40 moedas
// => ~110 moedas/semana para um usuário free consistente.
const COINS_PER_WEEK_ESTIMATE = 110

const AVATARS: AvatarItem[] = [
  {
    code: 'A1',
    name: 'Padrão',
    description: 'Seu símbolo inicial — simples, limpo e elegante.',
    coins: 0,
    rarity: 'Gratuito',
  },
  {
    code: 'A2',
    name: 'Ascensão',
    description: 'Subindo um degrau por dia. Foque no próximo passo.',
    coins: 50,
    rarity: 'Comum',
  },
  {
    code: 'A3',
    name: 'Escudo',
    description: 'Proteção mental. Você aprende a dizer “não”.',
    coins: 100,
    rarity: 'Comum',
  },
  {
    code: 'A4',
    name: 'Mira',
    description: 'Clareza e alvo. Você faz o dia acontecer.',
    coins: 150,
    rarity: 'Comum',
  },
  {
    code: 'A5',
    name: 'Bússola',
    description: 'Direção. Você se guia por valores, não por impulso.',
    coins: 250,
    rarity: 'Comum',
  },
  {
    code: 'A6',
    name: 'Tempo',
    description: 'Disciplina silenciosa. Pequenas rotinas, grandes resultados.',
    coins: 350,
    rarity: 'Comum',
  },
  {
    code: 'A7',
    name: 'Escada',
    description: 'Progresso visível. Você constrói consistência.',
    coins: 500,
    rarity: 'Raro',
  },
  {
    code: 'A8',
    name: 'Fluxo',
    description: 'Leveza. Você flui sem perder o controle.',
    coins: 700,
    rarity: 'Raro',
  },
  {
    code: 'A9',
    name: 'Vento',
    description: 'Respiração e calma. A mente fica arejada.',
    coins: 900,
    rarity: 'Raro',
  },
  {
    code: 'A10',
    name: 'Infinito',
    description: 'Longo prazo. Você joga o jogo da vida.',
    coins: 1200,
    rarity: 'Raro',
  },
  {
    code: 'A11',
    name: 'Elo',
    description: 'Conexões reais. Você fortalece sua rede.',
    coins: 1500,
    rarity: 'Épico',
  },
  {
    code: 'A12',
    name: 'Raio',
    description: 'Energia concentrada. A ação vence a ansiedade.',
    coins: 1800,
    rarity: 'Épico',
  },
  {
    code: 'A13',
    name: 'Semente',
    description: 'Um novo hábito nasce — e você rega todo dia.',
    coins: 2200,
    rarity: 'Épico',
  },
  {
    code: 'A14',
    name: 'Lua',
    description: 'Autocontrole noturno. Você dorme melhor, pensa melhor.',
    coins: 2600,
    rarity: 'Épico',
  },
  {
    code: 'A15',
    name: 'Flor',
    description: 'Beleza do processo. Crescer sem pressa.',
    coins: 3000,
    rarity: 'Épico',
  },
  {
    code: 'A16',
    name: 'Constelação',
    description: 'Você organiza a vida em sistemas, não em força de vontade.',
    coins: 3500,
    rarity: 'Lendário',
  },
  {
    code: 'A17',
    name: 'Guarda',
    description: 'Resiliência. Você não negocia com o seu futuro.',
    coins: 4000,
    rarity: 'Lendário',
  },
  {
    code: 'A18',
    name: 'Cristal',
    description: 'Clareza rara. Você se vê com honestidade.',
    coins: 4600,
    rarity: 'Lendário',
  },
  {
    code: 'A19',
    name: 'Coroa',
    description: 'Domínio. Você assume o comando da sua rotina.',
    coins: 5200,
    rarity: 'Lendário',
  },
  {
    code: 'A20',
    name: 'Luz Suprema',
    description: 'A conquista longa: um ano de disciplina no modo Free.',
    coins: 6000,
    rarity: 'Lendário',
  },
]

export default function RewardsPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )
  const { toast } = useToast()

  const avatarByCode = useMemo(() => {
    const m = new Map<string, AvatarItem>()
    for (const a of AVATARS) m.set(a.code.toUpperCase(), a)
    return m
  }, [])

  const getAvatarName = (code: string) => {
    const c = String(code ?? '').trim().toUpperCase()
    return avatarByCode.get(c)?.name ?? c
  }

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [wallet, setWallet] = useState<Wallet>({ coins: 0 })
  const [xp, setXp] = useState<number>(0)

  const [owned, setOwned] = useState<Set<string>>(new Set(['A1']))
  const [equipped, setEquipped] = useState<string>('A1')

  const [query, setQuery] = useState('')
  const [showOwnedOnly, setShowOwnedOnly] = useState(false)
  const [selected, setSelected] = useState<string>('A1')
  const [busy, setBusy] = useState(false)

  const level = useMemo(() => Math.floor((Number(xp) || 0) / XP_PER_LEVEL) + 1, [xp])

  const selectedItem = useMemo(() => {
    const found = AVATARS.find((a) => a.code === selected)
    return found ?? AVATARS[0]
  }, [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return AVATARS.filter((a) => {
      if (showOwnedOnly && !owned.has(a.code)) return false
      if (!q) return true
      return (
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.rarity.toLowerCase().includes(q)
      )
    })
  }, [owned, query, showOwnedOnly])

  const progressText = useMemo(() => {
    const count = Array.from(owned).filter((x) => isAvatarId(x)).length
    return `${count}/${AVATARS.length} coletados`
  }, [owned])

  const progressPct = useMemo(() => {
    const count = Array.from(owned).filter((x) => isAvatarId(x)).length
    return clamp(Math.round((count / AVATARS.length) * 100), 0, 100)
  }, [owned])

  const canBuy = useMemo(() => {
    if (!selectedItem) return false
    if (owned.has(selectedItem.code)) return false
    return wallet.coins >= selectedItem.coins
  }, [owned, selectedItem, wallet.coins])

  const estimatedWeeks = useMemo(() => {
    const price = selectedItem?.coins ?? 0
    if (price <= 0) return 0
    return Math.ceil(price / COINS_PER_WEEK_ESTIMATE)
  }, [selectedItem])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)

        const { data: authData } = await supabase.auth.getUser()
        const uid = authData?.user?.id ?? null
        if (!active) return

        setUserId(uid)

        if (!uid) {
          setOwned(new Set(['A1']))
          setEquipped('A1')
          setSelected('A1')
          setWallet({ coins: 0 })
          setXp(0)
          return
        }

        // Load wallet + profile (XP/equipped) em paralelo
        const [wRes, pRes] = await Promise.all([
          supabase.from('user_wallet').select('coins').eq('user_id', uid).maybeSingle(),
          supabase.from('profiles').select('xp, equipped_icon').eq('id', uid).maybeSingle<ProfileLite>(),
        ])

        if (!active) return

        // Coins
        if (wRes.error) {
          console.warn('user_wallet load error:', wRes.error)
        }
        let coins = Number((wRes.data as any)?.coins ?? 0)

        // Se não existe linha de wallet ainda, cria com defaults do DB
        if (!wRes.data && !wRes.error) {
          const ins = await supabase
            .from('user_wallet')
            .insert({ user_id: uid })
            .select('coins')
            .maybeSingle()

          if (ins.error) {
            console.warn('user_wallet insert error:', ins.error)
          } else {
            coins = Number((ins.data as any)?.coins ?? coins)
          }
        }

        setWallet({ coins })

        // XP + equipped
        if (pRes.error) {
          console.warn('profiles load error:', pRes.error)
        }
        const profXp = Number((pRes.data as any)?.xp ?? 0)
        setXp(profXp)

        const equippedRaw = String((pRes.data as any)?.equipped_icon ?? '').trim()
        const initialEquipped = isAvatarId(equippedRaw) ? equippedRaw.toUpperCase() : 'A1'
        setEquipped(initialEquipped)
        setSelected(initialEquipped)

        // Se não tinha nada equipado, fixa A1 no perfil (padrão)
        if (!equippedRaw) {
          try {
            await supabase.from('profiles').update({ equipped_icon: 'A1' }).eq('id', uid)
          } catch {
            // ignore
          }
        }

        // Owned items
        const inv = await supabase
          .from('user_store_items')
          .select('item_id')
          .eq('user_id', uid)
          .like('item_id', 'avatar_%')

        if (!active) return

        const set = new Set<string>(['A1'])
        for (const row of inv.data ?? []) {
          const itemId = String((row as any).item_id ?? '')
          if (itemId.startsWith('avatar_')) {
            const code = itemId.replace('avatar_', '').trim().toUpperCase()
            if (isAvatarId(code)) set.add(code)
          }
        }
        setOwned(set)

        // Garante que A1 exista no inventário (para persistir)
        if (!Array.from(set).includes('A1')) {
          try {
            await supabase
              .from('user_store_items')
              .insert({ user_id: uid, item_id: 'avatar_A1', equipped: false })
          } catch {
            // ignore
          }
        }
      } catch (e: any) {
        console.error(e)
        toast({ title: 'Erro ao carregar recompensas', description: 'Tente atualizar a página.' })
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [supabase, toast])

  async function equipAvatar(code: string) {
    const c = String(code ?? '').trim().toUpperCase()
    if (!isAvatarId(c)) return

    if (!userId) {
      toast({
        title: 'Faça login para equipar',
        description: 'Você precisa estar logado para mudar seu avatar.',
      })
      return
    }

    if (!owned.has(c)) {
      toast({ title: 'Você ainda não possui este avatar' })
      return
    }

    try {
      setBusy(true)
      const { error } = await supabase.from('profiles').update({ equipped_icon: c }).eq('id', userId)
      if (error) throw error
      setEquipped(c)
      toast({ title: 'Avatar equipado!', description: `Agora você está usando: ${getAvatarName(c)}.` })
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Não foi possível equipar', description: 'Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  async function buySelected() {
    if (!userId) {
      toast({ title: 'Faça login para comprar', description: 'Você precisa estar logado para comprar avatares.' })
      return
    }
    if (!selectedItem) return

    const code = selectedItem.code

    if (owned.has(code)) {
      await equipAvatar(code)
      return
    }

    const price = selectedItem.coins
    if (wallet.coins < price) {
      toast({
        title: 'Moedas insuficientes',
        description: `Você precisa de ${formatCoins(price)} moedas para comprar este avatar.`,
      })
      return
    }

    try {
      setBusy(true)

      // 1) Deduz moedas (update; se não existir linha, faz upsert)
      const nextCoins = wallet.coins - price
      const up = await supabase
        .from('user_wallet')
        .update({ coins: nextCoins })
        .eq('user_id', userId)
        .select('coins')
        .maybeSingle()

      if (up.error) throw up.error

      let finalCoins = Number((up.data as any)?.coins ?? nextCoins)
      if (!up.data) {
        const ups = await supabase
          .from('user_wallet')
          .upsert({ user_id: userId, coins: nextCoins })
          .select('coins')
          .maybeSingle()
        if (ups.error) throw ups.error
        finalCoins = Number((ups.data as any)?.coins ?? nextCoins)
      }

      // 2) Registra compra
      const ins = await supabase.from('user_store_items').insert({
        user_id: userId,
        item_id: `avatar_${code}`,
        equipped: false,
      })
      if (ins.error) {
        // Nunca cobre por um item duplicado ou por uma gravação que falhou.
        // A compra ideal deve ser transacional no banco; fazemos o estorno
        // defensivo enquanto a operação atômica não for implementada.
        const refund = await supabase.from('user_wallet')
          .update({ coins: wallet.coins })
          .eq('user_id', userId)
        if (refund.error) console.error('Falha ao estornar moedas:', refund.error)
        throw ins.error
      }

      setWallet({ coins: finalCoins })
      setOwned((prev) => new Set([...Array.from(prev), code]))

      toast({ title: 'Compra concluída!', description: `Você desbloqueou: ${getAvatarName(code)}.` })
      await equipAvatar(code)
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Erro na compra', description: 'Tente novamente em alguns instantes.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-white">Recompensas</h1>
                <Badge className="bg-white/10 text-white border-white/10">Loja de Avatares</Badge>
              </div>
              <p className="text-sm text-white/65">
                Junte moedas em missões e desbloqueie símbolos colecionáveis. Seu avatar aparece na Comunidade.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <div className="flex items-center gap-2 text-white">
                <Coins className="h-4 w-4 text-yellow-300" />
                <span className="text-sm">{formatCoins(wallet.coins)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-white/70">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs">XP {formatCoins(xp)}</span>
                <span className="text-white/30">•</span>
                <span className="text-xs">Nível {formatCoins(level)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <div className="text-xs text-white/70">Coleção</div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-28 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-2 bg-emerald-400/80" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs text-white/80">{progressText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Preview */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{selectedItem.name}</h2>
                    <Badge className="bg-white/10 text-white border-white/10">{selectedItem.rarity}</Badge>
                    {owned.has(selectedItem.code) && (
                      <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-400/20">Possuído</Badge>
                    )}
                    {equipped === selectedItem.code && (
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30">Em uso</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-white/70">{selectedItem.description}</p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-white/70">Preço</div>
                  <div className="text-white font-semibold">
                    {selectedItem.coins === 0 ? 'Grátis' : `${formatCoins(selectedItem.coins)} moedas`}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                  <Image
                    src={avatarSrc(selectedItem.code)}
                    alt={selectedItem.name}
                    fill
                    className="object-cover"
                    sizes="112px"
                    priority
                  />
                </div>

                <div className="flex-1">
                  {selectedItem.coins > 0 && (
                    <div className="mt-2 text-xs text-white/60">
                      Estimativa: ~{estimatedWeeks} semana(s) juntando moedas (média: {COINS_PER_WEEK_ESTIMATE}/semana).
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {equipped === selectedItem.code ? (
                      <Button className="rounded-2xl" variant="secondary" disabled>
                        <Check className="mr-2 h-4 w-4" />
                        Em uso
                      </Button>
                    ) : owned.has(selectedItem.code) ? (
                      <Button
                        className="rounded-2xl"
                        variant={equipped === selectedItem.code ? 'secondary' : 'default'}
                        disabled={busy}
                        onClick={() => equipAvatar(selectedItem.code)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Equipar
                      </Button>
                    ) : (
                      <Button className="rounded-2xl" disabled={!canBuy || busy} onClick={buySelected}>
                        <Coins className="mr-2 h-4 w-4" />
                        Comprar
                      </Button>
                    )}

                    {!owned.has(selectedItem.code) && userId && (
                      <Button className="rounded-2xl" variant="secondary" disabled={busy} onClick={() => setSelected(equipped)}>
                        Ver meu avatar
                      </Button>
                    )}
                  </div>

                  {!owned.has(selectedItem.code) && userId && wallet.coins < selectedItem.coins && (
                    <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                      <div className="font-medium">Falta pouco!</div>
                      <div className="mt-1">
                        Você tem {formatCoins(wallet.coins)} moedas. Faltam{' '}
                        {formatCoins(Math.max(0, selectedItem.coins - wallet.coins))}.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Como isso aparece na Comunidade</div>
              <p className="mt-2 text-sm text-white/70">
                Seu avatar fica no seu perfil e ao lado dos seus posts/comentários. O “Padrão” é o grátis para todo mundo.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-black/30">
                  <Image src={avatarSrc(equipped)} alt={getAvatarName(equipped)} fill className="object-cover" sizes="40px" />
                </div>
                <div>
                  <div className="text-sm text-white">Em uso: {getAvatarName(equipped)}</div>
                  <div className="text-xs text-white/60">Troque aqui e veja refletir na Comunidade.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">Avatares</div>
                  <div className="mt-1 text-xs text-white/60">Clique para ver detalhes. Compre com moedas e equipe quando quiser.</div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={showOwnedOnly} onCheckedChange={setShowOwnedOnly} />
                    <span className="text-xs text-white/70">Mostrar possuídos</span>
                  </div>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, raridade..."
                    className="h-9 w-56 rounded-2xl bg-white/10 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {filtered.map((a) => {
                  const isOwned = owned.has(a.code)
                  const isSelected = selected === a.code
                  const isEquipped = equipped === a.code

                  return (
                    <button
                      key={a.code}
                      onClick={() => setSelected(a.code)}
                      className={
                        'group relative rounded-2xl border bg-black/30 transition overflow-hidden ' +
                        (isSelected
                          ? 'border-emerald-400/60 ring-2 ring-emerald-400/30'
                          : 'border-white/10 hover:border-white/20')
                      }
                      aria-label={`Selecionar ${a.name}`}
                    >
                      <div className="relative aspect-square">
                        <Image
                          src={avatarSrc(a.code)}
                          alt={a.name}
                          fill
                          className={'object-cover transition ' + (isOwned ? 'opacity-100' : 'opacity-40 grayscale')}
                          sizes="(max-width: 768px) 33vw, 140px"
                        />

                        {!isOwned && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">
                              <Lock className="h-3 w-3" />
                              <span>{formatCoins(a.coins)}</span>
                            </div>
                          </div>
                        )}

                        {isEquipped && (
                          <div className="absolute left-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200 border border-emerald-400/30">
                            Em uso
                          </div>
                        )}
                      </div>

                      <div className="p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-white line-clamp-1">{a.name}</div>
                          {isOwned ? (
                            <div className="text-[11px] text-emerald-200">OK</div>
                          ) : (
                            <div className="text-[11px] text-white/70">{formatCoins(a.coins)}</div>
                          )}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-white/60">{a.rarity}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {loading && <div className="mt-4 text-xs text-white/60">Carregando…</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
