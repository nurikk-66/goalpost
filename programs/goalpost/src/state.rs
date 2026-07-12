use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub fixture_id: u64,
    pub market_type: u8,
    pub status: MarketStatus,
    pub outcome: Option<Outcome>,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub lock_time: i64,
    pub total_home: u64,
    pub total_draw: u64,
    pub total_away: u64,
    pub participant_count: u32,
    pub claimed_count: u32,
    pub settled_at: Option<i64>,
    pub settlement_epoch_day: u32,
    pub settlement_home_goals: i32,
    pub settlement_away_goals: i32,
    pub bump: u8,
}

/// One position per wallet per market - a wallet backs exactly one outcome
/// (no same-market hedging). `join()` tops up `amount` on repeat calls
/// rather than creating a second position.
#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub participant: Pubkey,
    pub outcome: Outcome,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

/// `Claimed` is a cosmetic terminal state for the UI
/// (`claimed_count == participant_count`), not a security boundary -
/// double-claim protection lives on `Position.claimed`.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Claimed,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Home,
    Draw,
    Away,
}
