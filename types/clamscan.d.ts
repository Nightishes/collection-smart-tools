declare module "clamscan" {
  export interface ClamScanOptions {
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
      local_fallback?: boolean;
    };
    preference?: "clamdscan" | "clamscan";
  }

  export interface ScanResult {
    isInfected: boolean;
    viruses: string[] | null;
  }

  export default class NodeClam {
    init(options?: ClamScanOptions): Promise<NodeClam>;
    isInfected(filePath: string): Promise<ScanResult>;
  }
}
