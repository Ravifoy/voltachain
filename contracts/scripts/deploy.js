// Deploys VoltaChain to the local Hardhat node and writes address + ABI into the frontend.
// Hardhat accounts: #0 = admin (deployer), #1 = inspector, #2 = seller, #3 = buyer.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  const admin = signers[0];
  const inspector = signers[1] ?? signers[0]; // on a public testnet we only have one funded wallet
  const Factory = await hre.ethers.getContractFactory("VoltaChain");
  const contract = await Factory.deploy();
  const deployReceipt = await contract.deploymentTransaction().wait();
  const address = await contract.getAddress();
  console.log("VoltaChain deployed to:", address);

  // Admin approves account #1 as a verified inspector.
  await (await contract.connect(admin).addInspector(inspector.address)).wait();
  console.log("Inspector added:", inspector.address);

  // Export for the frontend (it reads this JSON to talk to the contract).
  const artifact = await hre.artifacts.readArtifact("VoltaChain");
  const out = { address, abi: artifact.abi, chainId: Number(hre.network.config.chainId), network: hre.network.name, deployBlock: deployReceipt.blockNumber, admin: admin.address };
  const dir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "VoltaChain.json"), JSON.stringify(out, null, 2));
  console.log("Wrote frontend/src/contracts/VoltaChain.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
