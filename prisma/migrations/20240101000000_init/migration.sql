-- CreateEnum
CREATE TYPE "ClipOrientation" AS ENUM ('horizontal', 'vertical');

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "source_path" TEXT NOT NULL,
    "original_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moments" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_assets" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "moment_id" TEXT NOT NULL,
    "orientation" "ClipOrientation" NOT NULL,
    "file_path" TEXT NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moments_video_id_rank_key" ON "moments"("video_id", "rank");

-- CreateIndex
CREATE INDEX "moments_video_id_idx" ON "moments"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "clip_assets_moment_id_orientation_key" ON "clip_assets"("moment_id", "orientation");

-- CreateIndex
CREATE INDEX "clip_assets_video_id_idx" ON "clip_assets"("video_id");

-- CreateIndex
CREATE INDEX "clip_assets_moment_id_idx" ON "clip_assets"("moment_id");

-- AddForeignKey
ALTER TABLE "moments" ADD CONSTRAINT "moments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_assets" ADD CONSTRAINT "clip_assets_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_assets" ADD CONSTRAINT "clip_assets_moment_id_fkey" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
