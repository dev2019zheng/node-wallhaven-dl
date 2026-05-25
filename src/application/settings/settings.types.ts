export type DownloadStrategy = {
  baseDir: string;
  relativePath: string;
};

export type SettingsSnapshot = {
  wallhavenKey: string;
  defaultDownloadStrategy: DownloadStrategy;
};

export type SaveSettingsInput = {
  wallhavenKey: string;
};
