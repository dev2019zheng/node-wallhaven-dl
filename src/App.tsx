import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { DownloadsPage } from "@/features/downloads/DownloadsPage";
import { GalleryPage } from "@/features/gallery/GalleryPage";
import { SearchPage } from "@/features/search/SearchPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />} path="/">
          <Route element={<Navigate replace to="/search" />} index />
          <Route element={<SearchPage />} path="search" />
          <Route element={<DownloadsPage />} path="downloads" />
          <Route element={<GalleryPage />} path="gallery" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<Navigate replace to="/search" />} path="*" />
        </Route>
      </Routes>
    </HashRouter>
  );
}
