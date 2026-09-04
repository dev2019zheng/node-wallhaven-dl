import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, Loader2, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { downloadWallpaper as downloadWallpaperInService } from "@/application/downloads/downloads-service";
import { searchWallpapers as searchWallpapersInService } from "@/application/search/search-service";
import type {
  SearchWallpaper,
  SearchWallpapersResponse,
} from "@/application/search/search.types";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useUiShellStore } from "@/features/shell/ui-shell-store";
import { writeClipboardText } from "@/infrastructure/browser/clipboard";
import { toUserFacingErrorMessage } from "@/infrastructure/tauri/runtime-errors";
import {
  VALID_TOPLIST_RANGES,
  type WallhavenPurityFilter,
  type WallhavenQueryFilters,
} from "@/domain/wallhaven/models";

import { WallpaperGrid } from "./components/WallpaperGrid";
import {
  getSearchPageSessionSnapshot,
  saveSearchPageSessionSnapshot,
  type SearchPageFormValues,
} from "./search-page-session";

const BULK_DOWNLOAD_CONCURRENCY = 4;

const searchSchema = z.object({
  category: z.enum(["all", "general", "anime", "people", "ga", "gp"]),
  purityPreset: z.enum(["sfw", "sketchy", "nsfw", "ws", "wn", "sn", "all"]),
  sorting: z.enum(["date_added", "toplist"]),
  topRange: z.enum(VALID_TOPLIST_RANGES),
  resolution: z.enum(["all", "1920x1080", "2560x1440", "3840x2160"]),
  aspectRatio: z.enum(["all", "16x9", "16x10", "21x9", "4x3", "portrait"]),
  q: z.string().max(200, "Query is unexpectedly long."),
  page: z.number().int().min(1, "Page must be at least 1."),
  pagesToDownload: z.number().int().min(1, "Pages to download must be at least 1."),
});

type DownloadFeedback = {
  tone: "success" | "error";
  message: string;
};

type DownloadActivityCounts = Record<string, number>;

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return toUserFacingErrorMessage(error, fallbackMessage);
}

function buildPurityFilter(purityPreset: SearchPageFormValues["purityPreset"]): WallhavenPurityFilter {
  switch (purityPreset) {
    case "sfw":
      return { sfw: true, sketchy: false, nsfw: false };
    case "sketchy":
      return { sfw: false, sketchy: true, nsfw: false };
    case "nsfw":
      return { sfw: false, sketchy: false, nsfw: true };
    case "ws":
      return { sfw: true, sketchy: true, nsfw: false };
    case "wn":
      return { sfw: true, sketchy: false, nsfw: true };
    case "sn":
      return { sfw: false, sketchy: true, nsfw: true };
    case "all":
      return { sfw: true, sketchy: true, nsfw: true };
  }
}

export function SearchPage() {
  return (
    <section className="space-y-6">
      <p role="alert">SearchPage restore incomplete — full source pending upload.</p>
    </section>
  );
}
