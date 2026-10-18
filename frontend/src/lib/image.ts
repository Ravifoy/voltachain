// Battery photos: resize in the browser, hash with keccak256, store the image off-chain (API) and only the hash on-chain.
import { keccak256, toUtf8Bytes } from "ethers";
import { ML_URL } from "./config";

/** Shrink a photo to max 800px JPEG so it stays small (~50-150 KB). Returns a data URL. */
export async function resizeToDataUrl(file: File, maxDim = 800, quality = 0.8): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", quality);
  if (url.length > 600_000) throw new Error("Photo is too large even after resizing");
  return url;
}

/** The fingerprint stored on-chain: keccak256 of the exact data URL text. */
export const hashImage = (dataUrl: string) => keccak256(toUtf8Bytes(dataUrl));

export async function saveImage(hash: string, data: string) {
  const res = await fetch(`${ML_URL}/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash, data }) });
  if (!res.ok) throw new Error("Could not upload the photo to the server");
}

const cache = new Map<string, string | null>();
export async function fetchImage(hash: string): Promise<string | null> {
  if (cache.has(hash)) return cache.get(hash)!;
  try {
    const res = await fetch(`${ML_URL}/images/${hash}`);
    const data: string | null = res.ok ? (await res.json()).data : null;
    cache.set(hash, data);
    return data;
  } catch { return null; }
}
