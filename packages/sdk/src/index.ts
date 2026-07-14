export { loadProgram } from "./program.js";
export type { Goalpost } from "./program.js";

export { GOALPOST_PROGRAM_ID, TXORACLE_PROGRAM_ID, TXLINE_API_BASE_URL, SETTLE_COMPUTE_UNIT_LIMIT } from "./constants.js";

export { marketPda, positionPda, dailyScoresMerkleRootsPda, epochDayFromTimestampMs } from "./pda.js";

export { createMarket, join, lockMarket, getMarket } from "./market.js";
export type { CreateMarketParams, JoinParams, OutcomeArg } from "./market.js";

export { settle, claim } from "./settle.js";
export type { SettleParams, ClaimParams } from "./settle.js";

export { settleArgsFromProof } from "./proof.js";
export type { SettleArgs, TxLineStatValidationResponseV2 } from "./proof.js";

export { GoalpostProgramError, TxLineApiError, parseGoalpostError, parseTxLineHttpError, GOALPOST_ERROR_NAMES } from "./errors.js";
export type { GoalpostErrorName, TxLineErrorKind } from "./errors.js";

export { authenticateTxLine } from "./txline/auth.js";
export type { TxLineSession } from "./txline/auth.js";

export { TxLineClient } from "./txline/client.js";
export type { Fixture, ResultWithProof, TxLineClientOptions } from "./txline/client.js";
