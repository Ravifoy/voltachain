# ⚡ VoltaChain

A marketplace for second-hand batteries with tamper-proof health reports on the blockchain.

Used batteries often have years of life left, but buyers can't verify how much. VoltaChain records each battery's health reports and ownership history on-chain. Only **admin-approved inspectors** can add reports (a blockchain cannot verify real-world measurements by itself, so trusted signers submit them). A machine-learning model turns raw readings into a grade and a plain-English explanation.

## Features

- **Batteries as NFTs (ERC-721):** register, inspect, list and buy; payment goes directly from buyer to seller.
- **Inspector-only health reports:** the contract rejects anyone else with *"Only verified inspectors can add reports"*.
- **Report integrity:** the full report JSON is hashed with keccak256; only the hash is stored on-chain. The **Verify** page re-hashes the stored JSON and flags any change.
- **AI grading:** a RandomForest model predicts State of Health (SoH) and returns a grade (A ≥ 85, B 70–84, C 50–69, D < 50), estimated remaining life, a suggested price and a one-line explanation.
- **Built-in explorer:** blocks linked by parent hash, transactions with decoded function names and event logs, search by tx hash / block / address, live refresh.
- **Marketplace map:** listed batteries shown by city on an OpenStreetMap-based map.
- **Wallet names:** wallets can set an optional public display name.
- **Prices in INR and ETH**, success receipts with tx hash, block number, block hash and gas for every action.

## Project structure

```
contracts/   Hardhat + Solidity (VoltaChain.sol), tests, deploy and seed scripts
ml/          Python: dataset generation, RandomForest training, FastAPI (/predict, /reports)
frontend/    Next.js (TypeScript) + Tailwind + ethers.js + framer-motion + Leaflet
deployments/ Saved deployment details (Sepolia)
render.yaml  Render blueprint for the ML/report API
start.ps1    One-command local start (Windows)      stop.ps1  Stops it
```

## Run locally (Windows, one command)

Requirements: Node 18+, Python 3.10+, MetaMask.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

This installs dependencies on first run, trains the model, starts a local Hardhat chain (port 8545), starts the ML API (8000), deploys and seeds the contract, and starts the frontend at http://localhost:3000. Logs are in `logs/`; stop with `.\stop.ps1`. Each run creates a fresh chain.

> `start.ps1` redeploys to the local chain and overwrites `frontend/src/contracts/VoltaChain.json`. To go back to the Sepolia deployment, copy `deployments/sepolia.json` over it.

### Manual steps

```bash
# 1. local blockchain
cd contracts && npm install --legacy-peer-deps && npx hardhat node

# 2. ML API
cd ml && pip install -r requirements.txt && python train.py
python -m uvicorn app:app --port 8000

# 3. deploy + seed (needs 1 and 2 running)
cd contracts
npx hardhat test
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js   --network localhost

# 4. frontend
cd frontend && npm install && npm run dev
```

### MetaMask for local development

Add the network: RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH` (the app also offers to add it when you click *Connect wallet*). Then import Hardhat's built-in test accounts (MetaMask → Add account → Import account). These keys are public and must never be used on a real network.

| Role | # | Address | Private key |
|---|---|---|---|
| Admin (deployer) | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Inspector | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Seller | 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| Buyer | 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Seller 2 | 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

After restarting the chain, clear MetaMask's activity data (Settings → Advanced → *Clear activity tab data*), otherwise old nonces cause stuck transactions.

## Public deployment (Sepolia testnet + Vercel + Render)

### 1. Deploy the contract
```bash
cd contracts
cp .env.example .env        # fill in; .env is git-ignored
#   SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
#   DEPLOYER_PRIVATE_KEY=<key of a fresh wallet funded with Sepolia ETH>
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/seed.js   --network sepolia   # needs the ML API running; saves report JSONs to ml/data/reports.json
```
On Sepolia a single wallet acts as admin, inspector and seller. More inspectors can be approved from the Inspector page (admin only).

### 2. ML / report API on Render
New → **Blueprint** → select this repo (it reads `render.yaml`). Check `<url>/health` after the build.

### 3. Frontend on Vercel
Import the repo, set **Root Directory** to `frontend`, add the environment variable `NEXT_PUBLIC_ML_URL=<Render URL>` (no trailing slash), deploy.

Notes on the free hosting tiers: Render's free instances sleep when idle and use temporary disk, so reports added after deployment are lost on restart (the seeded reports in `ml/data/reports.json` persist). Production should use IPFS or a database for report storage.

## How report integrity works

1. The inspector enters readings; the ML API returns SoH, grade and explanation.
2. The frontend builds the report JSON (serial, readings, ML result, inspector address, timestamp).
3. `hash = keccak256(JSON.stringify(report))` is computed in the browser.
4. The JSON is saved off-chain, keyed by its hash; only the 32-byte hash is stored on-chain via `addHealthReport`.
5. Anyone can re-hash the stored JSON and compare it with the on-chain hash. Changing a single value produces a completely different hash. Whitespace does not matter, because the hash is taken over the compact JSON.

## Design notes and limitations

- **Training data is synthetic.** `ml/train.py` generates ~2,000 simulated rows following simple Li-ion degradation trends (cycle fade, calendar ageing, heat acceleration). On a 20% hold-out it scores R² ≈ 0.96 and MAE ≈ 2 SoH points. Because measured capacity is a near-direct proxy for SoH, the task is easy; the model should be retrained on real measurements before real use.
- **Grading and pricing:** remaining life = `(SoH − 50) / 0.6` months (capped at 120); suggested price = ₹600 per Ah of nominal capacity × (SoH/100)². These are simple heuristics.
- **Currency:** a fixed rate of 1 ETH = ₹200,000 is used for display (`frontend/src/lib/config.ts`).
- **Trust model:** the blockchain proves that a given inspector submitted an exact report and that it has not changed; it cannot prove the inspector measured honestly. The admin approves inspectors (single trusted party; multisig or governance would be the next step). The contract can add but not remove inspectors.
- **Names and locations are self-reported** and not verified.
- **Contract is unaudited**; deployed to a testnet only.
- **Failed-transaction display:** the Inspector page dry-runs the call (`eth_call`) to show the contract's revert reason for non-inspectors, then sends the transaction with a fixed gas limit so it is mined and fails on-chain; the explorer shows it with status *Failed*.

## Troubleshooting

- *"Can't reach the local blockchain"*: start `npx hardhat node` and redeploy (the address changes on each fresh chain).
- *Transactions stuck / nonce errors*: clear MetaMask activity tab data.
- *ML service unreachable*: start the ML API on port 8000 (or check `NEXT_PUBLIC_ML_URL`).
- *Wrong network in MetaMask*: use the **Switch network** button in the navbar.
