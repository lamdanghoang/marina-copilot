# Marina Copilot — Deployment Guide

## Architecture

```
Frontend (Vercel)  →  Backend (AWS Lambda + API Gateway)  →  External Services
   Next.js 14            Express via serverless-http          Bedrock, Sui, MemWal
```

The frontend and backend are deployed independently:
- **Frontend**: Vercel (auto-deploys from Git)
- **Backend**: AWS Lambda behind API Gateway (via Serverless Framework)

---

## Frontend Deployment (Vercel)

### Setup

1. Import repository in [Vercel Dashboard](https://vercel.com/new)
2. Set **Root Directory** to `frontend`
3. Framework Preset: **Next.js** (auto-detected)
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Lambda API Gateway URL (e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`) |
| `NEXT_PUBLIC_SUI_NETWORK` | `testnet` |

5. Deploy — Vercel handles build and hosting automatically.

### Custom Domain (Optional)

Configure in Vercel project settings → Domains.

---

## Backend Deployment (AWS Lambda)

### Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- Node.js 20.x
- Serverless Framework: `npm install -g serverless`

### Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variables (export or use `.env`):
   ```bash
   export AWS_REGION=us-east-1
   export CORS_ORIGIN=https://your-app.vercel.app
   export BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514
   export SUI_RPC_URL=https://fullnode.testnet.sui.io:443
   export MEMWAL_API_KEY=your-key
   export MEMWAL_DELEGATE_KEY=your-key
   export CETUS_API_URL=your-url
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

   For production stage:
   ```bash
   npm run deploy:prod
   ```

### What Happens on Deploy

1. TypeScript compiles to `dist/`
2. Serverless Framework packages `dist/` + `node_modules/`
3. Creates/updates Lambda function
4. Sets up API Gateway with HTTP API (catch-all route)
5. Returns the API Gateway endpoint URL

### After Deploy

Copy the endpoint URL from the deploy output and set it as `NEXT_PUBLIC_API_URL` in Vercel.

---

## CORS Configuration

The backend CORS is controlled by the `CORS_ORIGIN` environment variable:
- **Local**: `http://localhost:3000`
- **Production**: Your Vercel deployment URL (e.g. `https://marina-copilot.vercel.app`)

The Express CORS middleware allows:
- Methods: GET, POST, OPTIONS
- Headers: Content-Type, Authorization
- Credentials: true

---

## End-to-End Verification

1. Deploy backend → get Lambda URL
2. Set Lambda URL in Vercel env vars → redeploy frontend
3. Test the flow:
   ```bash
   # Health check
   curl https://your-lambda-url.amazonaws.com/api/health

   # Process intent (requires valid wallet address)
   curl -X POST https://your-lambda-url.amazonaws.com/api/process-intent \
     -H "Content-Type: application/json" \
     -d '{"message": "swap 1 SUI to USDC", "walletAddress": "0x...", "conversationHistory": [], "balances": []}'
   ```

4. Open frontend URL → connect wallet → send a message → verify preview appears

---

## Troubleshooting

### Lambda not responding
- Check CloudWatch Logs: `/aws/lambda/marina-copilot-backend-dev-api`
- Verify IAM role has Bedrock permissions

### CORS errors in browser
- Ensure `CORS_ORIGIN` matches the exact Vercel URL (no trailing slash)
- Check API Gateway has preflight (OPTIONS) handling

### Timeout errors
- Lambda timeout is 30s (configured in serverless.yml)
- Bedrock calls timeout at 8s (in app config)
- If cold start is slow, consider provisioned concurrency

### Build failures
- Run `npm run build` locally first to catch TypeScript errors
- Ensure `dist/` is generated correctly
