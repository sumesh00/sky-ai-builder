import { DesktopIcon, MobileIcon, TabletIcon } from './Icons.jsx'

const devices = [
  { icon: DesktopIcon, id: 'desktop', label: 'Desktop' },
  { icon: TabletIcon, id: 'tablet', label: 'Tablet' },
  { icon: MobileIcon, id: 'mobile', label: 'Mobile' },
]

function DeviceSwitcher({ activeDevice, onChange }) {
  return (
    <div
      aria-label="Preview device"
      className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-[#111114] p-1"
      role="group"
    >
      {devices.map(({ icon: Icon, id, label }) => {
        const isActive = activeDevice === id

        return (
          <button
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              isActive
                ? 'bg-white/[0.08] text-zinc-200 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
            key={id}
            onClick={() => onChange(id)}
            title={`${label} preview frame`}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default DeviceSwitcher
