// svgr is configured with exportType:'named' (see vite.config.ts), so
// every `*.svg` module exposes a `ReactComponent` React component.
// This merges with vite/client's default-string `*.svg` declaration.
declare module '*.svg' {
  import * as React from 'react';

  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
}
