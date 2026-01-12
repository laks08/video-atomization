# FFmpeg Fix - Quick Reference

## ✅ What Was Fixed

The issue: Vercel serverless functions couldn't find the ffmpeg binary, causing `spawn ffmpeg ENOENT` errors.

## 🔧 Changes Made

1. **vercel.json** - Custom install command + include ffmpeg binary
2. **lib/ffmpeg.ts** - Better logging and error handling  
3. **.npmrc** - Enable pnpm postinstall scripts
4. **scripts/test-ffmpeg.ts** - Test script to verify setup
5. **package.json** - Added `test-ffmpeg` command

## 🚀 Quick Deploy

```bash
# 1. Test locally
pnpm test-ffmpeg

# 2. Commit changes
git add .
git commit -m "Fix ffmpeg in Vercel"

# 3. Deploy
vercel --prod
```

## ⚠️ Important

- **Requires Vercel Pro** for 60s timeout (Hobby = 10s only)
- **May still timeout** for large videos (>50MB or >30s)
- **Consider background processing** for production use

## 🐛 Troubleshooting

```bash
# Test ffmpeg locally
pnpm test-ffmpeg

# Check Vercel logs for:
# ✅ "Downloading ffmpeg b6.1.1"
# ✅ "[ffmpeg] Binary found at: ..."

# If still failing, set env var in Vercel:
# FFMPEG_PATH=/var/task/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg
```

## 📚 Full Guides

- **DEPLOYMENT_GUIDE.md** - Complete deployment instructions
- **FFMPEG_SOLUTIONS.md** - Alternative solutions for production

## 💡 Production Recommendation

For reliable video processing, use a background service:
- Railway / Render / Fly.io for the worker
- Vercel for the web app
- Job queue (BullMQ, Inngest) to connect them

This avoids timeout issues and is more cost-effective.
