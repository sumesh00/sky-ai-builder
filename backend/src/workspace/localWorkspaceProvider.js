const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createSafeEnvironment } = require('../commands/safeEnvironment')
const AppError = require('../utils/AppError')
const WorkspaceProvider = require('./workspaceProvider')
const { WorkspacePathPolicy } = require('./pathPolicy')

const IGNORED_DIRECTORIES = new Set([
  '.ai-builder',
  '.git',
  'build',
  'dist',
  'node_modules',
])

function toWorkspacePath(rootPath, absolutePath) {
  return path.relative(rootPath, absolutePath).split(path.sep).join('/') || '.'
}

function validateInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined) {
    return fallback
  }

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new AppError(
      `${name} must be an integer from ${minimum} to ${maximum}`,
      400,
      'WORKSPACE_OPTION_INVALID',
    )
  }

  return value
}

function ensureTextContent(content) {
  if (typeof content !== 'string') {
    throw new AppError(
      'File content must be a string',
      400,
      'WORKSPACE_CONTENT_INVALID',
    )
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(content)) {
    throw new AppError(
      'Source files cannot contain binary control characters',
      415,
      'WORKSPACE_BINARY_FILE',
    )
  }
}

function ensureBinaryContent(content) {
  if (!Buffer.isBuffer(content)) {
    throw new AppError(
      'Binary file content must be a Buffer',
      400,
      'WORKSPACE_BINARY_CONTENT_INVALID',
    )
  }
}

function looksBinary(buffer) {
  return buffer.includes(0)
}

function stripAnsi(value) {
  return value.replace(/\u001B(?:[@-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}

function terminateProcess(child) {
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    const terminator = spawn(
      'taskkill.exe',
      ['/pid', String(child.pid), '/T', '/F'],
      {
        stdio: 'ignore',
        windowsHide: true,
      },
    )

    const forceTermination = () => {
      if (child.exitCode === null) {
        child.kill('SIGKILL')
      }
    }

    terminator.once('error', forceTermination)
    terminator.once('close', forceTermination)
    terminator.unref()

    const fallback = setTimeout(forceTermination, 1000)
    fallback.unref()
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

class LocalWorkspaceProvider extends WorkspaceProvider {
  constructor({ maxFileBytes, maxListEntries, maxSearchResults, rootPath }) {
    super({ id: 'local' })
    this.maxFileBytes = maxFileBytes
    this.maxListEntries = maxListEntries
    this.maxSearchResults = maxSearchResults
    this.rootPath = path.resolve(rootPath)
    this.pathPolicy = new WorkspacePathPolicy(this.rootPath)
  }

  async getStatus() {
    await this.pathPolicy.initialize()

    return {
      capabilities: [
        'listFiles',
        'readFile',
        'readBinaryFile',
        'writeFile',
        'writeBinaryFile',
        'editFile',
        'searchCode',
        'runCommand',
        'startProcess',
      ],
      mode: 'managed',
      provider: this.id,
      ready: true,
    }
  }

  async listFiles(relativePath = '.', options = {}) {
    const depth = validateInteger(options.depth, 4, 1, 10, 'depth')
    const { absolutePath } = await this.pathPolicy.resolve(relativePath)
    const rootStats = await fs.lstat(absolutePath)

    if (!rootStats.isDirectory()) {
      throw new AppError(
        'The requested workspace path is not a directory',
        400,
        'WORKSPACE_NOT_DIRECTORY',
      )
    }

    const entries = []
    let truncated = false

    const visit = async (directoryPath, currentDepth) => {
      if (truncated) {
        return
      }

      const directoryEntries = await fs.readdir(directoryPath, {
        withFileTypes: true,
      })

      directoryEntries.sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })

      for (const directoryEntry of directoryEntries) {
        if (entries.length >= this.maxListEntries) {
          truncated = true
          return
        }

        if (
          directoryEntry.isDirectory() &&
          IGNORED_DIRECTORIES.has(directoryEntry.name)
        ) {
          continue
        }

        const entryPath = path.join(directoryPath, directoryEntry.name)
        const entryStats = await fs.lstat(entryPath)
        const type = entryStats.isSymbolicLink()
          ? 'symlink'
          : entryStats.isDirectory()
            ? 'directory'
            : entryStats.isFile()
              ? 'file'
              : 'other'

        entries.push({
          path: toWorkspacePath(this.rootPath, entryPath),
          size: type === 'file' ? entryStats.size : null,
          type,
        })

        if (
          type === 'directory' &&
          currentDepth < depth &&
          !IGNORED_DIRECTORIES.has(directoryEntry.name)
        ) {
          await visit(entryPath, currentDepth + 1)
        }
      }
    }

    await visit(absolutePath, 1)

    return {
      entries,
      path: toWorkspacePath(this.rootPath, absolutePath),
      truncated,
    }
  }

  async readFile(relativePath) {
    const { absolutePath } = await this.pathPolicy.resolve(relativePath)
    const stats = await fs.lstat(absolutePath)

    if (!stats.isFile()) {
      throw new AppError(
        'The requested workspace path is not a file',
        400,
        'WORKSPACE_NOT_FILE',
      )
    }

    if (stats.size > this.maxFileBytes) {
      throw new AppError(
        `Files larger than ${this.maxFileBytes} bytes cannot be read`,
        413,
        'WORKSPACE_FILE_TOO_LARGE',
      )
    }

    const buffer = await fs.readFile(absolutePath)

    if (looksBinary(buffer)) {
      throw new AppError(
        'Binary files cannot be read as source code',
        415,
        'WORKSPACE_BINARY_FILE',
      )
    }

    return {
      content: buffer.toString('utf8'),
      path: toWorkspacePath(this.rootPath, absolutePath),
      size: buffer.length,
    }
  }

  async readBinaryFile(relativePath, options = {}) {
    const maxBytes = validateInteger(
      options.maxBytes,
      this.maxFileBytes,
      1,
      10 * 1024 * 1024,
      'maxBytes',
    )
    const { absolutePath } = await this.pathPolicy.resolve(relativePath)
    const stats = await fs.lstat(absolutePath)

    if (!stats.isFile()) {
      throw new AppError(
        'The requested workspace path is not a file',
        400,
        'WORKSPACE_NOT_FILE',
      )
    }

    if (stats.size > maxBytes) {
      throw new AppError(
        `Files larger than ${maxBytes} bytes cannot be read`,
        413,
        'WORKSPACE_FILE_TOO_LARGE',
      )
    }

    return {
      content: await fs.readFile(absolutePath),
      path: toWorkspacePath(this.rootPath, absolutePath),
      size: stats.size,
    }
  }

  async writeFile(relativePath, content, options = {}) {
    ensureTextContent(content)

    const size = Buffer.byteLength(content, 'utf8')

    if (size > this.maxFileBytes) {
      throw new AppError(
        `File content cannot exceed ${this.maxFileBytes} bytes`,
        413,
        'WORKSPACE_FILE_TOO_LARGE',
      )
    }

    const { absolutePath } = await this.pathPolicy.resolve(relativePath, {
      allowMissing: true,
    })

    if (absolutePath === this.rootPath) {
      throw new AppError(
        'A file path is required',
        400,
        'WORKSPACE_PATH_INVALID',
      )
    }

    const existingStats = await fs.lstat(absolutePath).catch((error) => {
      if (error.code === 'ENOENT') {
        return null
      }

      throw error
    })

    if (existingStats?.isDirectory()) {
      throw new AppError(
        'A directory cannot be overwritten as a file',
        400,
        'WORKSPACE_NOT_FILE',
      )
    }

    if (existingStats && !options.overwrite) {
      throw new AppError(
        'The file already exists; use an edit operation or allow overwrite',
        409,
        'WORKSPACE_FILE_EXISTS',
      )
    }

    const parentPath = path.dirname(absolutePath)
    const parentRelativePath = toWorkspacePath(this.rootPath, parentPath)

    await this.pathPolicy.resolve(parentRelativePath, { allowMissing: true })
    await fs.mkdir(parentPath, { recursive: true })
    await this.pathPolicy.resolve(parentRelativePath)
    await fs.writeFile(absolutePath, content, {
      encoding: 'utf8',
      flag: options.overwrite ? 'w' : 'wx',
    })
    await this.pathPolicy.resolve(relativePath)

    return {
      created: !existingStats,
      path: toWorkspacePath(this.rootPath, absolutePath),
      size,
    }
  }

  async writeBinaryFile(relativePath, content, options = {}) {
    ensureBinaryContent(content)
    const maxBytes = validateInteger(
      options.maxBytes,
      this.maxFileBytes,
      1,
      10 * 1024 * 1024,
      'maxBytes',
    )

    if (content.length > maxBytes) {
      throw new AppError(
        `File content cannot exceed ${maxBytes} bytes`,
        413,
        'WORKSPACE_FILE_TOO_LARGE',
      )
    }

    const { absolutePath } = await this.pathPolicy.resolve(relativePath, {
      allowMissing: true,
    })

    if (absolutePath === this.rootPath) {
      throw new AppError(
        'A file path is required',
        400,
        'WORKSPACE_PATH_INVALID',
      )
    }

    const existingStats = await fs.lstat(absolutePath).catch((error) => {
      if (error.code === 'ENOENT') {
        return null
      }

      throw error
    })

    if (existingStats?.isDirectory()) {
      throw new AppError(
        'A directory cannot be overwritten as a file',
        400,
        'WORKSPACE_NOT_FILE',
      )
    }

    if (existingStats && !options.overwrite) {
      throw new AppError(
        'The file already exists; use explicit overwrite permission',
        409,
        'WORKSPACE_FILE_EXISTS',
      )
    }

    const parentPath = path.dirname(absolutePath)
    const parentRelativePath = toWorkspacePath(this.rootPath, parentPath)

    await this.pathPolicy.resolve(parentRelativePath, { allowMissing: true })
    await fs.mkdir(parentPath, { recursive: true })
    await this.pathPolicy.resolve(parentRelativePath)
    await fs.writeFile(absolutePath, content, {
      flag: options.overwrite ? 'w' : 'wx',
    })
    await this.pathPolicy.resolve(relativePath)

    return {
      created: !existingStats,
      path: toWorkspacePath(this.rootPath, absolutePath),
      size: content.length,
    }
  }

  async editFile(relativePath, search, replacement, options = {}) {
    if (typeof search !== 'string' || !search) {
      throw new AppError(
        'Edit search text must be a non-empty string',
        400,
        'WORKSPACE_EDIT_INVALID',
      )
    }

    ensureTextContent(replacement)

    const currentFile = await this.readFile(relativePath)
    const occurrences = currentFile.content.split(search).length - 1

    if (occurrences === 0) {
      throw new AppError(
        'The requested edit text was not found in the file',
        409,
        'WORKSPACE_EDIT_NOT_FOUND',
      )
    }

    const replaceAll = options.replaceAll === true
    const updatedContent = replaceAll
      ? currentFile.content.split(search).join(replacement)
      : currentFile.content.replace(search, replacement)
    const replacements = replaceAll ? occurrences : 1
    const result = await this.writeFile(relativePath, updatedContent, {
      overwrite: true,
    })

    return {
      path: result.path,
      replacements,
      size: result.size,
    }
  }

  async searchCode(query, relativePath = '.', options = {}) {
    if (typeof query !== 'string' || !query.trim() || query.length > 200) {
      throw new AppError(
        'Search queries must contain 1 to 200 characters',
        400,
        'WORKSPACE_SEARCH_INVALID',
      )
    }

    const maxResults = validateInteger(
      options.maxResults,
      50,
      1,
      this.maxSearchResults,
      'maxResults',
    )
    const caseSensitive = options.caseSensitive === true
    const needle = caseSensitive ? query : query.toLocaleLowerCase()
    const { absolutePath } = await this.pathPolicy.resolve(relativePath)
    const rootStats = await fs.lstat(absolutePath)
    const results = []
    let truncated = false

    const searchFile = async (filePath) => {
      if (results.length >= maxResults) {
        truncated = true
        return
      }

      const stats = await fs.lstat(filePath)

      if (!stats.isFile() || stats.size > this.maxFileBytes) {
        return
      }

      const buffer = await fs.readFile(filePath)

      if (looksBinary(buffer)) {
        return
      }

      const lines = buffer.toString('utf8').split(/\r?\n/)

      for (let index = 0; index < lines.length; index += 1) {
        const haystack = caseSensitive
          ? lines[index]
          : lines[index].toLocaleLowerCase()
        const column = haystack.indexOf(needle)

        if (column !== -1) {
          results.push({
            column: column + 1,
            line: index + 1,
            path: toWorkspacePath(this.rootPath, filePath),
            preview: lines[index].trim().slice(0, 240),
          })
        }

        if (results.length >= maxResults) {
          truncated = true
          return
        }
      }
    }

    const visit = async (currentPath) => {
      if (truncated) {
        return
      }

      const stats = await fs.lstat(currentPath)

      if (stats.isFile()) {
        await searchFile(currentPath)
        return
      }

      if (!stats.isDirectory()) {
        return
      }

      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        if (truncated) {
          return
        }

        if (entry.isSymbolicLink()) {
          continue
        }

        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
          continue
        }

        await visit(path.join(currentPath, entry.name))
      }
    }

    await visit(absolutePath)

    return {
      query,
      results,
      truncated,
    }
  }

  async runCommand({ args, executable, maxOutputBytes, timeoutMs }) {
    await this.pathPolicy.resolve('.')

    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const child = spawn(executable, args, {
        cwd: this.rootPath,
        detached: process.platform !== 'win32',
        env: createSafeEnvironment(),
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      const output = { stderr: '', stdout: '' }
      let capturedBytes = 0
      let settled = false
      let terminationReason = null

      const terminate = (reason) => {
        if (!terminationReason) {
          terminationReason = reason
          terminateProcess(child)
        }
      }

      const capture = (streamName, chunk) => {
        const remainingBytes = maxOutputBytes - capturedBytes

        if (remainingBytes <= 0) {
          terminate('output_limit')
          return
        }

        const capturedChunk = chunk.subarray(0, remainingBytes)
        output[streamName] += capturedChunk.toString('utf8')
        capturedBytes += capturedChunk.length

        if (capturedChunk.length < chunk.length) {
          terminate('output_limit')
        }
      }

      child.stdout.on('data', (chunk) => capture('stdout', chunk))
      child.stderr.on('data', (chunk) => capture('stderr', chunk))

      const timeout = setTimeout(() => terminate('timeout'), timeoutMs)

      child.once('error', (error) => {
        clearTimeout(timeout)

        if (!settled) {
          settled = true
          reject(
            new AppError(
              `Unable to start the approved command: ${error.message}`,
              502,
              'COMMAND_START_FAILED',
            ),
          )
        }
      })

      child.once('close', (exitCode, signal) => {
        clearTimeout(timeout)

        if (settled) {
          return
        }

        settled = true
        resolve({
          durationMs: Date.now() - startedAt,
          exitCode,
          signal,
          status:
            exitCode === 0 && !terminationReason ? 'succeeded' : 'failed',
          stderr: stripAnsi(output.stderr),
          stdout: stripAnsi(output.stdout),
          terminationReason,
        })
      })
    })
  }

  async startProcess({ args, executable, maxOutputBytes }) {
    await this.pathPolicy.resolve('.')

    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: this.rootPath,
        detached: process.platform !== 'win32',
        env: createSafeEnvironment(),
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      const output = { stderr: '', stdout: '' }
      let capturedBytes = 0
      let closed = false
      let spawned = false
      let terminationReason = null
      let resolveExit

      const exit = new Promise((resolveProcessExit) => {
        resolveExit = resolveProcessExit
      })

      const snapshot = (exitCode = null, signal = null) => ({
        exitCode,
        signal,
        status: closed ? 'stopped' : 'running',
        stderr: stripAnsi(output.stderr),
        stdout: stripAnsi(output.stdout),
        terminationReason,
      })

      const terminate = (reason) => {
        if (!terminationReason && !closed) {
          terminationReason = reason
          terminateProcess(child)
        }
      }

      const capture = (streamName, chunk) => {
        const remainingBytes = maxOutputBytes - capturedBytes

        if (remainingBytes <= 0) {
          terminate('output_limit')
          return
        }

        const capturedChunk = chunk.subarray(0, remainingBytes)
        output[streamName] += capturedChunk.toString('utf8')
        capturedBytes += capturedChunk.length

        if (capturedChunk.length < chunk.length) {
          terminate('output_limit')
        }
      }

      const handle = {
        exit,
        getSnapshot() {
          return snapshot(child.exitCode, child.signalCode)
        },
        async stop(reason = 'stopped') {
          terminate(reason)
          return exit
        },
      }

      child.stdout.on('data', (chunk) => capture('stdout', chunk))
      child.stderr.on('data', (chunk) => capture('stderr', chunk))

      child.once('spawn', () => {
        spawned = true
        resolve(handle)
      })

      child.once('error', (error) => {
        if (!spawned) {
          reject(
            new AppError(
              `Unable to start the approved process: ${error.message}`,
              502,
              'PROCESS_START_FAILED',
            ),
          )
        }
      })

      child.once('close', (exitCode, signal) => {
        closed = true
        resolveExit(snapshot(exitCode, signal))
      })
    })
  }
}

module.exports = LocalWorkspaceProvider
