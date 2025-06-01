const Database = require('better-sqlite3');
const db = new Database('./data/infractions.db'); // make sure this path is correct

try {
    db.exec("ALTER TABLE infractions ADD COLUMN robloxId TEXT NOT NULL DEFAULT ''");
    console.log('✅ Added robloxId column to infractions table.');
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log('ℹ️ Column robloxId already exists.');
    } else {
        console.error(e);
    }
}