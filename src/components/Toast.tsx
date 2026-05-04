'use client'
import { useEffect } from 'react'
import clsx from 'clsx'

type Props = {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={clsx(
        'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-fade-in',
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      )}
    >
      {message}
    </div>
  )
}
