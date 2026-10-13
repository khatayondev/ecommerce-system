# Comprehensive Master Prompt & Technical Blueprint: Cocobytes Chocolate E-Commerce & Retail OS

> **Usage Instructions**:  
> Copy and paste this prompt into an AI Agent (e.g., Antigravity, Claude, or ChatGPT) when you are ready to build the complete dual-application platform for **Cocobytes Chocolate** (Storefront Website + Cloud Inventory & POS Management System).

---

```markdown
# MISSION & SYSTEM OVERVIEW
You are an expert full-stack engineer and digital product designer tasked with building a complete, high-performance, enterprise-grade e-commerce storefront and retail management system for **Cocobytes Chocolate** (https://www.cocobyteschocolate.com/), an artisanal Ghanaian chocolate brand known for luxury handcrafted truffles, bonbons, chocolate bars, dragees, and bespoke gift boxes.

The project consists of two tightly integrated systems:
1. **The Public E-Commerce Storefront (`cocobyteschocolate-web`)**:
   - A modern, editorial, luxury brand website with an interactive chocolate gift-box builder, full catalog, shopping cart, customer accounts, blog/insights, and Paystack checkout (Mobile Money & Cards).
2. **The Retail & Inventory Operating System (`cocobyteschocolate-inventory`)**:
   - A real-time cloud operations dashboard featuring Point-of-Sale (POS) with offline sync, stock management with atomic batch deductions, recipe/composite bundle allocation, pop-up expo/exhibition tracking, supplier management, and automated Ghanaian SMS (Arkesel) and Email (Resend) receipts.

---

## 1. BRAND IDENTITY & DESIGN SYSTEM

### Brand Essence
- **Tagline**: *"Taste Ghana in Every Bite" | "From Farm to Finest Handcrafted Chocolate"*
- **Vibe**: High-end confectionery, artisanal craftsmanship, rich heritage, warm African luxury.
- **Reference URL**: https://www.cocobyteschocolate.com/

### Curated Color Palette
- **Deep Cocoa Dark**: `#1F110B` (Dark background, deep contrast text)
- **Rich Dark Chocolate**: `#2C1810` (Primary brand color, headers, cards)
- **Warm Milk Chocolate**: `#5C3826` (Secondary accents, borders)
- **Artisanal Honey Gold**: `#D4AF37` / `#C59B27` (Primary CTAs, accents, medals, badges)
- **Cream Ivory**: `#FAF6F0` (Backgrounds, hero contrast, soft sections)
- **Parchment White**: `#FFFFFF` (Surface cards)

### Typography
- **Headings**: `Playfair Display` or `Cinzel` (Serif, elegant, luxurious)
- **Body & UI**: `Poppins` or `Plus Jakarta Sans` (Clean, modern, legible)
- **Numbers / Pricing**: `Tango Sans` or tabular `Poppins` font weights (bold, high-contrast)

---

## 2. ARCHITECTURE & TECH STACK

- **Frontend Framework**: Next.js 14+ (App Router, React Server Components, Turbopack)
- **Styling**: TailwindCSS + Vanilla CSS utilities (rich micro-animations, glassmorphism, mobile-optimized)
- **Database & Auth**: Google Cloud Firebase (Firestore Database, Firebase Authentication with custom claims, Firebase Storage)
- **Payments**: Paystack API (Mobile Money: MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard in GHS)
- **Transactional SMS**: Arkesel v2 Gateway API (`PalaceHoney` / `Cocobytes` alphanumeric sender ID with Ghana phone normalization)
- **Transactional Emails**: Resend API with verified custom domain (`orders@cocobyteschocolate.com`)
- **Hosting & CI/CD**: Vercel production hosting with automated GitHub deployments

---

## 3. PART 1: PUBLIC STOREFRONT APPLICATION (`cocobyteschocolate-web`)

### Key Pages & Features:
1. **Hero & Brand Narrative (`/`)**:
   - Fluid video/carousel hero showcasing cocoa harvesting, bean roasting, and molten chocolate tempering.
   - Brand value badges: *🇬🇭 100% Single-Origin Ghana Cocoa*, *Handcrafted in Small Batches*, *Fair Trade & Farmer-Direct*.
   - Featured seasonal collections and chef's curated truffles.
2. **Shop Catalog (`/shop`)**:
   - Categories: Handcrafted Bars (Dark 70%, Milk, Moringa, Sea Salt, Coffee Bean), Artisanal Bonbons & Truffles, Dragees (Chocolate Peanuts / Cashews), Seasonal Gift Sets.
   - Live filters by cacao percentage, dietary flags (vegan, gluten-free, dairy-free), and price range.
3. **Interactive "Build Your Chocolate Box" (`/custom-box`)**:
   - Customers choose a luxury box size (e.g. 4-piece, 9-piece, 16-piece).
   - Visual grid allowing drag-and-drop or click-to-fill with hand-painted bonbons, truffles, and pralines.
   - Real-time preview of the curated box with dynamic calorie/allergen summary.
4. **Checkout & Payment (`/checkout`)**:
   - Multi-step or seamless single-page checkout.
   - Paystack Inline Popup or redirect for Ghana MoMo & Card processing.
   - Address auto-complete / Ghana Digital Address (GPS) and regional delivery fee calculation (Accra, Kumasi, Nationwide, Worldwide DHL).
5. **Receipt & Order Tracker (`/receipt/[id]` & `/track`)**:
   - Live progress indicator (Received -> Conched & Packed -> Out for Delivery -> Delivered).
   - Instant PDF download of branded purchase receipt.
6. **Stories & Cocoa Journal (`/journal`)**:
   - Editorial blog with recipe inspirations, chocolate pairing guides (wine, cheese, coffee), and farmer spotlight stories.

---

## 4. PART 2: RETAIL & INVENTORY OPERATING SYSTEM (`cocobyteschocolate-inventory`)

### Core Operational Modules:
1. **Real-time Inventory & Batch Management**:
   - Manage stock by SKU, batch number, production date, and expiry date.
   - Support **composite products**: Selling a "Luxury 9-Piece Box" automatically reserves or deducts 9 individual bonbons from the tempering inventory.
   - Low-stock threshold alerts sent to manager email/SMS.
2. **High-Speed Point of Sale (POS)**:
   - Optimized for touchscreens, tablets, and mobile pop-up stalls.
   - Instant product search, barcode scanner integration, and quick-tap grid.
   - **Offline Mode**: Operates seamlessly during trade fair Wi-Fi blackouts; queues orders in IndexedDB and automatically reconciles when internet restores.
   - Dual receipt options: Thermal printer output (`80mm/58mm ESC/POS`) + Instant digital SMS and Email receipts via Arkesel & Resend.
3. **Exhibition & Trade Fair Hub (`/exhibitions`)**:
   - Allocate specific stock to weekend farmer's markets, expos, or mall pop-ups.
   - Real-time stock isolation so event sales do not deplete factory showroom stock.
   - Auto-generated event landing page with QR codes for quick customer self-checkout.
4. **Wholesale & Corporate Gifting CRM (`/invoices` & `/customers`)**:
   - Separate pricing tiers for Retail, Wholesale, and Corporate clients.
   - Generate official PDF quotes and Proforma/Tax invoices with Ghana GRA compliance notes.
   - Integrated Paystack payment link inside invoices with automatic balance reconciliation upon payment.
5. **Suppliers & Raw Material Tracking (`/suppliers`)**:
   - Track purchases of raw cocoa beans, cocoa butter, milk powders, inclusions (nuts, dried mango), and luxury packaging boxes.
6. **Role-Based Access Control (RBAC)**:
   - Permissions hierarchy: `Super Admin` (Owner), `Manager` (Production & Stock), `Cashier` (POS only, restricted from viewing costs/profits).

---

## 5. LOCAL GHANAIAN INTEGRATIONS & CODE CONVENTIONS

### 1. Ghana Mobile Money & Phone Number Normalization
Always sanitize recipient numbers before passing to Arkesel:
```javascript
export function formatGhanaPhone(phone) {
  let cleaned = (phone || '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }
  if (cleaned.length === 9) {
    cleaned = '233' + cleaned;
  }
  return cleaned;
}
```

### 2. Arkesel SMS Gateway Integration
```javascript
export async function sendArkeselSMS(recipientPhone, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || 'Cocobytes';
  const phone = formatGhanaPhone(recipientPhone);

  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000), // 15s timeout prevents gateway dropouts
    body: JSON.stringify({ sender: senderId, recipients: [phone], message })
  });
  return res.json();
}
```

### 3. Paystack Webhook Handler (GHS MoMo & Card)
```javascript
// Validates Paystack crypto signature and updates Firestore order state atomically
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export async function verifyAndProcessPaystack(req) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers.get('x-paystack-signature');
  const body = await req.text();

  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  if (hash !== signature) throw new Error('Invalid webhook signature');

  const event = JSON.parse(body);
  if (event.event === 'charge.success') {
    const { reference, amount, metadata } = event.data;
    // Update order status to "Paid", deduct stock atomically, trigger SMS/Email receipt
  }
}
```

---

## 6. PROJECT DIRECTORY STRUCTURE

```
cocobyteschocolate/
├── cocobyteschocolate-web/          # Customer-Facing Storefront
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js             # Editorial Hero, Collections, Reviews
│   │   │   ├── shop/               # Catalog with filters & search
│   │   │   ├── custom-box/         # Interactive Chocolate Box Builder
│   │   │   ├── cart/               # Cart drawer & review
│   │   │   ├── checkout/           # Paystack integrated checkout
│   │   │   ├── receipt/[id]/       # Digital receipt & live tracker
│   │   │   └── journal/            # Chocolate stories & recipes
│   │   ├── components/             # Reusable UI (Navbar, Footer, ProductCard)
│   │   └── lib/                    # Firebase, Paystack client
│   └── tailwind.config.js
│
└── cocobyteschocolate-inventory/    # Operations & POS Hub
    ├── src/
    │   ├── app/
    │   │   ├── dashboard/          # Analytics, revenue, stock health
    │   │   ├── pos/                # Touchscreen POS with offline queue
    │   │   ├── inventory/          # Stock levels, composite products, alerts
    │   │   ├── exhibitions/        # Pop-up event stock & QR codes
    │   │   ├── invoices/           # B2B Invoices & quotes generator
    │   │   ├── communications/     # Arkesel SMS & Resend email broadcasts
    │   │   ├── api/
    │   │   │   ├── send-receipt/   # SMS & Email receipt dispatcher
    │   │   │   └── paystack/       # Payment initialization & webhooks
    │   └── utils/
    │       ├── sms.js              # Arkesel integration with normalization
    │       ├── receiptTemplate.js  # HTML email templates
    │       └── offlineStore.js     # IndexedDB local cache for POS
```

---

## 7. EXECUTION STEPS TO BUILD & LAUNCH

1. **Step 1: Scaffolding & Setup**
   - Initialize Next.js 14+ with App Router and Tailwind CSS for both apps.
   - Configure Firebase project (`cocobytes-prod`) with Firestore and Authentication.
2. **Step 2: Database Schema & Seed Data**
   - Collections: `products`, `orders`, `sales`, `customers`, `suppliers`, `exhibitions`, `invoices`.
   - Seed with Cocobytes catalog (Dark Bars, Milk Bars, Bonbon boxes, Dragees).
3. **Step 3: Build Storefront**
   - Create luxury editorial homepage with Playfair Display typography and rich chocolate aesthetic.
   - Implement the interactive "Build Your Box" feature and Paystack checkout.
4. **Step 4: Build Inventory & POS Engine**
   - Implement touchscreen POS with local offline queueing and instant print/SMS receipts.
   - Build composite product batch tracking and stock alerts.
5. **Step 5: Connect Communications & Production Keys**
   - Plug in verified Arkesel API key and register `Cocobytes` Sender ID.
   - Plug in Resend API key and verify DNS records (SPF, DKIM) on `cocobyteschocolate.com`.
   - Plug in live Paystack API keys.
6. **Step 6: Deploy & Handover**
   - Deploy Storefront to `https://cocobyteschocolate.com`
   - Deploy POS/Ops to `https://hub.cocobyteschocolate.com` (or `inventory.cocobyteschocolate.com`)
```
