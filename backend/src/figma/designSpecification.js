const MAX_DESIGN_NODES = 500
const MAX_TEXT_LENGTH = 1000

function compactString(value, maximum = 160) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maximum)
    : undefined
}

function finiteNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined
}

function bounds(value) {
  if (!value || typeof value !== 'object') return undefined

  const width = finiteNumber(value.width)
  const height = finiteNumber(value.height)

  if (width === undefined || height === undefined) return undefined

  return {
    height,
    width,
    x: finiteNumber(value.x) || 0,
    y: finiteNumber(value.y) || 0,
  }
}

function color(value, opacity) {
  if (!value || typeof value !== 'object') return undefined

  const channels = ['r', 'g', 'b'].map((channel) => value[channel])
  if (channels.some((channel) => !Number.isFinite(channel))) return undefined

  const hex = `#${channels
    .map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, '0'))
    .join('')}`
  const alpha = finiteNumber(opacity ?? value.a ?? 1)

  return alpha === undefined || alpha >= 1 ? hex : `${hex}${Math.round(Math.max(0, alpha) * 255).toString(16).padStart(2, '0')}`
}

function paints(values, imageRefs, colors) {
  if (!Array.isArray(values)) return []

  return values
    .filter((paint) => paint && typeof paint === 'object' && paint.visible !== false)
    .slice(0, 12)
    .map((paint) => {
      const paintColor = color(paint.color, paint.opacity)
      if (paintColor) colors.add(paintColor)
      if (typeof paint.imageRef === 'string') imageRefs.add(paint.imageRef)

      return {
        color: paintColor,
        imageRef: typeof paint.imageRef === 'string' ? paint.imageRef : undefined,
        opacity: finiteNumber(paint.opacity),
        scaleMode: compactString(paint.scaleMode, 40),
        type: compactString(paint.type, 40),
      }
    })
}

function typography(node, typographyTokens) {
  if (node.type !== 'TEXT') return undefined

  const style = node.style && typeof node.style === 'object' ? node.style : {}
  const value = {
    fontFamily: compactString(style.fontFamily, 120),
    fontSize: finiteNumber(style.fontSize),
    fontWeight: finiteNumber(style.fontWeight),
    letterSpacing: finiteNumber(style.letterSpacing),
    lineHeight: finiteNumber(style.lineHeightPx),
    textAlign: compactString(style.textAlignHorizontal, 40),
  }
  const token = JSON.stringify(value)
  if (token !== '{}') typographyTokens.set(token, value)

  return {
    ...value,
    content: compactString(node.characters, MAX_TEXT_LENGTH),
  }
}

function layout(node) {
  const value = {
    alignItems: compactString(node.counterAxisAlignItems, 40),
    clipsContent: node.clipsContent === true ? true : undefined,
    direction: compactString(node.layoutMode, 40),
    gap: finiteNumber(node.itemSpacing),
    justifyContent: compactString(node.primaryAxisAlignItems, 40),
    padding: {
      bottom: finiteNumber(node.paddingBottom),
      left: finiteNumber(node.paddingLeft),
      right: finiteNumber(node.paddingRight),
      top: finiteNumber(node.paddingTop),
    },
  }

  if (Object.values(value.padding).every((item) => item === undefined)) {
    delete value.padding
  }

  return Object.values(value).some((item) => item !== undefined) ? value : undefined
}

function visualStyle(node, imageRefs, colors) {
  const fills = paints(node.fills, imageRefs, colors)
  const strokes = paints(node.strokes, imageRefs, colors)
  const value = {
    backgroundColor: color(node.backgroundColor),
    cornerRadius: finiteNumber(node.cornerRadius),
    fills: fills.length ? fills : undefined,
    opacity: finiteNumber(node.opacity),
    strokes: strokes.length ? strokes : undefined,
  }

  if (value.backgroundColor) colors.add(value.backgroundColor)
  return Object.values(value).some((item) => item !== undefined) ? value : undefined
}

function nodeSpecification(node, context) {
  if (!node || typeof node !== 'object') return undefined
  if (context.nodeCount >= MAX_DESIGN_NODES) {
    context.truncated = true
    return undefined
  }

  context.nodeCount += 1
  const specification = {
    bounds: bounds(node.absoluteBoundingBox || node.absoluteRenderBounds),
    id: compactString(node.id, 120),
    layout: layout(node),
    name: compactString(node.name, 160),
    style: visualStyle(node, context.imageRefs, context.colors),
    text: typography(node, context.typography),
    type: compactString(node.type, 60) || 'UNKNOWN',
    visible: node.visible !== false,
  }
  const children = []

  for (const child of Array.isArray(node.children) ? node.children : []) {
    const childSpecification = nodeSpecification(child, context)
    if (childSpecification) children.push(childSpecification)
  }

  if (children.length) specification.children = children
  return Object.fromEntries(
    Object.entries(specification).filter(([, value]) => value !== undefined),
  )
}

function collectImageReferences(node, references = new Set(), seen = { count: 0 }) {
  if (!node || typeof node !== 'object' || seen.count >= MAX_DESIGN_NODES) {
    return references
  }

  seen.count += 1
  for (const paint of [...(node.fills || []), ...(node.strokes || [])]) {
    if (paint?.visible !== false && typeof paint?.imageRef === 'string') {
      references.add(paint.imageRef)
    }
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectImageReferences(child, references, seen)
  }

  return references
}

function buildDesignSpecification({ designName, fileKey, imageUrls = {}, nodeId, root }) {
  const context = {
    colors: new Set(),
    imageRefs: new Set(),
    nodeCount: 0,
    truncated: false,
    typography: new Map(),
  }
  const hierarchy = nodeSpecification(root, context)
  const images = [...context.imageRefs].map((imageRef) => ({
    available: typeof imageUrls[imageRef] === 'string',
    imageRef,
  }))

  return {
    colors: [...context.colors].slice(0, 80),
    designName: compactString(designName, 160) || 'Untitled Figma design',
    fileKey,
    hierarchy,
    images,
    nodeId: nodeId || null,
    nodeCount: context.nodeCount,
    truncated: context.truncated,
    typography: [...context.typography.values()].slice(0, 80),
    version: 1,
  }
}

module.exports = {
  buildDesignSpecification,
  collectImageReferences,
}
