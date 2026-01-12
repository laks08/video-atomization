# Deployment Guide - FFmpeg Fix

## Summary of Changes

I've fixed the ffmpeg issue in your Vercel deployment. Here's what was changed:

### 1. **Updated `vercel.json`**
```json
{
  "installCommand": "pnpm install --ignore-scripts=false && cd node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static && node install.js",
  "functions": {
    "api/worker/run": {
      "includeFiles": "node_modules/**/**/ffmpeg-static/ffmpeg",
      "maxDuration": 60
    }
  }
}
```

**What this does:**
- Custom install command that runs the ffmpeg-static postinstall script
- Includes the ffmpeg binary in the deployment bundle (wildcard pattern works with any version)
- Sets maxDuration to 60 seconds (requires Vercel Pro plan)

### 2. **Enhanced `lib/ffmpeg.ts`**
- Added detailed logging to help debug path resolution
- Improved error handling with better error messages
- Made the `ensureExecutable` function more robust

### 3. **Created `.npmrc`**
```
enable-pre-post-scripts=true
```
This allows pnpm to run postinstall scripts.

### 4. **Added Test Script**
Created `scripts/test-ffmpeg.ts` to verify ffmpeg works before deployment.

## How to Deploy

### Step 1: Test Locally
```bash
pnpm tsx scripts/test-ffmpeg.ts
```

You should see:
```
✅ All tests passed! FFmpeg is ready to use.
```

### Step 2: Commit Changes
```bash
git add .
git commit -m "Fix ffmpeg in Vercel serverless functions"
```

### Step 3: Deploy to Vercel
```bash
vercel --prod
```

### Step 4: Monitor Deployment
Watch the build logs in Vercel dashboard. Look for:
- ✅ `Downloading ffmpeg b6.1.1` during install
- ✅ No errors about missing ffmpeg binary

### Step 5: Test in Production
After deployment, trigger a render job and check the function logs for:
- `[ffmpeg] Using ffmpeg-static path: ...`
- `[ffmpeg] Binary found at: ...`
- `[ffmpeg] Binary is executable`

## Important Notes

### ⚠️ Vercel Limitations

1. **Timeout Limits:**
   - Hobby plan: 10 seconds (won't work for video processing)
   - Pro plan: 60 seconds with `maxDuration` (might work for short clips)
   - Enterprise: Up to 900 seconds

2. **Memory Limits:**
   - Default: 1024MB
   - Max (Pro): 3008MB

3. **File Size:**
   - Large videos will hit timeout/memory limits

### 🚀 Recommended for Production

If you're processing videos longer than 30 seconds or larger than 50MB, consider:

1. **Option A: Background Processing Service**
   - Deploy a separate worker on Railway/Render/Fly.io
   - Use a job queue (BullMQ, Inngest, etc.)
   - Process videos asynchronously
   - Much more reliable and cost-effective

2. **Option B: Use Cloudflare Workers + R2**
   - Better for video processing
   - Longer execution times
   - Built-in storage

3. **Option C: AWS Lambda with EFS**
   - Mount ffmpeg from EFS
   - 15-minute timeout
   - More expensive but very reliable

## Troubleshooting

### If deployment still fails:

1. **Check Vercel build logs** for:
   ```
   Downloading ffmpeg b6.1.1
   ```
   If you don't see this, the install script didn't run.

2. **Try setting environment variable** in Vercel dashboard:
   ```
   FFMPEG_PATH=/var/task/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg
   ```

3. **Check function logs** for the exact error:
   - `ENOENT` = binary not found
   - `EACCES` = permission denied
   - Timeout = video too large/long

4. **Verify Pro plan** if using maxDuration > 10s

### If it works but times out:

1. **Reduce video quality** in `lib/ffmpeg.ts`:
   - Change `-preset veryfast` to `-preset ultrafast`
   - Increase `-crf 23` to `-crf 28` (lower quality, faster)

2. **Process shorter clips** (< 30 seconds)

3. **Consider background processing** (see recommendations above)

## Next Steps

1. ✅ Deploy and test
2. ✅ Monitor function execution times
3. ⚠️ If you see timeouts, consider moving to a background service
4. 📊 Track costs - video processing in serverless can be expensive

## Need Help?

If you're still having issues:
1. Check Vercel function logs
2. Run the test script locally
3. Share the exact error message

Good luck! 🚀
