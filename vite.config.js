import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Subresource Integrity: agrega hash sha384 a los <script>/<link> de index.html,
// calculado sobre los archivos finales en disco (el plugin @small-tech/vite-plugin-sri
// calculaba el hash antes de que Vite 8 terminara de escribir el bundle y no coincidía).
function sri() {
  let outDir
  return {
    name: 'sri-final-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const htmlPath = join(outDir, 'index.html')
      const html = readFileSync(htmlPath, 'utf8').replace(
        /<(script|link)\b([^>]*?)\s(src|href)="\/(assets\/[^"]+\.(?:js|css))"([^>]*)>/g,
        (tag, element, before, attr, file, after) => {
          if (tag.includes('integrity=')) return tag
          const hash = createHash('sha384').update(readFileSync(join(outDir, file))).digest('base64')
          return `<${element}${before} ${attr}="/${file}"${after} integrity="sha384-${hash}">`
        },
      )
      writeFileSync(htmlPath, html)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sri()],
})
