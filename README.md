# ⚡ VoltaChain — verified second-hand battery marketplace

**Hackathon demo, not production.** Runs entirely on your laptop: a local Hardhat blockchain, a small Python ML API and a Next.js frontend.

**The idea:** people throw away batteries that still have useful life, because buyers can't verify how much health is left. VoltaChain stores each battery's health reports and ownership history on a blockchain (tamper-proof). Only **verified inspectors** can add health reports (this is the *oracle problem*: a blockchain cannot verify real-world data by itself, so trusted signers submit it). A simple ML model turns raw readings into a grade and a plain-English explanation.

```
/contracts   Hardhat + Solidity (VoltaChain.sol, ERC-721) + tests + deploy/seed scripts
/ml          Python: synthetic data, RandomForest training, FastAPI (/predict, /reports)
/frontend    Next.js + Tailwind + ethers.js + framer-motion (MetaMask)
start.ps1    one-command start        stop.ps1   stops everything
```

## Quick start (one command, Windows)

Prerequisites: Node 18+, Python 3.10+, MetaMask browser extension.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This (first run also installs dependencies and trains the model) starts the blockchain, the ML API, deploys the contract, seeds 6 sample batteries, and starts the frontend at **http://localhost:3000**. Logs are in `logs/`. Stop with `.\stop.ps1`.
Every run of `start.ps1` creates a **fresh chain** (new blocks from #0), so also do the MetaMask reset below.

## Manual step-by-step (4 terminals)

```bash
# Terminal 1 - local blockchain (keep running)
cd contracts
npm install --legacy-peer-deps
npx hardhat node

# Terminal 2 - ML API (keep running)
cd ml
pip install -r requirements.txt
python train.py                      # prints R2 / MAE, saves model.joblib
python -m uvicorn app:app --port 8000

# Terminal 3 - deploy + seed (needs terminals 1 and 2 running)
cd contracts
npx hardhat test                     # optional: run contract tests
npx hardhat run scripts/deploy.js --network localhost   # also writes address + ABI to frontend/src/contracts/VoltaChain.json
npx hardhat run scripts/seed.js --network localhost     # 1 inspector, 6 batteries, reports, 4 listed

# Terminal 4 - frontend
cd frontend
npm install
npm run dev                          # http://localhost:3000
```

## MetaMask setup

**1. Add the network** (the app offers to do this when you click *Connect wallet*, or add manually):
Settings → Networks → Add network manually:

| Field | Value |
|---|---|
| Network name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

**2. Import the Hardhat test accounts** (MetaMask → account menu → *Add account or hardware wallet* → *Import account* → paste the private key). These keys are **public, well-known test keys. Never use them on a real network.**

| Role in demo | Hardhat # | Address | Private key |
|---|---|---|---|
| **Admin** (deployer, can add inspectors) | #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Inspector** (verified) | #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Seller** (owns batteries #1,2,4,5) | #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **Buyer** | #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Seller 2 (owns #3, #6) | #4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

The navbar shows the role label (Admin / Inspector / Seller / Buyer) next to the connected address.

**3. After every restart of the chain:** MetaMask → Settings → Advanced → **Clear activity tab data** (for each imported account). Otherwise MetaMask remembers old nonces and transactions get stuck.

## What the demo contains

* **Smart contract** `contracts/contracts/VoltaChain.sol` (one ERC-721 contract, OpenZeppelin): `addInspector`, `registerBattery`, `addHealthReport` (inspectors only: *"Only verified inspectors can add reports"*), `listForSale`, `buy` (NFT to buyer, ETH straight to seller), views for batteries / reports / owner history / listings, and events `InspectorAdded, BatteryRegistered, HealthReportAdded, Listed, Sold`.
* **ML + API** (`/ml`): `POST /predict`, `POST /reports`, `GET /reports/{hash}`, `GET /health`.
* **Frontend pages:** Home, Marketplace, Battery detail (health, ML explanation, on-chain timeline), Sell, Inspector, Explorer, Verify (tamper check).
* **Proof features:** report hashing (keccak256), tamper check, built-in block explorer with parent-hash links and live refresh, tx success cards (tx hash, block number, block hash, gas, explorer link), access-control demo showing the revert reason.

### How report hashing works (good viva answer)
1. Inspector enters readings → ML API returns SoH, grade, explanation.
2. Frontend builds the **full report JSON** (serial, readings, ML result, inspector address, timestamp).
3. `hash = keccak256(JSON.stringify(report))` is computed in the browser.
4. The JSON is saved off-chain (`ml/data/reports.json`, keyed by hash); only the **32-byte hash** is stored on-chain via `addHealthReport`.
5. Anyone can later re-hash the stored JSON and compare it to the on-chain hash. One changed digit → a completely different hash → "MISMATCH". (Whitespace/pretty-printing does not matter, because the hash is taken over the compact JSON.)

## 3-minute demo script for the professor

| Time | Do | Say |
|---|---|---|
| 0:00 | **Explorer** page. Point at the linked block cards. | "This is our own mini-Etherscan reading the local chain. Each block stores its parent's hash. The colour bar and *hash match ✓* show block N's parent hash equals block N-1's hash. Change an old block and everything after it breaks." |
| 0:30 | Connect MetaMask as **Inspector (#1)**. Go to **Inspector**, pick battery #6, click *Fill sample readings* → *Analyze with AI* → *Submit report to blockchain*. | "AI turns readings into grade and explanation. We hash the whole report and store only the hash on-chain. Only a verified inspector can do this." |
| 1:00 | On the success card, show tx hash, block number, block hash, gas → **View in explorer**. | "Here is our transaction in its block. The explorer decoded the function name `addHealthReport` and the `HealthReportAdded` event, including the report hash." |
| 1:25 | **Verify** page → choose the new report → *Verify integrity* → green **MATCH**. Click *Tamper: SoH → 95* → *Verify integrity* → red **MISMATCH**. | "Off-chain JSON matches the on-chain hash. Now I change SoH from 72 to 95: totally different hash, tampering is caught. The differing characters are highlighted." |
| 2:00 | Switch MetaMask to **Seller (#2)** → **Inspector** page → analyze → submit. (MetaMask may warn the tx will fail; confirm anyway.) | "A non-inspector tries to add a report. We send the transaction anyway: the contract rejects it with *'Only verified inspectors can add reports'*. This is access control, our answer to the oracle problem." |
| 2:20 | Switch to **Buyer (#3)** → **Marketplace** → *Buy* on a battery → *Confirm purchase*. | "Payment goes directly to the seller and the NFT moves to me in one atomic transaction. Prices shown in ₹ and ETH." |
| 2:45 | Open that battery's **detail page**. | "The timeline shows register → report → listed → sold, each with tx hash and block number, and the ownership history now lists seller then buyer, all on-chain." |

## Choices and assumptions (made without asking)
* **Synthetic data:** the ML dataset (~2000 rows, `ml/train.py`) is **simulated**, not real battery measurements. It follows simple Li-ion degradation trends (cycle fade + calendar ageing + heat acceleration; resistance rises and capacity falls with lower health). Reported on a 20% hold-out: R² ≈ 0.96, MAE ≈ 2 SoH points (will vary slightly if you retrain). Because measured capacity is a near-direct proxy for SoH, the model is easy by design; this is a demo.
* **Grades:** A ≥ 85, B 70–84, C 50–69, D < 50 (recycle). Remaining life = `(SoH − 50) / 0.6` months (assumes 0.6 SoH points lost per month, capped at 120). Suggested price = ₹600 per Ah of nominal capacity × (SoH/100)².
* **Currency:** fixed demo rate **1 ETH = ₹200,000** (`frontend/src/lib/config.ts`, `contracts/scripts/seed.js`).
* **Hardhat 2** (not 3) for simplicity. Solidity 0.8.24, OpenZeppelin 5.
* **Owner history** is stored on-chain as (owner, timestamp, block). Tx hashes cannot be known inside a contract, so the timeline gets them from the contract's events.
* **Access-control demo:** the app dry-runs the call (`eth_call`) to read the revert reason, then sends the real transaction with a fixed gas limit so it is mined and fails on-chain. (Hardhat reports the failed tx to MetaMask as an error; the explorer then shows it with status *Failed* and the replayed reason.)
* **Off-chain storage** is a single JSON file (`ml/data/reports.json`); no IPFS/database as requested. If you reset the chain, `start.ps1` also clears it.
* No secrets are needed. `frontend/.env.example` lists optional URL overrides.
* Each battery page auto-checks its latest report against the chain and shows "Report authentic" or a red warning.

## Troubleshooting
* **"Can't reach the local blockchain"** → start `npx hardhat node`, then deploy again (the contract address changes each fresh chain).
* **Transactions stuck / "nonce too high"** → clear MetaMask activity tab data (see above).
* **Inspector page says ML service unreachable** → start the ML API on port 8000.
* **Wallet shows wrong data after redeploy** → refresh the page.

---

## Public network: Sepolia testnet + hosting (Vercel + Render)

The same contract can run on the **Sepolia public testnet** (free test ETH, real public blockchain, viewable on https://sepolia.etherscan.io).

### 1. Deploy the contract to Sepolia
```bash
cd contracts
cp .env.example .env          # then edit .env (never commit it)
#   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
#   DEPLOYER_PRIVATE_KEY=<private key of a FRESH wallet that has Sepolia ETH>
npx hardhat run scripts/deploy.js --network sepolia   # writes address + chainId into frontend/src/contracts/VoltaChain.json
npx hardhat run scripts/seed.js   --network sepolia   # needs the ML API running locally (it saves the report JSONs to ml/data/reports.json)
```
On Sepolia there is one wallet, so that wallet is admin, inspector and seller at once. Add more inspectors from the Inspector page (admin box). **`frontend/src/contracts/VoltaChain.json` now describes Sepolia. `start.ps1` redeploys locally and overwrites it**, so a backup of the Sepolia deployment is kept in `deployments/sepolia.json` (copy it back before pushing).

### 2. Push to GitHub
Commit the whole project (`.env` files are git-ignored). `ml/data/reports.json` **must be committed**: it holds the JSON of the seeded reports.

### 3. Host the ML/report API on Render
New + ? **Blueprint** ? pick the repo (it reads `render.yaml`). Wait for the deploy, then copy the URL, e.g. `https://voltachain-api.onrender.com`; check `/health` returns `{"ok":true,...}`.

### 4. Host the frontend on Vercel
Import the repo, set **Root Directory = `frontend`**, add the environment variable `NEXT_PUBLIC_ML_URL = <your Render URL>` (no trailing slash), deploy.

### Limits of the free hosting
* Render's free plan sleeps after ~15 min idle (first request takes ~30-60 s) and its disk is **temporary**: new reports saved by the Inspector page are lost on restart (reports in the repo survive). Fix for production: IPFS or a database.
* Anyone with MetaMask on Sepolia and some test ETH can register/buy. Only admin-approved wallets can add reports.

## Names and map
* Any wallet can set a public display name (`setName`, Sell page). It is shown on cards, the timeline and the explorer. Names are **not verified**.
* The owner sets a battery's city (`setLocation`, Sell page, preset Indian cities). The Marketplace **Map** view (Leaflet + OpenStreetMap tiles, no API key) shows listed batteries as grade-coloured pins.
