// Simple persistent tempban storage using JSON

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../../data/tempbans.json');

let tempbans = {};
if (fs.existsSync(file)) tempbans = JSON.parse(fs.readFileSync(file, 'utf8'));

function save() { fs.writeFileSync(file, JSON.stringify(tempbans, null, 2)); }

function addTempban(guildId, userId, unbanAt, reason) {
  tempbans[`${guildId}:${userId}`] = { guildId, userId, unbanAt, reason };
  save();
}

function removeTempban(guildId, userId) {
  delete tempbans[`${guildId}:${userId}`];
  save();
}

function getAll() {
  return Object.values(tempbans);
}

module.exports = { addTempban, removeTempban, getAll };