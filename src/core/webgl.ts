/**
 * WebGL Support Detection
 */

import type { WebGLSupportResult } from './types';

/**
 * Check WebGL support synchronously
 */
export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    if (gl.isContextLost()) return false;

    // Clean up
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();

    return true;
  } catch {
    return false;
  }
}

/**
 * Check WebGL support with detailed result
 */
export function getWebGLSupport(): WebGLSupportResult {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        supported: false,
        checked: true,
        error: 'WebGL not supported by browser',
      };
    }

    if (gl.isContextLost()) {
      return {
        supported: false,
        checked: true,
        error: 'WebGL context lost - too many active contexts',
      };
    }

    // Clean up
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();

    return {
      supported: true,
      checked: true,
    };
  } catch (e) {
    return {
      supported: false,
      checked: true,
      error: e instanceof Error ? e.message : 'WebGL check failed',
    };
  }
}
