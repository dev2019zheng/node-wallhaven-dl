export type DownloadDirectorySettings = {
  customDirectoryPath: string;
  effectiveDirectoryPath: string;
  defaultDirectoryPath: string;
  isUsingDefaultDirectory: boolean;
};

export type NetworkProxyScheme = "http" | "https" | "socks5";

export type NetworkProxySettings = {
  scheme: NetworkProxyScheme;
  address: string;
};

export type WallhavenAccessDiagnostic = {
  usesProxy: boolean;
  authenticated: boolean;
  total: number;
};

export type SettingsPreferences = {
  launchAtLogin: boolean;
  confirmBeforeDelete: boolean;
  telemetryEnabled: boolean;
  cacheSizeBytes: number;
};

export type SettingsSnapshot = {
  wallhavenKey: string;
  downloadDirectory: DownloadDirectorySettings;
  networkProxy: NetworkProxySettings | null;
  preferences: SettingsPreferences;
};

export type SaveSettingsInput = {
  wallhavenKey: string;
  customDownloadDirectoryPath: string;
  networkProxyScheme: NetworkProxyScheme;
  networkProxyAddress: string;
  preferences: SettingsPreferences;
};

export type SettingsCommandErrorKind =
  | "invalidRequest"
  | "resolvePath"
  | "upstreamStatus"
  | "timeout"
  | "network"
  | "internal";

export type SettingsCommandErrorPayload = {
  kind: SettingsCommandErrorKind;
  message: string;
  statusCode?: number;
};

export class SettingsCommandError extends Error {
  kind: SettingsCommandErrorKind;
  statusCode?: number;

  constructor({ kind, message, statusCode }: SettingsCommandErrorPayload) {
    super(message);
    this.name = "SettingsCommandError";
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export function isSettingsCommandErrorPayload(
  error: unknown,
): error is SettingsCommandErrorPayload {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<SettingsCommandErrorPayload>;
  return typeof candidate.kind === "string" && typeof candidate.message === "string";
}

export function toSettingsCommandError(error: unknown): SettingsCommandError {
  if (isSettingsCommandErrorPayload(error)) {
    return new SettingsCommandError(error);
  }

  if (error instanceof Error) {
    return new SettingsCommandError({
      kind: "internal",
      message: error.message,
    });
  }

  return new SettingsCommandError({
    kind: "internal",
    message: "Unexpected settings command failure.",
  });
}
