/**
 * useWebGLSupport - React hook for WebGL detection
 */

import { useState, useEffect } from 'react';
import type { WebGLSupportResult } from '../core/types';
import { getWebGLSupport } from '../core/webgl';

export function useWebGLSupport(): WebGLSupportResult {
  const [result, setResult] = useState<WebGLSupportResult>({
    supported: true,
    checked: false,
  });

  useEffect(() => {
    setResult(getWebGLSupport());
  }, []);

  return result;
}

export default useWebGLSupport;
