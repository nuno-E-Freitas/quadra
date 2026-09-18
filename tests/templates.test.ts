import { DEFAULT_PITCH, newScene } from "@/lib/presets";
import { sceneFromTemplate } from "@/lib/drills/template";
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

/** A play whose pieces were moved and which already has movement recorded. */
function drawnPlay() {
  const scene = newScene("play");
  scene.steps[0].positions.h4 = { x: 31, y: 5 };
  scene.steps[0].positions.h3 = { x: 31, y: 15 };
  scene.steps.push({
    id: "s1",
    durationMs: 1200,
    moves: [{ tokenId: "h4", kind: "run", points: [{ x: 31, y: 5 }, { x: 36, y: 6 }] }],
    positions: { ...scene.steps[0].positions, h4: { x: 36, y: 6 } },
  });
  return scene;
}

console.log("\n== sem template, a formação de sempre ==");
{
  const made = sceneFromTemplate(null, "play");
  check("igual a uma cena nova", made.steps[0].positions, newScene("play").steps[0].positions);
  check("válida", validateScene(made).success, true);
}

console.log("\n== com template, a equipa já está no sítio ==");
{
  const made = sceneFromTemplate(drawnPlay(), "play");
  check("h4 onde o treinador o deixou", made.steps[0].positions.h4, { x: 31, y: 5 });
  check("h3 também", made.steps[0].positions.h3, { x: 31, y: 15 });
  check("válida", validateScene(made).success, true);
}

console.log("\n== o template é uma posição, não o movimento de outra jogada ==");
{
  const made = sceneFromTemplate(drawnPlay(), "play");
  check("só o arranque sobrevive", made.steps.length, 1);
  check("sem trajetos herdados", made.steps[0].moves, []);
}

console.log("\n== o campo vem das definições, não da jogada de onde se copiou ==");
{
  const source = drawnPlay();
  source.pitch.surface = "#123456";
  source.pitch.overlays = ["voleibol"];

  const mine = { surface: "#14171a", lines: "#7fe3b0", surround: "#0b0d0f", overlays: ["basquetebol" as const] };
  const made = sceneFromTemplate(source, "play", mine);

  check("piso do treinador", made.pitch.surface, mine.surface);
  check("linhas do pavilhão do treinador", made.pitch.overlays, ["basquetebol"]);
  check("e não as da jogada copiada", made.pitch.surface === "#123456", false);

  const bare = sceneFromTemplate(source, "play");
  check("sem preferência, volta ao campo original", bare.pitch.surface, DEFAULT_PITCH.surface);
}

console.log("\n== um template só serve o seu próprio género ==");
{
  const made = sceneFromTemplate(drawnPlay(), "training");
  check("uma jogada não arruma um exercício", made.steps[0].positions.h4, undefined);
  check("caiu na formação de treino", made.kind, "training");
  check("válida", validateScene(made).success, true);
}

console.log("\n== lixo no template não parte nada ==");
{
  for (const junk of [{}, { kind: "play" }, "nada", 42, []]) {
    const made = sceneFromTemplate(junk, "play");
    check(
      "recusado: " + JSON.stringify(junk),
      validateScene(made).success && made.steps.length === 1,
      true,
    );
  }
}

console.log("\n== o equipamento também vem das definições ==");
{
  const kit = { home: "#112233", away: "#445566" };

  const fresh = newScene("play", {}, kit);
  const sides = (s: ReturnType<typeof newScene>) => ({
    home: [...new Set(s.tokens.filter((t) => t.kind === "player" && t.side === "home").map((t) => t.color))],
    away: [...new Set(s.tokens.filter((t) => t.kind === "player" && t.side === "away").map((t) => t.color))],
  });

  check("uma cena nova veste as duas equipas", sides(fresh), { home: [kit.home], away: [kit.away] });
  check("a bola não é uma equipa", fresh.tokens.find((t) => t.kind === "ball")?.color, "#ffffff");

  // The template gives the shape; the settings give the look — the same rule the
  // court follows, so there is one rule to remember rather than two.
  const source = drawnPlay();
  source.tokens = source.tokens.map((t) =>
    t.kind === "player" ? { ...t, color: "#ff0000" } : t,
  );
  const fromTemplate = sceneFromTemplate(source, "play", {}, kit);
  check("um template também é vestido", sides(fromTemplate), { home: [kit.home], away: [kit.away] });
  check("e mantém as posições do template", fromTemplate.steps[0].positions.h4, { x: 31, y: 5 });

  const noKit = sceneFromTemplate(source, "play");
  check("sem preferência, fica o que o template trazia", noKit.tokens.find((t) => t.kind === "player")?.color, "#ff0000");
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
