import { ingredientsForStep } from './stepIngredients.js';

const make = (names) => names.map((name, i) => ({ id: String(i), name, quantity: '1' }));
const names = (instruction, list) => ingredientsForStep(instruction, list).map((i) => i.name);

describe('ingredientsForStep', () => {
  it('matches ingredients named in the step, in ingredient order', () => {
    const list = make(['Flour', 'Eggs', 'Milk']);
    expect(names('Whisk the eggs into the flour', list)).toEqual(['Flour', 'Eggs']);
  });

  it('treats singular and plural as the same word', () => {
    const list = make(['Egg', 'Tomatoes', 'Cherries']);
    expect(names('Crack the eggs, then add a tomato and one cherry', list)).toEqual([
      'Egg',
      'Tomatoes',
      'Cherries',
    ]);
  });

  it('matches on the main word when the step shortens the name', () => {
    const list = make(['All-purpose flour', 'Large eggs, beaten', 'Unsalted butter (softened)']);
    expect(names('Cream the butter, then fold in the flour and eggs', list)).toEqual([
      'All-purpose flour',
      'Large eggs, beaten',
      'Unsalted butter (softened)',
    ]);
  });

  it('needs the full name when two ingredients share a main word', () => {
    const list = make(['Brown sugar', 'White sugar']);
    expect(names('Add the sugar', list)).toEqual([]);
    expect(names('Add the brown sugar', list)).toEqual(['Brown sugar']);
  });

  it('matches either half of a combined ingredient', () => {
    const list = make(['Salt and pepper']);
    expect(names('Season with pepper', list)).toEqual(['Salt and pepper']);
  });

  it('does not match words that only contain an ingredient name', () => {
    const list = make(['Oil', 'Pea']);
    expect(names('Boil the peanuts', list)).toEqual([]);
  });

  it('returns nothing for steps that name no ingredient', () => {
    const list = make(['Flour', 'Sugar']);
    expect(names('Add the dry ingredients', list)).toEqual([]);
    expect(ingredientsForStep('', list)).toEqual([]);
    expect(ingredientsForStep('Add flour', undefined)).toEqual([]);
  });
});
