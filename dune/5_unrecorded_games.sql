-- Unrecorded games: players who paid CRC entry fee but have no matching game result
-- Compares per-player payment count vs recorded game count
WITH payments AS (
    SELECT
        "from" AS player,
        COUNT(*) AS times_paid,
        SUM(value / 1e18) AS total_crc_paid
    FROM erc20_gnosis.evt_Transfer
    WHERE "to" = 0x335D5a9adA218A2b334c5E17242D15158e7380f9
    GROUP BY 1
),
recorded AS (
    SELECT player, COUNT(*) AS games_recorded
    FROM (
        SELECT player FROM card_circles_gnosis.leaderboardv0_evt_gameresult
        UNION ALL
        SELECT player FROM card_circles_gnosis.leaderboard_evt_gameresult
    ) r
    GROUP BY 1
)
SELECT
    p.player,
    p.times_paid,
    p.total_crc_paid,
    COALESCE(r.games_recorded, 0) AS games_recorded,
    p.times_paid - COALESCE(r.games_recorded, 0) AS unrecorded_games
FROM payments p
LEFT JOIN recorded r ON p.player = r.player
WHERE p.times_paid > COALESCE(r.games_recorded, 0)
ORDER BY unrecorded_games DESC
