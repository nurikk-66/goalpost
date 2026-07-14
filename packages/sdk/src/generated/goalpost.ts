/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/goalpost.json`.
 */
export type Goalpost = {
  "address": "6e6iXff86RZ6ryB7TeJSdn4GfGNDM5xtRz9h1oBQzLNr",
  "metadata": {
    "name": "goalpost",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Trustless World Cup settlement engine on Solana, verified via TxLINE on-chain Merkle proofs"
  },
  "docs": [
    "Trustless World Cup settlement engine. Market outcomes are never",
    "self-reported: `settle` CPIs into TxLINE's on-chain `validate_stat_v2` to",
    "authenticate the real final score, then derives the winning outcome",
    "itself from those proven values. See docs/ARCHITECTURE.md and",
    "docs/TRUST_MODEL.md."
  ],
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "participant",
          "signer": true,
          "relations": [
            "position"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "docs": [
            "Non-participant claims fail before reaching this instruction's body:",
            "these seeds are derived from the *signer's own* pubkey, so a wallet",
            "that never called `join()` has no initialized account at this",
            "address at all."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "participant"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "docs": [
            "The market's escrow: an ATA for `mint` owned by the market PDA",
            "itself. No separate vault PDA/bump needed."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fixtureId",
          "type": "u64"
        },
        {
          "name": "marketType",
          "type": "u8"
        },
        {
          "name": "lockTime",
          "type": "i64"
        }
      ]
    },
    {
      "name": "join",
      "discriminator": [
        206,
        55,
        2,
        106,
        113,
        220,
        17,
        163
      ],
      "accounts": [
        {
          "name": "participant",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "docs": [
            "One position per (market, participant); a second `join()` call from",
            "the same wallet tops this up rather than creating a new one."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "participant"
              }
            ]
          }
        },
        {
          "name": "participantTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": {
            "defined": {
              "name": "outcome"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lockMarket",
      "discriminator": [
        107,
        8,
        184,
        91,
        223,
        13,
        180,
        38
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "settler",
          "docs": [
            "Permissionless: anyone holding a valid TxLINE proof can settle. No",
            "admin key involved - see docs/TRUST_MODEL.md."
          ],
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "dailyScoresMerkleRoots",
          "docs": [
            "checked against that derivation before use (see `InvalidMerkleRootAccount`).",
            "Ownership by the TxLINE program itself is enforced by the CPI: an",
            "account that isn't real TxLINE-owned root data simply fails",
            "downstream inside `validate_stat_v2`."
          ]
        },
        {
          "name": "txoracleProgram",
          "docs": [
            "There's no published Anchor CPI crate for it (see txoracle.rs), so we",
            "can't use the typed `Program<'info, T>` wrapper the way",
            "`token_program: Program<'info, Token>` works for SPL calls; this",
            "address constraint is the equivalent safety check."
          ],
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        }
      ],
      "args": [
        {
          "name": "ts",
          "type": "i64"
        },
        {
          "name": "fixtureSummary",
          "type": {
            "defined": {
              "name": "scoresBatchSummary"
            }
          }
        },
        {
          "name": "fixtureProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "mainTreeProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "eventStatRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "homeStat",
          "type": {
            "defined": {
              "name": "statLeaf"
            }
          }
        },
        {
          "name": "awayStat",
          "type": {
            "defined": {
              "name": "statLeaf"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroAmount",
      "msg": "Stake amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "invalidLockTime",
      "msg": "Lock time must be in the future"
    },
    {
      "code": 6002,
      "name": "marketNotOpen",
      "msg": "Market is not open for joining"
    },
    {
      "code": 6003,
      "name": "marketAlreadyLocked",
      "msg": "Market is already locked, settled, or claimed"
    },
    {
      "code": 6004,
      "name": "lockTimeNotReached",
      "msg": "Market has not reached its lock time yet"
    },
    {
      "code": 6005,
      "name": "marketNotLocked",
      "msg": "Market must be locked before it can be settled"
    },
    {
      "code": 6006,
      "name": "marketNotSettled",
      "msg": "Market has not been settled yet"
    },
    {
      "code": 6007,
      "name": "outcomeMismatch",
      "msg": "This wallet already has a position backing a different outcome in this market"
    },
    {
      "code": 6008,
      "name": "fixtureMismatch",
      "msg": "Proven fixture id does not match this market's fixture id"
    },
    {
      "code": 6009,
      "name": "notFinalResult",
      "msg": "Submitted stat is not from the finalized full-time result"
    },
    {
      "code": 6010,
      "name": "unexpectedStatKey",
      "msg": "Submitted stat key does not match the expected home/away goals keys"
    },
    {
      "code": 6011,
      "name": "invalidMerkleRootAccount",
      "msg": "The supplied daily_scores_merkle_roots account does not match the PDA derived from ts"
    },
    {
      "code": 6012,
      "name": "statValidationFailed",
      "msg": "TxLINE on-chain proof verification failed"
    },
    {
      "code": 6013,
      "name": "alreadyClaimed",
      "msg": "This position has already been claimed"
    },
    {
      "code": 6014,
      "name": "nothingToClaim",
      "msg": "This position did not back the winning outcome"
    },
    {
      "code": 6015,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "u64"
          },
          {
            "name": "marketType",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketStatus"
              }
            }
          },
          {
            "name": "outcome",
            "type": {
              "option": {
                "defined": {
                  "name": "outcome"
                }
              }
            }
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "lockTime",
            "type": "i64"
          },
          {
            "name": "totalHome",
            "type": "u64"
          },
          {
            "name": "totalDraw",
            "type": "u64"
          },
          {
            "name": "totalAway",
            "type": "u64"
          },
          {
            "name": "participantCount",
            "type": "u32"
          },
          {
            "name": "claimedCount",
            "type": "u32"
          },
          {
            "name": "settledAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "settlementEpochDay",
            "type": "u32"
          },
          {
            "name": "settlementHomeGoals",
            "type": "i32"
          },
          {
            "name": "settlementAwayGoals",
            "type": "i32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketStatus",
      "docs": [
        "`Claimed` is a cosmetic terminal state for the UI",
        "(`claimed_count == participant_count`), not a security boundary -",
        "double-claim protection lives on `Position.claimed`."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "locked"
          },
          {
            "name": "settled"
          },
          {
            "name": "claimed"
          }
        ]
      }
    },
    {
      "name": "outcome",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "home"
          },
          {
            "name": "draw"
          },
          {
            "name": "away"
          }
        ]
      }
    },
    {
      "name": "position",
      "docs": [
        "One position per wallet per market - a wallet backs exactly one outcome",
        "(no same-market hedging). `join()` tops up `amount` on repeat calls",
        "rather than creating a second position."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "participant",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": {
              "defined": {
                "name": "outcome"
              }
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isRightSibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "scoreStat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "scoresBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "scoresUpdateStats"
              }
            }
          },
          {
            "name": "eventsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "i32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "statLeaf",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stat",
            "type": {
              "defined": {
                "name": "scoreStat"
              }
            }
          },
          {
            "name": "statProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          }
        ]
      }
    }
  ]
};
