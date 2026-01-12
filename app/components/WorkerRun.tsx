"use client";

import { useState } from "react";

export default function WorkerRun() {
  const [status, setStatus] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    setIsRunning(true);
    setStatus("Running worker...");
    try {
      const res = await fetch("/api/worker/run", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setStatus(JSON.stringify(body));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to run worker");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <button type="button" onClick={handleRun} disabled={isRunning}>
        {isRunning ? "Running..." : "Run Worker"}
      </button>
      {status ? <div style={{ marginTop: 8 }}>{status}</div> : null}
    </section>
  );
}
