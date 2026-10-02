import { useEffect, useRef, useState } from 'react'
import {
  getReferenceImageUrl,
  getReferenceImages,
  uploadReferenceImage,
} from '../services/api.js'
import { PaperclipIcon } from './Icons.jsx'

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 5 * 1024 * 1024

function ReferenceImages({ activeProject, onUploaded, projectRevision }) {
  const fileInput = useRef(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [references, setReferences] = useState([])
  const projectId = activeProject?.id || ''

  useEffect(() => {
    let isCurrent = true

    if (!projectId) {
      return () => {
        isCurrent = false
      }
    }

    getReferenceImages(projectId)
      .then((result) => {
        if (isCurrent) {
          setReferences(result)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setReferences([])
        }
      })

    return () => {
      isCurrent = false
    }
  }, [projectId, projectRevision])

  async function selectImage(event) {
    const [file] = event.target.files || []
    event.target.value = ''

    if (!file || isUploading) {
      return
    }

    if (!acceptedImageTypes.has(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.')
      return
    }

    if (file.size > maxImageBytes) {
      setError('Reference images must be 5 MB or smaller.')
      return
    }

    setError('')
    setIsUploading(true)

    try {
      const reference = await uploadReferenceImage(projectId, file)
      setReferences((current) => [...current, reference])
      onUploaded()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="border-t border-white/8 px-3 pt-3">
      <input
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={selectImage}
        ref={fileInput}
        type="file"
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
            Screenshot references
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-700">
            PNG, JPEG, or WebP · up to 5 MB
          </p>
        </div>
        <button
          aria-label="Upload screenshot reference"
          className="flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.035] px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!projectId || isUploading}
          onClick={() => fileInput.current?.click()}
          title={
            projectId
              ? 'Add a screenshot reference to the active project'
              : 'Generate or select a project before adding a screenshot reference'
          }
          type="button"
        >
          <PaperclipIcon className="size-3.5" />
          {isUploading ? 'Uploading…' : 'Add image'}
        </button>
      </div>

      {error ? <p className="mt-2 text-[10px] leading-4 text-red-300">{error}</p> : null}

      {references.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {references.map((reference) => (
            <figure className="w-20 shrink-0" key={reference.id}>
              <img
                alt={reference.fileName}
                className="aspect-[4/3] w-full rounded-md border border-white/10 bg-white/[0.03] object-cover"
                src={getReferenceImageUrl(projectId, reference.id)}
              />
              <figcaption className="mt-1 truncate text-[9px] text-zinc-600" title={reference.fileName}>
                {reference.fileName}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : projectId ? (
        <p className="mt-2 text-[10px] leading-4 text-zinc-700">
          Stored privately with this project for a later screenshot-to-code step.
        </p>
      ) : null}
    </div>
  )
}

export default ReferenceImages
