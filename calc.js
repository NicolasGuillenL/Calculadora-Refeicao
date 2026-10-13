/* Funções puras de cálculo (sem DOM) — testáveis no Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.Calc = factory(root.DATA);
})(typeof window !== 'undefined' ? window : globalThis, function (DATA) {
  const KEYS = DATA.NUTRIENTES.map(n => n.k);
  const PERFIL = { leve: 0.7, normal: 1, forte: 1.3 };

  const zero = () => Object.fromEntries(KEYS.map(k => [k, 0]));
  const scale = (o, f) => Object.fromEntries(KEYS.map(k => [k, (o[k] || 0) * f]));
  const add = (a, b) => Object.fromEntries(KEYS.map(k => [k, (a[k] || 0) + (b[k] || 0)]));

  /** nutrientes por 100 g de alimento COZIDO */
  function cookedPer100(food) {
    return food.base === 'cozido' ? scale(food.n, 1) : scale(food.n, 1 / food.yield);
  }
  /** nutrientes por 100 g de alimento CRU */
  function rawPer100(food) {
    return food.base === 'cru' ? scale(food.n, 1) : scale(food.n, food.yield);
  }

  const rawFromCooked = (food, g) => g / food.yield;
  const cookedFromRaw = (food, g) => g * food.yield;

  /** Fração em 1/4 (¼ ½ ¾) para medidas caseiras */
  function frac(x) {
    const q = Math.max(0.25, Math.round(x * 4) / 4);
    const i = Math.floor(q), f = q - i;
    const m = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };
    return (i ? String(i) : '') + (f ? (i ? ' ' : '') + m[f] : '');
  }
  const plural = (q, s, p) => (q > 1 ? p : s);

  function formatColher(g, T) {
    const cha = g / T.cha;
    if (cha < 0.2) return 'uma pitada';
    if (cha >= 3) {
      const s = Math.max(0.25, Math.round((g / T.sopa) * 4) / 4);
      return `${frac(s)} ${plural(s, 'colher', 'colheres')} de sopa`;
    }
    const c = Math.max(0.25, Math.round(cha * 4) / 4);
    return `${frac(c)} ${plural(c, 'colher', 'colheres')} de chá`;
  }

  /** Converte uma quantidade de tempero (g ou unidades) em texto caseiro */
  function formatTempero(key, qty) {
    const T = DATA.TEMPEROS[key];
    if (T.modo === 'dente') {
      const q = Math.max(0.5, Math.round(qty * 2) / 2);
      return `${q % 1 ? frac(q) : q} ${plural(q, 'dente', 'dentes')}`;
    }
    if (T.modo === 'folha') {
      const q = Math.max(1, Math.round(qty));
      return `${q} ${plural(q, 'folha', 'folhas')}`;
    }
    return formatColher(qty, T);
  }

  const xicaras = (ml) => {
    const q = Math.max(0.25, Math.round((ml / 180) * 4) / 4);
    return `${frac(q)} ${plural(q, 'xícara', 'xícaras')}`;
  };

  /**
   * Linha da refeição: dado o alimento, gramas COZIDAS por porção e nº de porções,
   * devolve quanto separar cru, água, temperos e nutrientes (já com sal/óleo).
   */
  function calcLinha(food, cookedPerPortion, portions, opts = {}) {
    const mult = PERFIL[opts.perfil || 'normal'];
    const contarOleo = opts.contarOleo !== false;
    const cookedTotal = cookedPerPortion * portions;
    const raw = rawFromCooked(food, cookedTotal);
    let nut = scale(cookedPer100(food), cookedTotal / 100);

    const temperos = (food.t || []).map(([key, q, o = {}]) => {
      const T = DATA.TEMPEROS[key];
      const fator = (key === 'sal' || key === 'oleo') ? mult : 1;
      const amount = (q * raw / 100) * fator;   // g (ou dentes/folhas)
      if (key === 'sal') {
        nut.na += amount * T.na * (o.abs != null ? o.abs : 1);
      }
      if (key === 'oleo' && contarOleo && o.nutr !== false) {
        nut.kcal += amount * 8.84;
        nut.l += amount;
      }
      return { key, nome: T.nome, amount, texto: formatTempero(key, amount) };
    });

    return {
      cookedTotal, raw,
      rawPorPorcao: raw / portions,
      xicaras: food.xicara ? raw / food.xicara : null,
      agua: food.agua ? raw * food.agua : 0,
      unidades: food.unidade ? cookedTotal / food.unidade.g : null,
      temperos,
      nutTotal: nut,
      nutPorPorcao: scale(nut, 1 / portions),
    };
  }

  /** Meta de proteína: peso (kg) × g/kg → total/dia e por refeição */
  function metaProteina(pesoKg, gPorKg, refeicoes) {
    const dia = pesoKg * gPorKg;
    return { dia, porRefeicao: dia / Math.max(1, refeicoes) };
  }

  /** % das calorias vindas de P, C e G (4/4/9 kcal/g) */
  function distribuicaoMacros(n) {
    const kp = n.p * 4, kc = n.c * 4, kl = n.l * 9, t = kp + kc + kl || 1;
    return { p: kp / t * 100, c: kc / t * 100, l: kl / t * 100 };
  }

  return { KEYS, PERFIL, zero, scale, add, cookedPer100, rawPer100, rawFromCooked, cookedFromRaw,
    frac, formatColher, formatTempero, xicaras, calcLinha, metaProteina, distribuicaoMacros };
});
