(function () {
  const LETTERS = ['A', 'B', 'C', 'D'];
  const root = document.getElementById('root');

  // Question text comes from outside, so it is escaped like nicknames are
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  const send = (name, ...args) => parent.postMessage({ type: 'move', name, args }, '*');

  function scoreboard(G, name, current) {
    const ids = Object.keys(G.scores).sort((a, b) => G.scores[b] - G.scores[a]);
    return (
      '<ul class="scoreboard">' +
      ids
        .map(
          (id) =>
            `<li class="${id === current ? 'turn' : ''}"><span>${name(id)}</span><strong>${G.scores[id]}</strong></li>`
        )
        .join('') +
      '</ul>'
    );
  }

  function finalHTML(G, ctx, name) {
    const w = ctx.gameover.winners;
    const title =
      w.length === 1
        ? `${name(w[0])} wins! 🎉`
        : `It's a tie: ${w.map((id) => name(id)).join(', ')}`;
    return `<h2>${title}</h2>${scoreboard(G, name, null)}`;
  }

  // The four options as read-only boxes (for the public screen)
  function optionBoxes(G) {
    const q = G.question;
    const revealed = G.phase === 'revealed';
    return (
      '<div class="options">' +
      q.options
        .map((o, i) => {
          let cls = '';
          if (revealed && i === q.correct) cls = ' right';
          else if (revealed && i === G.last.choice && !G.last.right) cls = ' wrong';
          return `<div class="opt${cls}"><b>${LETTERS[i]}</b> ${esc(o)}</div>`;
        })
        .join('') +
      '</div>'
    );
  }

  // The four options as tappable buttons (for the answering player)
  function optionButtons(G) {
    return (
      '<div class="options">' +
      G.question.options
        .map((o, i) => `<button class="opt" data-choice="${i}"><b>${LETTERS[i]}</b> ${esc(o)}</button>`)
        .join('') +
      '</div>'
    );
  }

  function tvHTML({ G, ctx }, name) {
    if (ctx.gameover) return finalHTML(G, ctx, name);
    const q = G.question;
    const who = name(ctx.currentPlayer);
    let banner = `<h3>${who} is answering…</h3>`;
    if (G.phase === 'revealed') {
      banner = G.last.right
        ? `<h3 class="good">${who} got it right! +${G.last.points}</h3>`
        : `<h3 class="bad">${who} got it wrong. The answer was ${LETTERS[q.correct]}.</h3>`;
    }
    return `<p>Question ${G.index + 1} of ${G.total} · ${esc(q.category)} · ${esc(q.difficulty)} (${q.points} pt${q.points > 1 ? 's' : ''})</p>
      <p class="qtext">${esc(q.text)}</p>
      ${optionBoxes(G)}
      ${banner}
      ${scoreboard(G, name, ctx.currentPlayer)}
      <p class="credit">Some questions from opentdb.com (Open Trivia Database, CC BY-SA 4.0)</p>`;
  }

  function phoneHTML({ G, ctx }, name, playerID) {
    if (ctx.gameover) return finalHTML(G, ctx, name);
    const current = ctx.currentPlayer;
    const q = G.question;
    const score = `<p>Your score: <strong>${G.scores[playerID]}</strong></p>`;

    if (current !== playerID) {
      const msg =
        G.phase === 'revealed'
          ? G.last.right
            ? `${name(current)} got it right!`
            : `${name(current)} got it wrong.`
          : `${name(current)} is answering. Watch the TV!`;
      return `<h2>${msg}</h2>${score}${scoreboard(G, name, current)}`;
    }
    if (G.phase === 'answering') {
      return `<h2>Your question!</h2><p class="qtext">${esc(q.text)}</p>${optionButtons(G)}${score}`;
    }
    const verdict = G.last.right
      ? `Correct! +${G.last.points}`
      : `Not quite. The answer was ${LETTERS[q.correct]}: ${esc(q.options[q.correct])}`;
    return `<h2>${verdict}</h2><button id="next">Next question</button>${score}`;
  }

  function bind() {
    root.querySelectorAll('[data-choice]').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('button').forEach((x) => (x.disabled = true));
        send('answer', Number(b.dataset.choice));
      };
    });
    const next = root.querySelector('#next');
    if (next) {
      next.onclick = () => {
        next.disabled = true;
        send('next');
      };
    }
  }

  function render(msg) {
    const { view, playerID, names, state } = msg;
    const name = (id) => esc(names[id] || `Player ${Number(id) + 1}`);
    if (view === 'player') {
      root.innerHTML = phoneHTML(state, name, playerID);
      bind();
    } else {
      root.innerHTML = tvHTML(state, name);
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source === parent && e.data && e.data.type === 'state') render(e.data);
  });
  parent.postMessage({ type: 'ready' }, '*');
})();