const fs = require('fs');
const path = require('path');

function loadCommandsFrom(dir) {
    let commands = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            commands = commands.concat(loadCommandsFrom(fullPath));
        } else if (file.isFile() && file.name.endsWith('.js')) {
            commands.push(fullPath);
        }
    }
    return commands;
}

module.exports = loadCommandsFrom;