// Server-side commands (run inside the backend or web container):
//   node src/cli.js admin <email or account id>     makes the account a site administrator
//   node src/cli.js unadmin <email or account id>   removes that right
//   node src/cli.js merge <from id> <into id>        merges an account into another (then deletes it)
import { pool, migrate } from './db.js';
import { mergeUsers } from './link.js';

const [command, who, into] = process.argv.slice(2);

async function findAccount(who) {
  const byId = /^\d+$/.test(who);
  const [rows] = await pool.query(
    `SELECT id, name, email FROM users WHERE ${byId ? 'id = ?' : 'email = ?'} ORDER BY last_seen_at DESC`,
    [byId ? Number(who) : who.toLowerCase()],
  );
  if (!rows.length) throw new Error(`Aucun compte pour « ${who} ».`);
  if (rows.length > 1) {
    const list = rows.map((u) => `  ${u.id}  ${u.name ?? '(sans nom)'}`).join('\n');
    throw new Error(`Plusieurs comptes utilisent ce courriel ; précisez son numéro :\n${list}`);
  }
  return rows[0];
}

async function merge(fromId, intoId) {
  const from = await findAccount(fromId);
  const target = await findAccount(intoId);
  if (from.id === target.id) throw new Error('Les deux comptes sont identiques.');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await mergeUsers(conn, from.id, target.id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  console.log(`Compte n° ${from.id} fusionné dans le n° ${target.id} (${target.name ?? 'sans nom'}), puis supprimé.`);
}

try {
  await migrate({ retries: 1 });
  if (command === 'merge') {
    if (!/^\d+$/.test(who ?? '') || !/^\d+$/.test(into ?? '')) throw new Error('Usage : node src/cli.js merge <numéro source> <numéro cible>');
    await merge(who, into);
    process.exit(0);
  }
  if (!['admin', 'unadmin'].includes(command) || !who) {
    throw new Error('Usage : node src/cli.js admin|unadmin|merge …');
  }
  const user = await findAccount(who);
  await pool.query('UPDATE users SET is_site_admin = ? WHERE id = ?', [command === 'admin' ? 1 : 0, user.id]);
  console.log(
    `${user.name ?? '(sans nom)'} (n° ${user.id}) ${command === 'admin' ? 'est maintenant' : "n'est plus"} administrateur du site.`,
  );
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
