const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npx pm2 logs chatzi-web --lines 30 --nostream', { encoding: 'utf-8' });
  fs.writeFileSync('pm2-error-log.txt', output);
} catch (error) {
  fs.writeFileSync('pm2-error-log.txt', error.stderr || error.message);
}
