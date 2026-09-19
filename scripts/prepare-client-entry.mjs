import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(projectRoot, 'index.html')
const clientPath = path.join(projectRoot, 'client', 'index.html')
const source = fs.readFileSync(sourcePath, 'utf8')
const clientEntry = source.replace('./client/src/main.jsx', './src/main.jsx')
fs.writeFileSync(clientPath, clientEntry)