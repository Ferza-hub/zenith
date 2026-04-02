import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged, signInWithPopup,
  GoogleAuthProvider, OAuthProvider, signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import logo from './assets/logo.png';
import { Check, X, ArrowRight, TrendingUp, TrendingDown, Target, Zap, Clock, AlertCircle, LayoutList, Layers, RefreshCw, Wifi } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import {
  getTrendSignal,
  computeJungleScoutSignal,
  computeRadarDims,
  computeOpportunityScore,
  classifyUrgency,
  generateContentAngle,
  getActiveSignalsDrift,
  type TrendSignal,
  type JungleScoutSignal,
} from './lib/realtime-engine';

type Platform = 'amazon' | 'etsy' | 'tiktok';
type AuthMode = 'idle' | 'login';
type ViewMode = 'engine' | 'table';

type Product = {
  id: string; name: string; price: number; revenue: number; reviews: number;
  score: number; insight: string; bestFor: Platform[]; contentAngle?: string;
  urgency?: 'low' | 'mid' | 'high'; momentum?: number; competitionGap?: number;
  radarDims?: { demand: number; gap: number; margin: number; trend: number; speed: number };
};

const PLATFORM_META: Record<Platform, { label: string; hint: string; categories: string[]; color: string; bg: string }> = {
  amazon: { label: 'Amazon', hint: 'BSR trends, review velocity & PPC opportunity in US marketplace.', categories: ['Home & Kitchen','Pet Supplies','Sports & Outdoors','Office Products','Beauty & Personal Care'], color: '#FF9900', bg: '#232F3E' },
  etsy:   { label: 'Etsy',   hint: 'Search trends, favorites velocity & seasonal demand on Etsy US.',  categories: ['Home Decor','Jewelry & Accessories','Digital Downloads','Party Supplies','Baby & Kids'], color: '#ffffff', bg: '#F1641E' },
  tiktok: { label: 'TikTok Shop', hint: 'Viral potential, impulse price points & trending product aesthetics.', categories: ['Skincare & Beauty','Kitchen Gadgets','Fitness & Wellness','Fashion Accessories','Home Aesthetic'], color: '#ffffff', bg: '#000000' },
};

const PRODUCT_DATA: Record<Platform, Record<string, Omit<Product, 'id' | 'score'>[]>> = {
  amazon: {
    'Home & Kitchen': [
      { name: 'Silicone Utensil Set 6pc', price: 24, revenue: 18400, reviews: 87, insight: 'High BSR movement', bestFor: ['amazon'] },
      { name: 'Magnetic Knife Strip 18"', price: 32, revenue: 12300, reviews: 42, insight: 'Rising search volume', bestFor: ['amazon'] },
      { name: 'Stackable Pantry Containers', price: 39, revenue: 27800, reviews: 210, insight: 'Steady BSR, reviews growing', bestFor: ['amazon', 'etsy'] },
      { name: 'Herb Growing Kit Indoor', price: 28, revenue: 9800, reviews: 31, insight: 'Seasonal spike incoming', bestFor: ['amazon', 'etsy'] },
      { name: 'Oil Sprayer Bottle Glass', price: 18, revenue: 15200, reviews: 58, insight: 'Strong repeat purchase signal', bestFor: ['amazon'] },
      { name: 'Compost Bin Countertop', price: 35, revenue: 11600, reviews: 44, insight: 'Rising eco trend', bestFor: ['amazon', 'etsy'] },
      { name: 'Adjustable Pot Lid Holder', price: 22, revenue: 7400, reviews: 19, insight: 'Very low reviews', bestFor: ['amazon'] },
      { name: 'Whetstone Knife Sharpener Kit', price: 41, revenue: 8900, reviews: 26, insight: 'High average order', bestFor: ['amazon'] },
      { name: 'Cold Brew Coffee Maker', price: 36, revenue: 19300, reviews: 88, insight: 'Consistent demand', bestFor: ['amazon'] },
      { name: 'Sous Vide Precision Cooker', price: 79, revenue: 14200, reviews: 34, insight: 'High price point', bestFor: ['amazon'] },
    ],
    'Pet Supplies': [
      { name: 'Interactive Cat Feeder Puzzle', price: 22, revenue: 14200, reviews: 53, insight: 'Gift-driven product', bestFor: ['amazon', 'etsy'] },
      { name: 'Slow Feed Dog Bowl', price: 19, revenue: 9700, reviews: 38, insight: 'Low competition, steady BSR', bestFor: ['amazon'] },
    ],
    'Sports & Outdoors': [
      { name: 'Resistance Bands Set 5pc', price: 27, revenue: 22100, reviews: 340, insight: 'High volume, maturing', bestFor: ['amazon'] },
      { name: 'Hydration Vest Trail Running', price: 64, revenue: 9400, reviews: 28, insight: 'Niche but loyal buyer', bestFor: ['amazon'] },
    ],
    'Office Products': [
      { name: 'Desk Organizer Bamboo', price: 34, revenue: 11200, reviews: 44, insight: 'Eco angle performs well', bestFor: ['amazon', 'etsy'] },
      { name: 'Cable Management Box', price: 26, revenue: 9300, reviews: 36, insight: 'Consistent search demand', bestFor: ['amazon'] },
    ],
    'Beauty & Personal Care': [
      { name: 'Jade Facial Roller Set', price: 24, revenue: 13600, reviews: 71, insight: 'Demand stable', bestFor: ['amazon', 'etsy'] },
      { name: 'LED Face Mask Therapy', price: 79, revenue: 11300, reviews: 28, insight: 'Premium niche, low reviews', bestFor: ['amazon'] },
    ],
  },
  etsy: {
    'Home Decor': [
      { name: 'Personalized Family Name Sign', price: 38, revenue: 8700, reviews: 24, insight: 'Consistent bestseller', bestFor: ['etsy'] },
      { name: 'Boho Macrame Wall Hanging', price: 45, revenue: 11200, reviews: 61, insight: 'Seasonal spike in Q4', bestFor: ['etsy'] },
    ],
    'Jewelry & Accessories': [
      { name: 'Dainty Name Necklace Gold', price: 34, revenue: 19400, reviews: 110, insight: 'Top Etsy category', bestFor: ['etsy'] },
      { name: 'Birth Month Flower Ring', price: 28, revenue: 11700, reviews: 47, insight: 'Trending search term', bestFor: ['etsy', 'tiktok'] },
    ],
    'Digital Downloads': [
      { name: 'Wedding Budget Spreadsheet', price: 12, revenue: 8200, reviews: 0, insight: 'Zero fulfillment cost', bestFor: ['etsy'] },
      { name: 'Self-Care Planner Printable', price: 9, revenue: 11400, reviews: 0, insight: 'High search volume', bestFor: ['etsy'] },
    ],
    'Party Supplies': [
      { name: 'Custom Banner Party Set', price: 28, revenue: 12400, reviews: 54, insight: 'Strong gifting signal', bestFor: ['etsy'] },
      { name: 'Balloon Garland Kit', price: 34, revenue: 18700, reviews: 88, insight: 'High volume, consistent demand', bestFor: ['etsy'] },
    ],
    'Baby & Kids': [
      { name: 'Personalized Name Puzzle', price: 36, revenue: 14200, reviews: 62, insight: 'Etsy bestseller', bestFor: ['etsy'] },
      { name: 'Custom Baby Milestone Blanket', price: 48, revenue: 11700, reviews: 44, insight: 'High gifting intent', bestFor: ['etsy'] },
    ],
  },
  tiktok: {
    'Skincare & Beauty': [
      { name: 'Pore Vacuum Blackhead Remover', price: 19, revenue: 22400, reviews: 89, insight: 'Viral demo potential', bestFor: ['tiktok', 'amazon'] },
      { name: 'Gua Sha Facial Tool Rose Quartz', price: 16, revenue: 18700, reviews: 142, insight: 'Already viral', bestFor: ['tiktok', 'amazon'] },
    ],
    'Kitchen Gadgets': [
      { name: 'Aesthetic Butter Cutter Roller', price: 14, revenue: 16800, reviews: 42, insight: 'Made-for-TikTok demo', bestFor: ['tiktok'] },
      { name: 'Electric Whisk Mini Handheld', price: 12, revenue: 21400, reviews: 88, insight: 'Under $15 impulse buy', bestFor: ['tiktok', 'amazon'] },
    ],
    'Fitness & Wellness': [
      { name: 'Acupressure Mat & Pillow Set', price: 32, revenue: 14800, reviews: 54, insight: 'Satisfying reaction content', bestFor: ['tiktok', 'amazon'] },
      { name: 'Posture Corrector Brace', price: 24, revenue: 22100, reviews: 130, insight: 'Problem-solution hook', bestFor: ['tiktok', 'amazon'] },
    ],
    'Fashion Accessories': [
      { name: 'Gold Butterfly Hair Clips Set', price: 12, revenue: 14200, reviews: 48, insight: 'GRWM content staple', bestFor: ['tiktok'] },
      { name: 'Y2K Tinted Sunglasses', price: 16, revenue: 18700, reviews: 88, insight: 'Aesthetic crossover', bestFor: ['tiktok'] },
    ],
    'Home Aesthetic': [
      { name: 'LED Neon Sign Custom', price: 49, revenue: 16800, reviews: 54, insight: 'Room tour & aesthetic', bestFor: ['tiktok', 'etsy'] },
      { name: 'Aesthetic Candle Set Minimal', price: 34, revenue: 12400, reviews: 44, insight: 'Room aesthetic content', bestFor: ['tiktok', 'etsy'] },
    ],
  },
};

const PLATFORM_META_LOOKUP = PLATFORM_META;

// ANGLES and calcScore removed — replaced by realtime-engine.ts

function scoreColor(score: number) {
  if (score <= 40) return { bar: '#ef4444', text: 'text-red-500' };
  if (score <= 75) return { bar: '#facc15', text: 'text-yellow-500' };
  return { bar: '#22c55e', text: 'text-green-500' };
}

function UrgencyBadge({ urgency }: { urgency?: 'low' | 'mid' | 'high' }) {
  if (urgency === 'high') return (
    <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase text-red-600 bg-red-50 px-2.5 py-1 rounded-full animate-pulse border border-red-100 whitespace-nowrap">
      <Zap className="w-3 h-3" /> Act Now
    </div>
  );
  if (urgency === 'mid') return (
    <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 whitespace-nowrap">
      <Clock className="w-3 h-3" /> Good Window
    </div>
  );
  return (
    <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 whitespace-nowrap">
      <Check className="w-3 h-3" /> Stable
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [platform, setPlatform] = useState<Platform>('amazon');
  const [category, setCategory] = useState<string>('Home & Kitchen');
  const [products, setProducts] = useState<Product[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'seeded'>('seeded');

  const [viewMode, setViewMode] = useState<ViewMode>('engine');
  const [currentIndex, setCurrentIndex] = useState(0);

  const [activeSignalsCount, setActiveSignalsCount] = useState(842);

  // Live realtime signals
  const [liveMomentum, setLiveMomentum] = useState(0);
  const [momentumDirection, setMomentumDirection] = useState<'up' | 'down'>('up');
  const [currentTrend, setCurrentTrend] = useState<TrendSignal | null>(null);
  const [currentSignal, setCurrentSignal] = useState<JungleScoutSignal | null>(null);
  const momentumRef = useRef<number>(75);

  // Auth state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('idle');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const checkoutUrl = 'https://paypal.me/zenithintelligence';

  // ── Firebase Auth listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        setIsUnlocked(snap.exists() && snap.data()?.isPaid === true);
      } else {
        setIsUnlocked(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Real-Time Product Generation (Async, Trend-Enriched) ──────────────────
  const generateProducts = useCallback(async () => {
    setIsGenerating(true);
    const pool = PRODUCT_DATA[platform]?.[category] ?? [];
    if (pool.length === 0) { setProducts([]); setIsGenerating(false); return; }

    // Shuffle pool deterministically per epoch (stable order within same 2h window)
    const shuffled = [...pool].sort((a, b) => {
      const seedA = (a.name.charCodeAt(0) * 31 + a.price) ^ Math.floor(Date.now() / 7200000);
      const seedB = (b.name.charCodeAt(0) * 31 + b.price) ^ Math.floor(Date.now() / 7200000);
      return seedA - seedB;
    });

    // Fetch trend signal for the category keyword (one fetch for the category)
    const trendKeyword = category.split(' & ')[0] + ' products';
    const trendSig = await getTrendSignal(trendKeyword);
    const anyLive = trendSig.source === 'trends';
    setDataSource(anyLive ? 'live' : 'seeded');

    const fresh: Product[] = shuffled.map((p, i) => {
      const signal = computeJungleScoutSignal(
        p.name, p.price, p.revenue, p.reviews, platform, category, trendSig
      );
      const score = computeOpportunityScore(signal, trendSig);
      const urgency = classifyUrgency(score, trendSig, signal);
      const contentAngle = generateContentAngle(platform, p.name, signal.priceHistory[6] ?? p.price, trendSig);
      const radarDims = computeRadarDims(signal, trendSig);

      return {
        ...p,
        id: `${platform}-${category}-${i}`,
        price: signal.priceHistory[6] ?? p.price,
        revenue: signal.estimatedMonthlyRevenue,
        reviews: signal.reviewCount,
        score,
        urgency,
        momentum: signal.momentumScore,
        competitionGap: signal.competitionGap,
        contentAngle,
        radarDims,
      } as Product;
    });

    setProducts(fresh);
    setIsGenerating(false);
  }, [platform, category]);

  useEffect(() => {
    generateProducts();
    setCurrentIndex(0);
  }, [generateProducts]);

  // ── Real-Time Momentum Feed (Trend-Anchored) ───────────────────────────────
  useEffect(() => {
    // Fetch live trend for the current product's keyword on card change
    const activeP = products[currentIndex];
    if (!activeP) return;

    let cancelled = false;
    const keyword = activeP.name.split(' ').slice(0, 3).join(' ');
    getTrendSignal(keyword).then(trend => {
      if (cancelled) return;
      setCurrentTrend(trend);
      const sig = computeJungleScoutSignal(
        activeP.name, activeP.price, activeP.revenue, activeP.reviews,
        platform, category, trend
      );
      setCurrentSignal(sig);
      // Anchor live momentum to the real trend-based value
      const anchoredMomentum = sig.momentumScore;
      momentumRef.current = anchoredMomentum;
      setLiveMomentum(anchoredMomentum);
      setMomentumDirection(trend.trendDelta >= 0 ? 'up' : 'down');
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, products.length]);

  // ── Live Micro-Drift (animates the bar after anchoring) ───────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setLiveMomentum(prev => {
        // Drift ±2% around the anchored trend value
        const anchor = momentumRef.current;
        const pull = (anchor - prev) * 0.15; // gentle mean-reversion
        const jitter = (Math.random() * 3) - 1.3;
        const next = Math.min(100, Math.max(0, prev + jitter + pull));
        setMomentumDirection(next > prev ? 'up' : 'down');
        return next;
      });
      setActiveSignalsCount(prev => getActiveSignalsDrift(prev));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  function handlePlatformChange(p: Platform) {
    setPlatform(p);
    setCategory(PLATFORM_META_LOOKUP[p].categories[0]);
  }

  function handleSkip() {
    if (currentIndex < products.length - 1) {
      setCurrentIndex(c => c + 1);
    }
  }

  function handleCommit() {
    if (currentIndex < products.length - 1) {
      setCurrentIndex(c => c + 1);
    }
  }

  function handleRowClick(index: number) {
    setCurrentIndex(index);
    setViewMode('engine');
  }

  // ── Auth handlers ──────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthMode('idle');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in with Google');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function signInWithApple() {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const provider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, provider);
      setAuthMode('idle');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in with Apple');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  // ── Data formatting ──────────────────────────────────────────────────────
  const activeProduct = products[currentIndex];
  // Next product respects paywall bounds for visualization
  const nextProduct = (!isUnlocked && currentIndex >= 1) ? null : products[currentIndex + 1];
  const showPaywall = !isUnlocked && currentIndex >= 1;

  const radarData = useMemo(() => {
    if (!activeProduct?.radarDims) return [];
    return [
      { subject: 'DEMAND', A: activeProduct.radarDims.demand, fullMark: 100 },
      { subject: 'GAP', A: activeProduct.radarDims.gap, fullMark: 100 },
      { subject: 'MARGIN', A: activeProduct.radarDims.margin, fullMark: 100 },
      { subject: 'TREND', A: activeProduct.radarDims.trend, fullMark: 100 },
      { subject: 'SPEED', A: activeProduct.radarDims.speed, fullMark: 100 },
    ];
  }, [activeProduct]);

  // Table slice
  const visibleTableProducts = isUnlocked ? products : products.slice(0, 1);
  const hiddenTableProducts = isUnlocked ? [] : products.slice(1);
  const showTablePaywall = !isUnlocked && products.length > 1;

  // ─── Render ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans selection:bg-black selection:text-white pb-24">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Zenith" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
            <div>
              <span className="text-2xl font-black tracking-tighter uppercase">ZENITH</span>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Tactical Decision Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 hidden sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {activeSignalsCount.toLocaleString()} Signals Active
            </div>

            {/* Data Source Badge */}
            <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
              dataSource === 'live'
                ? 'text-blue-600 bg-blue-50 border-blue-100'
                : 'text-gray-400 bg-gray-50 border-gray-200'
            }`}>
              <Wifi className="w-3 h-3" />
              {dataSource === 'live' ? 'Live' : 'Sim'}
            </div>

            {isUnlocked ? (
              <span className="text-xs font-bold text-gray-700 bg-gray-100 border-gray-200 border px-3 py-1.5 rounded-full uppercase tracking-wider">
                Full Pass
              </span>
            ) : (
               <button onClick={() => window.open(checkoutUrl, '_blank')} className="text-[10px] sm:text-xs font-bold text-white bg-black border-black border px-3 py-1.5 rounded-full uppercase tracking-wider">
                 Get Pass
               </button>
            )}
            
            {auth.currentUser && (
              <button
                onClick={handleSignOut}
                className="text-xs text-gray-400 hover:text-black font-bold uppercase tracking-wider transition-colors ml-2"
              >
                Logout
              </button>
            )}
          </div>
        </header>

        {/* ── Platform & View Mode Selector ──────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-start md:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
              <button 
                onClick={() => setViewMode('engine')} 
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                  viewMode === 'engine' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Layers className="w-4 h-4" /> Engine
              </button>
              <button 
                onClick={() => setViewMode('table')} 
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <LayoutList className="w-4 h-4" /> All Signals
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200 hidden md:block" />

            <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden w-fit">
              {(['amazon', 'etsy', 'tiktok'] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePlatformChange(p)}
                  className={`px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors border-r border-gray-200 last:border-r-0 flex items-center gap-2 ${platform === p
                      ? p === 'amazon'
                        ? 'bg-[#232F3E] text-[#FF9900]'
                        : p === 'etsy'
                          ? 'bg-[#F1641E] text-white'
                          : 'bg-black text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-black'
                    }`}
                >
                  {PLATFORM_META_LOOKUP[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PLATFORM_META_LOOKUP[platform].categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${category === cat
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400 hover:text-black'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Auth Modal ─────────────────────────────────────────────────── */}
        {authMode !== 'idle' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
              <h3 className="text-xl font-black mb-1 text-center tracking-tight">
                Sign in to Zenith
              </h3>
              <p className="text-sm text-gray-500 mb-8 text-center px-4 font-medium">
                Use the account associated with your purchase.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={signInWithGoogle}
                  disabled={authSubmitting}
                  className="flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-black font-bold py-3.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={signInWithApple}
                  disabled={authSubmitting}
                  className="flex items-center justify-center gap-3 w-full bg-black hover:bg-gray-900 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.96.95-2.12 1.48-3.48 1.48-1.42 0-2.45-.51-3.66-.51-1.24 0-2.46.53-3.72.53-2.43 0-4.66-1.57-5.92-3.83-1.27-2.27-1.1-4.87.23-6.85 1.02-1.5 2.51-2.45 4.14-2.45 1.42 0 2.45.51 3.66.51s2.24-.51 3.66-.51c.96 0 1.83.18 2.59.54-1.07.72-1.74 1.82-1.74 3.1 0 1.94 1.63 3.53 3.75 3.53.07 0 .14 0 .21-.01-.4 1.44-1.18 2.65-2.14 3.61l-.01.01zm-3.61-16.15c0-1.14.49-2.25 1.34-3.04.88-.84 2.11-1.33 3.37-1.31.02 1.25-.49 2.43-1.37 3.25-.85.8-2.04 1.35-3.23 1.35-.07 0-.08 0-.11-.25z"/>
                  </svg>
                  Apple
                </button>
                {authError && <p className="text-xs text-red-500 text-center mt-2 font-medium">{authError}</p>}
                <button onClick={() => setAuthMode('idle')} className="mt-4 text-[10px] text-gray-400 hover:text-black font-black uppercase tracking-widest transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── View Routing ─────────────────────────────────────────────────── */}
        {viewMode === 'engine' && (
           <>
            {/* Loading State */}
            {isGenerating && (
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 animate-pulse">
                <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                  <div className="h-6 w-24 bg-gray-200 rounded-full mb-6" />
                  <div className="h-10 w-3/4 bg-gray-200 rounded-xl mb-8" />
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="h-20 bg-gray-200 rounded-2xl" />
                    <div className="h-20 bg-gray-200 rounded-2xl" />
                  </div>
                  <div className="h-28 bg-gray-200 rounded-2xl mb-6" />
                  <div className="h-20 bg-amber-100 rounded-2xl" />
                </div>
                <div className="w-full md:w-96 flex flex-col gap-6">
                  <div className="h-64 bg-white rounded-3xl shadow-sm border border-gray-100" />
                  <div className="h-28 bg-gray-200 rounded-2xl" />
                </div>
              </div>
            )}
            {activeProduct && !showPaywall && !isGenerating ? (
              <div className="relative max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
                
                {/* Left Column: Core Data */}
                <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex gap-2 items-center mb-4 flex-wrap">
                           <UrgencyBadge urgency={activeProduct.urgency} />
                           {/* Trend Delta Badge */}
                           {currentTrend && (
                             <div className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border whitespace-nowrap ${
                               currentTrend.trendDelta > 5
                                 ? 'text-green-700 bg-green-50 border-green-100'
                                 : currentTrend.trendDelta > 0
                                   ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                   : 'text-orange-600 bg-orange-50 border-orange-100'
                             }`}>
                               {currentTrend.trendDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                               {currentTrend.trendDelta > 0 ? '+' : ''}{currentTrend.trendDelta}% trend
                             </div>
                           )}
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight max-w-[80%] text-gray-900">
                          {activeProduct.name}
                        </h2>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Opp. Score</span>
                        <span className={`text-6xl lg:text-7xl font-black tracking-tighter ${
                          activeProduct.score >= 80 ? 'text-green-500' :
                          activeProduct.score >= 50 ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {activeProduct.score}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Est. Revenue</span>
                        <span className="text-3xl font-black">${activeProduct.revenue.toLocaleString()}</span>
                        {currentSignal && (
                          <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                            ~{currentSignal.estimatedMonthlySales.toLocaleString()} units/mo
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Avg. Price</span>
                        <span className="text-3xl font-black">${activeProduct.price.toFixed(2)}</span>
                        {currentSignal && (
                          <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                            BSR #{currentSignal.bsr.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-6 mb-8 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                      <div>
                        <label className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                          <span className="flex items-center gap-2 text-gray-500">
                            {momentumDirection === 'up' ? <TrendingUp className="w-4 h-4 text-green-500"/> : <TrendingDown className="w-4 h-4 text-red-500" />}
                            Market Momentum
                          </span>
                          <span className="flex items-center gap-2">
                            {currentTrend && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                currentTrend.source === 'trends' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {currentTrend.source === 'trends' ? '● LIVE' : '◌ SIM'}
                              </span>
                            )}
                            <span className="tabular-nums font-mono text-gray-900">{liveMomentum.toFixed(1)}%</span>
                          </span>
                       </label>
                        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black transition-all duration-1000 ease-in-out" 
                            style={{ width: `${liveMomentum}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
                           <span className="flex items-center gap-2 text-gray-500"><Target className="w-4 h-4" /> Competition Gap</span>
                           <span className="tabular-nums text-gray-900">{Math.round(activeProduct.competitionGap || 0)}% Open</span>
                        </div>
                        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-1000 ease-in-out" 
                            style={{ width: `${activeProduct.competitionGap}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Review Velocity Strip */}
                    {currentSignal && currentSignal.reviewVelocity > 0 && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 mb-5 border border-gray-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3" /> Review Velocity
                        </span>
                        <span className="text-xs font-black text-gray-800">+{currentSignal.reviewVelocity}/mo · {activeProduct.reviews.toLocaleString()} total</span>
                      </div>
                    )}

                    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-700 tracking-widest mb-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Winning Angle
                      </div>
                      <p className="text-xl font-bold text-amber-900 leading-snug">"{activeProduct.contentAngle}"</p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Radar & Actions */}
                <div className="w-full md:w-96 flex flex-col gap-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Market Dimensions</span>
                    <div className="h-[280px] w-full relative -ml-2 -mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                          <PolarGrid stroke="#e5e7eb" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} />
                          <Radar
                            name="Product"
                            dataKey="A"
                            stroke="#000"
                            fill="#000"
                            fillOpacity={0.2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleSkip}
                      className="bg-white border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                      <X className="w-8 h-8 group-hover:scale-110 transition-transform" strokeWidth={3} />
                      <span className="font-black uppercase tracking-widest text-[10px]">Skip</span>
                    </button>
                    <button 
                      onClick={handleCommit}
                      className="bg-black text-white hover:bg-gray-900 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all shadow-xl shadow-black/20 group hover:-translate-y-1"
                    >
                      <Check className="w-8 h-8 group-hover:scale-110 transition-transform text-white/90" strokeWidth={3} />
                      <span className="font-black uppercase tracking-widest text-[10px]">Commit</span>
                    </button>
                  </div>

                  {/* Next Up Teaser */}
                  {nextProduct ? (
                    <div className="bg-white px-5 py-4 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-500 h-16">
                      <span className="uppercase tracking-widest text-[10px] font-black text-gray-400">Next up</span>
                      <div className="flex items-center gap-2 blur-[3px] opacity-60">
                        <span>{nextProduct.name.slice(0, 15)}...</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 px-5 py-4 rounded-xl border border-gray-200 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase tracking-widest h-16 opacity-50">
                      End of queue
                    </div>
                  )}
                </div>

              </div>
            ) : showPaywall ? (
              
              <div className="max-w-xl mx-auto bg-white rounded-3xl p-10 shadow-xl border border-gray-100 flex flex-col items-center text-center mt-12 relative overflow-hidden">
                <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-purple-500 via-yellow-500 to-green-500" />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-100 rounded-full blur-3xl opacity-50" />
                
                <AlertCircle className="w-16 h-16 text-yellow-500 mb-6 relative z-10" />
                <h2 className="text-3xl font-black tracking-tight mb-2 relative z-10">Queue Limit Reached</h2>
                <p className="text-gray-500 mb-8 font-medium leading-relaxed relative z-10 px-4">
                  You've viewed your free limit. Unlock the full data engine to reveal robust analysis of the next product on {PLATFORM_META_LOOKUP[platform].label}.
                </p>
                
                <div className="w-full flex justify-center flex-col gap-3 relative z-10">
                  <button
                      onClick={() => window.open(checkoutUrl, '_blank')}
                      className="w-full bg-black hover:bg-gray-800 text-white font-bold tracking-wide py-4 rounded-xl transition-all shadow-xl shadow-black/20"
                    >
                      Unlock Unlimited Engine — $19/mo
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className="w-full text-gray-500 hover:text-black font-black uppercase tracking-wider text-[10px] py-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      I already have an active pass
                    </button>
                </div>
              </div>

            ) : !isGenerating && (
              <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-sm">
                Evaluating data feed...
              </div>
            )}
           </>
        )}

        {viewMode === 'table' && (
          <div className="relative border border-gray-100 shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Product Name</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Price</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Est. Revenue</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Opp. Score</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Momentum</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Comp. Gap</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400 text-center w-36">Window</th>
                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400 min-w-[240px]">Winning Angle</th>
                    <th className="px-5 py-4 border-l border-gray-100 bg-gray-50 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Visible rows */}
                  {visibleTableProducts.map((product, index) => {
                    const { bar, text } = scoreColor(product.score);
                    const isDigital = platform === 'etsy' && category === 'Digital Downloads';
                    return (
                      <tr 
                        key={product.id} 
                        onClick={() => handleRowClick(index)}
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-4 font-bold text-gray-900 whitespace-normal min-w-[200px]">{product.name}</td>
                        <td className="px-5 py-4 text-gray-600 font-medium">${product.price.toFixed(2)}</td>
                        <td className="px-5 py-4 text-gray-900 font-bold">
                          {isDigital ? 'N/A' : `$${product.revenue.toLocaleString()}`}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden opacity-80">
                              <div className="h-full" style={{ width: `${product.score}%`, backgroundColor: bar }} />
                            </div>
                            <span className={`font-black w-6 text-right tabular-nums ${text} text-base`}>{product.score}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${product.momentum ?? 0}%`,
                                  backgroundColor: (product.momentum ?? 0) > 70 ? '#22c55e' : (product.momentum ?? 0) > 45 ? '#facc15' : '#ef4444'
                                }}
                              />
                            </div>
                            <span className="text-xs font-black tabular-nums text-gray-700">{Math.round(product.momentum ?? 0)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-blue-600">{Math.round(product.competitionGap || 0)}%</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <UrgencyBadge urgency={product.urgency} />
                        </td>
                        <td className="px-5 py-4 text-amber-900 font-medium text-xs whitespace-normal line-clamp-2">
                          {product.contentAngle}
                        </td>
                        <td className="px-5 py-4 text-center border-l border-gray-50 w-16">
                           <button className="text-gray-300 group-hover:text-black transition-colors rounded-full p-2 group-hover:bg-gray-100">
                             <ArrowRight className="w-4 h-4" />
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Hidden Paywall Rows */}
                  {hiddenTableProducts.map((_product, i) => (
                      <tr key={`hidden-table-${i}`} className="select-none pointer-events-none">
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-40 blur-[3px]" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-10 blur-[3px]" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-16 blur-[3px]" /></td>
                        <td className="px-5 py-4 blur-[3px]"><div className="h-2 w-12 bg-gray-200 rounded-full" /></td>
                        <td className="px-5 py-4 blur-[3px]"><div className="h-2 w-14 bg-gray-200 rounded-full" /></td>
                        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-10 blur-[3px]" /></td>
                        <td className="px-5 py-4 blur-[4px]"><div className="h-6 mx-auto bg-gray-200 rounded-full w-20" /></td>
                        <td className="px-5 py-4 blur-[4px]"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                        <td className="px-5 py-4 border-l border-gray-50"></td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {showTablePaywall && (
              <div className="absolute inset-0 top-16 bg-gradient-to-t from-white via-white/95 to-transparent flex flex-col items-center justify-end pb-12 z-10">
                <div className="bg-white px-8 py-8 rounded-3xl shadow-xl border border-gray-100 text-center max-w-sm mx-4">
                  <h3 className="text-2xl font-black mb-2 tracking-tight">
                    {hiddenTableProducts.length} more hidden
                  </h3>
                  <p className="text-gray-500 text-sm mb-6 font-medium leading-relaxed">
                    Unlock all {products.length} live signals for {PLATFORM_META_LOOKUP[platform].label} including data for the Decision Engine to review.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => window.open(checkoutUrl, '_blank')}
                      className="w-full bg-black hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-xl shadow-black/20"
                    >
                      Unlock All Data — $19/mo
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className="w-full text-gray-500 hover:text-black font-black uppercase tracking-widest text-[10px] py-3.5 rounded-xl border-2 border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default App;
