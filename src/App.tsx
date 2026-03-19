import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import logo from './assets/logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'amazon' | 'etsy' | 'tiktok';

type Product = {
  id: string;
  name: string;
  price: number;
  revenue: number;
  reviews: number;
  score: number;
  insight: string;
  bestFor: Platform[];
};

type AuthMode = 'idle' | 'login' | 'register';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<Platform, { label: string; hint: string; categories: string[] }> = {
  amazon: {
    label: 'Amazon',
    hint: 'Signals based on BSR trends, review velocity & PPC opportunity in US marketplace.',
    categories: ['Home & Kitchen', 'Pet Supplies', 'Sports & Outdoors', 'Office Products', 'Beauty & Personal Care'],
  },
  etsy: {
    label: 'Etsy',
    hint: 'Signals based on search trends, favorites velocity & seasonal demand on Etsy US.',
    categories: ['Home Decor', 'Jewelry & Accessories', 'Digital Downloads', 'Party Supplies', 'Baby & Kids'],
  },
  tiktok: {
    label: 'TikTok Shop',
    hint: 'Signals based on viral potential, impulse price points & trending product aesthetics on TikTok Shop US.',
    categories: ['Skincare & Beauty', 'Kitchen Gadgets', 'Fitness & Wellness', 'Fashion Accessories', 'Home Aesthetic'],
  },
};

const PRODUCT_DATA: Record<Platform, Record<string, Omit<Product, 'id' | 'score'>[]>> = {
  amazon: {
    'Home & Kitchen': [
      { name: 'Silicone Utensil Set 6pc', price: 24, revenue: 18400, reviews: 87, insight: 'High BSR movement, low review count — strong PPC entry window', bestFor: ['amazon'] },
      { name: 'Magnetic Knife Strip 18"', price: 32, revenue: 12300, reviews: 42, insight: 'Rising search volume, few reviews — ideal before competition spikes', bestFor: ['amazon'] },
      { name: 'Stackable Pantry Containers', price: 39, revenue: 27800, reviews: 210, insight: 'Steady BSR, reviews growing — window narrowing, act soon', bestFor: ['amazon', 'etsy'] },
      { name: 'Herb Growing Kit Indoor', price: 28, revenue: 9800, reviews: 31, insight: 'Seasonal spike incoming — list now for Q4 positioning', bestFor: ['amazon', 'etsy'] },
      { name: 'Oil Sprayer Bottle Glass', price: 18, revenue: 15200, reviews: 58, insight: 'Strong repeat purchase signal — good LTV for Subscribe & Save', bestFor: ['amazon'] },
      { name: 'Compost Bin Countertop', price: 35, revenue: 11600, reviews: 44, insight: 'Rising eco trend, low incumbents — low PPC cost right now', bestFor: ['amazon', 'etsy'] },
      { name: 'Adjustable Pot Lid Holder', price: 22, revenue: 7400, reviews: 19, insight: 'Very low reviews for search volume — wide open entry', bestFor: ['amazon'] },
      { name: 'Whetstone Knife Sharpener Kit', price: 41, revenue: 8900, reviews: 26, insight: 'High average order, low reviews — premium listing opportunity', bestFor: ['amazon'] },
      { name: 'Cold Brew Coffee Maker', price: 36, revenue: 19300, reviews: 88, insight: 'Consistent demand year-round, moderate competition', bestFor: ['amazon'] },
      { name: 'Sous Vide Precision Cooker', price: 79, revenue: 14200, reviews: 34, insight: 'High price point, low review density — strong margin signal', bestFor: ['amazon'] },
    ],
    'Pet Supplies': [
      { name: 'Interactive Cat Feeder Puzzle', price: 22, revenue: 14200, reviews: 53, insight: 'Gift-driven product, low reviews — strong Q4 PPC play', bestFor: ['amazon', 'etsy'] },
      { name: 'Slow Feed Dog Bowl', price: 19, revenue: 9700, reviews: 38, insight: 'Low competition, steady BSR — clean entry with good images', bestFor: ['amazon'] },
      { name: 'Cat Window Perch Hammock', price: 34, revenue: 7300, reviews: 22, insight: 'Rising trend, very low reviews — early mover advantage', bestFor: ['amazon', 'etsy'] },
      { name: 'Dog Car Seat Cover Waterproof', price: 52, revenue: 23900, reviews: 144, insight: 'High revenue, moderate reviews — listing quality is the lever', bestFor: ['amazon'] },
      { name: 'Pet First Aid Kit', price: 38, revenue: 6200, reviews: 18, insight: 'Underserved niche, real demand — low PPC cost right now', bestFor: ['amazon'] },
      { name: 'Cat Calming Collar', price: 26, revenue: 11800, reviews: 47, insight: 'Repeat purchase potential — Subscribe & Save angle viable', bestFor: ['amazon'] },
      { name: 'Dog Training Clicker Set', price: 12, revenue: 5600, reviews: 15, insight: 'Ultra-low barrier to test — bundle to increase AOV', bestFor: ['amazon'] },
      { name: 'Automatic Pet Water Fountain', price: 42, revenue: 29400, reviews: 720, insight: 'High volume but competitive — premium positioning required', bestFor: ['amazon'] },
      { name: 'Orthopedic Dog Bed Medium', price: 68, revenue: 31000, reviews: 390, insight: 'Strong revenue, reviews slowing — still viable with niche angle', bestFor: ['amazon'] },
      { name: 'Pet Grooming Glove', price: 15, revenue: 18600, reviews: 260, insight: 'Maturing — bundle strategy recommended to defend margin', bestFor: ['amazon'] },
    ],
    'Sports & Outdoors': [
      { name: 'Resistance Bands Set 5pc', price: 27, revenue: 22100, reviews: 340, insight: 'High volume, maturing — brand differentiation is the key lever', bestFor: ['amazon'] },
      { name: 'Hydration Vest Trail Running', price: 64, revenue: 9400, reviews: 28, insight: 'Niche but loyal buyer segment — strong margin, low CPC', bestFor: ['amazon'] },
      { name: 'Yoga Blocks Cork Set', price: 29, revenue: 8700, reviews: 33, insight: 'Low competition in natural materials segment — eco angle wins', bestFor: ['amazon', 'etsy'] },
      { name: 'Camping Hammock Lightweight', price: 37, revenue: 14900, reviews: 78, insight: 'Strong summer demand signal — position now before peak', bestFor: ['amazon'] },
      { name: 'Balance Board Wooden', price: 48, revenue: 5800, reviews: 14, insight: 'Emerging category, very low reviews — early mover upside', bestFor: ['amazon', 'etsy'] },
      { name: 'Hiking Poles Collapsible', price: 56, revenue: 7600, reviews: 21, insight: 'Low reviews relative to category size — good entry signal', bestFor: ['amazon'] },
      { name: 'Ab Roller Wheel with Mat', price: 22, revenue: 19300, reviews: 187, insight: 'Established demand — focus on quality perception & images', bestFor: ['amazon'] },
      { name: 'Foam Roller Deep Tissue', price: 31, revenue: 16800, reviews: 95, insight: 'Steady demand, moderate competition — listing quality matters', bestFor: ['amazon'] },
      { name: 'Adjustable Jump Rope Speed', price: 18, revenue: 12500, reviews: 61, insight: 'Gift-friendly with seasonal spikes — bundle opportunity', bestFor: ['amazon'] },
      { name: 'Portable Pull-Up Bar Doorway', price: 43, revenue: 31600, reviews: 510, insight: 'Crowded but high volume — bundle with accessories to stand out', bestFor: ['amazon'] },
    ],
    'Office Products': [
      { name: 'Desk Organizer Bamboo', price: 34, revenue: 11200, reviews: 44, insight: 'Eco angle performs well with WFH buyers — low PPC cost', bestFor: ['amazon', 'etsy'] },
      { name: 'Cable Management Box', price: 26, revenue: 9300, reviews: 36, insight: 'Consistent search demand, low reviews — clean entry', bestFor: ['amazon'] },
      { name: 'Ergonomic Footrest Under Desk', price: 39, revenue: 16800, reviews: 89, insight: 'Strong repeat searches, moderate reviews — real opportunity', bestFor: ['amazon'] },
      { name: 'Wireless Charging Desk Pad', price: 62, revenue: 7400, reviews: 19, insight: 'Low competition in premium segment — high margin potential', bestFor: ['amazon'] },
      { name: 'Whiteboard Sticker Roll', price: 22, revenue: 5900, reviews: 12, insight: 'Underserved niche, clear use case — test with low MOQ', bestFor: ['amazon'] },
      { name: 'Laptop Stand Portable Foldable', price: 41, revenue: 24600, reviews: 180, insight: 'Steady demand, moderate competition — listing quality is lever', bestFor: ['amazon'] },
      { name: 'Sticky Note Dispenser Desktop', price: 18, revenue: 4200, reviews: 8, insight: 'Ultra low reviews — wide open if demand validated by PPC', bestFor: ['amazon'] },
      { name: 'Monitor Stand Riser Adjustable', price: 48, revenue: 28700, reviews: 310, insight: 'High demand, growing competitive — still room with strong images', bestFor: ['amazon'] },
      { name: 'Blue Light Glasses Set 3pk', price: 29, revenue: 18400, reviews: 220, insight: 'Maturing — bundle or private label for margin defense', bestFor: ['amazon'] },
      { name: 'Desk Lamp LED with USB Port', price: 37, revenue: 31200, reviews: 490, insight: 'High volume — differentiate on design or smart features', bestFor: ['amazon'] },
    ],
    'Beauty & Personal Care': [
      { name: 'Jade Facial Roller Set', price: 24, revenue: 13600, reviews: 71, insight: 'Demand stable, competition moderate — strong branding wins', bestFor: ['amazon', 'etsy'] },
      { name: 'LED Face Mask Therapy', price: 79, revenue: 11300, reviews: 28, insight: 'Premium niche, low reviews — strong margin & gifting signal', bestFor: ['amazon'] },
      { name: 'Konjac Facial Sponge Set', price: 19, revenue: 7200, reviews: 22, insight: 'Low reviews for demand level — good entry window now', bestFor: ['amazon', 'etsy'] },
      { name: 'Dermaplaning Tool Set', price: 26, revenue: 12100, reviews: 55, insight: 'Steady search trend — solid if reviews stay low', bestFor: ['amazon'] },
      { name: 'Face Steamer Nano Ionic', price: 54, revenue: 8400, reviews: 19, insight: 'Low competition, growing demand — timing is favorable', bestFor: ['amazon'] },
      { name: 'Scalp Massager Shampoo Brush', price: 14, revenue: 21400, reviews: 290, insight: 'Maturing — bundle with hair care for margin defense', bestFor: ['amazon'] },
      { name: 'Nail Dip Powder Kit Starter', price: 44, revenue: 9600, reviews: 31, insight: 'Rising trend, niche — early positioning opportunity', bestFor: ['amazon'] },
      { name: 'Hair Diffuser Universal', price: 22, revenue: 15800, reviews: 88, insight: 'Accessory play — pairs well with any curly hair brand', bestFor: ['amazon', 'tiktok'] },
      { name: 'Eyelash Growth Serum', price: 32, revenue: 18700, reviews: 142, insight: 'Moderate competition — differentiate on ingredients claim', bestFor: ['amazon', 'tiktok'] },
      { name: 'Eyebrow Stencil Kit 12pc', price: 16, revenue: 8900, reviews: 34, insight: 'Gift-friendly, low barrier — strong influencer seeding angle', bestFor: ['amazon', 'tiktok'] },
    ],
  },
  etsy: {
    'Home Decor': [
      { name: 'Personalized Family Name Sign', price: 38, revenue: 8700, reviews: 24, insight: 'Consistent bestseller — personalization drives favorites velocity', bestFor: ['etsy'] },
      { name: 'Boho Macrame Wall Hanging', price: 45, revenue: 11200, reviews: 61, insight: 'Seasonal spike in Q4 — list with gift-ready photography', bestFor: ['etsy'] },
      { name: 'Custom City Map Print', price: 29, revenue: 14300, reviews: 88, insight: 'Digital + physical SKUs possible — strong repeat gifting demand', bestFor: ['etsy'] },
      { name: 'Dried Flower Wreath', price: 52, revenue: 6800, reviews: 18, insight: 'Rising Pinterest-to-Etsy trend — early organic search advantage', bestFor: ['etsy'] },
      { name: 'Ceramic Catch-All Tray', price: 34, revenue: 9100, reviews: 31, insight: 'Low competition in handmade ceramic niche — favorites velocity strong', bestFor: ['etsy'] },
      { name: 'Wax Seal Stamp Set', price: 27, revenue: 7600, reviews: 14, insight: 'Gift-driven, repeat buyers — bundle with wax beads for AOV', bestFor: ['etsy'] },
      { name: 'Linen Pillow Cover Set', price: 42, revenue: 12800, reviews: 55, insight: 'Consistent demand, moderate favorites count — strong seasonal peak', bestFor: ['etsy'] },
      { name: 'Pressed Flower Art Frame', price: 36, revenue: 5400, reviews: 12, insight: 'Low competition, rising search trend — timing favorable now', bestFor: ['etsy'] },
      { name: 'Custom Candle Gift Set', price: 48, revenue: 16200, reviews: 79, insight: 'High gifting demand — subscription angle viable for repeat buyers', bestFor: ['etsy', 'tiktok'] },
      { name: 'Geometric Planter Pot', price: 31, revenue: 8300, reviews: 26, insight: 'Steady Etsy search demand — eco packaging increases conversion', bestFor: ['etsy'] },
    ],
    'Jewelry & Accessories': [
      { name: 'Dainty Name Necklace Gold', price: 34, revenue: 19400, reviews: 110, insight: 'Top Etsy category — differentiate on turnaround time & packaging', bestFor: ['etsy'] },
      { name: 'Birth Month Flower Ring', price: 28, revenue: 11700, reviews: 47, insight: 'Trending search term, low competition — capitalize now', bestFor: ['etsy', 'tiktok'] },
      { name: 'Custom Birthstone Bracelet', price: 42, revenue: 14200, reviews: 63, insight: "Strong gifting signal — Mother's Day & birthday peak incoming", bestFor: ['etsy'] },
      { name: 'Pressed Flower Resin Earrings', price: 24, revenue: 7800, reviews: 22, insight: 'Rising handmade trend — low favorites count means early mover upside', bestFor: ['etsy'] },
      { name: 'Initial Charm Anklet', price: 19, revenue: 9300, reviews: 31, insight: 'Summer search spike predictable — position inventory now', bestFor: ['etsy'] },
      { name: 'Pearl Huggie Earrings Set', price: 26, revenue: 12100, reviews: 58, insight: 'TikTok aesthetic crossover — strong organic traffic signal', bestFor: ['etsy', 'tiktok'] },
      { name: 'Zodiac Constellation Necklace', price: 36, revenue: 8900, reviews: 34, insight: 'Steady year-round demand — gift-ready angle is key', bestFor: ['etsy'] },
      { name: 'Leather Cord Wrap Bracelet', price: 22, revenue: 6400, reviews: 18, insight: 'Low entry cost, consistent search — good first product to test', bestFor: ['etsy'] },
      { name: 'Personalized Bar Necklace', price: 44, revenue: 22600, reviews: 130, insight: 'High volume category — speed of fulfillment is the differentiator', bestFor: ['etsy'] },
      { name: 'Wax Seal Wax Ring', price: 31, revenue: 5600, reviews: 14, insight: 'Niche with loyal buyer base — bundle upsell potential', bestFor: ['etsy'] },
    ],
    'Digital Downloads': [
      { name: 'Wedding Budget Spreadsheet', price: 12, revenue: 8200, reviews: 0, insight: 'Zero fulfillment cost — one listing generates passive income', bestFor: ['etsy'] },
      { name: 'Self-Care Planner Printable', price: 9, revenue: 11400, reviews: 0, insight: 'High search volume, low competition in premium design niche', bestFor: ['etsy'] },
      { name: 'Social Media Content Calendar', price: 14, revenue: 7600, reviews: 0, insight: 'B2B buyer on Etsy — underserved, high intent segment', bestFor: ['etsy'] },
      { name: 'Baby Shower Games Bundle', price: 8, revenue: 9800, reviews: 0, insight: 'Evergreen demand — seasonal spikes predictable and consistent', bestFor: ['etsy'] },
      { name: 'Meal Prep Weekly Planner', price: 7, revenue: 6300, reviews: 0, insight: 'Health niche crossover — bundle with grocery list for higher AOV', bestFor: ['etsy'] },
      { name: 'Invoice Template Pack', price: 11, revenue: 5100, reviews: 0, insight: 'Small business buyer — strong word-of-mouth referral pattern', bestFor: ['etsy'] },
      { name: 'Party Invitation Template', price: 8, revenue: 14200, reviews: 0, insight: 'Very high search volume — editable Canva template wins', bestFor: ['etsy'] },
      { name: 'Ebook Cover Template Canva', price: 16, revenue: 3900, reviews: 0, insight: 'Growing B2B niche on Etsy — creator economy demand rising', bestFor: ['etsy'] },
      { name: 'Habit Tracker Printable', price: 7, revenue: 8800, reviews: 0, insight: 'Evergreen wellness demand — simple to produce, easy to rank', bestFor: ['etsy'] },
      { name: 'Watercolor Flower Clipart Set', price: 13, revenue: 4700, reviews: 0, insight: 'Low competition in premium style — licensing upsell possible', bestFor: ['etsy'] },
    ],
    'Party Supplies': [
      { name: 'Custom Banner Party Set', price: 28, revenue: 12400, reviews: 54, insight: 'Strong gifting signal — personalization drives conversion rate', bestFor: ['etsy'] },
      { name: 'Balloon Garland Kit', price: 34, revenue: 18700, reviews: 88, insight: 'High volume, consistent demand — packaging quality is differentiator', bestFor: ['etsy'] },
      { name: 'Personalized Party Favor Bags', price: 22, revenue: 8900, reviews: 32, insight: 'Repeat buyer potential — birthday + holiday seasonal spikes', bestFor: ['etsy'] },
      { name: 'Edible Cake Topper Custom', price: 19, revenue: 11200, reviews: 47, insight: 'Niche skill barrier = lower competition — high margin per unit', bestFor: ['etsy'] },
      { name: 'Photo Booth Props Set', price: 24, revenue: 6700, reviews: 19, insight: 'Low competition in premium quality segment — reorder rate strong', bestFor: ['etsy'] },
      { name: 'Table Number Cards Wedding', price: 18, revenue: 9400, reviews: 38, insight: 'Wedding niche on Etsy — favorites-to-purchase ratio high', bestFor: ['etsy'] },
      { name: 'Gender Reveal Confetti Cannon', price: 14, revenue: 7800, reviews: 24, insight: 'Viral gifting product — TikTok crossover demand rising', bestFor: ['etsy', 'tiktok'] },
      { name: 'Boho Party Decoration Kit', price: 42, revenue: 4800, reviews: 12, insight: 'Rising aesthetic trend — early Etsy search advantage now', bestFor: ['etsy'] },
      { name: 'Kids Birthday Crown Set', price: 12, revenue: 8100, reviews: 28, insight: 'Consistent evergreen demand — low competition in handmade niche', bestFor: ['etsy'] },
      { name: 'Personalized Wine Label', price: 16, revenue: 5200, reviews: 14, insight: 'Gift niche with strong AOV — bundle for higher basket size', bestFor: ['etsy'] },
    ],
    'Baby & Kids': [
      { name: 'Personalized Name Puzzle', price: 36, revenue: 14200, reviews: 62, insight: 'Etsy bestseller category — lead time differentiation is key', bestFor: ['etsy'] },
      { name: 'Custom Baby Milestone Blanket', price: 48, revenue: 11700, reviews: 44, insight: 'High gifting intent — newborn gift segment is very loyal', bestFor: ['etsy'] },
      { name: 'Wooden Alphabet Blocks Set', price: 42, revenue: 8900, reviews: 28, insight: 'Consistent gift demand — eco packaging boosts conversion', bestFor: ['etsy'] },
      { name: 'Personalized Growth Chart', price: 44, revenue: 9300, reviews: 31, insight: 'Nursery decor niche — repeat buyer for second child common', bestFor: ['etsy'] },
      { name: 'Custom Name Night Light', price: 38, revenue: 12100, reviews: 48, insight: 'Gift-ready product — search volume rising ahead of Q4', bestFor: ['etsy', 'amazon'] },
      { name: 'Kids Recipe Baking Kit', price: 29, revenue: 5600, reviews: 14, insight: 'Niche gift idea, low favorites count — wide open right now', bestFor: ['etsy'] },
      { name: 'Montessori Busy Board', price: 52, revenue: 7400, reviews: 22, insight: 'Rising parenting trend — premium price point with low supply', bestFor: ['etsy', 'amazon'] },
      { name: 'Baby Announcement Card Set', price: 18, revenue: 8700, reviews: 31, insight: 'Evergreen gifting niche — digital + physical bundle opportunity', bestFor: ['etsy'] },
      { name: 'Personalized Book for Kids', price: 45, revenue: 16400, reviews: 74, insight: 'Strong Etsy search volume — personalization is the full moat', bestFor: ['etsy'] },
      { name: 'Baby Photo Album Book', price: 34, revenue: 6800, reviews: 19, insight: 'Low competition in premium handmade — gifting angle strong', bestFor: ['etsy'] },
    ],
  },
  tiktok: {
    'Skincare & Beauty': [
      { name: 'Pore Vacuum Blackhead Remover', price: 19, revenue: 22400, reviews: 89, insight: 'Viral demo potential — satisfying content drives organic reach', bestFor: ['tiktok', 'amazon'] },
      { name: 'Gua Sha Facial Tool Rose Quartz', price: 16, revenue: 18700, reviews: 142, insight: 'Already viral — differentiate on aesthetic packaging for gifting', bestFor: ['tiktok', 'amazon'] },
      { name: 'Lip Plumping Gloss', price: 14, revenue: 14200, reviews: 54, insight: 'Impulse buy price point — before/after content converts fast', bestFor: ['tiktok'] },
      { name: 'Ice Roller Face Globes', price: 22, revenue: 11800, reviews: 38, insight: 'Satisfying demo product — low price, high shareability score', bestFor: ['tiktok', 'amazon'] },
      { name: 'Snail Mucin Serum', price: 18, revenue: 19300, reviews: 210, insight: 'TikTok skincare trend still rising — ingredient story is the hook', bestFor: ['tiktok', 'amazon'] },
      { name: 'Lash Lift Kit At-Home', price: 26, revenue: 9400, reviews: 28, insight: 'Tutorial content drives sales — creator collab opportunity', bestFor: ['tiktok'] },
      { name: 'Skin Tint SPF Tinted Moisturizer', price: 24, revenue: 16800, reviews: 88, insight: 'GRWM content goldmine — impulse friendly price point', bestFor: ['tiktok'] },
      { name: 'Peptide Eye Cream', price: 32, revenue: 8700, reviews: 22, insight: 'Anti-aging angle resonates with 25-35 TikTok buyer', bestFor: ['tiktok', 'amazon'] },
      { name: 'Hydrocolloid Acne Patch', price: 12, revenue: 24600, reviews: 310, insight: 'Maturing but still viral — bundle variant for higher AOV', bestFor: ['tiktok', 'amazon'] },
      { name: 'Vitamin C Brightening Serum', price: 21, revenue: 17200, reviews: 130, insight: 'Trust-driven purchase — ingredient focus content converts well', bestFor: ['tiktok', 'amazon'] },
    ],
    'Kitchen Gadgets': [
      { name: 'Aesthetic Butter Cutter Roller', price: 14, revenue: 16800, reviews: 42, insight: 'Made-for-TikTok demo — satisfying video = free organic traffic', bestFor: ['tiktok'] },
      { name: 'Electric Whisk Mini Handheld', price: 12, revenue: 21400, reviews: 88, insight: 'Under $15 impulse buy — ASMR demo content drives conversions', bestFor: ['tiktok', 'amazon'] },
      { name: 'Lemon Squeezer Stainless', price: 16, revenue: 14200, reviews: 54, insight: 'Satisfying squeeze demo — simple product with strong visual hook', bestFor: ['tiktok', 'amazon'] },
      { name: 'Avocado Slicer 3-in-1', price: 11, revenue: 18900, reviews: 71, insight: 'Problem-solution content format — strong add-to-cart trigger', bestFor: ['tiktok', 'amazon'] },
      { name: 'Herb Stripper Tool', price: 9, revenue: 12600, reviews: 38, insight: 'Satisfying demo potential — ultra low price = high impulse rate', bestFor: ['tiktok', 'amazon'] },
      { name: 'Egg Separator Silicone', price: 8, revenue: 9800, reviews: 22, insight: 'Simple, demo-friendly — bundle with other kitchen tools for AOV', bestFor: ['tiktok'] },
      { name: 'Waffle Maker Mini Dash', price: 29, revenue: 28400, reviews: 190, insight: 'Already viral product — entry via bundle or accessories play', bestFor: ['tiktok', 'amazon'] },
      { name: 'Watermelon Slicer Cutter', price: 17, revenue: 11300, reviews: 34, insight: 'Summer demo content performs well — seasonal spike upcoming', bestFor: ['tiktok'] },
      { name: 'Pineapple Corer Slicer', price: 13, revenue: 8700, reviews: 19, insight: 'Satisfying demo, low price — pairs well with summer content', bestFor: ['tiktok', 'amazon'] },
      { name: 'Oil Dispenser Glass Olive', price: 22, revenue: 13400, reviews: 47, insight: 'Aesthetic kitchen content — "what I use in my kitchen" format', bestFor: ['tiktok', 'amazon'] },
    ],
    'Fitness & Wellness': [
      { name: 'Acupressure Mat & Pillow Set', price: 32, revenue: 14800, reviews: 54, insight: 'Satisfying reaction content — wellness niche has high LTV', bestFor: ['tiktok', 'amazon'] },
      { name: 'Posture Corrector Brace', price: 24, revenue: 22100, reviews: 130, insight: 'Problem-solution hook — before/after content format converts', bestFor: ['tiktok', 'amazon'] },
      { name: 'Massage Gun Mini Compact', price: 38, revenue: 19400, reviews: 88, insight: 'Demo-friendly product — gym content creator collab potential', bestFor: ['tiktok', 'amazon'] },
      { name: 'Resistance Loop Bands Set', price: 16, revenue: 12600, reviews: 48, insight: 'Ultra low price point — workout tutorial content drives sales', bestFor: ['tiktok', 'amazon'] },
      { name: 'Cold Plunge Tub Inflatable', price: 89, revenue: 8700, reviews: 14, insight: 'Viral trend, low supply — premium price with strong content hook', bestFor: ['tiktok'] },
      { name: 'Lymphatic Drainage Massager', price: 28, revenue: 11200, reviews: 34, insight: 'Rising wellness trend — creator education content converts well', bestFor: ['tiktok'] },
      { name: 'Creatine Gummies', price: 34, revenue: 16800, reviews: 71, insight: 'Supplement crossover — taste hook content angle performs well', bestFor: ['tiktok'] },
      { name: 'Ab Stimulator Belt EMS', price: 29, revenue: 9300, reviews: 26, insight: 'Demo-heavy product — skeptic-to-believer content arc works well', bestFor: ['tiktok', 'amazon'] },
      { name: 'Slant Board Calf Stretcher', price: 42, revenue: 6400, reviews: 18, insight: 'Physical therapy niche rising on TikTok — educational content wins', bestFor: ['tiktok', 'amazon'] },
      { name: 'Weighted Hula Hoop', price: 34, revenue: 18200, reviews: 95, insight: 'Viral workout product — fun content format = organic reach', bestFor: ['tiktok', 'amazon'] },
    ],
    'Fashion Accessories': [
      { name: 'Gold Butterfly Hair Clips Set', price: 12, revenue: 14200, reviews: 48, insight: 'GRWM content staple — haul video format drives fast sales', bestFor: ['tiktok'] },
      { name: 'Y2K Tinted Sunglasses', price: 16, revenue: 18700, reviews: 88, insight: 'Aesthetic crossover — outfit content format drives high CTR', bestFor: ['tiktok'] },
      { name: 'Satin Scrunchie Bundle', price: 14, revenue: 11300, reviews: 42, insight: 'Impulse buy price — "unboxing" and haul content converts', bestFor: ['tiktok', 'etsy'] },
      { name: 'Phone Charm Keychain Set', price: 11, revenue: 9800, reviews: 28, insight: 'Viral accessory trend — aesthetic packaging for gifting angle', bestFor: ['tiktok', 'etsy'] },
      { name: 'Minimalist Gold Stacking Rings', price: 18, revenue: 12600, reviews: 38, insight: 'OOTD content friendly — low price for jewelry = impulse buy', bestFor: ['tiktok', 'etsy'] },
      { name: 'Baseball Cap with Chain', price: 24, revenue: 8400, reviews: 22, insight: 'Streetwear trend crossover — style content format works well', bestFor: ['tiktok'] },
      { name: 'Claw Clip Set Large', price: 13, revenue: 22100, reviews: 130, insight: 'Already viral — private label with aesthetic packaging', bestFor: ['tiktok', 'amazon'] },
      { name: 'Beaded Bracelet Starter Kit', price: 19, revenue: 7600, reviews: 19, insight: 'DIY craft trend on TikTok — tutorial content sells the product', bestFor: ['tiktok', 'etsy'] },
      { name: 'Aesthetic Belt Bag Mini', price: 26, revenue: 11800, reviews: 44, insight: 'OOTD staple — high visual appeal for content creators', bestFor: ['tiktok'] },
      { name: 'Disco Ball Earrings', price: 14, revenue: 6200, reviews: 14, insight: 'Statement piece — party season demand spike predictable', bestFor: ['tiktok', 'etsy'] },
    ],
    'Home Aesthetic': [
      { name: 'LED Neon Sign Custom', price: 49, revenue: 16800, reviews: 54, insight: 'Room tour & aesthetic content — high visual impact for creators', bestFor: ['tiktok', 'etsy'] },
      { name: 'Aesthetic Candle Set Minimal', price: 34, revenue: 12400, reviews: 44, insight: 'Room aesthetic content staple — gifting angle very strong', bestFor: ['tiktok', 'etsy'] },
      { name: 'Flower Vase Bud Set', price: 22, revenue: 9800, reviews: 28, insight: 'Desk aesthetic trend — simple product with strong visual appeal', bestFor: ['tiktok', 'etsy'] },
      { name: 'Mushroom Night Light', price: 18, revenue: 14200, reviews: 48, insight: 'Viral aesthetic product — cozy content format drives sales', bestFor: ['tiktok', 'amazon'] },
      { name: 'Polaroid String Lights Photo', price: 24, revenue: 11700, reviews: 38, insight: 'Dorm & apartment content — back to school seasonal spike', bestFor: ['tiktok', 'amazon'] },
      { name: 'Aesthetic Desk Mat Pastel', price: 28, revenue: 8900, reviews: 24, insight: '"My desk setup" content format converts well — WFH trend', bestFor: ['tiktok', 'amazon'] },
      { name: 'Terrarium Kit Glass', price: 38, revenue: 6400, reviews: 16, insight: 'Slow living trend — calming content format with tutorial hook', bestFor: ['tiktok', 'etsy'] },
      { name: 'Washi Tape Set Aesthetic', price: 14, revenue: 7800, reviews: 18, insight: 'Journaling & craft community — haul and ASMR content formats', bestFor: ['tiktok', 'etsy'] },
      { name: 'Scent Diffuser Stone', price: 26, revenue: 10200, reviews: 31, insight: 'Wellness aesthetic crossover — minimal product, strong visual', bestFor: ['tiktok', 'etsy'] },
      { name: 'Aesthetic Bookends Set', price: 32, revenue: 5600, reviews: 12, insight: 'Bookshelf aesthetic trend growing — low competition right now', bestFor: ['tiktok', 'etsy'] },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcScore(revenue: number, reviews: number): number {
  let s = 0;
  if (revenue > 20000) s += 38;
  else if (revenue > 12000) s += 24;
  else if (revenue > 6000) s += 12;
  else s += 4;

  if (reviews === 0) s += 38; // digital downloads
  else if (reviews < 20) s += 42;
  else if (reviews < 60) s += 30;
  else if (reviews < 150) s += 16;
  else if (reviews < 400) s += 6;

  return Math.min(100, Math.max(5, s + Math.round((Math.random() - 0.5) * 8)));
}

function scoreColor(score: number) {
  if (score <= 40) return { bar: '#ef4444', text: 'text-red-500' };
  if (score <= 75) return { bar: '#facc15', text: 'text-yellow-500' };
  return { bar: '#22c55e', text: 'text-green-500' };
}

const PLATFORM_BADGE: Record<Platform, string> = {
  amazon: 'bg-[#232F3E] text-[#FF9900]',
  etsy: 'bg-[#F1641E] text-white',
  tiktok: 'bg-black text-white',
};

const PLATFORM_LABEL: Record<Platform, string> = {
  amazon: 'Amazon',
  etsy: 'Etsy',
  tiktok: 'TikTok',
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [platform, setPlatform] = useState<Platform>('amazon');
  const [category, setCategory] = useState<string>('Home & Kitchen');
  const [products, setProducts] = useState<Product[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  // Auth state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('idle');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Filters
  const [minRevenue, setMinRevenue] = useState<number | ''>('');
  const [maxReviews, setMaxReviews] = useState<number | ''>('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const checkoutUrl = 'https://YOUR-STORE.lemonsqueezy.com/buy/YOUR_PRODUCT_ID';

  // ── Firebase Auth listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check Firestore for paid status
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

  // ── Generate products ──────────────────────────────────────────────────────
  useEffect(() => {
    generateProducts();
    setLastUpdated(format(new Date(), 'HH:mm'));
  }, [platform, category]);

  function generateProducts() {
    const pool = PRODUCT_DATA[platform]?.[category] ?? [];
    const fresh = [...pool]
      .sort(() => Math.random() - 0.5)
      .map((p, i) => ({
        ...p,
        id: `${platform}-${category}-${i}`,
        revenue: p.revenue + Math.round((Math.random() - 0.5) * p.revenue * 0.12),
        reviews: p.reviews === 0 ? 0 : Math.max(1, p.reviews + Math.round((Math.random() - 0.5) * p.reviews * 0.18)),
        score: calcScore(p.revenue, p.reviews),
      }));
    setProducts(fresh);
  }

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      generateProducts();
      setLastUpdated(format(new Date(), 'HH:mm'));
      setIsRefreshing(false);
    }, 800);
  }

  function handlePlatformChange(p: Platform) {
    setPlatform(p);
    setCategory(PLATFORM_META[p].categories[0]);
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

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (minRevenue !== '' && p.revenue < minRevenue) return false;
      if (maxReviews !== '' && p.reviews > maxReviews) return false;
      if (minPrice !== '' && p.price < minPrice) return false;
      if (maxPrice !== '' && p.price > maxPrice) return false;
      return true;
    });
  }, [products, minRevenue, maxReviews, minPrice, maxPrice]);

  const visibleProducts = isUnlocked ? filteredProducts : filteredProducts.slice(0, 5);
  const hiddenProducts = isUnlocked ? [] : filteredProducts.slice(5);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Zenith" className="w-10 h-10 object-contain rounded-lg" />
            <div>
              <span className="text-2xl font-black tracking-tighter uppercase">ZENITH</span>
              <p className="text-xs text-gray-500 mt-0.5">Product opportunity signals for US e-commerce sellers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isUnlocked && (
              <span className="text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                Full access
              </span>
            )}
            {auth.currentUser && (
              <button
                onClick={handleSignOut}
                className="text-xs text-gray-500 hover:text-black transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="py-10 md:py-16 max-w-3xl mb-12">
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            Find winning products in 5 seconds —{' '}
            <br className="hidden md:block" />
            no bloated dashboards.
          </h2>
          <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-2xl">
            Simple product signals. Clear opportunities. Built for Amazon, Etsy, and TikTok Shop sellers in the US market.
          </p>

          {!isUnlocked ? (
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => window.open(checkoutUrl, '_blank')}
                className="bg-black hover:bg-gray-800 text-white font-medium py-4 px-8 rounded-lg transition-colors text-lg cursor-pointer w-full sm:w-auto"
              >
                Unlock Full Access — $19/month
              </button>
              <button
                onClick={() => setAuthMode('login')}
                className="bg-white hover:bg-gray-50 text-gray-600 font-medium py-4 px-8 rounded-lg transition-colors text-lg border border-gray-200 cursor-pointer w-full sm:w-auto"
              >
                I have paid — sign in
              </button>
            </div>
          ) : (
            <div className="mb-8 inline-flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-800 font-medium rounded-lg border border-gray-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Full access unlocked
            </div>
          )}

          <ul className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-gray-500 font-medium">
            {['No complex tools', 'No wasted time', 'Just clear opportunities'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Auth Modal ─────────────────────────────────────────────────── */}
        {authMode !== 'idle' && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm">
              <h3 className="text-xl font-bold mb-1 text-center">
                Sign in to Zenith
              </h3>
              <p className="text-sm text-gray-500 mb-8 text-center px-4">
                Use the account associated with your purchase.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={signInWithGoogle}
                  disabled={authSubmitting}
                  className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 hover:bg-gray-50 text-black font-semibold py-3.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  onClick={signInWithApple}
                  disabled={authSubmitting}
                  className="flex items-center justify-center gap-3 w-full bg-black hover:bg-gray-900 text-white font-semibold py-3.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.96.95-2.12 1.48-3.48 1.48-1.42 0-2.45-.51-3.66-.51-1.24 0-2.46.53-3.72.53-2.43 0-4.66-1.57-5.92-3.83-1.27-2.27-1.1-4.87.23-6.85 1.02-1.5 2.51-2.45 4.14-2.45 1.42 0 2.45.51 3.66.51s2.24-.51 3.66-.51c.96 0 1.83.18 2.59.54-1.07.72-1.74 1.82-1.74 3.1 0 1.94 1.63 3.53 3.75 3.53.07 0 .14 0 .21-.01-.4 1.44-1.18 2.65-2.14 3.61l-.01.01zm-3.61-16.15c0-1.14.49-2.25 1.34-3.04.88-.84 2.11-1.33 3.37-1.31.02 1.25-.49 2.43-1.37 3.25-.85.8-2.04 1.35-3.23 1.35-.07 0-.08 0-.11-.25z"/>
                  </svg>
                  Continue with Apple
                </button>

                {authError && (
                  <p className="text-xs text-red-500 text-center mt-2 font-medium">
                    {authError}
                  </p>
                )}

                <button 
                  onClick={() => setAuthMode('idle')} 
                  className="mt-4 text-xs text-gray-400 hover:text-black transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Platform Selector ──────────────────────────────────────────── */}
        <div className="flex gap-0 mb-2 border border-gray-200 rounded-xl overflow-hidden w-fit">
          {(['amazon', 'etsy', 'tiktok'] as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePlatformChange(p)}
              className={`px-6 py-3 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${platform === p
                  ? p === 'amazon'
                    ? 'bg-[#232F3E] text-[#FF9900]'
                    : p === 'etsy'
                      ? 'bg-[#F1641E] text-white'
                      : 'bg-black text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
            >
              {PLATFORM_META[p].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4">{PLATFORM_META[platform].hint}</p>

        {/* ── Category Tabs ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PLATFORM_META[platform].categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${category === cat
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-black'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 mb-8 p-5 border border-gray-200 rounded-lg bg-gray-50/50">
          {[
            { label: 'Min Revenue ($)', value: minRevenue, setter: setMinRevenue, placeholder: 'e.g. 10000' },
            { label: 'Max Reviews', value: maxReviews, setter: setMaxReviews, placeholder: 'e.g. 300' },
            { label: 'Min Price ($)', value: minPrice, setter: setMinPrice, placeholder: '0' },
            { label: 'Max Price ($)', value: maxPrice, setter: setMaxPrice, placeholder: '999' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type="number"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setter(e.target.value === '' ? '' : Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black w-36 bg-white"
              />
            </div>
          ))}
        </div>

        {/* ── Table Controls ─────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-4 text-xs font-semibold tracking-wide uppercase text-gray-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live Signal
            </div>
            <span className="border-l border-gray-200 h-3" />
            <span>Last updated: {lastUpdated}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2 hover:opacity-60 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Signals
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-white">
          {isRefreshing && (
            <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-3">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating signals...
              </div>
            </div>
          )}

          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 font-semibold text-gray-700">Product Name</th>
                <th className="px-5 py-4 font-semibold text-gray-700">Price</th>
                <th className="px-5 py-4 font-semibold text-gray-700">Est. Revenue</th>
                <th className="px-5 py-4 font-semibold text-gray-700">Reviews</th>
                <th className="px-5 py-4 font-semibold text-gray-700">Opp. Score</th>
                <th className="px-5 py-4 font-semibold text-gray-700 min-w-[260px]">Insight</th>
                <th className="px-5 py-4 font-semibold text-gray-700">Best For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Visible rows */}
              {visibleProducts.map((product) => {
                const { bar, text } = scoreColor(product.score);
                const isDigital = platform === 'etsy' && category === 'Digital Downloads';
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900 max-w-[220px]">{product.name}</td>
                    <td className="px-5 py-4 text-gray-600">${product.price.toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-600">
                      {isDigital ? 'N/A' : `$${product.revenue.toLocaleString()}`}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {isDigital ? '—' : product.reviews.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                          <div className="h-full transition-all duration-500" style={{ width: `${product.score}%`, backgroundColor: bar }} />
                        </div>
                        <span className={`font-bold w-6 text-right tabular-nums ${text}`}>{product.score}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs leading-relaxed">{product.insight}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {product.bestFor.map((bf) => (
                          <span key={bf} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_BADGE[bf]}`}>
                            {PLATFORM_LABEL[bf]}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Blurred rows */}
              {hiddenProducts.map((product) => {
                const { bar } = scoreColor(product.score);
                return (
                  <tr key={product.id} className="select-none pointer-events-none">
                    <td className="px-5 py-4">
                      <div className="h-4 bg-gray-200 rounded w-40 blur-sm" />
                    </td>
                    <td className="px-5 py-4 text-gray-400 blur-sm">${product.price.toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-400 blur-sm">${product.revenue.toLocaleString()}</td>
                    <td className="px-5 py-4 text-gray-400 blur-sm">{product.reviews}</td>
                    <td className="px-5 py-4 blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full" style={{ width: `${product.score}%`, backgroundColor: bar }} />
                        </div>
                        <span className="font-bold text-gray-400 w-6 text-right">{product.score}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 blur-sm">
                      <div className="h-3 bg-gray-200 rounded w-52" />
                    </td>
                    <td className="px-5 py-4 blur-sm">
                      <div className="h-5 bg-gray-200 rounded w-16" />
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No products match your filters. Try adjusting the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── Paywall Overlay ──────────────────────────────────────────── */}
          {!isUnlocked && filteredProducts.length > 5 && (
            <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-white via-white/95 to-transparent flex flex-col items-center justify-end pb-8 z-10">
              <div className="bg-white px-8 py-6 rounded-xl shadow-xl border border-gray-100 text-center max-w-sm w-full mx-4">
                <h3 className="text-lg font-bold mb-1">
                  {filteredProducts.length - 5} more opportunities hidden
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Unlock all {filteredProducts.length} signals for {platform === 'amazon' ? 'Amazon US' : platform === 'etsy' ? 'Etsy US' : 'TikTok Shop US'} — $19/month.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => window.open(checkoutUrl, '_blank')}
                    className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    Unlock Full Access — $19/month
                  </button>
                  <button
                    onClick={() => setAuthMode('login')}
                    className="w-full text-gray-500 hover:text-black font-medium py-3 rounded-lg border border-gray-200 transition-colors text-sm"
                  >
                    I have paid — sign in
                  </button>
                </div>
                <p className="mt-4 text-xs text-gray-300">
                  After purchase, create an account to unlock access.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;