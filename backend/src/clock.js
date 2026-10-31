// "Today" and "now" are computed in the application's timezone (not the container's),
// so archiving and edit deadlines behave the same regardless of where the server runs.
const TZ = process.env.APP_TIMEZONE || 'America/Toronto';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

export function clock() {
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const today = `${p.year}-${p.month}-${p.day}`;
  return { today, now: `${today} ${p.hour}:${p.minute}:${p.second}`, timezone: TZ };
}
