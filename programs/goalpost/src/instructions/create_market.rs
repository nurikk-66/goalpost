use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::errors::GoalpostError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(fixture_id: u64, market_type: u8, lock_time: i64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", fixture_id.to_le_bytes().as_ref(), &[market_type]],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub mint: Account<'info, Mint>,

    /// The market's escrow: an ATA for `mint` owned by the market PDA
    /// itself. No separate vault PDA/bump needed.
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<CreateMarket>, fixture_id: u64, market_type: u8, lock_time: i64) -> Result<()> {
    require!(lock_time > Clock::get()?.unix_timestamp, GoalpostError::InvalidLockTime);

    let market = &mut ctx.accounts.market;
    market.fixture_id = fixture_id;
    market.market_type = market_type;
    market.status = MarketStatus::Open;
    market.outcome = None;
    market.creator = ctx.accounts.creator.key();
    market.mint = ctx.accounts.mint.key();
    market.vault = ctx.accounts.vault.key();
    market.lock_time = lock_time;
    market.total_home = 0;
    market.total_draw = 0;
    market.total_away = 0;
    market.participant_count = 0;
    market.claimed_count = 0;
    market.settled_at = None;
    market.settlement_epoch_day = 0;
    market.settlement_home_goals = 0;
    market.settlement_away_goals = 0;
    market.bump = ctx.bumps.market;

    Ok(())
}
