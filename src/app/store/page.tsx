'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

export default function StorePageRedirect() {
  const router = useRouter()

  useEffect(() => {
    // A loja foi unificada em /rewards (Recompensas).
    const t = setTimeout(() => router.replace('/rewards'), 150)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/40 p-6 text-center">
        <div className="text-2xl font-semibold">Loja atualizada</div>
        <p className="mt-2 text-sm text-white/70">
          A loja foi unificada em <span className="font-medium text-white">Recompensas</span>.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="rounded-2xl">
            <Link href="/rewards">Ir para Recompensas</Link>
          </Button>
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.replace('/rewards')}
          >
            Redirecionar agora
          </Button>
        </div>
      </div>
    </div>
  )
}
