
const fs = require('fs');
try {
    require('./backend/server.js');
} catch (error) {
    const log = `
  Message: ${error.message}
  Code: ${error.code}
  Stack: ${error.stack}
  `;
    fs.writeFileSync('debug-error.txt', log);
}
