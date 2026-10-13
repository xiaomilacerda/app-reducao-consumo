'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Sparkles, Trophy } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

type StoreItemKind = 'icon' | 'theme' | 'frame' | 'card' | 'boost';

type StoreItem = {
  id: string;
  kind: StoreItemKind;
  name: string;
  priceCoins: number;
  icon?: string;
};

type WalletRow = { coins: number | null };
type ProfileRow = {
  id: string;
  is_premium?: boolean | null;
  xp?: number | null;
  equipped_icon?: string | null;
  equipped_theme?: string | null;
  equipped_frame?: string | null;
  equipped_card?: string | null;
};

type StoreOwnedRow = {
  item_id: string;
  qty?: number | null;
  equipped: boolean | null;
};

const LS_EQUIPPED_ICON = 'wr_equipped_icon_v1';
const LS_EQUIPPED_THEME = 'wr_equipped_theme_v1';
const LS_EQUIPPED_FRAME = 'wr_equipped_frame_v1';
const LS_EQUIPPED_CARD = 'wr_equipped_card_v1';
const LS_ACTIVE_BOOSTS = 'wr_active_boosts_v1';

const DEFAULT_ICON = 'icon_leaf';
const DEFAULT_THEME = 'theme_midnight';
const DEFAULT_FRAME = 'frame_none';
const DEFAULT_CARD = 'card_gradient';

const ITEMS: StoreItem[] = [
  { id: 'icon_leaf', kind: 'icon', name: 'Folha Base', priceCoins: 0, icon: '🍃' },
  { id: 'icon_bolt', kind: 'icon', name: 'Raio da Disciplina', priceCoins: 120, icon: '⚡' },
  { id: 'icon_shield', kind: 'icon', name: 'Escudo Anti-Gatilho', priceCoins: 240, icon: '🛡️' },
  { id: 'icon_owl', kind: 'icon', name: 'Coruja do Controle', priceCoins: 420, icon: '🦉' },
  { id: 'icon_crown_legend', kind: 'icon', name: 'Lenda', priceCoins: 3000, icon: '👑' },

  { id: 'theme_midnight', kind: 'theme', name: 'Midnight', priceCoins: 0, icon: '🌙' },
  { id: 'theme_nebula', kind: 'theme', name: 'Nebula', priceCoins: 260, icon: '🪐' },
  { id: 'theme_ocean', kind: 'theme', name: 'Ocean Focus', priceCoins: 260, icon: '🌊' },
  { id: 'theme_royal', kind: 'theme', name: 'Royal Gold', priceCoins: 850, icon: '✨' },

  { id: 'frame_none', kind: 'frame', name: 'Sem moldura', priceCoins: 0, icon: '⬛' },
  { id: 'frame_silver', kind: 'frame', name: 'Moldura Prata', priceCoins: 180, icon: '🥈' },
  { id: 'frame_gold', kind: 'frame', name: 'Moldura Ouro', priceCoins: 420, icon: '🥇' },
  { id: 'frame_neon', kind: 'frame', name: 'Moldura Neon', priceCoins: 950, icon: '💜' },

  { id: 'card_gradient', kind: 'card', name: 'Card Gradiente', priceCoins: 0, icon: '🧩' },
  { id: 'card_glass', kind: 'card', name: 'Card Glass', priceCoins: 220, icon: '🧊' },
  { id: 'card_obsidian', kind: 'card', name: 'Card Obsidiana', priceCoins: 900, icon: '🖤' },

  { id: 'boost_focus_3d', kind: 'boost', name: 'Foco 3 dias', priceCoins: 90, icon: '🎯' },
  { id: 'boost_focus_7d', kind: 'boost', name: 'Foco 7 dias', priceCoins: 190, icon: '🔥' },
];

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function themeGradient(themeId: string) {
  switch (themeId) {
    case 'theme_nebula':
      return 'radial-gradient(circle at 50% 35%, rgba(155,60,255,0.40), rgba(199,39,150,0.25), rgba(10,10,16,1) 70%)';
    case 'theme_ocean':
      return 'radial-gradient(circle at 50% 35%, rgba(59,130,246,0.26), rgba(16,185,129,0.10), rgba(8,8,12,1) 70%)';
    case 'theme_royal':
      return 'radial-gradient(circle at 50% 35%, rgba(245,158,11,0.28), rgba(168,85,247,0.18), rgba(10,10,16,1) 72%)';
    case 'theme_midnight':
    default:
      return 'radial-gradient(circle at 50% 35%, rgba(155,60,255,0.35), rgba(199,39,150,0.18), rgba(10,10,16,1) 70%)';
  }
}

function frameStyle(frameId: string): CSSProperties {
  switch (frameId) {
    case 'frame_silver':
      return { borderColor: 'rgba(226,232,240,0.85)', boxShadow: '0 0 0 2px rgba(226,232,240,0.25), 0 12px 40px rgba(0,0,0,0.35)' };
    case 'frame_gold':
      return { borderColor: 'rgba(251,191,36,0.9)', boxShadow: '0 0 0 2px rgba(251,191,36,0.22), 0 12px 44px rgba(0,0,0,0.35)' };
    case 'frame_neon':
      return { borderColor: 'rgba(168,85,247,0.95)', boxShadow: '0 0 0 2px rgba(168,85,247,0.30), 0 0 22px rgba(168,85,247,0.35), 0 14px 46px rgba(0,0,0,0.35)' };
    case 'frame_none':
    default:
      return { borderColor: 'rgba(255,255,255,0.18)', boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 12px 40px rgba(0,0,0,0.35)' };
  }
}

function cardSkinStyle(cardId: string): CSSProperties {
  switch (cardId) {
    case 'card_glass':
      return {
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))',
        borderColor: 'rgba(255,255,255,0.18)',
      };
    case 'card_obsidian':
      return {
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.20))',
        borderColor: 'rgba(255,255,255,0.14)',
      };
    case 'card_gradient':
    default:
      return {
        background:
          'linear-gradient(135deg, rgba(168,85,247,0.30), rgba(236,72,153,0.22), rgba(0,0,0,0.18))',
        borderColor: 'rgba(255,255,255,0.16)',
      };
  }
}

export default function StoryPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [isPremium, setIsPremium] = useState(false);

  const [equippedIcon, setEquippedIcon] = useState(DEFAULT_ICON);
  const [equippedTheme, setEquippedTheme] = useState(DEFAULT_THEME);
  const [equippedFrame, setEquippedFrame] = useState(DEFAULT_FRAME);
  const [equippedCard, setEquippedCard] = useState(DEFAULT_CARD);

  const [activeBoosts, setActiveBoosts] = useState<Record<string, { until: string }>>({});
  const [owned, setOwned] = useState<Record<string, { qty: number; equipped: boolean }>>({});

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);

  function pushToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function getItemIcon(itemId: string) {
    return ITEMS.find((x) => x.id === itemId)?.icon ?? '✨';
  }

  function isBoostActive(itemId: string) {
    const b = activeBoosts[itemId];
    if (!b) return false;
    return new Date(b.until).getTime() > Date.now();
  }

  async function loadData() {
    // local
    try {
      const li = localStorage.getItem(LS_EQUIPPED_ICON);
      const lt = localStorage.getItem(LS_EQUIPPED_THEME);
      const lf = localStorage.getItem(LS_EQUIPPED_FRAME);
      const lc = localStorage.getItem(LS_EQUIPPED_CARD);
      const lb = safeJsonParse<Record<string, { until: string }>>(localStorage.getItem(LS_ACTIVE_BOOSTS), {});
      if (li) setEquippedIcon(li);
      if (lt) setEquippedTheme(lt);
      if (lf) setEquippedFrame(lf);
      if (lc) setEquippedCard(lc);
      setActiveBoosts(lb);
    } catch {}

    // supabase
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);

      if (!uid) return;

      const { data: w } = await supabase
        .from('user_wallet')
        .select('coins')
        .eq('user_id', uid)
        .maybeSingle<WalletRow>();
      if (w) {
        setCoins(Number(w.coins ?? 0));

      }

      const { data: p } = await supabase
        .from('profiles')
        .select('id,is_premium,xp,equipped_icon,equipped_theme,equipped_frame,equipped_card')
        .eq('id', uid)
        .maybeSingle<ProfileRow>();
      if (p) {
        setIsPremium(!!p.is_premium);
        setXp(Number(p.xp ?? 0));
        setEquippedIcon((p.equipped_icon ?? equippedIcon) as string);
        setEquippedTheme((p.equipped_theme ?? equippedTheme) as string);
        setEquippedFrame((p.equipped_frame ?? equippedFrame) as string);
        setEquippedCard((p.equipped_card ?? equippedCard) as string);
      }

      const { data: inv } = await supabase
        .from('user_store_items')
        .select('item_id,equipped')
        .eq('user_id', uid)
        .returns<StoreOwnedRow[]>();
      if (inv) {
        const next: Record<string, { qty: number; equipped: boolean }> = {};
        for (const row of inv) next[row.item_id] = { qty: Number(row.qty ?? 1), equipped: !!row.equipped };
        setOwned(next);
      }
    } catch {}
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = Math.max(1, Math.floor(xp / 250) + 1);

  const storyText = `Minha evolução no Weed Reset 🌱\n\n• Nível: ${level}\n• Moedas: ${coins}\n• Ícone: ${getItemIcon(equippedIcon)}\n\n#WeedReset`;

  function copyText() {
    try {
      navigator.clipboard.writeText(storyText);
      pushToast('Texto copiado!');
    } catch {
      pushToast('Não foi possível copiar.');
    }
  }

  function downloadPng() {
    // desenha uma “Story card” simples via Canvas (funciona no desktop e no mobile)
    const canvas = document.createElement('canvas');
    const w = 1080;
    const h = 1920;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // bg
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(168,85,247,0.55)');
    g.addColorStop(0.45, 'rgba(236,72,153,0.35)');
    g.addColorStop(1, 'rgba(8,8,12,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // overlay
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, w, h);

    // title
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 64px Inter, system-ui, sans-serif';
    ctx.fillText('WEED RESET', 90, 170);

    // card
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 4;
    const cardX = 90, cardY = 280, cardW = 900, cardH = 520;
    roundRect(ctx, cardX, cardY, cardW, cardH, 40);
    ctx.fill();
    ctx.stroke();

    // icon circle
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 4;
    const cx = cardX + 110, cy = cardY + 115, cr = 70;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '64px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(getItemIcon(equippedIcon), cx - 22, cy + 22);

    // stats
    ctx.font = 'bold 44px Inter, system-ui, sans-serif';
    ctx.fillText(`Nível ${level}`, cardX + 220, cardY + 120);

    ctx.font = '32px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Moedas: ${coins}`, cardX + 220, cardY + 180);

    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.fillText(isPremium ? 'Premium ativo' : 'Free', cardX + 220, cardY + 240);

    // footer
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillText('#WeedReset', 90, h - 120);

    // download
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weedreset_story.png';
    a.click();

    pushToast('Imagem gerada!');
  }

  const bgStyle: CSSProperties = { background: themeGradient(equippedTheme) };
  const cardStyle: CSSProperties = cardSkinStyle(equippedCard);
  const iconFrameStyle: CSSProperties = frameStyle(equippedFrame);

  return (
    <div className="min-h-screen wr-noise wr-premium-bg" style={bgStyle}>
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/rewards"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xl">
                  ✨
                </div>
                <h1 className="text-xl font-semibold text-white">Minha Story</h1>
              </div>
              <p className="mt-1 text-sm text-white/70">
                Aqui é onde <b>cards/molduras/temas</b> aparecem de verdade. Perfeito para motivar a juntar moedas.
              </p>
            </div>
          </div>

          <Link
            href="/rewards"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4" />
            Voltar à Loja
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Preview */}
          <div className="rounded-3xl border border-white/10 bg-white/7 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Preview da Story</div>
              <div className="text-xs text-white/60">1080×1920 recomendado</div>
            </div>

            <div className="mt-4 rounded-3xl border p-6" style={cardStyle}>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-black/20 text-2xl"
                  style={iconFrameStyle}
                >
                  {getItemIcon(equippedIcon)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">Weed Reset</div>
                  <div className="mt-1 text-xs text-white/70">
                    Nível {level} • {coins} moedas • {isPremium ? 'Premium' : 'Free'}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <Trophy className="h-4 w-4" />
                  {level >= 10 ? 'Fase forte' : 'Começando forte'}
                </div>
              </div>

              <div className="mt-4 text-sm text-white/80">
                “Um dia de cada vez. Hoje eu escolhi o controle.”
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {Object.keys(activeBoosts)
                  .filter((id) => isBoostActive(id))
                  .slice(0, 3)
                  .map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/80"
                    >
                      <span className="text-sm">{getItemIcon(id)}</span>
                      {ITEMS.find((x) => x.id === id)?.name ?? 'Extra'}
                    </span>
                  ))}
                {!Object.keys(activeBoosts).some((id) => isBoostActive(id)) && (
                  <span className="text-xs text-white/50">Nenhum extra ativo.</span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={copyText}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                <Copy className="h-4 w-4" />
                Copiar texto
              </button>
              <button
                onClick={downloadPng}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Gerar PNG
              </button>
            </div>

            <div className="mt-3 text-xs text-white/50">
              Dica: a forma mais simples é tirar print da Story. O botão PNG é um bônus.
            </div>
          </div>

          {/* Coleção / status */}
          <div className="rounded-3xl border border-white/10 bg-white/7 p-5">
            <div className="text-sm font-semibold text-white">Seu setup equipado</div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'Ícone', id: equippedIcon },
                { label: 'Tema', id: equippedTheme },
                { label: 'Moldura', id: equippedFrame },
                { label: 'Card', id: equippedCard },
              ].map((x) => (
                <div key={x.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">{x.label}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xl">
                      {getItemIcon(x.id)}
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {ITEMS.find((i) => i.id === x.id)?.name ?? x.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-sm font-semibold text-white">Metas longas (motivação)</div>
            <div className="mt-2 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
              Exemplo: o ícone 👑 Lenda custa <b>3000</b> moedas. Se o usuário fizer missões todo dia e a semanal, vira uma meta de meses.
            </div>

            <div className="mt-6 text-sm font-semibold text-white">O que comprar primeiro?</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>Ícone raro (120–240) para já sentir “evolução”.</li>
              <li>Moldura prata/ouro para deixar a Story linda.</li>
              <li>Guardar para um lendário (meta longa → conversão pro Premium).</li>
            </ul>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const min = Math.min(w, h);
  const rr = Math.min(r, min / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
