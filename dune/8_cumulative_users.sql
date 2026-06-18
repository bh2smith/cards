-- Cumulative unique players over time
WITH results AS (
    SELECT evt_block_time, player
    FROM card_circles_gnosis.leaderboardv0_evt_gameresult
    UNION ALL
    SELECT evt_block_time, player
    FROM card_circles_gnosis.leaderboard_evt_gameresult
),
first_seen AS (
    SELECT
        player,
        DATE_TRUNC('day', MIN(evt_block_time)) AS first_day
    FROM results
    GROUP BY player
),
daily_new AS (
    SELECT
        first_day AS day,
        COUNT(*) AS new_players
    FROM first_seen
    GROUP BY first_day
)
SELECT
    day,
    new_players,
    SUM(new_players) OVER (ORDER BY day) AS cumulative_players
FROM daily_new
ORDER BY day
