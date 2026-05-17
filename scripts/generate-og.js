import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, '_posts');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'og');
const PKG = path.join(ROOT, 'node_modules');

function woff(pkg, file) {
  return fs.readFileSync(path.join(PKG, pkg, file));
}

const fonts = [
  { name: 'IBM Plex Sans', weight: 400, data: woff('@ibm/plex', 'IBM-Plex-Sans/fonts/complete/woff/IBMPlexSans-Regular.woff') },
  { name: 'IBM Plex Sans', weight: 700, data: woff('@ibm/plex', 'IBM-Plex-Sans/fonts/complete/woff/IBMPlexSans-Bold.woff') },
  { name: 'Unbounded', weight: 700, data: woff('@fontsource/unbounded', 'files/unbounded-latin-700-normal.woff') },
  { name: 'Unbounded', weight: 700, data: woff('@fontsource/unbounded', 'files/unbounded-cyrillic-700-normal.woff') },
];

async function generate(title, tag, description, outPath) {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', width: 1200, height: 630, background: '#fff' },
        children: [
          { type: 'div', props: { style: { height: 8, background: '#1A3D7C' } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 60px 0' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontFamily: 'Unbounded', fontWeight: 700, fontSize: 40, color: '#1A1A1A', lineHeight: 1.1 },
                    children: 'Соловей'
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: { fontFamily: 'IBM Plex Sans', fontWeight: 400, fontSize: 16, color: '#6B6B6B', marginTop: 8 },
                    children: 'про менеджмент, особисту ефективність і трішки про AI'
                  }
                },
                { type: 'div', props: { style: { height: 80 } } },
                ...(tag ? [{
                  type: 'div',
                  props: {
                    style: { fontFamily: 'IBM Plex Sans', fontWeight: 400, fontSize: 16, color: '#1A3D7C', marginBottom: 14, letterSpacing: '0.06em' },
                    children: `# ${tag.toUpperCase()}`
                  }
                }] : []),
                {
                  type: 'div',
                  props: {
                    style: { fontFamily: 'IBM Plex Sans', fontWeight: 700, fontSize: 56, color: '#1A1A1A', lineHeight: 1.2 },
                    children: title
                  }
                },
                ...(description ? [{
                  type: 'div',
                  props: {
                    style: { fontFamily: 'IBM Plex Sans', fontWeight: 400, fontSize: 20, color: '#6B6B6B', marginTop: 16, lineHeight: 1.4 },
                    children: description.length > 100 ? description.slice(0, 100) + '…' : description
                  }
                }] : [])
              ]
            }
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', padding: '0 60px 36px' },
              children: [
                { type: 'div', props: { style: { height: 1, background: '#E5E5E5', marginBottom: 14 } } },
                { type: 'div', props: { style: { fontFamily: 'IBM Plex Sans', fontWeight: 400, fontSize: 14, color: '#6B6B6B' }, children: 'solovey' } }
              ]
            }
          }
        ]
      }
    },
    { width: 1200, height: 630, fonts }
  );

  fs.writeFileSync(outPath, new Resvg(svg).render().asPng());
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
for (const file of posts) {
  const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
  const outPath = path.join(OUTPUT_DIR, `${slug}.png`);
  if (fs.existsSync(outPath)) { console.log(`skip  ${slug}`); continue; }
  const { data } = matter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
  await generate(data.title, data.tags?.[0] ?? null, data.excerpt ?? null, outPath);
  console.log(`gen   ${slug}`);
}
