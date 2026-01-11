import { Prisma, JobStatus, JobType } from "@prisma/client";
import prisma from "./db";

export type EnqueueResult = {
  id: string;
  type: JobType;
  status: JobStatus;
};

export type JobRow = {
  id: string;
  video_id: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: Date;
  locked_at: Date | null;
  payload: Prisma.JsonValue | null;
};

export async function enqueueJob(
  videoId: string,
  type: JobType,
  payload?: Prisma.JsonValue
): Promise<EnqueueResult> {
  const existing = await prisma.job.findFirst({
    where: {
      video_id: videoId,
      type,
      status: { in: [JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.FAILED] },
    },
  });

  if (existing) {
    if (existing.status === JobStatus.FAILED) {
      const updated = await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: JobStatus.QUEUED,
          attempts: 0,
          run_after: new Date(),
          locked_at: null,
          last_error: null,
          payload: payload ?? existing.payload,
        },
      });

      return { id: updated.id, type: updated.type, status: updated.status };
    }

    return { id: existing.id, type: existing.type, status: existing.status };
  }

  const created = await prisma.job.create({
    data: {
      video_id: videoId,
      type,
      status: JobStatus.QUEUED,
      payload,
    },
  });

  return { id: created.id, type: created.type, status: created.status };
}

export async function claimNextJob(): Promise<JobRow | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<JobRow[]>(Prisma.sql`
      SELECT id, video_id, type, status, attempts, max_attempts, run_after, locked_at, payload
      FROM jobs
      WHERE status = 'QUEUED' AND run_after <= NOW()
      ORDER BY run_after ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (rows.length === 0) {
      return null;
    }

    const job = rows[0];

    const updated = await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.RUNNING,
        attempts: { increment: 1 },
        locked_at: new Date(),
      },
    });

    return {
      id: updated.id,
      video_id: updated.video_id,
      type: updated.type,
      status: updated.status,
      attempts: updated.attempts,
      max_attempts: updated.max_attempts,
      run_after: updated.run_after,
      locked_at: updated.locked_at,
      payload: updated.payload,
    };
  });
}

export async function requeueJob(
  jobId: string,
  runAfter: Date,
  decrementAttempt: boolean
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.QUEUED,
      run_after: runAfter,
      locked_at: null,
      attempts: decrementAttempt ? { decrement: 1 } : undefined,
    },
  });
}

export async function markJobSucceeded(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.SUCCEEDED,
      locked_at: null,
      last_error: null,
    },
  });
}

export async function markJobFailed(
  jobId: string,
  error: string,
  maxAttempts: number,
  attempts: number
): Promise<JobStatus> {
  if (attempts >= maxAttempts) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        locked_at: null,
        last_error: error,
      },
    });

    return JobStatus.FAILED;
  }

  const delaySeconds = attempts === 1 ? 10 : attempts === 2 ? 30 : 60;
  const runAfter = new Date(Date.now() + delaySeconds * 1000);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.QUEUED,
      run_after: runAfter,
      locked_at: null,
      last_error: error,
    },
  });

  return JobStatus.QUEUED;
}

export async function hasSuccessfulJob(
  videoId: string,
  type: JobType
): Promise<boolean> {
  const job = await prisma.job.findFirst({
    where: { video_id: videoId, type, status: JobStatus.SUCCEEDED },
    select: { id: true },
  });

  return Boolean(job);
}
