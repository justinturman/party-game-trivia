import { takeQuestions, startQuestionBank } from './bank.js';
const INVALID_MOVE = 'INVALID_MOVE';

const QUESTIONS_PER_PLAYER = 3;
const POINTS = { easy: 1, medium: 2, hard: 3 };

// Where questions come from. Tests can swap this out.
export const source = { take: takeQuestions };

// Called once by the platform when the server starts
export const init = startQuestionBank;

export const game = {
  name: 'trivia',
  minPlayers: 2,
  maxPlayers: 6,

  setup: ({ ctx, random }) => {
    const total = ctx.numPlayers * QUESTIONS_PER_PLAYER;
    const raw = source.take(total);
    const questions = raw.map((q) => {
      const options = random.Shuffle([q.answer, ...q.wrong]);
      return {
        text: q.text,
        category: q.category,
        difficulty: q.difficulty,
        options,
        correct: options.indexOf(q.answer),
      };
    });
    const scores = {};
    for (let i = 0; i < ctx.numPlayers; i++) scores[String(i)] = 0;
    return { questions, index: 0, phase: 'answering', last: null, scores };
  },

  // THE PRIVACY RULE: everyone sees the current question and its four options,
  // but the correct answer stays secret until it has been answered.
  // Future questions never leave the server.
  playerView: ({ G }) => {
    const q = G.questions[G.index];
    return {
      total: G.questions.length,
      index: G.index,
      phase: G.phase,
      scores: G.scores,
      last: G.last,
      question: q
        ? {
            text: q.text,
            category: q.category,
            difficulty: q.difficulty,
            options: q.options,
            points: POINTS[q.difficulty] || 1,
            correct: G.phase === 'revealed' ? q.correct : null,
          }
        : null,
    };
  },

  moves: {
    // Only the server runs these, because they use the secret answer
    answer: {
      client: false,
      move: ({ G, playerID }, choice) => {
        if (G.phase !== 'answering') return INVALID_MOVE;
        if (!Number.isInteger(choice) || choice < 0 || choice > 3) return INVALID_MOVE;
        const q = G.questions[G.index];
        const right = choice === q.correct;
        const points = right ? POINTS[q.difficulty] || 1 : 0;
        G.scores[playerID] += points;
        G.phase = 'revealed';
        G.last = { playerID, choice, right, points };
      },
    },
    next: {
      client: false,
      move: ({ G, events }) => {
        if (G.phase !== 'revealed') return INVALID_MOVE;
        G.index += 1;
        G.phase = 'answering';
        G.last = null;
        events.endTurn(); // the next player gets the next question
      },
    },
  },

  endIf: ({ G }) => {
    if (G.questions.length === 0 || G.index < G.questions.length) return;
    const best = Math.max(...Object.values(G.scores));
    return { winners: Object.keys(G.scores).filter((id) => G.scores[id] === best) };
  },
};