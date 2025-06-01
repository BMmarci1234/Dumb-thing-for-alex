module.exports = function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhdw])$/i;
  const match = str.match(regex);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    case 'w': return n * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
};