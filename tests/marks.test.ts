import { useEditor } from "@/lib/editor-store";
import { newScene } from "@/lib/presets";
import { validateScene } from "@/lib/scene";

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
const kinds = (k: string) => scene().tokens.filter((t) => t.kind === k);

console.log("\n== uma marca vale numa jogada, um cone não ==");
{
  useEditor.getState().load(newScene("play"));
  const before = scene().tokens.length;

  useEditor.getState().addToken("marker", "neutral");
  check("a marca entrou", kinds("marker").length, 1);

  useEditor.getState().addToken("cone", "neutral");
  check("o cone foi recusado numa jogada", kinds("cone").length, 0);

  useEditor.getState().addToken("goal", "neutral");
  check("a baliza foi recusada numa jogada", kinds("goal").length, 0);

  check("só uma peça foi acrescentada", scene().tokens.length, before + 1);
  check("e a cena continua válida", validateScene(scene()).success, true);
}

console.log("\n== num treino entra tudo ==");
{
  useEditor.getState().load(newScene("training"));
  useEditor.getState().addToken("marker", "neutral");
  useEditor.getState().addToken("cone", "neutral");
  useEditor.getState().addToken("goal", "neutral");
  check("marca", kinds("marker").length, 1);
  check("cone", kinds("cone").length >= 1, true);
  check("baliza", kinds("goal").length, 1);
  check("a cena continua válida", validateScene(scene()).success, true);
}

console.log("\n== as marcas ganham letras, os jogadores números ==");
{
  useEditor.getState().load(newScene("play"));
  useEditor.getState().addToken("marker", "neutral");
  useEditor.getState().addToken("marker", "neutral");
  useEditor.getState().addToken("marker", "neutral");
  check("A, B, C pela ordem", kinds("marker").map((t) => t.label), ["A", "B", "C"]);
  check("cada uma com posição em todos os passos", Object.keys(scene().steps[0].positions).length, scene().tokens.length);
}

console.log("\n== o limite de 24 peças é travado antes de guardar ==");
{
  useEditor.getState().load(newScene("play"));
  const start = scene().tokens.length;
  // Ask for far more than the schema allows; the store must stop at the cap
  // rather than let autosave fail with "cena inválida".
  for (let i = 0; i < 30; i++) useEditor.getState().addToken("marker", "neutral");

  check("parou no limite", scene().tokens.length, 24);
  check("acrescentou o que cabia", kinds("marker").length, 24 - start);
  check("e o que ficou é válido", validateScene(scene()).success, true);
}

console.log("\n== uma jogada não aceita jogadores a mais ==");
{
  useEditor.getState().load(newScene("play"));
  const before = kinds("player").length;
  useEditor.getState().addToken("player", "home");
  check("já estava cheia a 5x5", kinds("player").length, before);
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
