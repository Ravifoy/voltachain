// Seeds the local chain with 6 sample batteries + inspector reports; 4 are listed for sale.
// Needs: hardhat node running, contract deployed (npm run deploy), ML API running on :8000.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

const ML = process.env.ML_URL || "http://127.0.0.1:8000";
const INR_PER_ETH = 200000; // fixed display rate (same constant used in the frontend)

// serial, type, nominal mAh, readings, seller account index, list for sale?
const SAMPLES = [
  ["VC-18650-0001", "Li-ion 18650 cell", 3000, { cycle_count: 180, age_months: 10, internal_resistance: 38, avg_temperature: 27, measured_capacity: 2850 }, 2, true],
  ["EB-PACK-0002", "E-bike battery pack", 10000, { cycle_count: 420, age_months: 22, internal_resistance: 52, avg_temperature: 31, measured_capacity: 8600 }, 2, true],
  ["ES-PACK-0003", "E-scooter battery pack", 20000, { cycle_count: 700, age_months: 36, internal_resistance: 66, avg_temperature: 34, measured_capacity: 14600 }, 4, true],
  ["LP-CELL-0004", "Laptop battery cell", 2600, { cycle_count: 950, age_months: 52, internal_resistance: 73, avg_temperature: 36, measured_capacity: 1590 }, 2, true],
  ["PB-CELL-0005", "Power bank cell", 5000, { cycle_count: 1500, age_months: 72, internal_resistance: 105, avg_temperature: 44, measured_capacity: 1550 }, 2, false],
  ["PH-CELL-0006", "Phone Li-poly cell", 3500, { cycle_count: 300, age_months: 18, internal_resistance: 44, avg_temperature: 29, measured_capacity: 3115 }, 4, false],
];

// city for each sample battery (lat/lng in degrees x 1e6, shown on the marketplace map)
const CITIES = {
  Mumbai: [19076000, 72877700], Pune: [18520400, 73856700], Delhi: [28613900, 77209000],
  Bengaluru: [12971600, 77594600], Chennai: [13082700, 80270700], Hyderabad: [17385000, 78486700],
};
const CITY_OF = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Chennai", "Hyderabad"];

async function main() {
  const file = require("../../frontend/src/contracts/VoltaChain.json");
  const signers = await ethers.getSigners();
  const inspector = signers[1] ?? signers[0];
  const pick = (i) => signers[i] ?? signers[0]; // public testnet: single wallet plays every role
  const contract = await ethers.getContractAt("VoltaChain", file.address);

  // Human-readable wallet names (public, unverified - see setName in the contract)
  await (await contract.connect(inspector).setName("VoltaLab Inspector")).wait();
  if (signers.length > 1) {
    await (await contract.connect(signers[2]).setName("GreenCell Recyclers")).wait();
    await (await contract.connect(signers[4]).setName("EcoPack Delhi")).wait();
  } else {
    await (await contract.connect(signers[0]).setName("VoltaChain Admin")).wait(); // single wallet on a public testnet
  }

  for (const [i, [serial, type, nominal, rd, sellerIdx, list]] of SAMPLES.entries()) {
    const seller = pick(sellerIdx);
    const readings = { ...rd, nominal_capacity: nominal };

    // 1. Seller registers the battery (mints NFT).
    const rc = await (await contract.connect(seller).registerBattery(serial, type, nominal)).wait();
    const tokenId = Number(rc.logs.map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "BatteryRegistered").args.tokenId);

    const city = CITY_OF[i];
    await (await contract.connect(seller).setLocation(tokenId, city, CITIES[city][0], CITIES[city][1])).wait();

    // 2. ML model turns raw readings into a grade + explanation.
    const res = await fetch(`${ML}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(readings) });
    if (!res.ok) throw new Error("ML API not reachable at " + ML + " - start it first");
    const ml = await res.json();

    // 3. Build the full report, hash it (keccak256 of compact JSON), save JSON off-chain.
    const report = { serialNumber: serial, batteryType: type, tokenId, readings, ml, inspector: inspector.address, timestamp: new Date().toISOString() };
    const hash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(report)));
    await fetch(`${ML}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash, report }) });

    // 4. Inspector stores the hash on-chain.
    await (await contract.connect(inspector).addHealthReport(tokenId, Math.round(ml.soh_percent), ml.grade, readings.cycle_count, hash)).wait();

    // 5. Optionally list for sale at the ML-suggested price (converted to ETH).
    if (list) {
      const eth = (ml.suggested_price_inr / INR_PER_ETH).toFixed(6);
      await (await contract.connect(seller).listForSale(tokenId, ethers.parseEther(eth))).wait();
    }
    console.log(`#${tokenId} ${serial}: SoH ${ml.soh_percent}% grade ${ml.grade}${list ? " (listed)" : ""}  ${hash.slice(0, 12)}...`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
