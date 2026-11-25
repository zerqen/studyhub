import type { StudyHubDesktopApi } from "../../electron/preload";

declare global {
  interface Window {
    studyhub: StudyHubDesktopApi;
  }
}

export {};
