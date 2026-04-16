declare module "@react-pdf/renderer" {
  import * as React from "react";

  export const Document: React.ComponentType<any>;
  export const Page: React.ComponentType<any>;
  export const Text: React.ComponentType<any>;
  export const View: React.ComponentType<any>;
  export const Image: React.ComponentType<any>;
  export const Font: {
    register: (options: any) => void;
  };
  export const StyleSheet: {
    create: (styles: Record<string, any>) => Record<string, any>;
  };

  interface PDFDownloadLinkRenderProps {
    blob?: Blob;
    url?: string;
    loading: boolean;
    error?: Error;
  }

  interface PDFDownloadLinkProps {
    document: React.ReactElement;
    fileName?: string;
    className?: string;
    children?: (props: PDFDownloadLinkRenderProps) => React.ReactNode;
  }

  export class PDFDownloadLink extends React.Component<PDFDownloadLinkProps> {}
}

export {};
