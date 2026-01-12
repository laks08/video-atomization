# FFmpeg in Vercel Serverless Functions - Solutions

## Problem
Vercel serverless functions don't include ffmpeg by default, causing `ENOENT` errors when trying to spawn the ffmpeg process.

## Current Fixes Applied

### 1. Updated `vercel.json`
- Fixed the `includeFiles` path to match pnpm's structure
- Added `maxDuration: 60` to allow longer processing time (requires Pro plan)

### 2. Enhanced `lib/ffmpeg.ts`
- Added detailed logging for debugging
- Improved error handling
- Better path resolution for Vercel environment

## Recommended Long-term Solutions

### Option A: Use Vercel Blob + Background Processing (Best for Production)

Instead of processing videos in the serverless function, use a queue-based approach:

1. **Upload video to Vercel Blob** (already doing this)
2. **Trigger a background worker** (separate service like Railway, Render, or AWS Lambda)
3. **Process video with ffmpeg** in the background service
4. **Upload results back to Vercel Blob**
5. **Update database** with clip URLs

**Pros:**
- No timeout issues
- Better resource management
- Scalable
- Cost-effective

**Cons:**
- Requires additional infrastructure
- More complex setup

### Option B: Use FFmpeg WASM (Experimental)

Use `@ffmpeg/ffmpeg` which runs in WebAssembly:

```bash
pnpm add @ffmpeg/ffmpeg @ffmpeg/util
```

**Pros:**
- Works in serverless
- No binary needed

**Cons:**
- Slower than native ffmpeg
- Higher memory usage
- Still subject to timeout limits
- May not work for large videos

### Option C: Use Cloudflare Workers with R2 (Alternative Platform)

Cloudflare Workers support longer execution times with their "Durable Objects" feature.

### Option D: Self-host on Railway/Render/Fly.io

Deploy the worker as a separate long-running service:

**Pros:**
- Full control over ffmpeg
- No timeout limits
- Better for CPU-intensive tasks

**Cons:**
- Additional hosting cost
- More infrastructure to manage

## Testing the Current Fix

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Check the logs** to see if ffmpeg is found:
   - Look for `[ffmpeg] Using ffmpeg-static path: ...`
   - Look for `[ffmpeg] Binary found at: ...`

3. **If it still fails**, the issue might be:
   - pnpm version mismatch (the path includes version `@5.2.0`)
   - Vercel's build process not including the binary
   - File permissions in Vercel's runtime

## Quick Fix for Path Issues

If the pnpm path is different in Vercel's build, use a wildcard pattern in `vercel.json`:

```json
{
  "functions": {
    "api/worker/run": {
      "includeFiles": "node_modules/**/**/ffmpeg-static/ffmpeg",
      "maxDuration": 60
    }
  }
}
```

Or set an environment variable in Vercel dashboard:
```
FFMPEG_PATH=/var/task/node_modules/.pnpm/ffmpeg-static@5.2.0/node_modules/ffmpeg-static/ffmpeg
```

## Monitoring

After deployment, check Vercel function logs for:
- `[ffmpeg] Using ffmpeg-static path: ...` - confirms path resolution
- `[ffmpeg] Binary found at: ...` - confirms file exists
- `[ffmpeg] Binary is executable` - confirms permissions
- Any `spawn ffmpeg ENOENT` errors - indicates the fix didn't work

## Next Steps

1. **Test the current fix** by deploying
2. **If it still fails**, consider Option A (background processing)
3. **For quick wins**, try the wildcard pattern or environment variable approach
4. **Long-term**, move video processing to a dedicated service

## Vercel Limitations to Consider

- **Hobby Plan**: 10s timeout, 1024MB memory
- **Pro Plan**: 60s timeout (with maxDuration), 3008MB memory
- **Enterprise**: Up to 900s timeout

Even with Pro plan, 60 seconds might not be enough for large videos.
