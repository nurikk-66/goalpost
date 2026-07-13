use anchor_lang::prelude::*;

use crate::errors::GoalpostError;
use crate::state::*;

/// Permissionless: anyone can flip a market from Open to Locked once its
/// lock_time has passed. `join()` and `settle()` also check the relevant
/// conditions directly, so this instruction isn't load-bearing for
/// security - it exists to give the documented state machine (MASTER_PLAN
/// §1) an explicit on-chain transition the UI/indexer can key off.
#[derive(Accounts)]
pub struct LockMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), &[market.market_type]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

pub(crate) fn handler(ctx: Context<LockMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(market.status == MarketStatus::Open, GoalpostError::MarketAlreadyLocked);
    require!(
        Clock::get()?.unix_timestamp >= market.lock_time,
        GoalpostError::LockTimeNotReached
    );
    market.status = MarketStatus::Locked;
    Ok(())
}
