const fs = require('fs');
const content = 'TEST FILE WRITE ' + Date.now();
fs.writeFileSync('C:/Users/RYZEN/.antigravity-ide/handicaplab/test_write.txt', content, 'utf8');
console.log('Written:', content);
