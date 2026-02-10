import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenVesting } from "../target/types/token_vesting";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";


// ---------- ANSI COLORS ----------
const WHITE = "\x1b[37m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const PASS = `${YELLOW}✔${RESET}`;

describe("token_vesting (persistent + nft)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .TokenVesting as Program<TokenVesting>;

  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // ---------- Persistent local state ----------
  const STATE_FILE = path.join(__dirname, ".test-state.json");

  type LocalState = {
    team: string;
    lpVault: string;
    tokenMint: string;
  };

  function loadState(): LocalState | null {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }

  function saveState(state: LocalState) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  let TEAM_PUBKEY: anchor.web3.PublicKey;
  let LP_VAULT: anchor.web3.PublicKey;
  let TOKEN_MINT: anchor.web3.PublicKey;

  let statePda: anchor.web3.PublicKey;
  let vestingVault: anchor.web3.PublicKey;
  let userAta: anchor.web3.PublicKey;
  let teamAta: anchor.web3.PublicKey;

  const DECIMALS = 6;

  // ---------------- SETUP ----------------
  before(async () => {
    [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    const saved = loadState();
    let local: LocalState = saved ?? { team: "", lpVault: "", tokenMint: "" };

    // ---------- TEAM ----------
    if (local.team) {
      TEAM_PUBKEY = new anchor.web3.PublicKey(local.team);
    } else {
      const team = anchor.web3.Keypair.generate();
      TEAM_PUBKEY = team.publicKey;
      local.team = TEAM_PUBKEY.toBase58();
      console.log("New TEAM created:", TEAM_PUBKEY.toBase58());
    }

    // ---------- LP VAULT ----------
    if (local.lpVault) {
      LP_VAULT = new anchor.web3.PublicKey(local.lpVault);
    } else {
      const lp = anchor.web3.Keypair.generate();
      await anchor.web3.sendAndConfirmTransaction(
        connection,
        new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: lp.publicKey,
            lamports: await connection.getMinimumBalanceForRentExemption(0),
            space: 0,
            programId: anchor.web3.SystemProgram.programId,
          })
        ),
        [wallet.payer, lp]
      );
      LP_VAULT = lp.publicKey;
      local.lpVault = LP_VAULT.toBase58();
      console.log("New LP vault created:", LP_VAULT.toBase58());
    }

    // ---------- TOKEN MINT ----------
    if (local.tokenMint) {
      TOKEN_MINT = new anchor.web3.PublicKey(local.tokenMint);
    } else {
      TOKEN_MINT = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        DECIMALS
      );

      local.tokenMint = TOKEN_MINT.toBase58();
      console.log("New TOKEN mint created:", TOKEN_MINT.toBase58());

      vestingVault = (
        await getOrCreateAssociatedTokenAccount(
          connection,
          wallet.payer,
          TOKEN_MINT,
          statePda,
          true
        )
      ).address;

      await mintTo(
        connection,
        wallet.payer,
        TOKEN_MINT,
        vestingVault,
        wallet.payer,
        90_000 * 10 ** DECIMALS
      );

      await setAuthority(
        connection,
        wallet.payer,
        TOKEN_MINT,
        wallet.payer,
        AuthorityType.MintTokens,
        statePda
      );
    }

    saveState(local);

    // ---------- ATAs ----------
    vestingVault = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        TOKEN_MINT,
        statePda,
        true
      )
    ).address;

    userAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        TOKEN_MINT,
        wallet.publicKey
      )
    ).address;

    teamAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        TOKEN_MINT,
        TEAM_PUBKEY
      )
    ).address;
  });

  // ---------------- INITIALIZE ----------------
  it("Initialize (idempotent)", async () => {
    try {
      await program.methods.initialize().accounts({
        state: statePda,
        admin: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }).rpc();
    } catch {
      console.log("Already initialized");
    }
  });

  // ---------------- MINT ----------------
  it("Mint NFT → unlock 10k", async () => {
    // --------- MINIMAL NFT (NEW EACH TIME) ---------
    const nftMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0 // NFT
    );

    const nftAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      nftMint,
      wallet.publicKey
    );

    await mintTo(
      connection,
      wallet.payer,
      nftMint,
      nftAta.address,
      wallet.payer,
      1
    );

    // --------- CALL PROGRAM ---------
    await program.methods.mintNftAndUnlock().accounts({
      state: statePda,
      user: wallet.publicKey,
      userTokenAccount: userAta,
      teamTokenAccount: teamAta,
      vestingVault,
      lpVault: LP_VAULT,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    // --------- BALANCES ---------
    const userBal = await getAccount(connection, userAta);
    const teamBal = await getAccount(connection, teamAta);
    const vestBal = await getAccount(connection, vestingVault);
    const lpSol = await connection.getBalance(LP_VAULT);

    // --------- REPORT ---------
    console.log(`\n${WHITE}========= CORE DATA =========${RESET}`);
    console.log(`${WHITE}USER ADDRESS:   ${wallet.publicKey.toBase58()}`);
    console.log(`TEAM ADDRESS:   ${TEAM_PUBKEY.toBase58()}`);
    console.log(`LP ADDRESS:     ${LP_VAULT.toBase58()}`);
    console.log(`TOKEN ADDRESS:  ${TOKEN_MINT.toBase58()}`);
    console.log(`NFT MINT:       ${nftMint.toBase58()}${RESET}`);
    console.log(`${WHITE}-----------------------------${RESET}`);
    console.log(`${PASS} User Balance:   ${YELLOW}${Number(userBal.amount) / 10 ** DECIMALS}${RESET}`);
    console.log(`${PASS} Team Balance:   ${YELLOW}${Number(teamBal.amount) / 10 ** DECIMALS}${RESET}`);
    console.log(`${PASS} LP Balance:     ${YELLOW}${lpSol / anchor.web3.LAMPORTS_PER_SOL} SOL${RESET}`);
    console.log(`${PASS} Vesting Left:   ${YELLOW}${Number(vestBal.amount) / 10 ** DECIMALS}${RESET}`);
    console.log(`${WHITE}=============================\n${RESET}`);
  });
});

