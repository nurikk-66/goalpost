use anchor_lang::prelude::*;

use crate::errors::GoalpostError;
use crate::state::*;
use crate::txoracle::{self, ProofNode, ScoresBatchSummary, StatLeaf, StatValidationInput};

#[derive(Accounts)]
pub struct Settle<'info> {
    /// Permissionless: anyone holding a valid TxLINE proof can settle. No
    /// admin key involved - see docs/TRUST_MODEL.md.
    pub settler: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), &[market.market_type]],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: address is deterministically re-derived from `ts` below and
    /// checked against that derivation before use (see `InvalidMerkleRootAccount`).
    /// Ownership by the TxLINE program itself is enforced by the CPI: an
    /// account that isn't real TxLINE-owned root data simply fails
    /// downstream inside `validate_stat_v2`.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: must be the real TxLINE txoracle program - the CPI target.
    /// There's no published Anchor CPI crate for it (see txoracle.rs), so we
    /// can't use the typed `Program<'info, T>` wrapper the way
    /// `token_program: Program<'info, Token>` works for SPL calls; this
    /// address constraint is the equivalent safety check.
    #[account(address = txoracle::TXORACLE_PROGRAM_ID)]
    pub txoracle_program: UncheckedAccount<'info>,
}

/// Verifies the real match result via CPI, then *derives* the outcome from
/// the authenticated stat values - never trusts a caller-supplied outcome
/// claim. See docs/ARCHITECTURE.md §3 for the full rationale.
#[allow(clippy::too_many_arguments)]
pub(crate) fn handler(
    ctx: Context<Settle>,
    ts: i64,
    fixture_summary: ScoresBatchSummary,
    fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
    event_stat_root: [u8; 32],
    home_stat: StatLeaf,
    away_stat: StatLeaf,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(market.status == MarketStatus::Locked, GoalpostError::MarketNotLocked);

    require!(
        fixture_summary.fixture_id == market.fixture_id as i64,
        GoalpostError::FixtureMismatch
    );

    // Only the finalized full-time result may settle a market - period=100
    // marks the game_finalised record (docs/TXLINE_NOTES.md §4/§9);
    // anything else is an in-progress snapshot that happens to be a real,
    // provable value at some earlier point in the match.
    require!(home_stat.stat.period == 100, GoalpostError::NotFinalResult);
    require!(away_stat.stat.period == 100, GoalpostError::NotFinalResult);
    require!(home_stat.stat.key == 1, GoalpostError::UnexpectedStatKey);
    require!(away_stat.stat.key == 2, GoalpostError::UnexpectedStatKey);

    let epoch_day = u16::try_from(ts / 86_400_000).map_err(|_| GoalpostError::InvalidMerkleRootAccount)?;
    let (expected_pda, _bump) = txoracle::daily_scores_merkle_roots_pda(epoch_day);
    require_keys_eq!(
        ctx.accounts.daily_scores_merkle_roots.key(),
        expected_pda,
        GoalpostError::InvalidMerkleRootAccount
    );

    let home_goals = home_stat.stat.value;
    let away_goals = away_stat.stat.value;

    let payload = StatValidationInput {
        ts,
        fixture_summary,
        fixture_proof,
        main_tree_proof,
        event_stat_root,
        stats: vec![home_stat, away_stat],
    };

    txoracle::validate_stat_v2(
        &ctx.accounts.daily_scores_merkle_roots.to_account_info(),
        &ctx.accounts.txoracle_program.to_account_info(),
        payload,
    )?;

    let outcome = match home_goals.cmp(&away_goals) {
        std::cmp::Ordering::Greater => Outcome::Home,
        std::cmp::Ordering::Less => Outcome::Away,
        std::cmp::Ordering::Equal => Outcome::Draw,
    };

    market.outcome = Some(outcome);
    market.status = MarketStatus::Settled;
    market.settled_at = Some(Clock::get()?.unix_timestamp);
    market.settlement_epoch_day = epoch_day as u32;
    market.settlement_home_goals = home_goals;
    market.settlement_away_goals = away_goals;

    Ok(())
}
