const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Create data directory if not exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
const dbPath = path.join(dataDir, 'infractions_discord.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS infractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        moderator TEXT,
        reason TEXT,
        duration TEXT,
        circle INTEGER DEFAULT 1,
        timestamp INTEGER NOT NULL
    )
`);

// Add a new infraction
function addInfraction(userId, infraction) {
    const stmt = db.prepare(`
        INSERT INTO infractions (userId, type, moderator, reason, duration, circle, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
        userId,
        infraction.type,
        infraction.moderator || '',
        infraction.reason || '',
        infraction.duration || '',
        infraction.circle === false ? 0 : 1,
        infraction.timestamp || Date.now()
    );
    return { id: info.lastInsertRowid, userId, ...infraction };
}

// Get all infractions for a user
function getInfractions(userId) {
    const stmt = db.prepare('SELECT * FROM infractions WHERE userId = ? ORDER BY timestamp DESC');
    return stmt.all(userId);
}

// Delete infraction by id and return the deleted infraction object if found, otherwise null
function deleteInfraction(id) {
    const select = db.prepare('SELECT * FROM infractions WHERE id = ?').get(id);
    if (!select) return null;
    const stmt = db.prepare('DELETE FROM infractions WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0 ? select : null;
}

module.exports = {
    addInfraction,
    getInfractions,
    deleteInfraction,
    db
};