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

export type SettingsSnapshot = {
  wallhavenKey: string;
  downloadDirectory: DownloadDirectorySettings;
  networkProxy: NetworkProxySettings | null;
};

export type SaveSettingsInput = {
  wallhavenKey: string;
  customDownloadDirectoryPath: string;
  networkProxyScheme: NetworkProxyScheme;
  networkProxyAddress: string;
};

export type SettingsCommandErrorKind =
  | "invalidRequest"
  | "resolvePath"
  | "internal";

export type SettingsCommandErrorPayload = {
  kind: SettingsCommandErrorKind;
  message: string;
};

export class SettingsCommandError extends Error {
  kind: SettingsCommandErrorKind;

  constructor({ kind, message }: SettingsCommandErrorPayload) {
    super(message);
    this.name = "SettingsCommandError";
    this.kind = kind;
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
