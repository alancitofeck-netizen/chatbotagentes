import { timingSafeEqual } from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import { config } from "./config.js";
import { startSession, logoutSession, sendTextMessage } from "./sessionManager.js";

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

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  app.use(verifySharedSecret);

  app.post("/sessions/:sessionId/start", async (req, res) => {
    const { sessionId } = req.params;
    const { workspaceId, memberId } = req.body as { workspaceId?: string; memberId?: string };
    if (!workspaceId || !memberId) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }
    try {
      await startSession(sessionId, workspaceId, memberId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(`[controlApi] failed to start session ${sessionId}:`, err);
      res.status(500).json({ error: "start_failed" });
    }
  });

  app.post("/sessions/:sessionId/logout", async (req, res) => {
    const { sessionId } = req.params;
    try {
      await logoutSession(sessionId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(`[controlApi] failed to logout session ${sessionId}:`, err);
      res.status(500).json({ error: "logout_failed" });
    }
  });

  app.post("/sessions/:sessionId/send", async (req, res) => {
    const { sessionId } = req.params;
    const { to, body } = req.body as { to?: string; body?: string };
    if (!to || !body) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }
    try {
      const result = await sendTextMessage(sessionId, to, body);
      res.status(200).json(result);
    } catch (err) {
      console.error(`[controlApi] failed to send via session ${sessionId}:`, err);
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "send_failed" });
    }
  });

  return app;
}
