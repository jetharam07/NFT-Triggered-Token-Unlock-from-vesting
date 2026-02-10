# NFT-Triggered Token Vesting (Solana Anchor)

### 📌 Project Overview

This project is a **Solana Anchor smart contract** implementing an  
**NFT-driven token vesting and distribution system**.

The protocol links **NFT minting** directly with **token unlocks**, ensuring
controlled supply release, fair distribution, and sustainable token economics.

---

### 🔹 Token Economics

- **Total token supply (minted initially)**: `100,000`
- **Locked tokens**: `90,000`
- **Initially unlocked tokens**: `10,000`

### 🔓 Token Unlock Logic
- Each successful **NFT mint unlocks `10,000` tokens**
- Tokens are unlocked and distributed **atomically**

### 📊 Distribution per NFT mint
- **User**: `60%`
- **Team**: `40%`

---

##3 🎨 NFT Minting Rules

- **Mint price**: `0.5 SOL`
- **Mint cooldown**: `10 seconds` between consecutive mints
- Each NFT mint:
  - Unlocks tokens
  - Distributes tokens to user and team
  - Sends SOL to the **Liquidity Pool (LP)**

---

##3 ⚙️ Core Features

- Built using **Solana Anchor framework**
- NFT-triggered token vesting mechanism
- Automatic and atomic token distribution
- Time-based mint restriction (anti-spam)
- LP-ready SOL collection
- Clear separation of user and team allocations

---

### 🚀 Use Cases

This architecture is suitable for:
- NFT projects with progressive token unlocks
- Fair and transparent token distribution models
- Preventing early token dumping
- Aligning NFT demand with token supply release

---

## 🚀 Getting Started


> ⚠️ Note: All required commands are provided, but depending on your system setup, some steps may need to be re-run or reordered.


Follow the steps below to clone the repository, build the program, and run tests.

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/jetharam07/NFT-Triggered-Token-Unlock-from-vesting
cd NFT-Triggered-Token-Unlock-from-vesting
```

```bash
npm install -g yarn
yarn -v
```

### Quick Solana, Anchor set up Installation

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

### Build Program
```bash
anchor build
```

### Check Program ID
```bash
anchor keys list
```

### Set solana devnet network
```bash
solana config set --url https://api.devnet.solana.com
```
### Create wallet if not exists
```bash
solana-keygen new --outfile wallet.json
solana config set --keypair ./wallet.json
```

### Airdrop sol faucet
```bash
solana airdrop 2
```

### Deploy Program
```bash
anchor deploy
```

### Program Testing
```bash
anchor test
```

## 📚 References & Useful Links

- **Solana Official Documentation**  
  https://docs.solana.com/

- **Solana Toolchain Installation Guide**  
  https://docs.solana.com/cli/install-solana-cli-tools

- **Solana Devnet Faucet**  
  https://faucet.solana.com/

- **Solana Explorer (Devnet)**  
  https://explorer.solana.com/?cluster=devnet

- **Anchor Framework Documentation**  
  https://www.anchor-lang.com/

---

