import * as React from 'react'

const MIN_MEDIA_PERCENT = 30
const MAX_MEDIA_PERCENT = 70

/** Keeps the media/comments split usable on touch-sized review screens. */
export function useMobileReviewSplit(initialMediaPercent = 46) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const draggingRef = React.useRef(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const [mediaPercent, setMediaPercent] = React.useState(initialMediaPercent)

  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const updateFromPointer = React.useCallback((clientY: number) => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds || bounds.height === 0) return
    const percent = ((clientY - bounds.top) / bounds.height) * 100
    setMediaPercent(Math.min(MAX_MEDIA_PERCENT, Math.max(MIN_MEDIA_PERCENT, percent)))
  }, [])

  const onPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event.clientY)
  }, [isMobile, updateFromPointer])

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) updateFromPointer(event.clientY)
  }, [updateFromPointer])

  const stopDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return {
    containerRef,
    isMobile,
    mediaPercent,
    onPointerDown,
    onPointerMove,
    onPointerUp: stopDragging,
    onPointerCancel: stopDragging,
  }
}
