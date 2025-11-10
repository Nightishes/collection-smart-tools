export type UploadState = {
  name: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  message?: string;
};

export type StyleInfo = {
  fontColors: { name: string; value: string }[];
  fontSizes: { name: string; value: string }[];
};

export type ModifyOptions = {
  removeDataImages: boolean;
  bgColor: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};