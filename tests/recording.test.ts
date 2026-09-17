import { useEditor } from "@/lib/editor-store";
import { newScene } from "@/lib/presets";
import type { Scene, Vec } from "@/lib/scene";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASSA" : "FALHA"}  ${label}` +
      (ok ? "" : `\n         esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`),
  );
}

const state = () => useEditor.getState();
const scene = () => state().scene;
/** Which tokens moved in each step, setup excluded. */
const beats = () => scene().steps.slice(1).map((s) => s.moves.map((m) => m.tokenId).sort());

/** A drag is a straight line from wherever the token currently rests. */
function drag(id: string, to: Vec) {
  const from = scene().steps[state().stepIndex].positions[id];
  useEditor.getState().recordDrag(id, [{ ...from }, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to]);
}

/** The default play puts the ball at h4's feet; park it away for the plain cases. */
function loose(): Scene {
  const s = newScene("play");
  // A corner nobody is standing in: at (20,10) the ball is one metre from
  // h2, who would then carry it into every drag and muddy what is being tested.
  s.steps[0].positions.ball = { x: 2, y: 18 };
  return s;
}

console.log("\n== gravar abre um momento e fecha-o ==");
{
  useEditor.getState().load(loose());
  check("começa fora de gravação", state().recording, false);
  check("uma cena nova tem só a posição inicial", scene().steps.length, 1);

  useEditor.getState().startRecording();
  check("gravar liga", state().recording, true);
  check("abriu o primeiro momento", scene().steps.length, 2);
  check("e levou-nos para lá", state().stepIndex, 1);

  useEditor.getState().stopRecording();
  check("terminar desliga", state().recording, false);
  check("um momento aberto e não usado não fica", scene().steps.length, 1);
}

console.log("\n== vários jogadores no mesmo momento ==");
{
  useEditor.getState().load(loose());
  useEditor.getState().startRecording();
  drag("h3", { x: 30, y: 16 });
  drag("h2", { x: 24, y: 10 });
  drag("a2", { x: 28, y: 12 });
  check("os três ficaram no mesmo momento", beats(), [["a2", "h2", "h3"]]);
  check("continua um só momento", scene().steps.length, 2);
}

console.log("\n== voltar a um que já mexeu abre o momento seguinte ==");
{
  useEditor.getState().load(loose());
  useEditor.getState().startRecording();
  drag("h3", { x: 30, y: 16 });
  drag("h2", { x: 24, y: 10 });
  check("ainda no primeiro", state().stepIndex, 1);

  drag("h3", { x: 34, y: 12 });
  check("h3 outra vez abriu o segundo", state().stepIndex, 2);
  check("e foi para lá que o trajeto foi", beats(), [["h2", "h3"], ["h3"]]);

  drag("h2", { x: 28, y: 6 });
  check("h2 junta-se ao segundo", beats(), [["h2", "h3"], ["h2", "h3"]]);

  useEditor.getState().stopRecording();
  check("dois momentos gravados", scene().steps.length, 3);
}

console.log("\n== fora de gravação, arrastar outra vez ainda corrige ==");
{
  useEditor.getState().load(loose());
  useEditor.getState().addStep();
  drag("h3", { x: 30, y: 16 });
  drag("h3", { x: 34, y: 12 });
  check("continua um só momento", scene().steps.length, 2);
  check("com um só trajeto para h3", beats(), [["h3"]]);
  check("e termina onde o segundo arrasto largou", scene().steps[1].positions.h3, { x: 34, y: 12 });
}

console.log("\n== a bola aos pés conta como movimento desse momento ==");
{
  // The default play already has the ball at h4's feet.
  useEditor.getState().load(newScene("play"));
  useEditor.getState().startRecording();
  drag("h4", { x: 31, y: 4 });
  check("h4 leva a bola no mesmo momento", beats(), [["ball", "h4"]]);

  drag("ball", { x: 34, y: 9 });
  check("mexer a bola a seguir é o momento seguinte", state().stepIndex, 2);
  check("o passe ficou sozinho no segundo", beats(), [["ball", "h4"], ["ball"]]);
}

console.log("\n== terminar guarda o último momento se foi usado ==");
{
  useEditor.getState().load(loose());
  useEditor.getState().startRecording();
  drag("h3", { x: 30, y: 16 });
  useEditor.getState().stopRecording();
  check("o momento usado fica", scene().steps.length, 2);
  check("e o índice não aponta para fora", state().stepIndex < scene().steps.length, true);
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
