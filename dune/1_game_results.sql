-- All game results (V1 + V2 combined)
-- Table names assume project_name=card_circles, contract_name=CardRoomLeaderboard / CardRoomLeaderboardV2
WITH game_names AS (
    SELECT column0 AS game_id, column1 AS game_name, column2 AS game_type FROM (
        VALUES
            (0, 'Golf',      'Solo'),
            (1, 'Pyramid',   'Solo'),
            (2, 'Cribbage',  'vs AI'),
            (3, 'Blackjack', 'vs AI'),
            (4, 'Gin Rummy', 'vs AI'),
            (5, 'Hearts',    'vs AI')
    ) AS games
),
results AS (
    SELECT
        evt_block_time,
        evt_tx_hash,
        gameId,
        player,
        won,
        cardsRemaining,
        timestamp,
        'v1' AS contract_version
    FROM card_circles_gnosis.leaderboardv0_evt_gameresult

    UNION ALL

    SELECT
        evt_block_time,
        evt_tx_hash,
        gameId,
        player,
        won,
        cardsRemaining,
        timestamp,
        'v2' AS contract_version
    FROM card_circles_gnosis.leaderboard_evt_gameresult
)
SELECT
    r.evt_block_time,
    r.evt_tx_hash,
    r.player,
    r.gameId AS game_id,
    g.game_name,
    g.game_type,
    r.won,
    r.cardsRemaining AS cards_remaining,
    r.contract_version
FROM results r
LEFT JOIN game_names g ON r.gameId = g.game_id
ORDER BY r.evt_block_time DESC
