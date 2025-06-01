require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const Database = require('better-sqlite3');

// Load Discord bot helpers
const { client: discordClient, getUserRoles } = require('./bot/bot');
const { onPunishmentLoggedDashboard } = require('./bot/events/punishmentLogged');

const app = express();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DASHBOARD_ACCESS_ROLE,
  LOG_CHANNEL_ID,
  PUNISHMENT_DM_USER,
  SESSION_SECRET,
  PORT = 3000,
  REMOVE_INFRACTION_ROLE,
  BAN_PERMISSION_ROLE,
  OWNER_ID,
  COMMUNITY_MANAGER_ID
} = process.env;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Infractions DB (Roblox dashboard)
const dbPath = path.join(dataDir, 'infractions.db');
const db = new Database(dbPath);
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

// Moderators DB
const dbMod = new Database(path.join(dataDir, 'moderators.db'));
dbMod.exec(`
  CREATE TABLE IF NOT EXISTS moderators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    robloxId TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL
  )
`);

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth2 Login
app.get('/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent('http://localhost:3000/auth/discord/callback');
    const scope = encodeURIComponent('identify');
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided.');
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'http://localhost:3000/auth/discord/callback',
            scope: 'identify'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${access_token}` }
        });
        const userId = userResponse.data.id;
        const userRoles = await getUserRoles(discordClient, userId);
        if (!Array.isArray(userRoles) || !userRoles.includes(DASHBOARD_ACCESS_ROLE)) {
            return res.redirect('/unauthorized');
        }
        req.session.user = { accessToken: access_token, discordId: userId };
        res.redirect('/dashboard');
    } catch (err) {
        console.error('OAuth Error:', err.message);
        res.status(500).send('OAuth failed.');
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/unauthorized', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'unauthorized.html'));
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => {});
    res.redirect('/');
});

// API: Get current user Discord profile
app.get('/api/me', async (req, res) => {
    if (!req.session.user) return res.json({});
    try {
        const user = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${req.session.user.accessToken}` }
        });
        let avatar = user.data.avatar
            ? `https://cdn.discordapp.com/avatars/${user.data.id}/${user.data.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        res.json({
            username: user.data.username,
            discriminator: user.data.discriminator,
            id: user.data.id,
            avatar
        });
    } catch {
        res.json({});
    }
});

// API: Get roles for sidebar visibility
app.get('/api/roles', async (req, res) => {
    const { discordId } = req.query;
    if (!discordId) return res.json({ roles: [] });
    try {
        const roles = await getUserRoles(discordClient, discordId);
        res.json({ roles });
    } catch {
        res.json({ roles: [] });
    }
});

// API: Community manager check
app.get('/api/is-community-manager', async (req, res) => {
    if (!req.session.user) return res.json({ isCM: false });
    const roles = await getUserRoles(discordClient, req.session.user.discordId);
    res.json({ isCM: roles.includes(COMMUNITY_MANAGER_ID) });
});

// API: Moderator list
app.get('/api/moderators', async (req, res) => {
    if (!req.session.user) return res.status(401).json({error: "Unauthorized"});
    const roles = await getUserRoles(discordClient, req.session.user.discordId);
    if (!roles.includes(COMMUNITY_MANAGER_ID)) return res.status(403).json({error: "Forbidden"});
    const mods = dbMod.prepare('SELECT * FROM moderators ORDER BY username COLLATE NOCASE').all();
    res.json(mods);
});
// API: Add moderator
app.post('/api/moderators', async (req, res) => {
    if (!req.session.user) return res.status(401).json({error: "Unauthorized"});
    const roles = await getUserRoles(discordClient, req.session.user.discordId);
    if (!roles.includes(COMMUNITY_MANAGER_ID)) return res.status(403).json({error: "Forbidden"});
    const { robloxId, username } = req.body;
    if (!robloxId || !username) return res.status(400).json({error: "robloxId and username required"});
    try {
        dbMod.prepare('INSERT OR IGNORE INTO moderators (robloxId, username) VALUES (?, ?)').run(String(robloxId), username);
        res.json({success:true});
    } catch (e) {
        res.status(500).json({error: "DB error"});
    }
});
// API: Remove moderator
app.post('/api/remove-moderator', async (req, res) => {
    if (!req.session.user) return res.status(401).json({error: "Unauthorized"});
    const roles = await getUserRoles(discordClient, req.session.user.discordId);
    if (!roles.includes(COMMUNITY_MANAGER_ID)) return res.status(403).json({error: "Forbidden"});
    const { robloxId } = req.body;
    if (!robloxId) return res.status(400).json({error: "robloxId required"});
    try {
        const info = dbMod.prepare('DELETE FROM moderators WHERE robloxId = ?').run(String(robloxId));
        if (info.changes === 0) return res.status(404).json({error: "Moderator not found"});
        res.json({success:true});
    } catch (e) {
        res.status(500).json({error: "DB error"});
    }
});

// API: Log a Punishment
app.post('/api/log-punishment', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    const data = req.body;
    const requiredFields = {
        warning: ['username', 'robloxId', 'reason'],
        kick: ['username', 'robloxId', 'reason'],
        ban: ['username', 'robloxId', 'reason', 'evidence', 'banType']
    };
    const missing = (requiredFields[data.type] || []).filter(f => !data[f]);
    if (missing.length > 0) {
        return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }
    if (data.type === "ban") {
        if (data.banType === "temporary" && !data.duration) {
            return res.status(400).json({ error: "Duration required for a temporary ban." });
        }
        if (data.banType === "permanent") {
            data.duration = "";
        }
    }
    if (data.type === "ban") {
        const userRoles = await getUserRoles(discordClient, req.session.user.discordId);
        if (
            !userRoles.includes(BAN_PERMISSION_ROLE) &&
            req.session.user.discordId !== OWNER_ID
        ) {
            return res.status(403).json({ error: "You do not have permission to log bans." });
        }
    }
    db.prepare(`
        INSERT INTO infractions (type, username, robloxId, reason, evidence, duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        data.type,
        data.username,
        data.robloxId,
        data.reason || null,
        data.evidence || null,
        data.type === "ban" ? data.duration || null : data.duration || null
    );
    try {
        await onPunishmentLoggedDashboard({
            discordClient,
            robloxId: data.robloxId,
            robloxUsername: data.username,
            type: data.type
        });
    } catch (err) {
        console.error("onPunishmentLogged error:", err);
    }
    res.json({
        success: true,
        robloxLink: `https://www.roblox.com/users/${data.robloxId}/profile`
    });
});

app.get('/api/logs', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    let logs = db.prepare('SELECT * FROM infractions ORDER BY timestamp DESC').all();
    let canDelete = false;
    if (req.session.user) {
        const roles = await getUserRoles(discordClient, req.session.user.discordId);
        canDelete = roles.includes(REMOVE_INFRACTION_ROLE) || req.session.user.discordId === OWNER_ID;
    }
    logs = logs.map(l => ({ ...l, canDelete }));
    res.json(logs);
});

app.get('/api/lookup', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { robloxId, username } = req.query;
    if (!robloxId && !username) return res.json({ error: "Provide robloxId or username" });
    let stmt, infractions;
    if (robloxId) {
        stmt = db.prepare('SELECT * FROM infractions WHERE robloxId = ? ORDER BY timestamp DESC');
        infractions = stmt.all(robloxId);
    } else {
        stmt = db.prepare('SELECT * FROM infractions WHERE username = ? ORDER BY timestamp DESC');
        infractions = stmt.all(username);
    }
    res.json({
        userId: infractions[0]?.robloxId || robloxId || null,
        infractions
    });
});

app.post('/api/delete-infraction', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing infraction ID' });
    const roles = await getUserRoles(discordClient, req.session.user.discordId);
    const allowed = roles.includes(REMOVE_INFRACTION_ROLE) || req.session.user.discordId === OWNER_ID;
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to remove this infraction.' });
    const entry = db.prepare('SELECT * FROM infractions WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Infraction not found' });
    const info = db.prepare('DELETE FROM infractions WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Not deleted' });
    try {
        const owner = await discordClient.users.fetch(PUNISHMENT_DM_USER);
        await owner.send(`Punishment #${id} [${entry.type}] for ${entry.username} (Roblox ID: ${entry.robloxId}) was removed by <@${req.session.user.discordId}>.`);
    } catch (err) {}
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});