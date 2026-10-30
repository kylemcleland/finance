// Shared data: every item in the game. Stats documented in DESIGN.md §6.
(() => {
  const I = {};
  const add = (id, o) => (I[id] = { id, ...o });

  // --- Swords / melee weapons ---
  add('stick',        { name: 'Wooden Stick',   type: 'weapon', price: 0,    dmg: 4,  speed: 0.9,  reach: 18, color: '#9a6a3a', desc: 'A sturdy stick. Better than fists.' });
  add('rusty_sword',  { name: 'Rusty Sword',    type: 'weapon', price: 40,   dmg: 7,  speed: 1.0,  reach: 22, color: '#a07a5a', desc: 'Old Aldric\'s first blade. Pitted, but true.' });
  add('iron_sword',   { name: 'Iron Sword',     type: 'weapon', price: 150,  dmg: 11, speed: 1.0,  reach: 23, color: '#b8bcc6', desc: 'A solid soldier\'s sword.' });
  add('falchion',     { name: 'Falchion',       type: 'weapon', price: 260,  dmg: 13, speed: 0.85, reach: 21, color: '#d0d4dc', desc: 'Quick curved blade. Fast swings.' });
  add('war_axe',      { name: 'War Axe',        type: 'weapon', price: 320,  dmg: 19, speed: 1.35, reach: 21, heavy: true, color: '#8a8f99', desc: 'Slow and brutal. Breaks guards.' });
  add('steel_sword',  { name: 'Steel Longsword',type: 'weapon', price: 520,  dmg: 18, speed: 1.0,  reach: 27, color: '#e2e6ee', desc: 'Long reach, keen edge.' });
  add('knight_blade', { name: 'Knight\'s Blade',type: 'weapon', price: 1100, dmg: 24, speed: 0.95, reach: 27, color: '#f0f4ff', desc: 'Forged in Crownhold for sworn knights.' });
  add('sunsteel',     { name: 'Sunsteel Sword', type: 'weapon', price: 0,    dmg: 32, speed: 0.9,  reach: 29, color: '#ffe48a', desc: 'Prize of the Thornbrook Pit. Glows faintly.', noSell: true });

  // --- Shields ---
  add('buckler',      { name: 'Wooden Buckler', type: 'shield', price: 30,   block: 0.55, parry: 40, def: 0, color: '#9a6a3a', desc: 'Small and quick. Good for parries.' });
  add('kite_shield',  { name: 'Kite Shield',    type: 'shield', price: 180,  block: 0.75, parry: 10, def: 1, color: '#3b6fc4', desc: 'Covers you well.' });
  add('tower_shield', { name: 'Tower Shield',   type: 'shield', price: 420,  block: 0.9,  parry: 0,  def: 2, color: '#7a7f8a', desc: 'A wall of oak and iron.' });
  add('heater_shield',{ name: 'Heater Shield',  type: 'shield', price: 700,  block: 0.85, parry: 50, def: 2, color: '#b23a3a', desc: 'A knight\'s shield, balanced.' });

  // --- Armor ---
  add('tunic',        { name: 'Linen Tunic',    type: 'armor', price: 0,    def: 0, hp: 0,  weight: 0,    desc: 'Your stable clothes.' });
  add('padded',       { name: 'Padded Jack',    type: 'armor', price: 60,   def: 1, hp: 6,  weight: 0,    desc: 'Quilted cloth. Soaks blows.' });
  add('leather',      { name: 'Leather Armor',  type: 'armor', price: 160,  def: 2, hp: 12, weight: 0.05, desc: 'Boiled leather plates.' });
  add('chainmail',    { name: 'Chainmail',      type: 'armor', price: 450,  def: 4, hp: 20, weight: 0.12, desc: 'Rings of iron.' });
  add('plate',        { name: 'Plate Armor',    type: 'armor', price: 1200, def: 7, hp: 35, weight: 0.2,  desc: 'Full harness. Heavy but mighty.' });

  // --- Lances ---
  add('practice_lance',{ name: 'Practice Lance',type: 'lance', price: 0,    power: 1.0, stability: 0.2,  breakChance: 0.15, desc: 'Blunted ash pole.', noSell: true });
  add('ash_lance',    { name: 'Ash Lance',      type: 'lance', price: 220,  power: 1.25, stability: 0.35, breakChance: 0.25, desc: 'Light, splinters well.' });
  add('oak_lance',    { name: 'Oak Lance',      type: 'lance', price: 600,  power: 1.5, stability: 0.5,  breakChance: 0.3, desc: 'Heavy and steady.' });
  add('royal_lance',  { name: 'Royal Lance',    type: 'lance', price: 1500, power: 1.8, stability: 0.65, breakChance: 0.4, desc: 'Painted in royal colors.' });

  // --- Horses ---
  add('old_nag',      { name: 'Old Nag',        type: 'horse', price: 120,  speed: 0.8, stamina: 0.7, control: 0.5, color: '#8a6a4a', desc: 'Slow but kind.' });
  add('palfrey',      { name: 'Palfrey',        type: 'horse', price: 400,  speed: 1.0, stamina: 1.0, control: 0.7, color: '#c9a36a', desc: 'Smooth gait, easy to steer.' });
  add('courser',      { name: 'Courser',        type: 'horse', price: 800,  speed: 1.2, stamina: 0.9, control: 0.65, color: '#5a3a22', desc: 'Swift and spirited.' });
  add('destrier',     { name: 'Destrier',       type: 'horse', price: 1200, speed: 1.15, stamina: 1.3, control: 0.85, color: '#2a2a2e', desc: 'A true warhorse.' });

  // --- Bows ---
  add('short_bow',    { name: 'Short Bow',      type: 'bow', price: 60,   power: 0.8, steady: 0.3, draw: 0.9,  desc: 'Simple hunting bow.' });
  add('hunting_bow',  { name: 'Hunting Bow',    type: 'bow', price: 140,  power: 1.0, steady: 0.45, draw: 0.85, desc: 'Yew stave, honest pull.' });
  add('longbow',      { name: 'Longbow',        type: 'bow', price: 500,  power: 1.3, steady: 0.55, draw: 1.1,  desc: 'Tall bow. Laughs at wind.' });
  add('elven_bow',    { name: 'Wren\'s Recurve',type: 'bow', price: 0,    power: 1.5, steady: 0.75, draw: 0.8,  desc: 'Gift of the Archery Master.', noSell: true });

  // --- Consumables ---
  add('bread',        { name: 'Bread',          type: 'consumable', price: 8,   heal: 15, desc: 'Heals 15 HP.' });
  add('herb',         { name: 'Healing Herb',   type: 'consumable', price: 20,  heal: 35, desc: 'Heals 35 HP.' });
  add('potion',       { name: 'Tonic',          type: 'consumable', price: 55,  heal: 80, desc: 'Heals 80 HP.' });
  add('elixir',       { name: 'Elixir',         type: 'consumable', price: 160, heal: 999, desc: 'Fully heals.' });

  // --- Key items ---
  add('lost_arrows',  { name: 'Miller\'s Arrows', type: 'key', price: 0, desc: 'A quiver of fletched arrows, lost in the woods.' });
  add('letter',       { name: 'Aldric\'s Letter', type: 'key', price: 0, desc: 'A letter of recommendation for the Lists.' });
  add('gate_pass',    { name: 'Kingsroad Pass',  type: 'key', price: 0, desc: 'Lets you travel the Kingsroad.' });
  add('horseshoe',    { name: 'Lucky Horseshoe', type: 'key', price: 0, desc: 'Someone in Harrowfield lost this.' });
  add('signet',       { name: 'Black Signet',    type: 'key', price: 0, desc: 'Taken from Black Hugh. Proof of his defeat.' });

  G.items = I;
  G.itemTypes = ['weapon', 'shield', 'armor', 'lance', 'horse', 'bow', 'consumable', 'key'];
  G.slotOf = { weapon: 'weapon', shield: 'shield', armor: 'armor', lance: 'lance', horse: 'horse', bow: 'bow' };
})();
