// Drag-scroll check in a long shop list (portrait) and tap-to-select.
export default async (page, h) => {
  await h.eval(() => { G.newGame(); G.state.gold = 50; G.shop.open('crownhold_smith'); });
  await h.wait(500);
  const W = await h.W();
  await h.drag(W / 2, 200, W / 2, 90, 400); await h.wait(300);
  await h.shot('drag_scrolled');
  await h.tap(W / 2, 120); await h.wait(300);
  await h.shot('drag_tapsel');
  await h.drag(W / 2 + 40, 100, W / 2 + 40, 260, 300); await h.wait(600);
  await h.shot('drag_back');
};
