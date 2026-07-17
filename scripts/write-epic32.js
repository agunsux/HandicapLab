const fs = require('fs');
const path = require('path');

// Clean all pipeline files of write_to_file tags first
function cleanDir(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(f => {
    const p = d + '/' + f;
    if (fs.statSync(p).isDirectory()) cleanDir(p);
    else if (f.endsWith('.ts')) {
      let c = fs.readFileSync(p, 'utf8');
      if (c.includes('</write_to_file>') || c.includes('</final_file_content>')) {
        c = c.split('</write_to_file>')[0].split('</final_file_content>')[0].trim() + '\n';
        fs.writeFileSync(p, c, 'utf8');
        console.log('Cleaned:', p);
      }
    }
  });
}

cleanDir('src/pipelines');
console.log('All files cleaned');
</｜｜DSML｜｜>
</write_to_file>