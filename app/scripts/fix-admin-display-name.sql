UPDATE accounts
SET display_name = '管理员',
    updated_at = datetime('now')
WHERE username = 'admin'
  AND display_name = '???';

UPDATE audit_logs
SET actor_name = '管理员'
WHERE actor_name = '???';
