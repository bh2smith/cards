-- Daily active players and games played (use as time-series chart)
WITH game_names AS (
    SELECT column0 AS game_id, column1 AS game_name FROM (
        VALUES
            (0, 'Golf'), (1, 'Pyramid'), (2, 'Cribbage'),
            (3, 'Blackjack'), (4, 'Gin Rummy'), (5, 'Hearts')
    ) AS games
),
results AS (
    SELECT evt_block_time, player, gameId
    FROM card_circles_gnosis.CardRoomLeaderboard_evt_GameResult
    UNION ALL
    SELECT evt_block_time, player, gameId
    FROM card_circles_gnosis.CardRoomLeaderboardV2_evt_GameResult
)
SELECT
    DATE_TRUNC('day', r.evt_block_time) AS day,
    COUNT(*) AS games_played,
    COUNT(DISTINCT r.player) AS unique_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 0 THEN r.player END) AS golf_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 1 THEN r.player END) AS pyramid_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 2 THEN r.player END) AS cribbage_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 3 THEN r.player END) AS blackjack_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 4 THEN r.player END) AS gin_rummy_players,
    COUNT(DISTINCT CASE WHEN r.gameId = 5 THEN r.player END) AS hearts_players
FROM results r
GROUP BY 1
ORDER BY 1
