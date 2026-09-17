import { DEFAULT_PITCH, PITCH_PRESETS, newScene } from "@/lib/presets";
import { PITCH_OVERLAYS, sceneSchema } from "@/lib/scene";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASSA" : "FALHA"}  ${label}` +
      (ok ? "" : `\n         esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`),
  );
}

console.log("\n== cenas guardadas antes das cores existirem ==");
{
  // Exactly what the JSONB column holds for every drill saved until now.
  const old = {
    ...newScene("play"),
    pitch: { width: 40, height: 20, variant: "full" },
  };
  const parsed = sceneSchema.safeParse(old);
  check("continua a validar", parsed.success, true);
  if (parsed.success) {
    check("as cores originais são preenchidas", parsed.data.pitch, {
      width: 40,
      height: 20,
      variant: "full",
      ...DEFAULT_PITCH,
    });
  }
}

console.log("\n== uma cena nova segue a preferência do treinador ==");
{
  const mine = { surface: "#14171a", lines: "#7fe3b0", surround: "#0b0d0f" };
  const scene = newScene("play", mine);
  check("piso", scene.pitch.surface, mine.surface);
  check("linhas", scene.pitch.lines, mine.lines);
  check("fora", scene.pitch.surround, mine.surround);
  check("a geometria não se mexe", [scene.pitch.width, scene.pitch.height], [40, 20]);
}

console.log("\n== sem preferência, o campo de sempre ==");
{
  const scene = newScene("training");
  check("piso", scene.pitch.surface, DEFAULT_PITCH.surface);
  check("linhas", scene.pitch.lines, DEFAULT_PITCH.lines);
}

console.log("\n== uma preferência parcial só mexe no que traz ==");
{
  const scene = newScene("play", { lines: "#ff0000" });
  check("linhas trocadas", scene.pitch.lines, "#ff0000");
  check("piso intacto", scene.pitch.surface, DEFAULT_PITCH.surface);
}

console.log("\n== as cores propostas são hex de seis dígitos ==");
{
  const bad = PITCH_PRESETS.filter(
    (p) => ![p.surface, p.lines, p.surround].every((c) => /^#[0-9a-f]{6}$/i.test(c)),
  );
  check("nenhuma inválida", bad.map((p) => p.name), []);

  // A scene built from each preset must survive the schema, since that is the
  // only thing standing between a preset and the database.
  const rejected = PITCH_PRESETS.filter((p) => !sceneSchema.safeParse(newScene("play", p)).success);
  check("todas passam o schema", rejected.map((p) => p.name), []);
}

console.log("\n== linhas do pavilhão ==");
{
  // What the JSONB column holds for every drill saved before overlays existed.
  const old = { ...newScene("play"), pitch: { width: 40, height: 20, variant: "full" } };
  const parsed = sceneSchema.safeParse(old);
  check("uma cena antiga continua válida", parsed.success, true);
  if (parsed.success) check("e fica sem marcações", parsed.data.pitch.overlays, []);

  const marked = newScene("play", { overlays: ["basquetebol", "andebol"] });
  check("uma cena nova segue a preferência", marked.pitch.overlays, ["basquetebol", "andebol"]);
  check("e continua válida", sceneSchema.safeParse(marked).success, true);

  // A name from a version of this app that offered something we no longer do.
  const bogus = newScene("play");
  (bogus.pitch as unknown as { overlays: string[] }).overlays = ["padel"];
  check("um nome desconhecido é recusado", sceneSchema.safeParse(bogus).success, false);

  check(
    "as três modalidades passam o schema",
    PITCH_OVERLAYS.filter((o) => !sceneSchema.safeParse(newScene("play", { overlays: [o] })).success),
    [],
  );
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
