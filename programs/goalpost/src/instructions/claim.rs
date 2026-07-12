use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::GoalpostError;
use crate::state::*;

#[derive(Accounts)]
pub struct Claim<'info> {
    pub participant: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), &[market.market_type]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// Non-participant claims fail before reaching this instruction's body:
    /// these seeds are derived from the *signer's own* pubkey, so a wallet
    /// that never called `join()` has no initialized account at this
    /// address at all.
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), participant.key().as_ref()],
        bump = position.bump,
        has_one = participant,
    )]
    pub position: Account<'info, Position>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination.mint == market.mint,
        constraint = destination.owner == participant.key(),
    )]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(market.status == MarketStatus::Settled, GoalpostError::MarketNotSettled);

    let position = &mut ctx.accounts.position;
    require!(!position.claimed, GoalpostError::AlreadyClaimed);

    let outcome = market.outcome.ok_or(GoalpostError::MarketNotSettled)?;
    let winning_pool = match outcome {
        Outcome::Home => market.total_home,
        Outcome::Draw => market.total_draw,
        Outcome::Away => market.total_away,
    };
    let total_pool = market
        .total_home
        .checked_add(market.total_draw)
        .and_then(|v| v.checked_add(market.total_away))
        .ok_or(GoalpostError::Overflow)?;

    let payout: u64 = if winning_pool == 0 {
        // Nobody backed the winning outcome (e.g. everyone bet home/away,
        // result was a draw). Documented rule, not a silent edge case: full
        // refund to everyone rather than stuck funds - see
        // docs/ARCHITECTURE.md §4.
        position.amount
    } else {
        require!(position.outcome == outcome, GoalpostError::NothingToClaim);
        (position.amount as u128)
            .checked_mul(total_pool as u128)
            .and_then(|v| v.checked_div(winning_pool as u128))
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(GoalpostError::Overflow)?
    };

    position.claimed = true;
    market.claimed_count = market.claimed_count.checked_add(1).ok_or(GoalpostError::Overflow)?;
    if market.claimed_count == market.participant_count {
        market.status = MarketStatus::Claimed;
    }

    let fixture_id_bytes = market.fixture_id.to_le_bytes();
    let market_type_byte = market.market_type;
    let bump = market.bump;
    let seeds: &[&[u8]] = &[b"market", fixture_id_bytes.as_ref(), &[market_type_byte], &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: market.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds);
    token::transfer(cpi_ctx, payout)?;

    Ok(())
}
