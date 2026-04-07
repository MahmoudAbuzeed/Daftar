-- Rename daftar_entries table to ledger_entries
ALTER TABLE daftar_entries RENAME TO ledger_entries;

-- Update any RLS policies that reference the old table name
-- (policies auto-follow table renames, but indexes/triggers may reference old names)
