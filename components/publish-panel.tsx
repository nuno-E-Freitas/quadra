import { publishDrill, unpublishDrill } from "@/lib/teams/actions";
import styles from "@/app/(app)/app.module.css";

/**
 * Publishing is separate from the share link on purpose. The /b/ link stays
 * public and unguessable for anyone you paste it to; publishing is what makes a
 * drill appear, without a link, in the trainings of everyone in the squad.
 */
export function PublishPanel({
  drillId,
  teams,
  publishedTo,
}: {
  drillId: string;
  teams: { id: string; name: string }[];
  publishedTo: string[];
}) {
  if (teams.length === 0) return null;
  const live = new Set(publishedTo);

  return (
    <section className={styles.section}>
      <h2>Publish to a squad</h2>
      <div className={styles.rows}>
        {teams.map((team) => {
          const on = live.has(team.id);
          return (
            <div key={team.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>{team.name}</b>
                <span className={styles.meta}>
                  {on ? "in every player's trainings" : "not published"}
                </span>
              </div>
              <form action={on ? unpublishDrill : publishDrill}>
                <input type="hidden" name="drillId" value={drillId} />
                <input type="hidden" name="teamId" value={team.id} />
                <button className={on ? "btn" : "btn btn-primary"} type="submit">
                  {on ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </section>
  );
}
