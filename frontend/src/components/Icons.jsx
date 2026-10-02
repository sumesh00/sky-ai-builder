const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.7,
  viewBox: '0 0 24 24',
}

export function CodeIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" />
    </svg>
  )
}

export function DesktopIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <rect height="13" rx="2" width="19" x="2.5" y="3.5" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  )
}

export function ExternalLinkIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  )
}

export function FileIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="M14 2.75H6.5A1.5 1.5 0 0 0 5 4.25v15.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-12Z" />
      <path d="M14 2.75v5h5" />
    </svg>
  )
}

export function FolderIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="M3 7.25A2.25 2.25 0 0 1 5.25 5h4l2 2h7.5A2.25 2.25 0 0 1 21 9.25v8.5A2.25 2.25 0 0 1 18.75 20H5.25A2.25 2.25 0 0 1 3 17.75Z" />
    </svg>
  )
}

export function MobileIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <rect height="20" rx="2.5" width="11" x="6.5" y="2" />
      <path d="M10.5 18.5h3" />
    </svg>
  )
}

export function MoonIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.4 8.4 0 1 0 20.2 15.1Z" />
    </svg>
  )
}

export function PaperclipIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="m20.5 11.5-8.7 8.7a5.1 5.1 0 0 1-7.2-7.2l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.3 9.3a1.9 1.9 0 0 1-2.7-2.7l8.6-8.6" />
    </svg>
  )
}

export function RefreshIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="M20 7v5h-5" />
      <path d="M18.5 9A7.5 7.5 0 1 0 19 15" />
    </svg>
  )
}

export function SendIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="m4 4 17 8-17 8 3-8Z" />
      <path d="M7 12h14" />
    </svg>
  )
}

export function SidebarIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <rect height="18" rx="2" width="20" x="2" y="3" />
      <path d="M8 3v18" />
    </svg>
  )
}

export function SparklesIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25Z" />
      <path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75ZM5.5 13l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" />
    </svg>
  )
}

export function SunIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
    </svg>
  )
}

export function TabletIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} {...iconProps}>
      <rect height="18" rx="2.5" width="14" x="5" y="3" />
      <path d="M10.5 18h3" />
    </svg>
  )
}
