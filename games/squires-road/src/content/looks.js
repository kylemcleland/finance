// Extra character looks for named NPCs (safe at load time: only writes G.looks).
(() => {
  const add = (k, v) => { G.looks[k] = v; };
  add('miller', { skin: '#efc29a', hair: '#e8e0d0', hairStyle: 'short', tunic: '#e9e1c8', apron: '#ffffff', pants: '#8a7a5a', boots: '#4a3a2a', hat: '#d8ccb0' });
  add('bard', { skin: '#f3c9a0', hair: '#d8a040', hairStyle: 'long', tunic: '#d0503a', tunic2: '#ffd04a', pants: '#2e7a5a', boots: '#5a2a1a', hat: '#2e7a5a' });
  add('kidA', { skin: '#f5cfa8', hair: '#3a2410', hairStyle: 'spiky', tunic: '#4a9ad0', pants: '#6a4a2a', boots: '#3a2a1a' });
  add('kidB', { skin: '#e6b08a', hair: '#c24a2a', hairStyle: 'long', tunic: '#f0c040', dress: true, tunic2: '#d8a030', boots: '#5a3a1a' });
  add('farmer', { skin: '#dba67a', hair: '#7a5a2a', tunic: '#7a9a4a', pants: '#5a4a30', boots: '#3a2a18', hat: '#e0c070' });
  add('granny', { skin: '#efc6a6', hair: '#e8e8e8', hairStyle: 'long', tunic: '#8a5aa0', dress: true, tunic2: '#6a4280', boots: '#3a2a2a', hood: '#a07ab8' });
  add('tobias', { skin: '#c99a70', hair: '#a8a8a8', hairStyle: 'short', beard: '#b0b0b0', tunic: '#8a5a2a', apron: '#5a3a1a', pants: '#4a3a2a', boots: '#2a1a10', hat: '#6a4a2a' });
  add('herald', { skin: '#f0c49a', hair: '#6a3a1a', tunic: '#2a5aa0', tunic2: '#f2c14e', pants: '#f2c14e', boots: '#2a2a3a', hat: '#d6453d' });
  add('captain', { skin: '#d9a77a', hair: '#5a5a5a', beard: '#6a6a6a', tunic: '#9a2f2f', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#c8ccd6', plume: '#f2c14e' });
  add('fisher', { skin: '#d9a070', hair: '#4a3a2a', beard: '#4a3a2a', tunic: '#4a6a8a', pants: '#3a4a5a', boots: '#2a3a3a', hat: '#c0a060' });
  add('hermit', { skin: '#e3b48a', hair: '#9a9a8a', hairStyle: 'long', beard: '#a8a898', tunic: '#5a6a4a', dress: true, tunic2: '#4a5a3a', boots: '#3a2a1a', hood: '#4a5a3a' });
  add('priest', { skin: '#efc6a6', hair: '#8a8a8a', hairStyle: 'bald', tunic: '#f0ecdc', dress: true, tunic2: '#d8d0b8', boots: '#6a5a3a' });
  add('maid', { skin: '#f5cfa8', hair: '#3a2410', hairStyle: 'long', tunic: '#5a6aa0', dress: true, apron: '#ffffff', tunic2: '#4a5a8a', boots: '#2a2a3a' });
  add('queen', { skin: '#f7d2a6', hair: '#d8b060', hairStyle: 'long', tunic: '#6a2a8a', dress: true, tunic2: '#4a1a6a', boots: '#2a1a2a', crown: true });
  add('princess', { skin: '#f7d2a6', hair: '#2a1a10', hairStyle: 'long', tunic: '#e07aa0', dress: true, tunic2: '#c05a80', boots: '#5a2a3a', crown: true });
  add('jester', { skin: '#f3c9a0', hair: '#3a2410', tunic: '#d6453d', tunic2: '#f2c14e', pants: '#3f7fd1', boots: '#d6453d', hat: '#5bb04a' });
  add('brigand', { skin: '#c99a70', hair: '#2a1a10', beard: '#2a1a10', tunic: '#3a3a2a', pants: '#2a2a1a', boots: '#1a1a10', hood: '#5a1a1a' });
  add('gareth', { skin: '#e2ae80', hair: '#a06a2a', beard: '#a06a2a', tunic: '#2a7a4a', tunic2: '#f2e6c8', pants: '#5a5a66', boots: '#2b2b33', helmet: '#c8ccd6', plume: '#2a7a4a' });
  add('lord', { skin: '#f0c49a', hair: '#8a8a8a', beard: '#9a9a9a', tunic: '#4a2a6a', tunic2: '#f2c14e', pants: '#2a2a3a', boots: '#1a1a2a', cape: '#2a1a4a' });
  add('nun', { skin: '#efc6a6', hair: '#222', tunic: '#2a2a3a', dress: true, tunic2: '#1a1a2a', boots: '#1a1a1a', hood: '#f0ecdc' });
  add('crier', { skin: '#e9b98a', hair: '#6a3a1a', tunic: '#c08a3a', tunic2: '#7a3a1a', pants: '#5a4632', boots: '#3a2616', hat: '#7a3a1a' });
  add('baker', { skin: '#f5cfa8', hair: '#c09060', tunic: '#f0e0c0', apron: '#ffffff', pants: '#8a7a6a', boots: '#4a3a2a', hat: '#ffffff' });
})();
