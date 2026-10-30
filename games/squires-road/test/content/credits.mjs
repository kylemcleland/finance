// Quick check of the credits roll: node test/run.mjs --html test/content.html --outdir test/shots/content --script test/content/credits.mjs
export default async function (page, h) {
  await h.eval(() => { G.newGame(); Object.assign(G.state.flags, { opening: 1, met_aldric: 1, trained: 1 }); G.world.start(); });
  await h.wait(800);
  await h.eval(() => { window.__cr = false; G.game.credits().then(() => { window.__cr = true; }); return 0; });
  await h.wait(5000); await h.shot('credits_a');
  await h.page.keyboard.down('KeyZ'); await h.wait(9000); await h.shot('credits_b'); await h.wait(8000); await h.page.keyboard.up('KeyZ');
  await h.wait(3000); await h.shot('credits_end');
  await h.key('KeyZ'); await h.wait(1500);
  console.log('credits done', await h.eval(() => window.__cr), await h.eval(() => G.state.look));
}
