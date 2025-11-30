# Clothes Design Generator API - Copilot Instructions

## Architecture Overview

This is a Vercel-deployed Express.js API for a Serbian AI-powered clothes design service (`kreiraj.rs`). Core flow:
1. User submits Serbian text prompt → Azure Translator translates to English
2. Translated prompt → Leonardo.AI generates 3 clothing design images (1024x1024)
3. User orders designs → Email confirmations + PayPal payment processing

**Key files:**
- `api/index.js` - Main Express server with all endpoints
- `mailer.js` - Nodemailer service for order/contact emails
- `paypalService.js` - PayPal Sandbox SDK integration
- `vercel.json` - Deployment config with CORS headers

## Critical Patterns

### CORS Configuration
CORS middleware **must be applied before bodyParser** (line 20-51 in `api/index.js`). Uses dynamic origin checking with explicit allowlist including `kreiraj.rs` domains. Development mode allows all origins when `process.env.ENV !== 'production'`.

### Environment-Based Server Setup
Production uses HTTPS with Let's Encrypt certs from `/etc/letsencrypt/` (hardcoded paths). Development runs plain HTTP on port 5001. Check `process.env.ENV === 'production'` before modifying server initialization (lines 62-75).

### AI Image Generation Flow
1. `POST /api/generateImage` - Translates prompt via Azure Cognitive Translator, sends to Leonardo.AI with specific model ID `de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3`
2. Returns `generationId` immediately (non-blocking)
3. Client polls `GET /api/getImageGenerationProgress/:task_id` until images ready
4. Leonardo.AI always generates exactly 3 images with `ultra: false, enhancePrompt: false`

### Order Processing Pattern
`POST /api/submitOrder` sends two emails (customer + admin) and **non-critically** posts to external Strapi service at `nosistamislis.rs:1337`. External service failures are swallowed (try-catch without throw). Order data structure includes: `name, email, phoneNumber, city, address, orderItems[]` where each item has `printImageSrc, category, color, size, productCount, discountedPrice`.

### Email Templates
`mailer.js` uses inline HTML with Serbian text. Product cards display: image, category, color swatch (hex), size dimensions (width/length/sleeves in cm), quantity, and price in RSD. Always use `formatOrderItem()` helper for consistent formatting.

## Required Environment Variables

```
LEONARDO_API_TOKEN          # Leonardo.AI API key
AZURE_TRANSLATOR_KEY        # Azure Cognitive Services key (northeurope region)
CAPTCHA_SECRET_KEY          # Google reCAPTCHA secret
EMAIL_USERNAME              # Gmail account for nodemailer
EMAIL_PASSWORD              # Gmail app password
PAYPAL_CLIENT_ID            # PayPal Sandbox credentials
PAYPAL_CLIENT_SECRET
ENV                         # 'production' or omit for dev mode
```

## PayPal Integration
Uses **Sandbox** environment (`https://api-m.sandbox.paypal.com`). Three-step flow:
1. Generate client token for card fields
2. Create order with EUR currency (converts from RSD on frontend)
3. Capture order by ID

All PayPal methods return `{ jsonResponse, httpStatusCode }` tuple pattern.

## Development Workflow

```powershell
npm start                    # Runs api/index.js on localhost:5001
```

No test suite exists. Vercel handles deployment via `vercel.json` rewrite rules (`/api/(.*)` → `/api`).

## API Conventions

- Validation: Input sanitization on `/api/contactUs` (email format, message presence). No validation library used elsewhere.
- Error responses: Always `{ message: string, error?: string }` with appropriate HTTP codes
- Serbian language: UI text in responses/emails is Serbian Cyrillic/Latin mixed
- External dependencies: Graceful degradation for non-critical services (Strapi order logging)
