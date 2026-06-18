-- CRC token transfers into the treasury
-- Circles v2 on Gnosis uses erc20 Transfer events from personal CRC token contracts
-- Treasury: 0x335D5a9adA218A2b334c5E17242D15158e7380f9
SELECT
    DATE_TRUNC('day', evt_block_time) AS day,
    COUNT(*) AS transfer_count,
    COUNT(DISTINCT "from") AS unique_payers,
    SUM(value / 1e18) AS total_crc
FROM erc20_gnosis.evt_Transfer
WHERE "to" = 0x335D5a9adA218A2b334c5E17242D15158e7380f9
GROUP BY 1
ORDER BY 1
