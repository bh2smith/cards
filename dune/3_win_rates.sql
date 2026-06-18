-- Win rates by game
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
    SELECT gameId, won, cardsRemaining
    FROM card_circles_gnosis.leaderboardv0_evt_gameresult
    UNION ALL
    SELECT gameId, won, cardsRemaining
    FROM card_circles_gnosis.leaderboard_evt_gameresult
)
SELECT
    g.game_name,
    g.game_type,
    COUNT(*) AS total_games,
    COUNT(DISTINCT CASE WHEN r.won THEN 1 END) AS wins,
    COUNT(DISTINCT CASE WHEN NOT r.won THEN 1 END) AS losses,
    ROUND(100.0 * SUM(CASE WHEN r.won THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate_pct,
    ROUND(AVG(CASE WHEN g.game_type = 'Solo' AND r.won THEN r.cardsRemaining END), 1) AS avg_cards_remaining_on_win
FROM results r
LEFT JOIN game_names g ON r.gameId = g.game_id
GROUP BY g.game_name, g.game_type
ORDER BY total_games DESC
