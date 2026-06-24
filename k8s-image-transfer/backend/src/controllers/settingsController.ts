import { Request, Response } from 'express';
import db from '../db/database';

export const settingsController = {
  async getSettings(req: Request, res: Response) {
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json({ settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateSettings(req: Request, res: Response) {
    try {
      const updates = req.body as Record<string, string>;
      const stmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const transaction = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          stmt.run(key, value);
        }
      });

      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
