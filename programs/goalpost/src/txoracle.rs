//! Manual CPI client for TxLINE's `txoracle` program. There is no published
//! Anchor CPI crate for it (only a public IDL + TS types - see
//! docs/TXLINE_NOTES.md §5), so we mirror the IDL's types locally and build
//! the CPI instruction by hand: 8-byte discriminator (from the real IDL,
//! scripts/vendor/txoracle.idl.json) followed by Borsh-serialized args.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::errors::GoalpostError;

pub const TXORACLE_PROGRAM_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

const VALIDATE_STAT_V2_DISCRIMINATOR: [u8; 8] = [208, 215, 194, 214, 241, 71, 246, 178];

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatValidationInput {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatPredicate {
    Single { index: u8, predicate: TraderPredicate },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GeometricTarget {
    pub stat_index: u8,
    pub prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NDimensionalStrategy {
    pub geometric_targets: Vec<GeometricTarget>,
    pub distance_predicate: Option<TraderPredicate>,
    pub discrete_predicates: Vec<StatPredicate>,
}

#[derive(AnchorSerialize)]
struct ValidateStatV2Args {
    payload: StatValidationInput,
    strategy: NDimensionalStrategy,
}

/// Seeds per docs/TXLINE_NOTES.md §5: `["daily_scores_roots", epoch_day: u16
/// LE]`, owned by the TxLINE program (not ours) - verified against a real
/// devnet account (`FtnZq4V8mp56GUNEGGXfL1MuyT81cvoz59yeKn192HdH` for
/// epochDay 20646) during Phase 2 design.
pub fn daily_scores_merkle_roots_pda(epoch_day: u16) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"daily_scores_roots", &epoch_day.to_le_bytes()], &TXORACLE_PROGRAM_ID)
}

/// CPIs into TxLINE's `validate_stat_v2` to authenticate two stat values
/// (home/away total goals, at the finalized period) against the real
/// on-chain daily Merkle root.
///
/// The strategy carries exactly one predicate, deliberately always-true
/// (threshold far outside any realistic scoreline): V2 requires every stat
/// passed in `payload.stats` to be referenced by exactly one predicate or it
/// rejects with `IncompleteStatCoverage`, but we don't want to trust *any*
/// caller-supplied outcome claim - see docs/ARCHITECTURE.md §3. We derive
/// the match outcome ourselves, in `instructions::settle`, from the values
/// this call authenticates - not from whether some predicate held.
pub fn validate_stat_v2<'info>(
    daily_scores_merkle_roots: &AccountInfo<'info>,
    txoracle_program: &AccountInfo<'info>,
    payload: StatValidationInput,
) -> Result<()> {
    let always_true_predicate = TraderPredicate {
        threshold: -999_999,
        comparison: Comparison::GreaterThan,
    };

    let strategy = NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates: vec![StatPredicate::Binary {
            index_a: 0,
            index_b: 1,
            op: BinaryExpression::Subtract,
            predicate: always_true_predicate,
        }],
    };

    let args = ValidateStatV2Args { payload, strategy };

    let mut data = VALIDATE_STAT_V2_DISCRIMINATOR.to_vec();
    args.serialize(&mut data)
        .map_err(|_| error!(GoalpostError::StatValidationFailed))?;

    let ix = Instruction {
        program_id: TXORACLE_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(daily_scores_merkle_roots.key(), false)],
        data,
    };

    invoke(&ix, &[daily_scores_merkle_roots.clone(), txoracle_program.clone()])
        .map_err(|_| error!(GoalpostError::StatValidationFailed))?;

    Ok(())
}
