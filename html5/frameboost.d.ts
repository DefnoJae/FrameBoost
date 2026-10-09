export function blendAmount(now: number, displayedAt: number, frameDurationMs: number): number;
export function attachFrameBoost(video: HTMLVideoElement, options?: {
  targetFps?: number; maxHeight?: number; onStatus?: (message: string) => void;
}): { setEnabled(value: boolean): boolean; destroy(): void };
export function mountFrameBoostControls(video: HTMLVideoElement): () => void;
