use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("71NQHpxgRs4kwLXVxsSxE4XMd9ZRaYsMLivfb5CgGDg");

const UNLOCK_AMOUNT: u64 = 10_000 * 1_000_000; // 10k tokens
const TOTAL_VESTING: u64 = 90_000 * 1_000_000;
const COOLDOWN: i64 = 10; // test (prod = 1800)

#[program]
pub mod token_vesting {
    use super::*;

    /// Initialize instruction

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
    
        if state.initialized {
            return Ok(());
        }
    
        state.admin = ctx.accounts.admin.key();
        state.last_mint_time = 0;
        state.total_unlocked = 0;
        state.initialized = true;
        state.bump = ctx.bumps.state; 
    
        Ok(())
    }
    

       /// Mint trigger instruction
       /// - Called after an NFT is minted on the client (TS) side
       /// - Transfers 0.5 SOL to the internal LP vault
       /// - Unlocks 10,000 vested tokens
       /// - Distributes tokens: 60% to user, 40% to team


    pub fn mint_nft_and_unlock(ctx: Context<MintAndUnlock>) -> Result<()> {
        let clock = Clock::get()?;

        //  immutable first
        let state_info = ctx.accounts.state.to_account_info();
        //  mutable after
        let state = &mut ctx.accounts.state;

        // cooldown
        if state.last_mint_time != 0 {
            let elapsed = clock.unix_timestamp - state.last_mint_time;
            require!(elapsed >= COOLDOWN, ErrorCode::Cooldown);
        }

        require!(
            state.total_unlocked + UNLOCK_AMOUNT <= TOTAL_VESTING,
            ErrorCode::VestingFinished
        );

        // 0.5 SOL → LP vault
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.lp_vault.to_account_info(),
                },
            ),
            500_000_000,
        )?;

        let seeds: &[&[u8]] = &[b"state", &[state.bump]];
        let signer = &[seeds];

        let user_amount = UNLOCK_AMOUNT * 60 / 100;
        let team_amount = UNLOCK_AMOUNT * 40 / 100;

        // user transfer
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vesting_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: state_info.clone(),
                },
                signer,
            ),
            user_amount,
        )?;

        // team transfer
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vesting_vault.to_account_info(),
                    to: ctx.accounts.team_token_account.to_account_info(),
                    authority: state_info,
                },
                signer,
            ),
            team_amount,
        )?;

        state.total_unlocked += UNLOCK_AMOUNT;
        state.last_mint_time = clock.unix_timestamp;

        emit!(MintReport {
            user: ctx.accounts.user.key(),
            user_tokens: user_amount,
            team_tokens: team_amount,
            total_unlocked: state.total_unlocked,
            lp_balance: ctx.accounts.lp_vault.lamports(),
        });

        Ok(())
    }
}

// ----------- ACCOUNTS -----------

/// Initialize accounts

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 64,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}


/// Mint & unlock accounts

#[derive(Accounts)]
pub struct MintAndUnlock<'info> {
    #[account(mut, seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, State>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub team_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vesting_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_vault: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ----------- STATE -----------

/// Program state stored in PDA

#[account]
pub struct State {
    pub admin: Pubkey,
    pub last_mint_time: i64,
    pub total_unlocked: u64,
    pub initialized: bool,
    pub bump: u8,
}


// ----------- EVENT -----------

/// Event emitted after every successful mint

#[event]
pub struct MintReport {
    pub user: Pubkey,
    pub user_tokens: u64,
    pub team_tokens: u64,
    pub total_unlocked: u64,
    pub lp_balance: u64,
}

// ----------- ERRORS -----------

#[error_code]
pub enum ErrorCode {
    #[msg("Wait for cooldown")]
    Cooldown,
    #[msg("Vesting completed")]
    VestingFinished,
}
