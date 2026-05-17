import React from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

interface MetricCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; positive: boolean }
  color?: 'blue' | 'green' | 'red' | 'yellow'
  className?: string
}

const colors = {
  blue:   'bg-blue-50 text-blue-600',
  green:  'bg-green-50 text-green-600',
  red:    'bg-red-50 text-red-600',
  yellow: 'bg-yellow-50 text-yellow-600',
}

export const Card: React.FC<CardProps> = ({ title, subtitle, action, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
        <div>
          {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
)

export const MetricCard: React.FC<MetricCardProps> = ({
  label, value, icon, trend, color = 'blue', className = ''
}) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
            {trend.positive ? '+' : ''}{trend.value}% vs ayer
          </p>
        )}
      </div>
      {icon && (
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
      )}
    </div>
  </div>
)
