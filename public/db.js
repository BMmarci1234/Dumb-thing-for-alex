const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Create data directory if not exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
const dbPath = path.join(dataDir, 'infractions.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS infractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        username TEXT NOT NULL,
        robloxId TEXT NOT NULL,
        reason TEXT,
        evidence TEXT,
        duration TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Add a new infraction
function addInfraction(data) {
    const stmt = db.prepare(`
        INSERT INTO infractions (type, username, robloxId, reason, evidence, duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
        data.type,
        data.username,
        data.robloxId,
        data.reason || null,
        data.evidence || null,
        data.duration || null
    );
    return { id: info.lastInsertRowid, ...data };
}

// Get all infractions for a user (by robloxId)
function getInfractionsByRobloxId(robloxId) {
    const stmt = db.prepare('SELECT * FROM infractions WHERE robloxId = ? ORDER BY timestamp DESC');
    return stmt.all(robloxId);
}

// (Optional) Get by username
function getInfractionsByUsername(username) {
    const stmt = db.prepare('SELECT * FROM infractions WHERE username = ? ORDER BY timestamp DESC');
    return stmt.all(username);
}

// Delete infraction by id
function deleteInfraction(id) {
    const stmt = db.prepare('DELETE FROM infractions WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
}

module.exports = {
    addInfraction,
    getInfractionsByRobloxId,
    getInfractionsByUsername,
    deleteInfraction,
    db
};