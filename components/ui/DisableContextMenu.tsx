'use client'

import { useEffect } from 'react'

export default function DisableContextMenu() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault()

    document.addEventListener('contextmenu', preventContextMenu)
    return () => document.removeEventListener('contextmenu', preventContextMenu)
  }, [])

  return null
}
