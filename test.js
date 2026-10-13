// Rode com: node test.js
const assert = require('assert');
const D = require('./data.js');
const C = require('./calc.js');
const f = id => D.foods.find(x => x.id === id);
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Exemplo do usuário: 3 porções de 150 g de arroz cozido
const r = C.calcLinha(f('arroz_branco'), 150, 3);
near(r.cookedTotal, 450, 0.001, 'cozido total');
near(r.raw, 450 / 2.8, 0.001, 'cru');            // ~160,7 g
near(r.agua, (450 / 2.8) * 2.4, 0.01, 'água');   // ~386 ml
assert(r.temperos.find(t => t.key === 'sal').texto.includes('colher'));

// 2) Ida e volta cru <-> cozido
for (const food of D.foods) {
  near(C.cookedFromRaw(food, C.rawFromCooked(food, 123)), 123, 1e-9, 'roundtrip ' + food.id);
}

// 3) Conservação de nutrientes: macros cozido×yield = macros do cru
for (const food of D.foods) {
  const cook = C.cookedPer100(food), raw = C.rawPer100(food);
  near(cook.kcal * food.yield, raw.kcal, 1e-6, 'kcal ' + food.id);
  near(cook.p * food.yield, raw.p, 1e-6, 'prot ' + food.id);
}

// 4) Plausibilidade das calorias (4/4/9) em ±30% (fibra/água/arredondamentos)
for (const food of D.foods) {
  const n = food.n, est = n.p * 4 + n.c * 4 + n.l * 9;
  assert(n.kcal === 0 || Math.abs(est - n.kcal) / n.kcal < 0.30, `kcal incoerente ${food.id}: ${est} vs ${n.kcal}`);
}

// 5) Proteína: 150 g de arroz cozido ≈ 3,8 g; 120 g de peito cozido ≈ 38 g
near(C.calcLinha(f('arroz_branco'), 150, 1).nutPorPorcao.p, 3.86, 0.1, 'prot arroz');
near(C.calcLinha(f('frango_peito'), 120, 1).nutPorPorcao.p, 38.4, 0.1, 'prot frango');

// 6) Sal entra no sódio; óleo só conta se contarOleo
const com = C.calcLinha(f('arroz_branco'), 150, 1, { contarOleo: true });
const sem = C.calcLinha(f('arroz_branco'), 150, 1, { contarOleo: false });
assert(com.nutTotal.kcal > sem.nutTotal.kcal && com.nutTotal.na > 100);
// peito: óleo não é contado (nutr:false)
near(C.calcLinha(f('frango_peito'), 100, 1, { contarOleo: true }).nutTotal.kcal, 159, 0.001, 'frango sem óleo extra');

// 7) Perfil de tempero
const leve = C.calcLinha(f('arroz_branco'), 150, 1, { perfil: 'leve' });
const forte = C.calcLinha(f('arroz_branco'), 150, 1, { perfil: 'forte' });
assert(leve.temperos[0].amount < forte.temperos[0].amount);

// 8) Formatação
assert.strictEqual(C.frac(0.5), '½');
assert.strictEqual(C.frac(1.75), '1 ¾');
assert.strictEqual(C.formatColher(0.2, D.TEMPEROS.sal), 'uma pitada');
assert.strictEqual(C.formatColher(5, D.TEMPEROS.sal), '1 colher de chá');
assert.strictEqual(C.formatColher(30, D.TEMPEROS.sal), '2 colheres de sopa');
assert.strictEqual(C.formatTempero('alho', 2), '2 dentes');
assert.strictEqual(C.formatTempero('louro', 0.4), '1 folha');

// 9) Ovo em unidades
near(C.calcLinha(f('ovo'), 100, 3).unidades, 6, 1e-9, 'ovos');

// 10) Meta de proteína
const m = C.metaProteina(75, 1.6, 4);
near(m.dia, 120, 1e-9, 'meta dia'); near(m.porRefeicao, 30, 1e-9, 'meta refeição');

console.log('OK —', D.foods.length, 'alimentos, todos os testes passaram');
