const fs = require('fs');
const readline = require('readline');

const jsonlPath = 'C:/Users/14598/.claude/projects/c--Users-14598-Documents-workspace-----/fd0d0c9b-1c21-4313-8a7b-7c559897a425.jsonl';
const outDir = 'C:/Users/14598/Documents/workspace/教育项目/extracted_images';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const dataUriRe = /data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)/g;

let count = 0;
const seen = new Set();

const stream = fs.createReadStream(jsonlPath, { encoding: 'utf8' });
const rl = readline.createInterface({ input: stream });

rl.on('line', line => {
  let m;
  while ((m = dataUriRe.exec(line)) !== null) {
    const base64 = m[2];
    if (seen.has(base64)) continue;
    seen.add(base64);
    const ext = m[1];
    const buf = Buffer.from(base64, 'base64');
    const filename = `${outDir}/img_${String(count).padStart(3, '0')}.${ext}`;
    fs.writeFileSync(filename, buf);
    console.log(`Saved ${filename} (${buf.length} bytes)`);
    count++;
  }
});

rl.on('close', () => {
  console.log(`Done, extracted ${count} images`);
});
