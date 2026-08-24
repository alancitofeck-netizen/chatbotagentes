import { timingSafeEqual } from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import { config } from "./config.js";
import { startJob, cancelJob, runningCount } from "./jobManager.js";

function verifySharedSecret(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBuf = Buffer.from(config.workerSecret);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, runningJobs: runningCount() }));

  app.use(verifySharedSecret);

  app.post("/jobs", async (req, res) => {
    const { jobId, workspaceId, connectionId } = req.body as { jobId?: string; workspaceId?: string; connectionId?: string };
    if (!jobId || !workspaceId || !connectionId) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }
    try {
      await startJob(jobId, workspaceId, connectionId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(`[controlApi] failed to start job ${jobId}:`, err);
      const message = err instanceof Error ? err.message : "start_failed";
      if (message.startsWith("max_concurrent_jobs_reached")) {
        res.status(503).json({ error: message });
        return;
      }
      res.status(500).json({ error: "start_failed" });
    }
  });

  app.post("/jobs/:jobId/cancel", async (req, res) => {
    const { jobId } = req.params;
    try {
      await cancelJob(jobId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(`[controlApi] failed to cancel job ${jobId}:`, err);
      res.status(500).json({ error: "cancel_failed" });
    }
  });

  return app;
}
