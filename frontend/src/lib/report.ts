// Report building + hashing + backend calls. The hash is the bridge between off-chain JSON and on-chain proof.
import { keccak256, toUtf8Bytes } from "ethers";
import { ML_URL } from "./config";

export type Readings = {
  cycle_count: number; age_months: number; internal_resistance: number;
  avg_temperature: number; measured_capacity: number; nominal_capacity: number;
};
export type MlResult = {
  soh_percent: number; grade: string; remaining_life_months: number; suggested_price_inr: number; explanation: string;
};
export type ReportJson = {
  serialNumber: string; batteryType: string; tokenId: number; readings: Readings; ml: MlResult;
  inspector: string; timestamp: string;
};

/**
 * keccak256 of the COMPACT JSON text. Compact (no spaces) makes the hash independent of
 * how the JSON is pretty-printed, but ANY change to a value changes the hash completely.
 */
export const hashReport = (report: unknown) => keccak256(toUtf8Bytes(JSON.stringify(report)));

export async function predict(r: Readings): Promise<MlResult> {
  const res = await fetch(`${ML_URL}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
  if (!res.ok) throw new Error("ML service returned an error. Check the readings.");
  return res.json();
}

export async function saveReport(hash: string, report: ReportJson) {
  const res = await fetch(`${ML_URL}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash, report }) });
  if (!res.ok) throw new Error("Could not save the report JSON to the backend");
}

export async function fetchReport(hash: string): Promise<ReportJson | null> {
  try {
    const res = await fetch(`${ML_URL}/reports/${hash}`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}
