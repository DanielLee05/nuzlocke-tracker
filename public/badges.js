// Pixel-art renditions of the eight Hoenn (Emerald) gym badges, 12×12 grids rendered as crisp SVG.
// Each entry: name, palette (char -> colour), and 12 rows of 12 chars ('.' = transparent).
window.BADGES = [
  {
    name: "Stone Badge",
    pal: { G: "#4b5563", L: "#9ca3af", W: "#e5e7eb", D: "#6b7280" },
    px: [
      "............",
      "............",
      "...GGGGGG...",
      "..GLLLLLLG..",
      ".GLWWLLLLLG.",
      "GLWWLLLLLLDG",
      "GLLLLLLLLLDG",
      ".GLLLLLLDDG.",
      "..GLDDDDDG..",
      "...GGGGGG...",
      "............",
      "............",
    ],
  },
  {
    name: "Knuckle Badge",
    pal: { O: "#7c3a1a", T: "#d97706", W: "#fde68a" },
    px: [
      "............",
      "....OOOOO...",
      "...OTTTTTO..",
      "..OTTWTTTTO.",
      "..OTTTTTTTO.",
      ".OTTOOOOTTO.",
      ".OTOTTTTOTO.",
      ".OTOTTTTOTO.",
      ".OTTOOOOTTO.",
      "..OTTTTTTO..",
      "...OOOOOO...",
      "............",
    ],
  },
  {
    name: "Dynamo Badge",
    pal: { O: "#92400e", F: "#facc15", B: "#fffbeb", S: "#eab308" },
    px: [
      "............",
      "...OOOOOO...",
      "..OFFFFFFO..",
      ".OFFFBBFFFO.",
      ".OFFBBFFFFO.",
      "OFFBBBBFFSFO",
      "OFFFFBBFFSFO",
      ".OFFFBBFSSO.",
      ".OFFFBFFSSO.",
      "..OFFFSSSO..",
      "...OOOOOO...",
      "............",
    ],
  },
  {
    name: "Heat Badge",
    pal: { R: "#991b1b", O: "#f97316", Y: "#fbbf24", W: "#fef3c7" },
    px: [
      "............",
      "....RRRR....",
      "...ROOOOR...",
      "..ROOYYOOR..",
      ".ROOYWWYOOR.",
      ".ROYWWWWYOR.",
      ".ROYWWWWYOR.",
      ".ROOYWWYOOR.",
      "..ROOYYOOR..",
      "...ROOOOR...",
      "....RRRR....",
      "............",
    ],
  },
  {
    name: "Balance Badge",
    pal: { B: "#1e40af", S: "#93c5fd", W: "#eff6ff" },
    px: [
      "............",
      ".BBBBBBBBBB.",
      ".BSSSSSSSSB.",
      ".BSBBBBBBSB.",
      ".BSBWWWWBSB.",
      ".BSBWSSWBSB.",
      ".BSBWSSWBSB.",
      ".BSBWWWWBSB.",
      ".BSBBBBBBSB.",
      ".BSSSSSSSSB.",
      ".BBBBBBBBBB.",
      "............",
    ],
  },
  {
    name: "Feather Badge",
    pal: { T: "#0f766e", W: "#5eead4", L: "#ccfbf1" },
    px: [
      "............",
      ".....TT.....",
      "....TLWT....",
      "...TLWTWT...",
      "..TLWWTWWT..",
      ".TLWWWTWWWT.",
      ".TWWWWTWWWT.",
      "..TWWWTWWT..",
      "...TWWTWT...",
      "....TWTT....",
      ".....TT.....",
      "............",
    ],
  },
  {
    name: "Mind Badge",
    pal: { P: "#6d28d9", M: "#c084fc", W: "#f5d0fe" },
    px: [
      "............",
      "............",
      "..PPP..PPP..",
      ".PMMMPPMMMP.",
      ".PMWMMMMMMP.",
      ".PMMMMMMMMP.",
      "..PMMMMMMP..",
      "...PMMMMP...",
      "....PMMP....",
      ".....PP.....",
      "............",
      "............",
    ],
  },
  {
    name: "Rain Badge",
    pal: { B: "#1d4ed8", L: "#60a5fa", W: "#dbeafe" },
    px: [
      "............",
      ".....BB.....",
      "....BLLB....",
      "....BLLB....",
      "...BLLLLB...",
      "...BLWLLB...",
      "..BLWLLLLB..",
      "..BLLLLLLB..",
      "..BLLLLLLB..",
      "...BLLLLB...",
      "....BBBB....",
      "............",
    ],
  },
];

window.badgeSvg = function badgeSvg(i) {
  const b = window.BADGES[i];
  let rects = "";
  b.px.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = b.pal[row[x]];
      if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  });
  return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
};
