const Database = require('better-sqlite3');
const db = new Database('./data/infractions.db'); // Adjust path if needed

try {
    db.exec("ALTER TABLE infractions ADD COLUMN evidence TEXT");
    console.log('✅ Added evidence column to infractions table.');
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log('ℹ️ Column evidence already exists.');
    } else {
        console.error(e);
    }
}