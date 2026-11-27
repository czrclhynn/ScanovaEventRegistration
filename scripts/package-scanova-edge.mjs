import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const output = new URL('../.tmp-scanova-edge/', import.meta.url)
const root = new URL('../', import.meta.url)
const dependencies = ['auth', 'db', 'email', 'http', 'registration', 'router', 'staff', 'tickets', 'types']
const { dependencies: versions } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const replacements = {
  'next/server': './index.mjs',
  'next/headers': './index.mjs',
  '@supabase/ssr': 'npm:@supabase/ssr@' + versions['@supabase/ssr'],
  pg: 'npm:pg@' + versions.pg,
  qrcode: 'npm:qrcode@' + versions.qrcode,
}

const files = await Promise.all(dependencies.map(async (name) => {
  const source = await readFile(new URL('src/lib/scanova/' + name + '.ts', root), 'utf8')
  const imports = source.replace(/^import 'server-only'\r?\n/gm, '')
    .replace(/from '([^']+)'/g, (full, specifier) => {
      if (replacements[specifier]) return "from '" + replacements[specifier] + "'"
      if (specifier.startsWith('./') && dependencies.includes(specifier.slice(2))) return "from '" + specifier + ".ts'"
      return full
    })
  return {
    name: name + '.ts',
    content: "import process from 'node:process'\nimport { runtimeValue } from './index.mjs'\nimport { Buffer } from 'node:buffer'\n" +
      imports.replace(/process\.env\.([A-Z0-9_]+)/g, (_, name) => "runtimeValue('" + name + "')"),
  }
}))
files.push({ name: 'index.mjs', content: await readFile(new URL('supabase/functions/scanova-api/index.mjs', root), 'utf8') })
await mkdir(output, { recursive: true })
await writeFile(new URL('files.json', output), JSON.stringify(files))
for (const { name, content } of files) await writeFile(new URL(join('.', name), output), content)
