/* Cozinha Calc — interface. Depende de data.js e calc.js */
(function () {
  'use strict';
  const { NUTRIENTES, GRUPOS, TEMPEROS } = DATA;

  /* ---------- utilitários ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (v, def = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cc_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cc_' + k, JSON.stringify(v)); } catch (e) { /* modo privado */ } },
    del(k) { try { localStorage.removeItem('cc_' + k); } catch (e) { } },
  };
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado!'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiado!'); } catch (_) { toast('Não consegui copiar'); }
      ta.remove();
    }
  }

  /* ---------- estado ---------- */
  const S = {
    route: 'planejar',
    porcoes: store.get('porcoes', 3),
    perfil: store.get('perfil', 'normal'),
    contarOleo: store.get('oleo', true),
    linhas: store.get('linhas', [
      { foodId: 'arroz_branco', g: 150 },
      { foodId: 'feijao_carioca_caldo', g: 100 },
      { foodId: 'frango_peito', g: 120 },
    ]),
    meta: store.get('meta', { peso: 75, gkg: 1.6, refeicoes: 4 }),
    cfg: store.get('cfg', { apiKey: '', model: 'gemini-flash-latest', tema: 'auto' }),
    custom: store.get('custom', []),
    receitas: store.get('receitas', []),
    receita: null,          // receita atual (IA)
    novoAlimento: null,     // proposta de alimento (IA)
    rend: { foodId: 'arroz_branco', dir: 'cozido-cru', g: 150, grupo: '' },
    tab: { q: '', grupo: '', base: 'cozido' },
  };
  const persist = () => {
    store.set('porcoes', S.porcoes); store.set('perfil', S.perfil); store.set('oleo', S.contarOleo);
    store.set('linhas', S.linhas); store.set('meta', S.meta);
  };
  const allFoods = () => DATA.foods.concat(S.custom);
  const byId = id => allFoods().find(f => f.id === id);
  const nutInfo = k => NUTRIENTES.find(n => n.k === k);

  function applyTheme() {
    const r = document.documentElement;
    if (S.cfg.tema === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.cfg.tema);
  }

  /* ---------- navegação ---------- */
  const ICON = {
    planejar: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    receitas: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>',
    rendimento: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
    tabela: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    metas: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const ROUTES = [
    ['planejar', 'Planejar refeição'], ['receitas', 'Receitas com IA'], ['rendimento', 'Rendimento'],
    ['tabela', 'Tabela nutricional'], ['metas', 'Metas'], ['config', 'Configurações'],
  ];
  function renderNav() {
    $('#nav').innerHTML = ROUTES.map(([id, nome]) =>
      `<a href="#${id}" ${S.route === id ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg><span>${nome}</span></a>`).join('');
  }
  function route() {
    const id = (location.hash || '#planejar').slice(1);
    S.route = ROUTES.some(r => r[0] === id) ? id : 'planejar';
    renderNav();
    ({ planejar: pagePlanejar, receitas: pageReceitas, rendimento: pageRendimento, tabela: pageTabela, metas: pageMetas, config: pageConfig })[S.route]();
    document.title = ROUTES.find(r => r[0] === S.route)[1] + ' · Cozinha Calc';
  }

  /* ---------- componentes ---------- */
  function foodOptions(sel) {
    const foods = allFoods();
    const grupos = GRUPOS.concat(foods.some(f => f.grupo === 'Meus alimentos') ? ['Meus alimentos'] : []);
    return grupos.map(g => {
      const items = foods.filter(f => f.grupo === g);
      return items.length ? `<optgroup label="${esc(g)}">${items.map(f => `<option value="${esc(f.id)}" ${f.id === sel ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</optgroup>` : '';
    }).join('');
  }
  const pct = (v, max) => Math.max(0, Math.min(100, max ? v / max * 100 : 0));
  const metaAtual = () => Calc.metaProteina(S.meta.peso, S.meta.gkg, S.meta.refeicoes);

  /* =====================================================================
     PÁGINA: PLANEJAR
  ===================================================================== */
  const PRESETS = [
    { nome: 'Arroz + feijão + frango', porcoes: 3, linhas: [['arroz_branco', 150], ['feijao_carioca_caldo', 100], ['frango_peito', 120]] },
    { nome: 'Fit: integral + preto + patinho + brócolis', porcoes: 4, linhas: [['arroz_integral', 120], ['feijao_preto_graos', 80], ['patinho', 130], ['brocolis', 80]] },
    { nome: 'Só arroz e feijão', porcoes: 3, linhas: [['arroz_branco', 150], ['feijao_carioca_caldo', 120]] },
    { nome: 'Peixe com legumes', porcoes: 2, linhas: [['batata_doce', 150], ['tilapia', 140], ['abobrinha', 100]] },
  ];

  function pagePlanejar() {
    $('#main').innerHTML = `
      <div class="page-head">
        <div><h1>Planejar refeição</h1>
          <p class="muted">Diga quantas porções e quantos gramas <b>prontos</b> você quer de cada item. O app calcula o quanto separar cru, a água, os temperos em colheres e os nutrientes.</p></div>
        <div class="row no-print"><button class="btn" data-act="print">Imprimir</button></div>
      </div>
      <div class="grid-2">
        <div class="stack">
          <section class="card">
            <h2>Ingredientes</h2>
            <div class="row" style="margin-bottom:12px">
              <label class="field" style="width:120px"><span>Porções</span><input type="number" id="porcoes" min="1" max="40" step="1" inputmode="numeric" value="${S.porcoes}"></label>
              <div class="field"><span>Tempero</span>
                <div class="seg" id="perfil" role="group" aria-label="Intensidade do tempero">
                  ${['leve', 'normal', 'forte'].map(p => `<button type="button" data-act="perfil" data-v="${p}" aria-pressed="${S.perfil === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}
                </div></div>
              <label class="switch" style="margin-top:18px"><input type="checkbox" id="oleo" ${S.contarOleo ? 'checked' : ''}> Contar óleo nas calorias</label>
            </div>
            <div id="rows"></div>
            <div class="row" style="margin-top:8px"><button class="btn" data-act="add-linha">+ Adicionar alimento</button></div>
            <p class="small muted" style="margin:14px 0 6px">Atalhos</p>
            <div class="row">${PRESETS.map((p, i) => `<button class="chip plain preset" data-act="preset" data-i="${i}">${esc(p.nome)}</button>`).join('')}</div>
          </section>
          <div id="fichas" class="stack"></div>
        </div>
        <aside class="stack sticky" id="resumo"></aside>
      </div>`;
    renderRows(); renderResults();
  }

  function rowHint(l) {
    const f = byId(l.foodId); if (!f) return '';
    const bits = [`${f.metodo}`, f.yield >= 1.05 ? `rende ${fmt(f.yield, 1)}× o peso cru` : (f.yield < 0.98 ? `perde ~${fmt((1 - f.yield) * 100)}% do peso` : 'peso quase não muda')];
    if (f.unidade) bits.push(`≈ ${fmt(l.g / f.unidade.g, 1)} ${f.unidade.nome}(s) por porção`);
    return bits.join(' · ');
  }
  function renderRows() {
    const el = $('#rows'); if (!el) return;
    if (!S.linhas.length) { el.innerHTML = '<p class="muted">Nenhum alimento ainda. Adicione um ou use um atalho abaixo.</p>'; return; }
    el.innerHTML = S.linhas.map((l, i) => `
      <div class="ing">
        <label class="field"><span>Alimento</span><select data-act="food" data-i="${i}">${foodOptions(l.foodId)}</select></label>
        <label class="field"><span>g prontos / porção</span><input type="number" min="0" step="5" inputmode="decimal" data-act="gramas" data-i="${i}" value="${l.g}"></label>
        <button class="btn icon-btn danger" data-act="rm-linha" data-i="${i}" aria-label="Remover ${esc(byId(l.foodId)?.nome || '')}" title="Remover">✕</button>
        <div class="hint small muted" id="hint-${i}">${esc(rowHint(l))}</div>
      </div>`).join('');
  }

  function computeMeal() {
    const opts = { perfil: S.perfil, contarOleo: S.contarOleo };
    const rows = S.linhas.map(l => {
      const f = byId(l.foodId); if (!f) return null;
      return { f, g: l.g, ...Calc.calcLinha(f, l.g, S.porcoes, opts) };
    }).filter(Boolean);
    const total = rows.reduce((a, r) => Calc.add(a, r.nutTotal), Calc.zero());
    return { rows, total, porPorcao: Calc.scale(total, 1 / S.porcoes) };
  }

  function renderResults() {
    const fichas = $('#fichas'), resumo = $('#resumo'); if (!fichas) return;
    const M = computeMeal();
    if (!M.rows.length) { fichas.innerHTML = ''; resumo.innerHTML = ''; return; }

    fichas.innerHTML = M.rows.map(r => {
      const f = r.f;
      const xic = r.xicaras ? ` · ≈ ${Calc.frac(r.xicaras)} xícara${r.xicaras > 1.12 ? 's' : ''}` : '';
      const separe = r.unidades != null
        ? `${fmt(r.unidades, r.unidades % 1 ? 1 : 0)} ${f.unidade.nome}${r.unidades > 1.01 ? 's' : ''} <small>(${fmt(r.raw)} g)</small>`
        : `${fmt(r.raw)} g <small>${f.base === 'cozido' ? 'cru (peso de compra)' : 'cru'}${xic}</small>`;
      return `
      <article class="ficha">
        <header>
          <h3>${esc(f.nome)} <span class="chip plain">${fmt(r.g)} g pronto × ${S.porcoes}</span></h3>
          <span class="muted small">${esc(f.metodo)}</span>
        </header>
        <div class="kv">
          <div><div class="k">Separe</div><div class="v num">${separe}</div></div>
          ${r.agua ? `<div><div class="k">Água</div><div class="v num">${fmt(r.agua)} ml <small>≈ ${Calc.xicaras(r.agua)}</small></div></div>` : ''}
          <div><div class="k">Rende pronto</div><div class="v num">${fmt(r.cookedTotal)} g</div></div>
          <div><div class="k">Por porção</div><div class="v num">${fmt(r.nutPorPorcao.kcal)} <small>kcal</small> · ${fmt(r.nutPorPorcao.p, 1)} <small>g prot.</small></div></div>
        </div>
        <div><div class="k small muted" style="font-weight:650;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Temperos (total)</div>
          <ul class="temp">${r.temperos.map(t => `<li><b>${esc(t.texto)}</b> de ${esc(t.nome.toLowerCase())}</li>`).join('') || '<li>sem tempero adicional</li>'}</ul></div>
        <p class="small"><b>Tempo:</b> ${esc(f.tempo)}</p>
        <p class="small muted">${esc(f.dica)}</p>
      </article>`;
    }).join('');

    // lista de compras
    const agg = {};
    M.rows.forEach(r => r.temperos.forEach(t => { agg[t.key] = (agg[t.key] || 0) + t.amount; }));
    const compras = M.rows.map(r => r.unidades != null
      ? [r.f.nome, `${fmt(r.unidades, r.unidades % 1 ? 1 : 0)} un. (${fmt(r.raw)} g)`]
      : [r.f.nome, `${fmt(r.raw)} g cru`]);
    const temperosTxt = Object.keys(agg).map(k => [TEMPEROS[k].nome, Calc.formatTempero(k, agg[k])]);
    S._lista = `Lista para ${S.porcoes} porções:\n` + compras.map(c => `- ${c[0]}: ${c[1]}`).join('\n')
      + '\n\nTemperos:\n' + temperosTxt.map(c => `- ${c[0]}: ${c[1]}`).join('');

    // resumo nutricional
    const P = M.porPorcao, meta = metaAtual(), dist = Calc.distribuicaoMacros(P);
    const falta = meta.porRefeicao - P.p;
    const sugestao = falta > 3
      ? `Faltam ~${fmt(falta)} g de proteína para a meta. Ex.: +${Math.round(falta / 0.32 / 5) * 5} g de peito de frango pronto ou +${Math.ceil(falta / 6.65)} ovo(s).` : '';
    resumo.innerHTML = `
      <section class="card">
        <h2>Por porção <span class="chip">${fmt(S.porcoes)} porç${S.porcoes > 1 ? 'ões' : 'ão'}</span></h2>
        <div class="row" style="flex-wrap:nowrap;gap:16px">
          <div class="ring" style="--v:${pct(P.p, meta.porRefeicao)}" role="img" aria-label="Proteína ${fmt(P.p)} g de ${fmt(meta.porRefeicao)} g">
            <div><b class="num">${fmt(P.p)}</b><small>g proteína</small><small>meta ${fmt(meta.porRefeicao)} g</small></div></div>
          <div style="flex:1"><div style="font-size:2rem;font-weight:750;letter-spacing:-.02em" class="num">${fmt(P.kcal)} <small class="muted" style="font-size:1rem;font-weight:500">kcal</small></div>
            <div class="small muted">Total da panela: ${fmt(M.total.kcal)} kcal · ${fmt(M.total.p)} g prot.</div></div>
        </div>
        <div class="bar" style="margin-top:14px" aria-hidden="true"><i style="width:${dist.p}%;background:var(--p)"></i><i style="width:${dist.c}%;background:var(--c)"></i><i style="width:${dist.l}%;background:var(--g)"></i></div>
        <div class="legend num">
          <span><i class="dot" style="background:var(--p)"></i>Prot. ${fmt(P.p, 1)} g (${fmt(dist.p)}%)</span>
          <span><i class="dot" style="background:var(--c)"></i>Carb. ${fmt(P.c, 1)} g (${fmt(dist.c)}%)</span>
          <span><i class="dot" style="background:var(--g)"></i>Gord. ${fmt(P.l, 1)} g (${fmt(dist.l)}%)</span>
        </div>
        ${sugestao ? `<p class="notice small" style="margin-top:12px">${sugestao}</p>` : (falta <= 3 ? '<p class="notice small" style="margin-top:12px">Meta de proteína por refeição atingida ✓</p>' : '')}
      </section>
      <section class="card">
        <h2>Micronutrientes <span class="small muted" style="font-weight:500">por porção · % do VD*</span></h2>
        <div class="table-wrap"><table>
          <tbody>${NUTRIENTES.filter(n => n.k !== 'kcal').map(n => {
            const v = P[n.k], p = n.vd ? v / n.vd * 100 : null;
            return `<tr><td>${n.nome}</td><td class="r num">${fmt(v, v < 10 ? 1 : 0)} ${n.un}</td>
              <td style="width:92px">${p != null ? `<div class="minibar ${n.limite ? 'lim' : ''}" title="${fmt(p)}% do VD"><i style="width:${Math.min(100, p)}%"></i></div>` : ''}</td>
              <td class="r num small muted" style="width:46px">${p != null ? fmt(p) + '%' : ''}</td></tr>`;
          }).join('')}</tbody></table></div>
        <p class="small muted" style="margin-top:8px">*VD de referência para adultos (rotulagem ANVISA, aproximado). Sódio: o ideal é ficar abaixo de 100%/dia. Perdas de vitaminas no cozimento não estão descontadas.</p>
      </section>
      <section class="card">
        <h2>Lista para separar <button class="btn" data-act="copy-lista">Copiar</button></h2>
        <ul class="shop">${compras.map(c => `<li><span>${esc(c[0])}</span><b class="num">${esc(c[1])}</b></li>`).join('')}</ul>
        <p class="small muted" style="margin:12px 0 4px"><b>Temperos</b></p>
        <ul class="shop">${temperosTxt.map(c => `<li><span>${esc(c[0])}</span><b>${esc(c[1])}</b></li>`).join('')}</ul>
      </section>`;
  }

  /* =====================================================================
     PÁGINA: RECEITAS COM IA (Gemini)
  ===================================================================== */
  async function gemini(prompt, { json = true } = {}) {
    if (!S.cfg.apiKey) throw new Error('Cole sua chave do Gemini em Configurações primeiro.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.cfg.model || 'gemini-flash-latest')}:generateContent`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.cfg.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
    } catch (e) { throw new Error('Sem conexão com a API do Gemini. Verifique a internet.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini (${res.status}): ${data.error?.message || 'erro desconhecido'}`);
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!text) throw new Error('O Gemini não devolveu texto (pode ter sido bloqueado). Tente reformular.');
    if (!json) return text;
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(clean); } catch (e) { throw new Error('Resposta do Gemini não veio em JSON válido. Tente de novo.'); }
  }

  const catalogoParaIA = () => allFoods().map(f => `${f.id}: ${f.nome} (${f.base === 'cozido' ? 'peso de referência = cozido/pronto' : 'peso de referência = cru'})`).join('\n');

  function promptReceita(desc, porcoes, objetivo) {
    return `Você é um nutricionista e cozinheiro brasileiro. Crie uma receita simples, econômica e realista com ingredientes de mercado brasileiro.
Pedido: "${desc}"
Porções: ${porcoes}. Objetivo: ${objetivo}.

Catálogo de ingredientes conhecidos pelo app (use o "db_id" EXATO quando o ingrediente existir aqui; senão use null):
${catalogoParaIA()}

Responda SOMENTE com JSON neste formato:
{
 "nome": string, "descricao": string, "porcoes": number, "tempo_total_min": number,
 "ingredientes": [{"nome": string, "db_id": string|null, "gramas_pronto_total": number|null, "gramas_cru_total": number, "medida_caseira": string}],
 "temperos": [{"nome": string, "quantidade": string}],
 "passo_a_passo": [string],
 "dicas": [string],
 "macros_estimados_por_porcao": {"kcal": number, "proteina_g": number, "carboidrato_g": number, "gordura_g": number}
}
Regras: para ingredientes com db_id, informe "gramas_pronto_total" = peso do ingrediente já cozido/pronto somando TODAS as porções (o app converte para cru). Para os demais, use apenas "gramas_cru_total" e deixe gramas_pronto_total null. Quantidades de temperos em colheres/dentes. Português do Brasil.`;
  }

  function promptAlimento(nome) {
    return `Você é especialista em composição de alimentos (tabela TACO e USDA). Para o alimento "${nome}" retorne SOMENTE JSON:
{
 "nome": string, "grupo": "Cereais e massas"|"Leguminosas"|"Tubérculos"|"Carnes e ovos"|"Peixes"|"Vegetais",
 "base": "cru"|"cozido",   // a que peso os nutrientes se referem
 "yield": number,          // peso cozido / peso cru (ex.: arroz 2.8, frango 0.72, espinafre 0.5)
 "agua_ml_por_g_cru": number|null,
 "metodo": string, "tempo": string, "dica": string,
 "n": {"kcal":number,"p":number,"l":number,"c":number,"fib":number,"ca":number,"fe":number,"mg":number,"k":number,"zn":number,"na":number,"vitc":number,"fol":number,"b12":number}
}
"n" = valores por 100 g do peso indicado em "base": kcal; p/l/c/fib em gramas; ca/fe/mg/k/zn/na/vitc em mg; fol e b12 em µg. Valores típicos e arredondados.`;
  }

  function pageReceitas() {
    $('#main').innerHTML = `
      <div class="page-head"><div><h1>Receitas com IA</h1>
        <p class="muted">O Gemini monta a receita; os macros e micros são recalculados pela base do app sempre que o ingrediente existe nela.</p></div></div>
      ${S.cfg.apiKey ? '' : '<p class="error" style="margin-bottom:14px">Falta a chave do Gemini. Vá em <a href="#config">Configurações</a> e cole a sua.</p>'}
      <div class="grid-2">
        <div class="stack">
          <section class="card">
            <h2>Descreva o que quer cozinhar</h2>
            <label class="field"><span>Pedido</span><textarea id="r-desc" placeholder="Ex.: frango desfiado com legumes, rico em proteína, para marmitas da semana"></textarea></label>
            <div class="row" style="margin-top:10px">
              <label class="field" style="width:110px"><span>Porções</span><input type="number" id="r-por" min="1" max="30" value="4"></label>
              <label class="field" style="flex:1;min-width:180px"><span>Objetivo</span>
                <select id="r-obj"><option>Tradicional e econômico</option><option>Alto em proteína</option><option>Baixa caloria</option><option>Baixo carboidrato</option><option>Rápido (até 30 min)</option></select></label>
              <button class="btn primary" id="r-go" data-act="gerar-receita" style="margin-top:18px">Gerar receita</button>
            </div>
          </section>
          <div id="r-out"></div>
          <section class="card">
            <h2>Alimento que não está na base</h2>
            <p class="small muted" style="margin-bottom:10px">Peça ao Gemini o rendimento, a água e os nutrientes de um alimento novo (ex.: “carne de sol”, “jiló”, “aveia em flocos”) e salve na sua base.</p>
            <div class="row"><input type="text" id="a-nome" placeholder="Nome do alimento" style="flex:1;min-width:200px">
              <button class="btn" id="a-go" data-act="consultar-alimento">Consultar</button></div>
            <div id="a-out" style="margin-top:12px"></div>
          </section>
        </div>
        <aside class="stack sticky">
          <section class="card"><h2>Receitas salvas</h2>
            <div id="r-saved"></div></section>
        </aside>
      </div>`;
    renderReceitaAtual(); renderSalvas(); renderNovoAlimento();
  }

  function nutricaoReceita(r) {
    let tot = Calc.zero(), cob = 0;
    (r.ingredientes || []).forEach(i => {
      const f = i.db_id && byId(i.db_id);
      if (f && i.gramas_pronto_total > 0) { tot = Calc.add(tot, Calc.scale(Calc.cookedPer100(f), i.gramas_pronto_total / 100)); cob++; }
    });
    const por = Math.max(1, r.porcoes || 1);
    return { cob, total: (r.ingredientes || []).length, porPorcao: Calc.scale(tot, 1 / por) };
  }

  function renderReceitaAtual() {
    const out = $('#r-out'); if (!out) return;
    const r = S.receita; if (!r) { out.innerHTML = ''; return; }
    const nu = nutricaoReceita(r), P = nu.porPorcao, ia = r.macros_estimados_por_porcao || {};
    const enviavel = (r.ingredientes || []).some(i => i.db_id && byId(i.db_id) && i.gramas_pronto_total > 0);
    out.innerHTML = `<section class="card recipe">
      <h3>${esc(r.nome)}</h3>
      <p class="muted">${esc(r.descricao)}</p>
      <div class="row" style="margin:10px 0"><span class="chip">${fmt(r.porcoes)} porções</span><span class="chip plain">~${fmt(r.tempo_total_min)} min</span></div>
      <h3 style="margin:14px 0 6px">Ingredientes</h3>
      <table><tbody>${(r.ingredientes || []).map(i => {
        const f = i.db_id && byId(i.db_id);
        const cru = f && i.gramas_pronto_total > 0 ? Calc.rawFromCooked(f, i.gramas_pronto_total) : i.gramas_cru_total;
        return `<tr><td>${esc(i.nome)} ${f ? '<span class="chip plain" title="Macros calculados pela base do app">na base</span>' : ''}</td>
          <td class="r num">${fmt(cru)} g cru</td><td class="small muted">${esc(i.medida_caseira || '')}</td></tr>`;
      }).join('')}</tbody></table>
      ${(r.temperos || []).length ? `<h3 style="margin:14px 0 6px">Temperos</h3><ul class="temp">${r.temperos.map(t => `<li><b>${esc(t.quantidade)}</b> ${esc(t.nome)}</li>`).join('')}</ul>` : ''}
      <h3 style="margin:14px 0 0">Modo de preparo</h3>
      <ol class="steps">${(r.passo_a_passo || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${(r.dicas || []).length ? `<ul class="tips" style="margin-top:10px">${r.dicas.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      <h3 style="margin:14px 0 6px">Nutrição por porção</h3>
      <div class="kv">
        <div><div class="k">Calculado (base do app)</div><div class="v num">${fmt(P.kcal)} kcal <small>· ${fmt(P.p, 1)} g prot.</small></div><div class="small muted">cobre ${nu.cob} de ${nu.total} ingredientes</div></div>
        <div><div class="k">Estimado pela IA</div><div class="v num">${fmt(ia.kcal)} kcal <small>· ${fmt(ia.proteina_g, 1)} g prot.</small></div><div class="small muted">C ${fmt(ia.carboidrato_g)} g · G ${fmt(ia.gordura_g)} g</div></div>
      </div>
      <div class="row no-print" style="margin-top:14px">
        ${enviavel ? '<button class="btn primary" data-act="receita-enviar">Enviar ao planejador</button>' : ''}
        <button class="btn" data-act="receita-salvar">Salvar receita</button>
        <button class="btn" data-act="receita-copiar">Copiar texto</button>
      </div></section>`;
  }
  function renderSalvas() {
    const el = $('#r-saved'); if (!el) return;
    el.innerHTML = S.receitas.length ? S.receitas.map((r, i) => `
      <div class="row" style="justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)">
        <button class="btn ghost" style="text-align:left" data-act="receita-abrir" data-i="${i}">${esc(r.nome)}</button>
        <button class="btn icon-btn danger" data-act="receita-del" data-i="${i}" aria-label="Apagar ${esc(r.nome)}">✕</button></div>`).join('')
      : '<p class="muted small">Nada salvo ainda.</p>';
  }
  function receitaTexto(r) {
    return `${r.nome} (${r.porcoes} porções, ~${r.tempo_total_min} min)\n${r.descricao}\n\nIngredientes:\n`
      + (r.ingredientes || []).map(i => { const f = i.db_id && byId(i.db_id); const cru = f && i.gramas_pronto_total > 0 ? Calc.rawFromCooked(f, i.gramas_pronto_total) : i.gramas_cru_total; return `- ${i.nome}: ${fmt(cru)} g cru ${i.medida_caseira ? '(' + i.medida_caseira + ')' : ''}`; }).join('\n')
      + '\n\nTemperos:\n' + (r.temperos || []).map(t => `- ${t.nome}: ${t.quantidade}`).join('\n')
      + '\n\nModo de preparo:\n' + (r.passo_a_passo || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
  }

  function renderNovoAlimento() {
    const el = $('#a-out'); if (!el) return;
    const a = S.novoAlimento; if (!a) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="card" style="box-shadow:none">
      <h3>${esc(a.nome)} <span class="chip plain">${esc(a.grupo)}</span></h3>
      <p class="small muted" style="margin:6px 0">${esc(a.metodo)} · ${a.yield >= 1.05 ? `rende ${fmt(a.yield, 2)}×` : `perde ~${fmt((1 - a.yield) * 100)}%`} · nutrientes por 100 g ${a.base}</p>
      <p class="small">${fmt(a.n.kcal)} kcal · P ${fmt(a.n.p, 1)} g · C ${fmt(a.n.c, 1)} g · G ${fmt(a.n.l, 1)} g · fibra ${fmt(a.n.fib, 1)} g</p>
      <p class="small muted" style="margin-top:6px">Estimativa da IA — confira num rótulo ou na TACO antes de confiar em números exatos.</p>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="alimento-salvar">Salvar na minha base</button><button class="btn" data-act="alimento-descartar">Descartar</button></div></div>`;
  }

  /* =====================================================================
     PÁGINA: RENDIMENTO (cru ↔ cozido + encolhimento)
  ===================================================================== */
  function pageRendimento() {
    $('#main').innerHTML = `
      <div class="page-head"><div><h1>Rendimento</h1>
        <p class="muted">Quanto cada alimento cresce (arroz, feijão, massas) ou encolhe (carnes, verduras) ao cozinhar.</p></div></div>
      <section class="card" style="margin-bottom:18px">
        <h2>Conversor</h2>
        <div class="row">
          <label class="field" style="flex:1;min-width:220px"><span>Alimento</span><select id="rd-food">${foodOptions(S.rend.foodId)}</select></label>
          <div class="field"><span>Converter</span><div class="seg" role="group">
            <button type="button" data-act="rd-dir" data-v="cozido-cru" aria-pressed="${S.rend.dir === 'cozido-cru'}">Pronto → cru</button>
            <button type="button" data-act="rd-dir" data-v="cru-cozido" aria-pressed="${S.rend.dir === 'cru-cozido'}">Cru → pronto</button></div></div>
          <label class="field" style="width:130px"><span>Gramas</span><input type="number" id="rd-g" min="0" step="10" value="${S.rend.g}"></label>
        </div>
        <div id="rd-out" style="margin-top:14px"></div>
      </section>
      <section class="card">
        <h2>Tabela de rendimento
          <select id="rd-grupo" style="width:auto"><option value="">Todos os grupos</option>${GRUPOS.map(g => `<option ${S.rend.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select></h2>
        <div class="table-wrap"><table id="rd-table"></table></div>
        <p class="small muted" style="margin-top:10px">Fatores médios (USDA e prática de cozinha). Variam com o corte, a gordura, o ponto e o tempo de fogo. Na carne, a perda é de água e gordura — os nutrientes ficam concentrados no que sobra.</p>
      </section>`;
    renderRendimento();
  }
  function renderRendimento() {
    const f = byId(S.rend.foodId); const out = $('#rd-out');
    if (f && out) {
      const g = S.rend.g;
      if (S.rend.dir === 'cozido-cru') {
        const r = Calc.rawFromCooked(f, g);
        out.innerHTML = `<div class="big" style="font-size:1.8rem;font-weight:750">${fmt(g)} g prontos → <span style="color:var(--brand)">${fmt(r)} g crus</span></div>
          <p class="muted small">${f.agua ? `Água: ~${fmt(r * f.agua)} ml (${Calc.xicaras(r * f.agua)}). ` : ''}${f.xicara ? `≈ ${Calc.frac(r / f.xicara)} xícara(s) de chá de ${esc(f.nome.toLowerCase())} cru. ` : ''}${f.unidade ? `≈ ${fmt(g / f.unidade.g, 1)} unidade(s).` : ''}</p>`;
      } else {
        const r = Calc.cookedFromRaw(f, g);
        out.innerHTML = `<div style="font-size:1.8rem;font-weight:750">${fmt(g)} g crus → <span style="color:var(--brand)">${fmt(r)} g prontos</span></div>
          <p class="muted small">${f.yield < 0.98 ? `Perda de ${fmt(g - r)} g (${fmt((1 - f.yield) * 100)}%).` : `Ganho de ${fmt(r - g)} g de água.`}</p>`;
      }
    }
    const tb = $('#rd-table'); if (!tb) return;
    const rows = allFoods().filter(x => !S.rend.grupo || x.grupo === S.rend.grupo);
    tb.innerHTML = `<thead><tr><th>Alimento</th><th>Método</th><th class="r">100 g cru →</th><th class="r">Variação</th><th class="r">Água/100 g cru</th><th>Tempo</th></tr></thead><tbody>${rows.map(x => {
      const v = (x.yield - 1) * 100;
      return `<tr><td>${esc(x.nome)}</td><td class="small muted">${esc(x.metodo)}</td><td class="r num">${fmt(x.yield * 100)} g</td>
        <td class="r num" style="color:${v < 0 ? 'var(--warn)' : 'var(--brand)'}">${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}%</td>
        <td class="r num">${x.agua ? fmt(x.agua * 100) + ' ml' : '—'}</td><td class="small">${esc(x.tempo)}</td></tr>`;
    }).join('')}</tbody>`;
  }

  /* =====================================================================
     PÁGINA: TABELA NUTRICIONAL
  ===================================================================== */
  function pageTabela() {
    $('#main').innerHTML = `
      <div class="page-head"><div><h1>Tabela nutricional</h1>
        <p class="muted">Macros e micros por 100 g. Valores de referência arredondados (TACO/USDA).</p></div></div>
      <section class="card">
        <div class="row" style="margin-bottom:12px">
          <input type="text" id="tb-q" placeholder="Buscar alimento…" style="flex:1;min-width:200px" value="${esc(S.tab.q)}">
          <select id="tb-g" style="width:auto"><option value="">Todos os grupos</option>${GRUPOS.map(g => `<option ${S.tab.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
          <div class="seg" role="group" aria-label="Base de peso">
            <button type="button" data-act="tb-base" data-v="cozido" aria-pressed="${S.tab.base === 'cozido'}">100 g pronto</button>
            <button type="button" data-act="tb-base" data-v="cru" aria-pressed="${S.tab.base === 'cru'}">100 g cru</button></div>
        </div>
        <div class="table-wrap"><table id="tb-table"></table></div>
      </section>`;
    renderTabela();
  }
  function renderTabela() {
    const tb = $('#tb-table'); if (!tb) return;
    const q = S.tab.q.trim().toLowerCase();
    const rows = allFoods().filter(f => (!S.tab.grupo || f.grupo === S.tab.grupo) && (!q || f.nome.toLowerCase().includes(q)));
    tb.innerHTML = `<thead><tr><th>Alimento</th>${NUTRIENTES.map(n => `<th class="r" title="${n.nome}">${n.nome.replace('Vitamina ', 'Vit. ').replace('Carboidratos', 'Carb.').replace('Proteínas', 'Prot.').replace('Gorduras', 'Gord.')} <span style="text-transform:none">(${n.un})</span></th>`).join('')}</tr></thead>
      <tbody>${rows.map(f => {
        const n = S.tab.base === 'cozido' ? Calc.cookedPer100(f) : Calc.rawPer100(f);
        return `<tr><td><b>${esc(f.nome)}</b><div class="small muted">${esc(f.metodo)}</div></td>${NUTRIENTES.map(k => `<td class="r num">${fmt(n[k.k], n[k.k] < 10 ? 1 : 0)}</td>`).join('')}</tr>`;
      }).join('') || '<tr><td colspan="15" class="muted">Nada encontrado.</td></tr>'}</tbody>`;
  }

  /* =====================================================================
     PÁGINA: METAS
  ===================================================================== */
  function pageMetas() {
    $('#main').innerHTML = `
      <div class="page-head"><div><h1>Metas de proteína</h1>
        <p class="muted">Define a meta por refeição usada no anel de proteína do planejador.</p></div></div>
      <div class="grid-2">
        <section class="card">
          <h2>Seus dados</h2>
          <div class="row">
            <label class="field" style="width:130px"><span>Peso (kg)</span><input type="number" id="m-peso" min="30" max="250" step="0.5" value="${S.meta.peso}"></label>
            <label class="field" style="width:150px"><span>Proteína (g/kg)</span><input type="number" id="m-gkg" min="0.6" max="3" step="0.1" value="${S.meta.gkg}"></label>
            <label class="field" style="width:150px"><span>Refeições/dia</span><input type="number" id="m-ref" min="1" max="8" step="1" value="${S.meta.refeicoes}"></label>
          </div>
          <p class="small muted" style="margin:14px 0 6px">Referências comuns (g/kg/dia)</p>
          <div class="row">${[[0.8, 'Sedentário (0,8)'], [1.2, 'Ativo (1,2)'], [1.6, 'Ganho de massa (1,6)'], [2.0, 'Definição (2,0)']].map(([v, t]) => `<button class="chip plain preset" data-act="meta-gkg" data-v="${v}">${t}</button>`).join('')}</div>
          <p class="small muted" style="margin-top:14px">Ajuste com seu nutricionista/médico se tiver doença renal ou outra condição. Estas faixas são referências gerais para adultos saudáveis.</p>
        </section>
        <section class="card" id="m-out"></section>
      </div>`;
    renderMetas();
  }
  function renderMetas() {
    const el = $('#m-out'); if (!el) return;
    const m = metaAtual();
    const eq = [['peito de frango pronto', 0.32, 'g'], ['patinho pronto', 0.359, 'g'], ['tilápia pronta', 0.262, 'g'], ['ovos', 6.65, 'un']];
    el.innerHTML = `<h2>Resultado</h2>
      <div class="kv"><div><div class="k">Por dia</div><div class="v num">${fmt(m.dia)} g</div></div>
        <div><div class="k">Por refeição</div><div class="v num">${fmt(m.porRefeicao)} g</div></div></div>
      <p class="small muted" style="margin:14px 0 6px">Para chegar a ${fmt(m.porRefeicao)} g numa refeição usando só uma fonte:</p>
      <ul class="shop">${eq.map(([n, f, u]) => `<li><span>${n}</span><b class="num">${u === 'un' ? Math.ceil(m.porRefeicao / f) + ' un.' : Math.round(m.porRefeicao / f / 5) * 5 + ' g'}</b></li>`).join('')}</ul>
      <p class="small muted" style="margin-top:10px">Arroz e feijão contribuem com parte da proteína — veja o anel no planejador.</p>`;
  }

  /* =====================================================================
     PÁGINA: CONFIGURAÇÕES
  ===================================================================== */
  function pageConfig() {
    $('#main').innerHTML = `
      <div class="page-head"><div><h1>Configurações</h1></div></div>
      <div class="stack" style="max-width:760px">
        <section class="card">
          <h2>Gemini (receitas e novos alimentos)</h2>
          <label class="field"><span>Chave da API</span><input type="password" id="c-key" autocomplete="off" placeholder="Cole sua GEMINI_API_KEY" value="${esc(S.cfg.apiKey)}"></label>
          <label class="field" style="margin-top:10px"><span>Modelo</span><input type="text" id="c-model" list="modelos" value="${esc(S.cfg.model)}">
            <datalist id="modelos"><option value="gemini-flash-latest"><option value="gemini-2.5-flash"><option value="gemini-2.5-pro"></datalist></label>
          <div class="row" style="margin-top:12px"><button class="btn primary" data-act="cfg-salvar">Salvar</button><button class="btn" data-act="cfg-testar" id="c-test">Testar conexão</button><button class="btn danger" data-act="cfg-limpar-chave">Remover chave</button></div>
          <p class="small muted" style="margin-top:12px">A chave fica só no armazenamento local deste navegador e é enviada apenas ao Google. Como este app é 100% front-end, use-o só no seu computador e nunca publique o site com a chave. No Google AI Studio você pode limitar a cota da chave.</p>
        </section>
        <section class="card">
          <h2>Aparência</h2>
          <div class="seg" role="group">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, t]) => `<button type="button" data-act="tema" data-v="${v}" aria-pressed="${S.cfg.tema === v}">${t}</button>`).join('')}</div>
        </section>
        <section class="card">
          <h2>Meus alimentos (criados com IA)</h2>
          ${S.custom.length ? S.custom.map((f, i) => `<div class="row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><span>${esc(f.nome)}</span><button class="btn icon-btn danger" data-act="custom-del" data-i="${i}" aria-label="Apagar ${esc(f.nome)}">✕</button></div>`).join('') : '<p class="muted small">Nenhum ainda.</p>'}
        </section>
        <section class="card">
          <h2>Dados</h2>
          <div class="row"><button class="btn" data-act="exportar">Exportar backup (.json)</button><button class="btn danger" data-act="apagar-tudo">Apagar todos os dados</button></div>
        </section>
      </div>`;
  }

  /* =====================================================================
     EVENTOS (delegação)
  ===================================================================== */
  const main = $('#main');

  main.addEventListener('input', e => {
    const t = e.target, act = t.dataset.act;
    if (t.id === 'porcoes') { S.porcoes = Math.max(1, Math.min(40, Math.round(num(t.value, 1)))); persist(); renderResults(); }
    else if (act === 'gramas') {
      const i = +t.dataset.i; S.linhas[i].g = Math.max(0, num(t.value)); persist();
      const h = $('#hint-' + i); if (h) h.textContent = rowHint(S.linhas[i]); renderResults();
    }
    else if (t.id === 'rd-g') { S.rend.g = Math.max(0, num(t.value)); renderRendimento(); }
    else if (t.id === 'tb-q') { S.tab.q = t.value; renderTabela(); }
    else if (['m-peso', 'm-gkg', 'm-ref'].includes(t.id)) {
      S.meta = { peso: num($('#m-peso').value, 75), gkg: num($('#m-gkg').value, 1.6), refeicoes: Math.max(1, Math.round(num($('#m-ref').value, 4))) };
      persist(); renderMetas();
    }
  });

  main.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.act === 'food') { const i = +t.dataset.i; S.linhas[i].foodId = t.value; persist(); const h = $('#hint-' + i); if (h) h.textContent = rowHint(S.linhas[i]); renderResults(); }
    else if (t.id === 'oleo') { S.contarOleo = t.checked; persist(); renderResults(); }
    else if (t.id === 'rd-food') { S.rend.foodId = t.value; renderRendimento(); }
    else if (t.id === 'rd-grupo') { S.rend.grupo = t.value; renderRendimento(); }
    else if (t.id === 'tb-g') { S.tab.grupo = t.value; renderTabela(); }
  });

  main.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
    const act = b.dataset.act, i = +b.dataset.i, v = b.dataset.v;
    switch (act) {
      case 'print': window.print(); break;
      case 'perfil': S.perfil = v; persist(); document.querySelectorAll('#perfil button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); renderResults(); break;
      case 'add-linha': S.linhas.push({ foodId: 'arroz_branco', g: 100 }); persist(); renderRows(); renderResults(); break;
      case 'rm-linha': S.linhas.splice(i, 1); persist(); renderRows(); renderResults(); break;
      case 'preset': { const p = PRESETS[i]; S.porcoes = p.porcoes; S.linhas = p.linhas.map(([foodId, g]) => ({ foodId, g })); persist(); pagePlanejar(); break; }
      case 'copy-lista': copy(S._lista || ''); break;

      case 'gerar-receita': {
        const desc = $('#r-desc').value.trim(); if (!desc) { toast('Descreva a receita primeiro'); return; }
        const por = Math.max(1, Math.round(num($('#r-por').value, 4)));
        b.disabled = true; const old = b.innerHTML; b.innerHTML = '<span class="spinner"></span> Gerando…';
        $('#r-out').innerHTML = '';
        try { S.receita = await gemini(promptReceita(desc, por, $('#r-obj').value)); S.receita.porcoes = S.receita.porcoes || por; renderReceitaAtual(); }
        catch (err) { $('#r-out').innerHTML = `<p class="error">${esc(err.message)}</p>`; }
        b.disabled = false; b.innerHTML = old; break;
      }
      case 'receita-enviar': {
        const r = S.receita, por = Math.max(1, r.porcoes || 1);
        const linhas = (r.ingredientes || []).filter(x => x.db_id && byId(x.db_id) && x.gramas_pronto_total > 0)
          .map(x => ({ foodId: x.db_id, g: Math.round(x.gramas_pronto_total / por / 5) * 5 || 5 }));
        S.porcoes = por; S.linhas = linhas; persist(); location.hash = '#planejar'; toast('Enviado ao planejador'); break;
      }
      case 'receita-salvar': S.receitas.unshift(S.receita); S.receitas = S.receitas.slice(0, 30); store.set('receitas', S.receitas); renderSalvas(); toast('Receita salva'); break;
      case 'receita-copiar': copy(receitaTexto(S.receita)); break;
      case 'receita-abrir': S.receita = S.receitas[i]; renderReceitaAtual(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'receita-del': S.receitas.splice(i, 1); store.set('receitas', S.receitas); renderSalvas(); break;

      case 'consultar-alimento': {
        const nome = $('#a-nome').value.trim(); if (!nome) { toast('Digite o nome do alimento'); return; }
        b.disabled = true; const old = b.innerHTML; b.innerHTML = '<span class="spinner"></span>';
        try {
          const a = await gemini(promptAlimento(nome));
          if (!a || !a.n || !(a.yield > 0)) throw new Error('A IA devolveu dados incompletos. Tente de novo.');
          if (!GRUPOS.includes(a.grupo)) a.grupo = 'Vegetais';
          S.novoAlimento = a; renderNovoAlimento();
        } catch (err) { $('#a-out').innerHTML = `<p class="error">${esc(err.message)}</p>`; }
        b.disabled = false; b.innerHTML = old; break;
      }
      case 'alimento-salvar': {
        const a = S.novoAlimento; const id = 'c_' + a.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_') + '_' + Date.now().toString(36);
        const n = {}; Calc.KEYS.forEach(k => n[k] = Number(a.n[k]) || 0);
        S.custom.push({ id, nome: a.nome, grupo: 'Meus alimentos', base: a.base === 'cozido' ? 'cozido' : 'cru', n, yield: a.yield,
          agua: a.agua_ml_por_g_cru || null, metodo: a.metodo || 'cozido', tempo: a.tempo || '', dica: (a.dica || '') + ' (valores estimados por IA)', t: [['sal', 1]] });
        store.set('custom', S.custom); S.novoAlimento = null; renderNovoAlimento(); toast('Salvo em “Meus alimentos”'); break;
      }
      case 'alimento-descartar': S.novoAlimento = null; renderNovoAlimento(); break;

      case 'rd-dir': S.rend.dir = v; document.querySelectorAll('[data-act="rd-dir"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); renderRendimento(); break;
      case 'tb-base': S.tab.base = v; document.querySelectorAll('[data-act="tb-base"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); renderTabela(); break;
      case 'meta-gkg': S.meta.gkg = +v; persist(); $('#m-gkg').value = v; renderMetas(); break;

      case 'cfg-salvar': S.cfg.apiKey = $('#c-key').value.trim(); S.cfg.model = $('#c-model').value.trim() || 'gemini-flash-latest'; store.set('cfg', S.cfg); toast('Configurações salvas'); break;
      case 'cfg-testar': {
        S.cfg.apiKey = $('#c-key').value.trim(); S.cfg.model = $('#c-model').value.trim() || 'gemini-flash-latest'; store.set('cfg', S.cfg);
        b.disabled = true; try { await gemini('Responda apenas: ok', { json: false }); toast('Conexão OK ✓'); } catch (err) { toast(err.message.slice(0, 110)); } b.disabled = false; break;
      }
      case 'cfg-limpar-chave': S.cfg.apiKey = ''; store.set('cfg', S.cfg); $('#c-key').value = ''; toast('Chave removida'); break;
      case 'tema': S.cfg.tema = v; store.set('cfg', S.cfg); applyTheme(); document.querySelectorAll('[data-act="tema"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); break;
      case 'custom-del': S.custom.splice(i, 1); store.set('custom', S.custom); pageConfig(); break;
      case 'exportar': {
        const dump = { exportadoEm: new Date().toISOString(), linhas: S.linhas, porcoes: S.porcoes, meta: S.meta, custom: S.custom, receitas: S.receitas };
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
        a.download = 'cozinha-calc-backup.json'; a.click(); URL.revokeObjectURL(a.href); break;
      }
      case 'apagar-tudo':
        if (confirm('Apagar linhas, receitas, alimentos criados e a chave do Gemini deste navegador?')) {
          ['porcoes', 'perfil', 'oleo', 'linhas', 'meta', 'cfg', 'custom', 'receitas'].forEach(store.del); location.reload();
        }
        break;
    }
  });

  window.addEventListener('hashchange', route);
  applyTheme();
  route();
})();
