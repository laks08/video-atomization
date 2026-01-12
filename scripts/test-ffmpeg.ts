#!/usr/bin/env tsx

/**
 * Test script to verify ffmpeg is accessible
 * Run with: pnpm tsx scripts/test-ffmpeg.ts
 */

import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import ffmpegStatic from "ffmpeg-static";

async function testFfmpeg() {
    console.log("🔍 Testing FFmpeg setup...\n");

    // Test 1: Check if ffmpeg-static resolves
    console.log("1. FFmpeg-static path:");
    console.log(`   ${ffmpegStatic || "❌ NOT FOUND"}\n`);

    if (!ffmpegStatic) {
        console.error("❌ ffmpeg-static did not resolve to a path");
        process.exit(1);
    }

    // Test 2: Check if file exists
    console.log("2. Checking if binary exists...");
    try {
        await access(ffmpegStatic);
        console.log("   ✅ Binary file exists\n");
    } catch (err) {
        console.error("   ❌ Binary file not found");
        console.error(`   Error: ${err}\n`);
        process.exit(1);
    }

    // Test 3: Check if executable
    console.log("3. Checking if binary is executable...");
    try {
        await access(ffmpegStatic, constants.X_OK);
        console.log("   ✅ Binary is executable\n");
    } catch (err) {
        console.error("   ⚠️  Binary is not executable (this might be OK)\n");
    }

    // Test 4: Try to run ffmpeg -version
    console.log("4. Testing ffmpeg execution...");
    return new Promise<void>((resolve, reject) => {
        if (!ffmpegStatic) {
            reject(new Error("ffmpegStatic is null"));
            return;
        }

        const child = spawn(ffmpegStatic, ["-version"]);

        let output = "";
        let errorOutput = "";

        child.stdout.on("data", (data: Buffer) => {
            output += data.toString();
        });

        child.stderr.on("data", (data: Buffer) => {
            errorOutput += data.toString();
        });

        child.on("error", (err: Error) => {
            console.error("   ❌ Failed to spawn ffmpeg");
            console.error(`   Error: ${err.message}\n`);
            reject(err);
        });

        child.on("close", (code: number | null) => {
            if (code === 0) {
                console.log("   ✅ FFmpeg executed successfully");
                const versionLine = output.split("\n")[0];
                console.log(`   ${versionLine}\n`);
                resolve();
            } else {
                console.error(`   ❌ FFmpeg exited with code ${code}`);
                if (errorOutput) {
                    console.error(`   Error output: ${errorOutput}\n`);
                }
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });
    });
}

testFfmpeg()
    .then(() => {
        console.log("✅ All tests passed! FFmpeg is ready to use.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ FFmpeg test failed");
        console.error(err);
        process.exit(1);
    });
