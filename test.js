import { game as Trivia, source as triviaSource } from './server.js';

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// A fake question supplier for testing
triviaSource.take = (n) =>
  Array.from({ length: n }, (_, i) => ({
    text: `Question ${i + 1}?`,
    category: 'Test',
    difficulty: ['easy', 'medium', 'hard'][i % 3],
    answer: 'right',
    wrong: ['w1', 'w2', 'w3'],
  }));

function newGame(numPlayers) {
  const ctx = { numPlayers, currentPlayer: '0' };
  const G = Trivia.setup({ ctx, random: { Shuffle: shuffle } });
  const events = {
    endTurn: () => {
      ctx.currentPlayer = String((Number(ctx.currentPlayer) + 1) % numPlayers);
    },
  };
  return { G, ctx, events };
}
const answer = (g, id, choice) =>
  Trivia.moves.answer.move({ G: g.G, ctx: g.ctx, playerID: id, events: g.events }, choice);
const next = (g, id) =>
  Trivia.moves.next.move({ G: g.G, ctx: g.ctx, playerID: id, events: g.events });

// Test 1: is the correct answer hidden until it is answered?
{
  const g = newGame(2);
  const view = Trivia.playerView({ G: g.G, ctx: g.ctx, playerID: null });
  console.log('View contains the question list? (should be false):', 'questions' in view);
  console.log('Correct answer before answering (should be null):', view.question.correct);
  const right = g.G.questions[0].correct;
  answer(g, '0', right);
  const after = Trivia.playerView({ G: g.G, ctx: g.ctx, playerID: null });
  console.log('Correct answer shown after answering (should be true):', after.question.correct === right);
}

// Test 2: bad moves are rejected
{
  const g = newGame(2);
  console.log('Next before answering rejected (true):', next(g, '0') === 'INVALID_MOVE');
  console.log('Choice 7 rejected (true):', answer(g, '0', 7) === 'INVALID_MOVE');
  answer(g, '0', 0);
  console.log('Answering twice rejected (true):', answer(g, '0', 1) === 'INVALID_MOVE');
}

// Test 3: a whole game with 3 players. Player 0 always answers correctly.
{
  const g = newGame(3);
  const turns = { 0: 0, 1: 0, 2: 0 };
  let guard = 0;
  while (!Trivia.endIf({ G: g.G, ctx: g.ctx })) {
    if (guard++ > 100) throw new Error('Game never ended');
    const me = g.ctx.currentPlayer;
    turns[me]++;
    const q = g.G.questions[g.G.index];
    answer(g, me, me === '0' ? q.correct : (q.correct + 1) % 4);
    next(g, me);
  }
  console.log('Turns per player (3 each):', turns);
  console.log('Scores (player 0 has 3, others 0):', g.G.scores);
  console.log('Result (winners: ["0"]):', Trivia.endIf({ G: g.G, ctx: g.ctx }));
}