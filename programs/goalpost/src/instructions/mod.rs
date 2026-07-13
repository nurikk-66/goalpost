pub mod claim;
pub mod create_market;
pub mod join;
pub mod lock_market;
pub mod settle;

// Glob re-exports, not named ones: `#[derive(Accounts)]` generates private
// companion items (`__client_accounts_*`) alongside each struct that the
// `#[program]` macro's codegen expects to reach via `crate::` - a named
// re-export of just e.g. `Claim` doesn't bring those along, which fails
// with "unresolved import `crate`" pointing at the #[program] module.
pub use claim::*;
pub use create_market::*;
pub use join::*;
pub use lock_market::*;
pub use settle::*;
