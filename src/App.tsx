import { useState, useMemo, useEffect } from 'react';
import logo from './assets/logo.png';
import { format } from 'date-fns';


type Product = {
  id: string;
  name: string;
  price: number;
  revenue: number;
  reviews: number;
  score: number;
  insight: string;
};

const SAMPLE_PRODUCTS: Product[] = [
  { id: '1', name: 'Heatless Hair Curler Set', price: 18.50, revenue: 68000, reviews: 420, score: 92, insight: 'TikTok viral trend, low competition — strong entry.' },
  { id: '2', name: 'Reusable Lint Roller Gel', price: 14.50, revenue: 42000, reviews: 280, score: 90, insight: 'High demand, low competition — highly actionable.' },
  { id: '3', name: 'Pet Hair Remover Carpet Rake', price: 22.00, revenue: 61000, reviews: 450, score: 93, insight: 'Viral potential, moderate competition — test quickly.' },
  { id: '4', name: 'Under Desk Cable Management Tray', price: 26.50, revenue: 31000, reviews: 120, score: 89, insight: 'Niche demand, very low competition — strong entry.' },
  { id: '5', name: 'Car Cup Holder Expander', price: 18.99, revenue: 44000, reviews: 350, score: 88, insight: 'Steady demand, low competition — great margins.' },
  { id: '6', name: 'LED Neck Reading Light', price: 19.99, revenue: 28000, reviews: 310, score: 86, insight: 'Rising trend, low competition — test quickly.' },
  { id: '7', name: 'Travel Cable Organizer Pouch', price: 11.99, revenue: 19000, reviews: 200, score: 85, insight: 'Stable niche, low competition — solid consistent seller.' },
  { id: '8', name: 'Cloud Slippers EVA Scuffs', price: 23.50, revenue: 71000, reviews: 800, score: 81, insight: 'High demand, growing competition — fast entry needed.' },
  { id: '9', name: 'Magnetic Wireless Power Bank', price: 49.99, revenue: 55000, reviews: 890, score: 74, insight: 'Consistent demand, moderate competition — solid opportunity.' },
  { id: '10', name: 'Shower Phone Holder Waterproof', price: 16.99, revenue: 21000, reviews: 650, score: 72, insight: 'Moderate demand, moderate competition — test small.' },
  { id: '11', name: 'Insulated Half Gallon Water Jug', price: 32.99, revenue: 78000, reviews: 1400, score: 68, insight: 'Very high demand, high competition — brand building needed.' },
  { id: '12', name: 'Adjustable Posture Corrector', price: 24.99, revenue: 35000, reviews: 1250, score: 64, insight: 'Stable demand, high competition — risky entry.' },
  { id: '13', name: 'Rechargeable Portable Blender', price: 34.00, revenue: 72000, reviews: 1950, score: 58, insight: 'Massive market, saturated — requires strong differentiation.' },
  { id: '14', name: 'TikTok Leggings (Scrunch Butt)', price: 25.00, revenue: 65000, reviews: 1950, score: 56, insight: 'Fad product, saturated — requires influencer push.' },
  { id: '15', name: 'Silicone Scalp Massager Brush', price: 12.99, revenue: 45000, reviews: 1850, score: 55, insight: 'High demand, very high competition — heavy marketing required.' },
  { id: '16', name: 'Reusable Silicone Storage Bags', price: 21.99, revenue: 14000, reviews: 1100, score: 54, insight: 'Low revenue, high competition — poor opportunity.' },
  { id: '17', name: 'Electric Milk Frother Wand', price: 15.99, revenue: 55000, reviews: 1900, score: 52, insight: 'Established market, fierce competition — high barrier to entry.' },
  { id: '18', name: 'Foldable Laptop Stand Aluminum', price: 29.50, revenue: 38000, reviews: 1750, score: 48, insight: 'Stable demand, heavily saturated — avoid.' },
  { id: '19', name: 'Acupressure Mat and Pillow Set', price: 39.99, revenue: 24000, reviews: 1600, score: 45, insight: 'Declining trend, saturated market — avoid.' },
  { id: '20', name: 'Blue Light Blocking Glasses 2-Pack', price: 19.99, revenue: 29000, reviews: 1800, score: 42, insight: 'Declining demand, extremely saturated — avoid.' },
];

function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem("zenith_unlocked") === "true";
  });

  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setLastUpdated(format(new Date(), 'HH:mm'));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Simulate new signals by slightly randomizing scores and reshuffling
      const freshData = [...SAMPLE_PRODUCTS].sort(() => Math.random() - 0.5).map(p => ({
        ...p,
        score: Math.min(100, Math.max(0, p.score + (Math.floor(Math.random() * 11) - 5)))
      }));
      setProducts(freshData);
      setLastUpdated(format(new Date(), 'HH:mm'));
      setIsRefreshing(false);
    }, 800);
  };

  const handleUnlock = () => {
    localStorage.setItem("zenith_unlocked", "true");
    setIsUnlocked(true);
  };

  const checkoutUrl = "https://YOUR-STORE.lemonsqueezy.com/buy/YOUR_PRODUCT_ID";

  const [minRevenue, setMinRevenue] = useState<number | ''>('');
  const [maxReviews, setMaxReviews] = useState<number | ''>('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (minRevenue !== '' && product.revenue < minRevenue) return false;
      if (maxReviews !== '' && product.reviews > maxReviews) return false;
      if (minPrice !== '' && product.price < minPrice) return false;
      if (maxPrice !== '' && product.price > maxPrice) return false;
      return true;
    });
  }, [products, minRevenue, maxReviews, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Zenith Logo" className="w-10 h-10 object-contain rounded-lg logo-shadow" />
            <span className="text-2xl font-black tracking-tighter uppercase">ZENITH</span>
          </div>
        </header>

        {/* Hero Section */}
        <div className="py-12 md:py-20 max-w-3xl mb-12">
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Find winning products in 5 seconds — <br className="hidden md:block" />no bloated dashboards.
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed max-w-2xl">
            Simple product signals. Clear opportunities. Built for sellers who hate overanalysis.
          </p>

          {!isUnlocked ? (
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={() => window.open(checkoutUrl, '_blank')}
                className="bg-black hover:bg-gray-800 text-white font-medium py-4 px-8 rounded-lg transition-colors text-lg cursor-pointer shadow-xl shadow-black/10 w-full sm:w-auto"
              >
                Unlock Full Access — $19/month
              </button>
              <button 
                onClick={handleUnlock}
                className="bg-white hover:bg-gray-50 text-gray-600 font-medium py-4 px-8 rounded-lg transition-colors text-lg border border-gray-200 cursor-pointer w-full sm:w-auto"
              >
                I have paid
              </button>
            </div>
          ) : (
            <div className="mb-8 inline-flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-800 font-medium rounded-lg border border-gray-200">
              <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              Full access unlocked
            </div>
          )}

          <ul className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-gray-600 font-medium">
            <li className="flex items-center gap-2">
              <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              No complex tools
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              No wasted time
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              Just clear opportunities
            </li>
          </ul>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Revenue ($)</label>
            <input
              type="number"
              placeholder="e.g. 10000"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors w-40"
              value={minRevenue}
              onChange={(e) => setMinRevenue(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Max Reviews</label>
            <input
              type="number"
              placeholder="e.g. 500"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors w-40"
              value={maxReviews}
              onChange={(e) => setMaxReviews(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Price ($)</label>
            <input
              type="number"
              placeholder="0"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors w-32"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Max Price ($)</label>
            <input
              type="number"
              placeholder="999"
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors w-32"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        {/* Table Area */}
        {isUnlocked && (
          <div className="mb-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-4 text-xs font-semibold tracking-wide uppercase text-gray-500">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                LIVE SIGNAL
              </div>
              <div className="border-l border-gray-200 h-3 mx-1"></div>
              <div>Last updated: {lastUpdated}</div>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 hover:opacity-70 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh Signals
            </button>
          </div>
        )}

        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
          {isRefreshing && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[1px] flex items-center justify-center transition-opacity">
              <div className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-3 shadow-2xl">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Updating signals...
              </div>
            </div>
          )}
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900">Product Name</th>
                <th className="px-6 py-4 font-semibold text-gray-900 right-align max-w-[100px]">Price</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Est. Revenue</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Reviews</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Opp. Score</th>
                <th className="px-6 py-4 font-semibold text-gray-900 w-full">Insight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product, index) => {
                const isBlurred = !isUnlocked && index >= 5;

                return (
                  <tr 
                    key={product.id} 
                    className={`group ${isBlurred ? 'select-none pointer-events-none filter blur-sm opacity-60' : 'hover:bg-gray-50 transition-colors'}`}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[250px] truncate whitespace-normal">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      ${product.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      ${product.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {product.reviews.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                          <div 
                            className="h-full transition-all duration-500" 
                            style={{ 
                              width: `${product.score}%`,
                              backgroundColor: product.score <= 40 ? '#ef4444' : product.score <= 75 ? '#facc15' : '#22c55e'
                            }}
                          />
                        </div>
                        <span className="font-bold text-gray-900 w-6 text-right tabular-nums">{product.score}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-normal min-w-[300px]">
                      {product.insight}
                    </td>
                  </tr>
                );
              })}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No products match your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Paywall Overlay */}
          {!isUnlocked && filteredProducts.length > 5 && (
            <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-white via-white/95 to-transparent flex flex-col items-center justify-end pb-8 z-10">
              <div className="bg-white px-8 py-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 text-center max-w-sm w-full mx-4 mb-4">
                <h3 className="text-xl font-bold mb-2">Unlock Full Access</h3>
                <p className="text-gray-500 text-sm mb-6">See all matching product opportunities and advanced insights for $19/month.</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => window.open(checkoutUrl, '_blank')}
                    className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    Unlock Full Access
                  </button>
                  <button 
                    onClick={handleUnlock}
                    className="w-full bg-white hover:bg-gray-50 text-gray-600 font-medium py-3 px-4 outline outline-1 outline-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    I have paid
                  </button>
                </div>
                
                <div className="mt-5 text-xs text-gray-400">
                  <p className="mb-1">After purchase, return and click "I have paid".</p>
                  <p>This is an early access version.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
