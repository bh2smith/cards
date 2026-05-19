-- Player leaderboard: top players by total games and win rate
WITH game_names AS (
    SELECT column0 AS game_id, column1 AS game_name FROM (
        VALUES
            (0, 'Golf'), (1, 'Pyramid'), (2, 'Cribbage'),
            (3, 'Blackjack'), (4, 'Gin Rummy'), (5, 'Hearts')
    ) AS games
),
results AS (
    SELECT evt_block_time, player, gameId, won
    FROM card_circles_gnosis.CardRoomLeaderboard_evt_GameResult
    UNION ALL
    SELECT evt_block_time, player, gameId, won
    FROM card_circles_gnosis.CardRoomLeaderboardV2_evt_GameResult
)
SELECT
    r.player,
    COUNT(*) AS total_games,
    SUM(CASE WHEN r.won THEN 1 ELSE 0 END) AS wins,
    ROUND(100.0 * SUM(CASE WHEN r.won THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_pct,
    COUNT(DISTINCT r.gameId) AS distinct_games_played,
    MIN(r.evt_block_time) AS first_game,
    MAX(r.evt_block_time) AS last_game,
    ARRAY_AGG(DISTINCT g.game_name) AS games_played
FROM results r
LEFT JOIN game_names g ON r.gameId = g.game_id
GROUP BY r.player
ORDER BY total_games DESC
