const fs = require('fs');
const readline = require('readline');
const path = require('path');

const transcriptPath = 'C:/Users/14598/.claude/projects/c--Users-14598-Documents-workspace-----/fd0d0c9b-1c21-4313-8a7b-7c559897a425.jsonl';
const outputDir = 'C:/Users/14598/Documents/workspace/教育项目/public';

let largest = null;
let last = null;
let lineCount = 0;

function getImageData(contentItem) {
  // Anthropic-style image content block
  if (contentItem.type === 'image' && contentItem.source) {
    const s = contentItem.source;
    if (s.type === 'base64' && s.data) {
      return { mime: s.media_type || 'image/png', b64: s.data };
    }
  }
  // OpenAI-style image_url
  if (contentItem.type === 'image_url' && contentItem.image_url && contentItem.image_url.url) {
    const url = contentItem.image_url.url;
    const m = url.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (m) return { mime: `image/${m[1]}`, b64: m[2] };
  }
  // Generic data URI inside text
  if (typeof contentItem.text === 'string') {
    const m = contentItem.text.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (m) return { mime: `image/${m[1]}`, b64: m[2] };
  }
  return null;
}

function record(info, lineNum) {
  const entry = { ...info, lineNum };
  last = entry;
  if (!largest || info.b64.length > largest.b64.length) {
    largest = entry;
  }
}

async function run() {
  const stream = fs.createReadStream(transcriptPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      continue;
    }

    const isUser = obj.type === 'user' || obj.message?.role === 'user';
    if (!isUser) continue;

    const content = obj.message?.content || obj.content;
    if (!Array.isArray(content)) continue;

    for (const item of content) {
      const info = getImageData(item);
      if (info) record(info, lineCount);
    }
  }

  console.log(`Processed ${lineCount} lines.`);
  console.log(`User image content blocks found: ${largest ? 1 : 0}`);
  if (largest) {
    console.log(`Largest image: line ${largest.lineNum}, mime=${largest.mime}, base64 length=${largest.b64.length}`);
  }
  if (last && last !== largest) {
    console.log(`Last image: line ${last.lineNum}, mime=${last.mime}, base64 length=${last.b64.length}`);
  }

  const target = largest || last;
  if (!target) {
    console.error('No image attachments found in user messages.');
    process.exitCode = 1;
    return;
  }

  const mime = target.mime.toLowerCase();
  const ext = mime.includes('png') ? 'png' : (mime.includes('webp') ? 'webp' : 'jpg');
  const outputPath = path.join(outputDir, `clinic-bg.${ext}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const buffer = Buffer.from(target.b64, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved image to ${outputPath}`);
  console.log(`File size: ${buffer.length} bytes`);
  console.log(`MIME type: ${mime}`);

  let dims = null;
  if (ext === 'png') {
    if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
      dims = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
  } else if (ext === 'webp') {
    // Simple WebP dimension parse for VP8/VP8L/VP8X
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
        dims = {
          width: buffer.readUInt16LE(26) & 0x3fff,
          height: buffer.readUInt16LE(28) & 0x3fff
        };
      } else if (chunk === 'VP8L' && buffer[20] === 0x2f) {
        const bits = buffer.readUInt32LE(21);
        dims = {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1
        };
      } else if (chunk === 'VP8X') {
        dims = {
          width: (buffer.readUInt32LE(24) & 0x00ffffff) + 1,
          height: (buffer.readUInt32LE(27) & 0x00ffffff) + 1
        };
      }
    }
  } else {
    let offset = 2;
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xFF) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xD8) { offset += 2; continue; }
      if (marker === 0xD9) break;
      if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        dims = { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        break;
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }

  if (dims) {
    console.log(`Dimensions: ${dims.width}x${dims.height}`);
  } else {
    console.log('Dimensions: could not determine');
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
