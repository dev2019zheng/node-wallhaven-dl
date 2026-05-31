import type { ImgHTMLAttributes } from "react"
import { useEffect, useState } from "react"

import { loadRemoteImageObjectUrl } from "@/infrastructure/tauri/media-repository"

type ProxiedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string
}

export function ProxiedImage({ src, alt, ...props }: ProxiedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    let objectUrl: string | null = null

    setResolvedSrc(null)
    loadRemoteImageObjectUrl(src)
      .then((nextObjectUrl) => {
        objectUrl = nextObjectUrl
        if (isActive) {
          setResolvedSrc(nextObjectUrl)
        } else {
          URL.revokeObjectURL(nextObjectUrl)
        }
      })
      .catch(() => {
        if (isActive) {
          setResolvedSrc(src)
        }
      })

    return () => {
      isActive = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src])

  return <img {...props} alt={alt} src={resolvedSrc ?? src} />
}
