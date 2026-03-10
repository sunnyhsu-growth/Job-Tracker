import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProspectSchema, STATUSES, INTEREST_LEVELS } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/prospects", async (_req, res) => {
    const prospects = await storage.getAllProspects();
    res.json(prospects);
  });

  app.post("/api/prospects", async (req, res) => {
    const parsed = insertProspectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map((e) => e.message).join(", ") });
    }
    const prospect = await storage.createProspect(parsed.data);
    res.status(201).json(prospect);
  });

  app.patch("/api/prospects/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid prospect ID" });
    }

    const existing = await storage.getProspect(id);
    if (!existing) {
      return res.status(404).json({ message: "Prospect not found" });
    }

    const body = req.body;
    const updates: Record<string, unknown> = {};

    if (body.companyName !== undefined) updates.companyName = body.companyName;
    if (body.roleTitle !== undefined) updates.roleTitle = body.roleTitle;
    if (body.jobUrl !== undefined) updates.jobUrl = body.jobUrl;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.referralName !== undefined) {
      updates.referralName = (typeof body.referralName === "string" && body.referralName.trim()) ? body.referralName.trim() : null;
    }
    if (body.referralEmail !== undefined) {
      const email = typeof body.referralEmail === "string" ? body.referralEmail.trim() : "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid referral email address" });
      }
      updates.referralEmail = email || null;
    }
    if (body.referralLinkedin !== undefined) {
      const url = typeof body.referralLinkedin === "string" ? body.referralLinkedin.trim() : "";
      if (url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ message: "Referral LinkedIn must be a valid URL starting with http(s)" });
      }
      updates.referralLinkedin = url || null;
    }
    if (body.salary !== undefined) {
      if (body.salary !== null && (typeof body.salary !== "number" || !Number.isFinite(body.salary) || !Number.isInteger(body.salary) || body.salary < 0)) {
        return res.status(400).json({ message: "Salary must be a non-negative integer" });
      }
      updates.salary = body.salary;
    }

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(", ")}` });
      }
      updates.status = body.status;
    }

    if (body.interestLevel !== undefined || body.interest_level !== undefined) {
      const level = body.interestLevel ?? body.interest_level;
      if (!INTEREST_LEVELS.includes(level)) {
        return res.status(400).json({ message: `Interest level must be one of: ${INTEREST_LEVELS.join(", ")}` });
      }
      updates.interestLevel = level;
    }

    const updated = await storage.updateProspect(id, updates);
    res.json(updated);
  });

  app.delete("/api/prospects/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid prospect ID" });
    }

    const deleted = await storage.deleteProspect(id);
    if (!deleted) {
      return res.status(404).json({ message: "Prospect not found" });
    }

    res.status(204).send();
  });

  return httpServer;
}
