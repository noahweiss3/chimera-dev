// Filled-in route: simulating a completed implementation.
import { Router } from "express";
import { db, schema } from "../db/client.js";

const router = Router();
router.get("/", async (_req, res) => {
  const rows = await db.select().from(schema.projects);
  res.json(rows);
});
router.post("/", async (req, res) => {
  const [row] = await db.insert(schema.projects).values(req.body).returning();
  res.status(201).json(row);
});
export default router;
