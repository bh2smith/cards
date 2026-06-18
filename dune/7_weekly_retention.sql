-- Weekly cohort retention: tracks how many players return each week after first play
WITH results AS (
    SELECT evt_block_time, player
    FROM card_circles_gnosis.leaderboardv0_evt_gameresult
    UNION ALL
    SELECT evt_block_time, player
    FROM card_circles_gnosis.leaderboard_evt_gameresult
),
first_play AS (
    SELECT
        player,
        DATE_TRUNC('week', MIN(evt_block_time)) AS cohort_week
    FROM results
    GROUP BY player
),
activity AS (
    SELECT DISTINCT
        r.player,
        DATE_TRUNC('week', r.evt_block_time) AS active_week
    FROM results r
)
SELECT
    f.cohort_week,
    COUNT(DISTINCT f.player) AS cohort_size,
    COUNT(DISTINCT CASE WHEN a.active_week = f.cohort_week THEN a.player END) AS week_0,
    COUNT(DISTINCT CASE WHEN a.active_week = f.cohort_week + INTERVAL '1' WEEK THEN a.player END) AS week_1,
    COUNT(DISTINCT CASE WHEN a.active_week = f.cohort_week + INTERVAL '2' WEEK THEN a.player END) AS week_2,
    COUNT(DISTINCT CASE WHEN a.active_week = f.cohort_week + INTERVAL '3' WEEK THEN a.player END) AS week_3,
    COUNT(DISTINCT CASE WHEN a.active_week = f.cohort_week + INTERVAL '4' WEEK THEN a.player END) AS week_4
FROM first_play f
LEFT JOIN activity a ON f.player = a.player
GROUP BY f.cohort_week
ORDER BY f.cohort_week
