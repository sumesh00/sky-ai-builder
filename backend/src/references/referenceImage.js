const path = require('node:path')
const AppError = require('../utils/AppError')

const MAX_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 10000
const MAX_IMAGE_PIXELS = 50 * 1024 * 1024

const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', name: 'JPEG' },
  'image/png': { extension: 'png', name: 'PNG' },
  'image/webp': { extension: 'webp', name: 'WebP' },
}

function invalidImage(message, code = 'REFERENCE_IMAGE_INVALID') {
  throw new AppError(message, 400, code)
}

function parsePng(buffer) {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(8) !== 13 ||
    buffer.subarray(12, 16).toString('ascii') !== 'IHDR' ||
    !buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return null
  }

  return {
    height: buffer.readUInt32BE(20),
    mediaType: 'image/png',
    width: buffer.readUInt32BE(16),
  }
}

function parseJpeg(buffer) {
  if (buffer.length < 10 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  let index = 2

  while (index < buffer.length) {
    if (buffer[index] !== 0xff) {
      index += 1
      continue
    }

    while (buffer[index] === 0xff) {
      index += 1
    }

    const marker = buffer[index]
    index += 1

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }

    if (index + 1 >= buffer.length) {
      return null
    }

    const length = buffer.readUInt16BE(index)

    if (length < 2 || index + length > buffer.length) {
      return null
    }

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (length < 8) {
        return null
      }

      return {
        height: buffer.readUInt16BE(index + 3),
        mediaType: 'image/jpeg',
        width: buffer.readUInt16BE(index + 5),
      }
    }

    index += length
  }

  return null
}

function parseWebp(buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return null
  }

  const chunk = buffer.subarray(12, 16).toString('ascii')

  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      height: buffer.readUIntLE(27, 3) + 1,
      mediaType: 'image/webp',
      width: buffer.readUIntLE(24, 3) + 1,
    }
  }

  if (
    chunk === 'VP8 ' &&
    buffer.length >= 30 &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      height: buffer.readUInt16LE(28) & 0x3fff,
      mediaType: 'image/webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
    }
  }

  if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    return {
      height: 1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10)),
      mediaType: 'image/webp',
      width: 1 + (buffer[21] | ((buffer[22] & 0x3f) << 8)),
    }
  }

  return null
}

function normalizeFileName(value, extension) {
  const fallback = `reference.${extension}`

  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }

  const basename = path.basename(value.trim()).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
  const normalized = basename.replace(/[. ]+$/, '').slice(0, 100)

  return normalized || fallback
}

function validateReferenceImage(buffer, contentType, fileName) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    invalidImage('A non-empty image file is required', 'REFERENCE_IMAGE_REQUIRED')
  }

  if (buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
    invalidImage(
      `Reference images cannot exceed ${MAX_REFERENCE_IMAGE_BYTES} bytes`,
      'REFERENCE_IMAGE_TOO_LARGE',
    )
  }

  const metadata = parsePng(buffer) || parseJpeg(buffer) || parseWebp(buffer)

  if (!metadata) {
    invalidImage(
      'Only valid PNG, JPEG, and WebP reference images are supported',
      'REFERENCE_IMAGE_UNSUPPORTED',
    )
  }

  const normalizedContentType = (contentType || '').split(';')[0].trim().toLocaleLowerCase()

  if (!IMAGE_TYPES[normalizedContentType] || normalizedContentType !== metadata.mediaType) {
    invalidImage(
      'The image content does not match its declared content type',
      'REFERENCE_IMAGE_TYPE_MISMATCH',
    )
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_IMAGE_DIMENSION ||
    metadata.height > MAX_IMAGE_DIMENSION ||
    metadata.width * metadata.height > MAX_IMAGE_PIXELS
  ) {
    invalidImage(
      'Reference image dimensions are outside the allowed range',
      'REFERENCE_IMAGE_DIMENSIONS_INVALID',
    )
  }

  return {
    ...metadata,
    extension: IMAGE_TYPES[metadata.mediaType].extension,
    fileName: normalizeFileName(fileName, IMAGE_TYPES[metadata.mediaType].extension),
    size: buffer.length,
  }
}

module.exports = {
  MAX_REFERENCE_IMAGE_BYTES,
  validateReferenceImage,
}
