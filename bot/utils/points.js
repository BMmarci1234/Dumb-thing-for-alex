const fs = require('fs');
const path = require('path');
const dbFile = path.join(__dirname, '../../data/circlePoints.json');
let circlePoints = {};
if (fs.existsSync(dbFile)) circlePoints = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
function saveDB() { fs.writeFileSync(dbFile, JSON.stringify(circlePoints, null, 2)); }

const POINTS = { warning: 3, mute: 4, kick: 6, tempban: 8 };

async function addPoints(userId, type) {
  if (!POINTS[type]) return getPoints(userId);
  if (!circlePoints[userId]) circlePoints[userId] = 0;
  circlePoints[userId] += POINTS[type];
  saveDB();
  return circlePoints[userId];
}

async function removePoints(userId, type) {
  if (!POINTS[type]) return getPoints(userId);
  if (!circlePoints[userId]) circlePoints[userId] = 0;
  circlePoints[userId] -= POINTS[type];
  if (circlePoints[userId] < 0) circlePoints[userId] = 0;
  saveDB();
  return circlePoints[userId];
}

function getPoints(userId) {
  return circlePoints[userId] || 0;
}

module.exports = { addPoints, getPoints, removePoints };