# Coolify Environment Variables Setup Guide

This guide explains how to configure environment variables for OpenStatus deployment in Coolify.

## 🚀 Quick Setup

### Step 1: Import the Stack
1. In Coolify dashboard, click **"New Service"** → **"Docker Compose"**
2. Choose **"Import from URL"** and enter:
   ```
   https://raw.githubusercontent.com/openstatusHQ/openstatus/main/coolify-deployment.yaml
   ```
3. Click **"Deploy"**

### Step 2: Configure Environment Variables
1. After deployment, click on the **OpenStatus stack**
2. Go to **"Settings"** → **"Environment Variables"**
3. Add the required variables below

## 🔧 Required Environment Variables

### **Core Database & Authentication**
```bash
# Database Connection
DATABASE_URL=http://libsql:8080
DATABASE_AUTH_TOKEN=

# Authentication
AUTH_SECRET=your-32-character-secret-here
NEXT_PUBLIC_URL=https://your-domain.com
SELF_HOST=true
```

### **Email Service (Required for Login)**
```bash
RESEND_API_KEY=re_your_resend_api_key_here
```

## 🔧 Optional Environment Variables

### **Analytics (TinyBird)**
```bash
TINY_BIRD_API_KEY=your_tinybird_api_key
TINYBIRD_URL=http://tinybird:7181
```

### **OAuth Providers**
```bash
# GitHub OAuth
AUTH_GITHUB_ID=your_github_oauth_id
AUTH_GITHUB_SECRET=your_github_oauth_secret

# Google OAuth
AUTH_GOOGLE_ID=your_google_oauth_id
AUTH_GOOGLE_SECRET=your_google_oauth_secret
```

### **Redis & Queue (Optional)**
```bash
UPSTASH_REDIS_REST_URL=http://localhost:6379
UPSTASH_REDIS_REST_TOKEN=your_redis_token
QSTASH_CURRENT_SIGNING_KEY=your_qstash_key
QSTASH_NEXT_SIGNING_KEY=your_qstash_key
QSTASH_TOKEN=your_qstash_token
QSTASH_URL=https://qstash.upstash.io/v1/publish/
```

### **Google Cloud (Optional)**
```bash
GCP_PROJECT_ID=your_gcp_project_id
GCP_LOCATION=your_gcp_location
GCP_CLIENT_EMAIL=your_gcp_service_account
GCP_PRIVATE_KEY=your_gcp_private_key
CRON_SECRET=your_cron_secret
```

### **API Keys (Optional)**
```bash
UNKEY_API_ID=your_unkey_api_id
UNKEY_TOKEN=your_unkey_token
SUPER_ADMIN_TOKEN=your_super_admin_token
FLY_REGION=self-hosted
```

### **Stripe (Optional)**
```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret
STRIPE_WEBHOOK_SECRET_KEY=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

### **Vercel (Optional)**
```bash
PROJECT_ID_VERCEL=your_vercel_project_id
TEAM_ID_VERCEL=your_vercel_team_id
VERCEL_AUTH_BEARER_TOKEN=your_vercel_token
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### **Observability (Optional)**
```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=your_openpanel_client_id
OPENPANEL_CLIENT_SECRET=your_openpanel_client_secret
PAGERDUTY_APP_ID=your_pagerduty_app_id
SLACK_SUPPORT_WEBHOOK_URL=your_slack_webhook_url
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### **External Services (Optional)**
```bash
OPENSTATUS_INGEST_URL=https://openstatus-private-location.fly.dev
SCREENSHOT_SERVICE_URL=your_screenshot_service_url
```

### **Development & Testing (Optional)**
```bash
TURBO_ENV_MODE=loose
PLAYGROUND_UNKEY_API_KEY=your_playground_key
WORKSPACES_LOOKBACK_30=true
WORKSPACES_HIDE_URL=false
```

## 🔍 Environment Variable Visibility in Coolify

### **Where to Find Environment Variables**
1. **Stack Settings**: Click on your OpenStatus stack
2. **Environment Tab**: Look for "Environment Variables" section
3. **Add Variables**: Click "Add Variable" for each required variable
4. **Apply Changes**: Save and redeploy the stack

### **Variable Categories in Coolify UI**
- **Database**: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
- **Authentication**: `AUTH_SECRET`, `NEXT_PUBLIC_URL`, `SELF_HOST`
- **Email**: `RESEND_API_KEY`
- **Analytics**: `TINY_BIRD_API_KEY`, `TINYBIRD_URL`
- **OAuth**: `AUTH_GITHUB_*`, `AUTH_GOOGLE_*`
- **Queue**: `UPSTASH_*`, `QSTASH_*`
- **Cloud**: `GCP_*`, `CRON_SECRET`
- **API Keys**: `UNKEY_*`, `SUPER_ADMIN_TOKEN`, `FLY_REGION`
- **Payments**: `STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Vercel**: `PROJECT_ID_VERCEL`, `TEAM_ID_VERCEL`, `VERCEL_*`
- **Observability**: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`, `OPENPANEL_*`
- **External**: `OPENSTATUS_INGEST_URL`, `SCREENSHOT_SERVICE_URL`
- **Development**: `TURBO_ENV_MODE`, `PLAYGROUND_*`, `WORKSPACES_*`

## 🚨 Troubleshooting

### **Environment Variables Not Working?**
1. **Check Stack Logs**: Look for environment variable errors
2. **Verify Variable Names**: Ensure exact match with this guide
3. **Redeploy**: Sometimes requires full stack restart
4. **Check Coolify Docs**: Some variables may need special handling

### **Common Issues**
- **DATABASE_URL**: Must be `http://libsql:8080` (internal container communication)
- **AUTH_SECRET**: Must be at least 32 characters
- **NEXT_PUBLIC_URL**: Must include protocol (http:// or https://)
- **RESEND_API_KEY**: Required for email login functionality

### **Getting Help**
- **Coolify Documentation**: Check Coolify's environment variables guide
- **OpenStatus Docs**: Visit [OpenStatus Documentation](https://github.com/openstatusHQ/openstatus)
- **Community Support**: Open an issue in the GitHub repository

## 🎯 Production Deployment

### **Minimum Required Variables**
For a basic working deployment, you only need:
```bash
DATABASE_URL=http://libsql:8080
DATABASE_AUTH_TOKEN=
AUTH_SECRET=your-32-char-secret
NEXT_PUBLIC_URL=https://your-domain.com
RESEND_API_KEY=your-resend-key
```

### **Testing Your Setup**
1. Deploy with minimum variables first
2. Check if services start correctly
3. Add optional variables incrementally
4. Test each feature as you add variables

This ensures a smooth, working deployment! 🚀
