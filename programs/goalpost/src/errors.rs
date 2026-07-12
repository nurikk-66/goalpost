use anchor_lang::prelude::*;

#[error_code]
pub enum GoalpostError {
    #[msg("Stake amount must be greater than zero")]
    ZeroAmount,
    #[msg("Lock time must be in the future")]
    InvalidLockTime,
    #[msg("Market is not open for joining")]
    MarketNotOpen,
    #[msg("Market is already locked, settled, or claimed")]
    MarketAlreadyLocked,
    #[msg("Market has not reached its lock time yet")]
    LockTimeNotReached,
    #[msg("Market must be locked before it can be settled")]
    MarketNotLocked,
    #[msg("Market has not been settled yet")]
    MarketNotSettled,
    #[msg("This wallet already has a position backing a different outcome in this market")]
    OutcomeMismatch,
    #[msg("Proven fixture id does not match this market's fixture id")]
    FixtureMismatch,
    #[msg("Submitted stat is not from the finalized full-time result")]
    NotFinalResult,
    #[msg("Submitted stat key does not match the expected home/away goals keys")]
    UnexpectedStatKey,
    #[msg("The supplied daily_scores_merkle_roots account does not match the PDA derived from ts")]
    InvalidMerkleRootAccount,
    #[msg("TxLINE on-chain proof verification failed")]
    StatValidationFailed,
    #[msg("This position has already been claimed")]
    AlreadyClaimed,
    #[msg("This position did not back the winning outcome")]
    NothingToClaim,
    #[msg("Arithmetic overflow")]
    Overflow,
}
