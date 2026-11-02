// Developer tool: exports the procedural body as OBJ files so its shape can be inspected outside the browser.
import { buildAnatomy } from '../src/body/anatomy'
import { writeFileSync } from 'node:fs'
const g = buildAnatomy(); let out = '', off = 1
g.forEach((geo, id) => {
  const p = geo.getAttribute('position'); out += `o ${id}\n`
  for (let i = 0; i < p.count; i++) out += `v ${p.getX(i)} ${p.getY(i)} ${p.getZ(i)}\n`
  const ix = geo.getIndex()!; for (let i = 0; i < ix.count; i += 3) out += `f ${ix.getX(i) + off} ${ix.getX(i + 1) + off} ${ix.getX(i + 2) + off}\n`
  off += p.count
})
writeFileSync(process.argv[2] ?? '/tmp/body.obj', out); console.log('groups', [...g.keys()].join(','), 'verts', off - 1)
