// SERVER ONLY. Never import this file from a browser file.
// Keeps a pool of trivia questions from Open Trivia DB (opentdb.com, CC BY-SA 4.0).

const FALLBACK = [
  ['What is the capital of Australia?', 'Canberra', ['Sydney', 'Melbourne', 'Perth'], 'easy'],
  ['Which planet is known as the Red Planet?', 'Mars', ['Venus', 'Jupiter', 'Mercury'], 'easy'],
  ['How many continents are there?', 'Seven', ['Five', 'Six', 'Eight'], 'easy'],
  ['What is the largest ocean on Earth?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], 'easy'],
  ['Who painted the Mona Lisa?', 'Leonardo da Vinci', ['Michelangelo', 'Raphael', 'Vincent van Gogh'], 'easy'],
  ['What is the chemical symbol for gold?', 'Au', ['Ag', 'Gd', 'Go'], 'medium'],
  ['In which country is the city of Marrakech?', 'Morocco', ['Egypt', 'Tunisia', 'Turkey'], 'medium'],
  ['What is the hardest natural mineral?', 'Diamond', ['Corundum', 'Topaz', 'Quartz'], 'medium'],
  ['How many strings does a standard violin have?', 'Four', ['Three', 'Five', 'Six'], 'easy'],
  ['Which element has the atomic number 1?', 'Hydrogen', ['Helium', 'Oxygen', 'Carbon'], 'easy'],
  ['Who wrote Romeo and Juliet?', 'William Shakespeare', ['Charles Dickens', 'Jane Austen', 'Christopher Marlowe'], 'easy'],
  ['What is the longest river in Europe?', 'Volga', ['Danube', 'Rhine', 'Seine'], 'medium'],
  ['In which year did the Berlin Wall fall?', '1989', ['1985', '1987', '1991'], 'medium'],
  ['What is the smallest prime number?', '2', ['0', '1', '3'], 'easy'],
  ['Which language has the most native speakers worldwide?', 'Mandarin Chinese', ['English', 'Spanish', 'Hindi'], 'medium'],
  ['What is the capital of Canada?', 'Ottawa', ['Toronto', 'Vancouver', 'Montreal'], 'easy'],
  ['Which gas do plants absorb from the air for photosynthesis?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Hydrogen'], 'easy'],
  ['Which city hosted the 2016 Summer Olympics?', 'Rio de Janeiro', ['London', 'Tokyo', 'Beijing'], 'medium'],
  ['How many players does one soccer team have on the field?', 'Eleven', ['Nine', 'Ten', 'Twelve'], 'easy'],
  ['What is the tallest mountain above sea level?', 'Mount Everest', ['K2', 'Kangchenjunga', 'Mont Blanc'], 'easy'],
  ['Which Dutch painter created The Night Watch?', 'Rembrandt', ['Vermeer', 'Van Gogh', 'Frans Hals'], 'medium'],
].map(([text, answer, wrong, difficulty]) => ({
  text,
  category: 'General Knowledge',
  difficulty,
  answer,
  wrong,
}));

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

let pool = [];
let token = null;
let lastRequest = 0;
let busy = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getJSON = async (url) => (await fetch(url, { signal: AbortSignal.timeout(10000) })).json();

// Open Trivia DB allows one request per 5 seconds, so we always pace ourselves
async function paced() {
  const gap = 5500 - (Date.now() - lastRequest);
  if (gap > 0) await wait(gap);
  lastRequest = Date.now();
}

const decode = decodeURIComponent;
const normalize = (r) => ({
  text: decode(r.question),
  category: decode(r.category),
  difficulty: r.difficulty,
  answer: decode(r.correct_answer),
  wrong: r.incorrect_answers.map(decode),
});

async function refill() {
  if (busy) return;
  busy = true;
  try {
    if (!token) {
      await paced();
      const t = await getJSON('https://opentdb.com/api_token.php?command=request');
      token = t.token || null;
    }
    await paced();
    const url =
      'https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986' +
      (token ? `&token=${token}` : '');
    const data = await getJSON(url);
    if (data.response_code === 0) {
      pool.push(...data.results.map(normalize).filter((q) => q.wrong.length === 3));
      console.log(`Trivia bank: ${pool.length} questions ready`);
    } else if (data.response_code === 3 || data.response_code === 4) {
      token = null; // token expired or every question served: get a fresh one next time
    }
    // response_code 5 means "too fast": we simply try again on a later call
  } catch (e) {
    console.log('Trivia bank: could not reach Open Trivia DB:', e.message);
  } finally {
    busy = false;
  }
}

export function startQuestionBank() {
  refill();
}

// Hand out n questions, topping up with our own pack if the pool is short
export function takeQuestions(n) {
  const out = pool.splice(0, n);
  if (pool.length < 20) refill();
  if (out.length < n) out.push(...shuffle(FALLBACK).slice(0, n - out.length));
  return out;
}