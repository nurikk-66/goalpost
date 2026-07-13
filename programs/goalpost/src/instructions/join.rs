use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::GoalpostError;
use crate::state::*;

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), &[market.market_type]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// One position per (market, participant); a second `join()` call from
    /// the same wallet tops this up rather than creating a new one.
    #[account(
        init_if_needed,
        payer = participant,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), participant.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut, constraint = participant_token_account.mint == market.mint)]
    pub participant_token_account: Account<'info, TokenAccount>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<Join>, outcome: Outcome, amount: u64) -> Result<()> {
    require!(amount > 0, GoalpostError::ZeroAmount);

    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Open && Clock::get()?.unix_timestamp < market.lock_time,
        GoalpostError::MarketNotOpen
    );

    let position = &mut ctx.accounts.position;
    let is_new_position = position.market == Pubkey::default();
    if is_new_position {
        position.market = market.key();
        position.participant = ctx.accounts.participant.key();
        position.outcome = outcome;
        position.claimed = false;
        position.bump = ctx.bumps.position;
        market.participant_count = market
            .participant_count
            .checked_add(1)
            .ok_or(GoalpostError::Overflow)?;
    } else {
        require!(position.outcome == outcome, GoalpostError::OutcomeMismatch);
    }
    position.amount = position.amount.checked_add(amount).ok_or(GoalpostError::Overflow)?;

    match outcome {
        Outcome::Home => {
            market.total_home = market.total_home.checked_add(amount).ok_or(GoalpostError::Overflow)?
        }
        Outcome::Draw => {
            market.total_draw = market.total_draw.checked_add(amount).ok_or(GoalpostError::Overflow)?
        }
        Outcome::Away => {
            market.total_away = market.total_away.checked_add(amount).ok_or(GoalpostError::Overflow)?
        }
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.participant_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.participant.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}
