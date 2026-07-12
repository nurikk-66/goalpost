use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod txoracle;

use instructions::*;
use state::Outcome;
use txoracle::{ProofNode, ScoresBatchSummary, StatLeaf};

declare_id!("6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr");

/// Trustless World Cup settlement engine. Market outcomes are never
/// self-reported: `settle` CPIs into TxLINE's on-chain `validate_stat_v2` to
/// authenticate the real final score, then derives the winning outcome
/// itself from those proven values. See docs/ARCHITECTURE.md and
/// docs/TRUST_MODEL.md.
#[program]
pub mod goalpost {
    use super::*;

    pub fn create_market(ctx: Context<CreateMarket>, fixture_id: u64, market_type: u8, lock_time: i64) -> Result<()> {
        instructions::create_market::handler(ctx, fixture_id, market_type, lock_time)
    }

    pub fn join(ctx: Context<Join>, outcome: Outcome, amount: u64) -> Result<()> {
        instructions::join::handler(ctx, outcome, amount)
    }

    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market::handler(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn settle(
        ctx: Context<Settle>,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        event_stat_root: [u8; 32],
        home_stat: StatLeaf,
        away_stat: StatLeaf,
    ) -> Result<()> {
        instructions::settle::handler(
            ctx,
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            event_stat_root,
            home_stat,
            away_stat,
        )
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }
}
