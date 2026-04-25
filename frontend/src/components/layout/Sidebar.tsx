import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Tag, Wallet, TrendingUp,
  RefreshCcw, PiggyBank, X, ChevronRight,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses',      icon: Receipt,         label: 'Expenses' },
  { to: '/income',        icon: Wallet,          label: 'Income' },
  { to: '/categories',    icon: Tag,             label: 'Categories' },
  { to: '/investments',   icon: TrendingUp,      label: 'Investments' },
  { to: '/subscriptions', icon: RefreshCcw,      label: 'Subscriptions' },
  { to: '/savings',       icon: PiggyBank,       label: 'Savings & Forecast' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 flex flex-col
        bg-gradient-to-b from-slate-900 to-indigo-950
        transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">SmartExpense</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
              ${isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} size={18} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-slate-500 text-center">SmartExpense v1.0</p>
      </div>
    </aside>
  )
}
