const Database = require('better-sqlite3');
const db = new Database('./data/infractions.db'); // Change path if needed

try {
    db.exec("ALTER TABLE infractions ADD COLUMN username TEXT NOT NULL DEFAULT ''");
    console.log('✅ Added username column to infractions table.');
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log('ℹ️ Column username already exists.');
    } else {
        console.error(e);
    }
}