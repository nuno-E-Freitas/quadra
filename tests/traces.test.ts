import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardView, type DrawnMove } from "@/components/board/board-view";
import { newScene } from "@/lib/presets";
import type { Move } from "@/lib/scene";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASSA" : "FALHA"}  ${label}` +
      (ok ? "" : `\n         esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`),
  );
}

const scene = newScene("play");
const run = (tokenId: string): Move => ({
  tokenId,
  kind: "run",
  points: [
    { x: 10, y: 10 },
    { x: 14, y: 12 },
    { x: 18, y: 10 },
  ],
});

const opacitiesIn = (markup: string) =>
  [...markup.matchAll(/stroke-opacity="([0-9.]+)"/g)].map((m) => Number(m[1]));

const render = (moves: DrawnMove[], focusId: string | null = null) =>
  renderToStaticMarkup(
    createElement(BoardView, { scene, positions: scene.steps[0].positions, moves, focusId }),
  );

/**
 * The court paints its own lines at fixed opacities — 0.5 for the markings, 0.78
 * for the goals — which sit in the same range as a trace and would drown the
 * measurement. Render an empty board first and subtract what it draws.
 */
const COURT = new Set(opacitiesIn(render([])));

/**
 * The strongest stroke a trace draws. The halo and the line share a fade factor,
 * so the brightest of them is what the eye actually reads.
 */
function strengthOf(moves: DrawnMove[], focusId: string | null = null) {
  return opacitiesIn(render(moves, focusId)).filter((v) => !COURT.has(v));
}

console.log("\n== um traço mais velho desenha-se mais fraco ==");
{
  const now = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 0 }]));
  const before = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 1 }]));
  const older = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 2 }]));

  check("o momento a correr é o mais forte", now > before, true);
  check("e o anterior mais forte do que o de trás", before > older, true);
  check("nenhum desaparece de todo", older > 0, true);
}

console.log("\n== a partir de certa idade, para de esbater ==");
{
  const two = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 2 }]));
  const six = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 6 }]));
  check("idade 2 e idade 6 desenham-se igual", two, six);
}

console.log("\n== sem idade, desenha-se como se fosse agora ==");
{
  const none = Math.max(...strengthOf([{ move: run("h4"), progress: 1 }]));
  const zero = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 0 }]));
  check("um traço sem idade é o de agora", none, zero);
}

console.log("\n== a bola esbate como toda a gente ==");
{
  const ballNow = Math.max(...strengthOf([{ move: run("ball"), progress: 1, age: 0 }]));
  const ballOld = Math.max(...strengthOf([{ move: run("ball"), progress: 1, age: 2 }]));
  const manOld = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 2 }]));

  check("o trajeto da bola também recua com a idade", ballOld < ballNow, true);
  check("e recua exatamente como o de um jogador", ballOld, manOld);
}

console.log("\n== focar uma peça manda as outras para trás ==");
{
  // h3's trace is the live one, h4's is two beats old — and h4 is the one asked
  // for, so it has to win anyway.
  const moves: DrawnMove[] = [
    { move: run("h3"), progress: 1, age: 0 },
    { move: run("h4"), progress: 1, age: 2 },
  ];
  const alone = Math.max(...strengthOf([{ move: run("h4"), progress: 1, age: 2 }]));
  const focused = Math.max(...strengthOf(moves, "h4"));
  const free = strengthOf(moves, null);

  check("sem foco, o mais novo lidera", Math.max(...free) > Math.min(...free), true);
  check("com foco, o escolhido volta à força toda apesar da idade", focused > alone, true);
  check("e é ele o mais forte no quadro", focused, Math.max(...strengthOf(moves, "h4")));
  check("o outro cai abaixo de tudo o que havia", Math.min(...strengthOf(moves, "h4")) < Math.min(...free), true);
}

console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
process.exit(failures === 0 ? 0 : 1);
