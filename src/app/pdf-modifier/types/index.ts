export type UploadState = {
  name: string;
  status: "idle" | "uploading" | "done" | "error";
  message?: string;
};

export type StyleInfo = {
  fontColors: { name: string; value: string }[];
  fontSizes: { name: string; value: string }[];
};

export type ModifyOptions = {
  removeDataImages: boolean;
  bgColor: string;
  reorganizeContainers?: boolean;
  // optional per-class overrides to send to the modifyHtml util
  fcOverrides?: Record<string, string>;
  fsOverrides?: Record<string, string>;
};
