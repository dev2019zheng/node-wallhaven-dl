import type { ImgHTMLAttributes, SyntheticEvent } from "react"
import { useEffect, useState } from "react"

import { loadRemoteImageObjectUrl } from "@/infrastructure/tauri/media-repository"

type ProxiedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string
}

const imagePlaceholderSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23101b2a'/%3E%3C/svg%3E"

export function ProxiedImage({ src, alt, onError, ...props }: ProxiedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(imagePlaceholderSrc)
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading")

  useEffect(() => {
    let isActive = true
    let objectUrl: string | null = null

    setResolvedSrc(imagePlaceholderSrc)
    setLoadState("loading")
    loadRemoteImageObjectUrl(src)
      .then((nextObjectUrl) => {
        objectUrl = nextObjectUrl
        if (isActive) {
          setResolvedSrc(nextObjectUrl)
          setLoadState("loaded")
        } else {
          URL.revokeObjectURL(nextObjectUrl)
        }
      })
      .catch(() => {
        if (isActive) {
          setResolvedSrc(imagePlaceholderSrc)
          setLoadState("error")
        }
      })

    return () => {
      isActive = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src])

  const handleImageError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (resolvedSrc !== imagePlaceholderSrc) {
      setResolvedSrc(imagePlaceholderSrc)
      setLoadState("error")
    }

    onError?.(event)
  }

  return (
    <img
      {...props}
      alt={alt}
      data-load-state={loadState}
      onError={handleImageError}
      src={resolvedSrc}
    />
  )
}
