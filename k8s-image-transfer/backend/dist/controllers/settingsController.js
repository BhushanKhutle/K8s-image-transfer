"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = void 0;
const database_1 = __importDefault(require("../db/database"));
exports.settingsController = {
    async getSettings(req, res) {
        try {
            const rows = database_1.default.prepare('SELECT key, value FROM settings').all();
            const settings = {};
            for (const row of rows) {
                settings[row.key] = row.value;
            }
            res.json({ settings });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async updateSettings(req, res) {
        try {
            const updates = req.body;
            const stmt = database_1.default.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);
            const transaction = database_1.default.transaction(() => {
                for (const [key, value] of Object.entries(updates)) {
                    stmt.run(key, value);
                }
            });
            transaction();
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
};
//# sourceMappingURL=settingsController.js.map