require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Optional public testnet: only enabled when BOTH values exist in contracts/.env
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;
const sepolia = SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
  ? { sepolia: { url: SEPOLIA_RPC_URL, chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY.startsWith("0x") ? DEPLOYER_PRIVATE_KEY : "0x" + DEPLOYER_PRIVATE_KEY] } }
  : {};

/** Local-only Hardhat config. No testnets, no secrets needed. */
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    ...sepolia,
  },
};
