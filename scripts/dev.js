import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env: process.env }),
]
let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = code
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Could not start a development process: ${error.message}`)
    shutdown(1)
  })
  child.on('exit', (code) => {
    if (!shuttingDown) shutdown(code || 0)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
