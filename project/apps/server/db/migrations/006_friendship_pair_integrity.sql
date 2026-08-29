-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

-- Keep one deterministic relationship row for each unordered account pair.
-- Older releases allowed the same pair in opposite directions; retain the
-- most recently updated row before enforcing the invariant for new writes.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS row_number
  FROM echoverse_friendships
)
DELETE FROM echoverse_friendships AS friendship
USING ranked
WHERE friendship.id = ranked.id AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS echoverse_friendships_pair_unique_idx
  ON echoverse_friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
