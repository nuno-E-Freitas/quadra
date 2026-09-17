import { useEditor } from "@/lib/editor-store";
import { newScene } from "@/lib/presets";
import { ballsCarriedBy, carrierOf, type Scene, type Vec } from "@/lib/scene";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "PASSA" : "FALHA"}  ${label}${ok ? "" : `\n         esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`}`);
}
const round = (v: Vec) => ({ x: +v.x.toFixed(2), y: +v.y.toFixed(2) });

function fresh(): Scene {
  const scene = newScene("play");
  // h4 starts at (26,3); park the ball just off his foot, 0.6 m away.
  scene.steps[0].positions.h4 = { x: 26, y: 3 };
  scene.steps[0].positions.ball = { x: 26.5, y: 3.33 };
  scene.attachments = {};
  return scene;
}

console.log("\n== quem leva a bola ==");
{
  const scene = fresh();
  const at = scene.steps[0].positions;
  check("bola a 0,6 m do h4 -> h4 leva-a", carrierOf(scene, at, "ball"), "h4");

  const far = structuredClone(scene);
  far.steps[0].positions.ball = { x: 32, y: 3 };
  check("bola a 6 m -> ninguem a leva", carrierOf(far, far.steps[0].positions, "ball"), null);

  // h3 sits at (26,17); put the ball between them but nearer h3
  const between = structuredClone(scene);
  between.steps[0].positions.h4 = { x: 26, y: 10 };
  between.steps[0].positions.h3 = { x: 26, y: 11 };
  between.steps[0].positions.ball = { x: 26, y: 10.8 };
  check("dois jogadores perto -> so o mais proximo", carrierOf(between, between.steps[0].positions, "ball"), "h3");

  const pinned = structuredClone(between);
  pinned.attachments = { ball: "h4" };
  check("ligacao explicita ganha a proximidade", carrierOf(pinned, pinned.steps[0].positions, "ball"), "h4");

  check("balls carried by h4", ballsCarriedBy(scene, at, "h4"), ["ball"]);
  check("balls carried by h3", ballsCarriedBy(scene, at, "h3"), []);
}

console.log("\n== reposicionar no arranque ==");
{
  useEditor.getState().load(fresh());
  useEditor.getState().moveToken("h4", { x: 30, y: 8 });
  const at = useEditor.getState().scene.steps[0].positions;
  check("h4 foi para onde se pediu", round(at.h4), { x: 30, y: 8 });
  // moved by (+4, +5), so the ball keeps its 0.5/0.33 gap
  check("a bola foi junto, mantendo a folga", round(at.ball), { x: 30.5, y: 8.33 });
}

console.log("\n== bola longe nao e arrastada ==");
{
  const scene = fresh();
  scene.steps[0].positions.ball = { x: 10, y: 10 };
  useEditor.getState().load(scene);
  useEditor.getState().moveToken("h4", { x: 30, y: 8 });
  const at = useEditor.getState().scene.steps[0].positions;
  check("a bola ficou onde estava", round(at.ball), { x: 10, y: 10 });
}

console.log("\n== gravar um trajeto num passo ==");
{
  useEditor.getState().load(fresh());
  useEditor.getState().addStep();
  useEditor.getState().setTool("run");
  // a straight run from h4's spot to (34,3)
  useEditor.getState().recordDrag("h4", [
    { x: 26, y: 3 },
    { x: 30, y: 3 },
    { x: 34, y: 3 },
  ]);

  const step = useEditor.getState().scene.steps[1];
  const kinds = Object.fromEntries(step.moves.map((m) => [m.tokenId, m.kind]));
  check("o jogador fica com uma corrida", kinds.h4, "run");
  check("a bola fica com uma conducao", kinds.ball, "dribble");
  check("o jogador acaba onde largou", round(step.positions.h4), { x: 34, y: 3 });
  check("a bola acaba a mesma folga a frente", round(step.positions.ball), { x: 34.5, y: 3.33 });
}

console.log("\n== um passe nao arrasta a bola com o jogador ==");
{
  useEditor.getState().load(fresh());
  useEditor.getState().addStep();
  useEditor.getState().setTool("screen");
  useEditor.getState().recordDrag("h4", [
    { x: 26, y: 3 },
    { x: 30, y: 3 },
  ]);
  const step = useEditor.getState().scene.steps[1];
  check("nenhum movimento gravado para a bola", step.moves.some((m) => m.tokenId === "ball"), false);
  check("a bola ficou parada", round(step.positions.ball), { x: 26.5, y: 3.33 });
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
