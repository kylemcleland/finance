// Shop data (DESIGN.md §9, §12). G.shops[id] = { name, keeper, look, greet, stock:[itemId] }.
// Stock fits each town and the progression: Thornbrook basic → Millbridge bows + iron →
// Harrowfield horses, lances, mid armor → Crownhold top gear.
(() => {
  const S = G.shops;

  S.thornbrook_store = {
    name: "Gilda's Goods", keeper: 'Gilda', look: 'merchant',
    greet: 'Bread, herbs, and a few odds and ends!',
    stock: ['bread', 'herb', 'rusty_sword', 'buckler', 'padded', 'short_bow'],
  };

  S.millbridge_bowyer = {
    name: 'Millbridge Bowyer', keeper: 'Fletch', look: 'archer',
    greet: 'Yew, ash, or something grander?',
    stock: ['short_bow', 'hunting_bow', 'longbow', 'bread', 'herb'],
  };

  S.millbridge_smith = {
    name: 'Millbridge Smithy', keeper: 'Ironhand Ida', look: 'smith',
    greet: 'Good iron, fair prices. Mostly fair.',
    stock: ['iron_sword', 'buckler', 'kite_shield', 'padded', 'leather', 'bread', 'herb'],
  };

  S.harrowfield_stable = {
    name: 'Harrowfield Stables', keeper: 'Tobias', look: 'tobias', horses: true,
    greet: 'Every one of them sound in wind and limb.',
    stock: ['old_nag', 'palfrey', 'courser', 'destrier'],
  };

  S.harrowfield_armory = {
    name: 'Harrowfield Armory', keeper: 'Armorer Brannoc', look: 'smith',
    greet: 'Lances, mail and shields for the Lists.',
    stock: ['ash_lance', 'oak_lance', 'kite_shield', 'tower_shield', 'leather', 'chainmail', 'war_axe', 'steel_sword', 'herb', 'potion'],
  };

  S.crownhold_market = {
    name: 'Crownhold Market', keeper: 'Master Trader Oswy', look: 'merchant',
    greet: 'Wares from every corner of the realm!',
    stock: ['bread', 'herb', 'potion', 'elixir', 'longbow', 'chainmail', 'courser'],
  };

  S.crownhold_smith = {
    name: 'Royal Forge', keeper: 'Royal Smith Hilde', look: 'smith',
    greet: 'Only the finest steel for the King\'s champions.',
    stock: ['steel_sword', 'knight_blade', 'heater_shield', 'tower_shield', 'plate', 'oak_lance', 'royal_lance', 'destrier', 'potion', 'elixir'],
  };
})();
