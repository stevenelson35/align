// The Daily's Texas Hold'em odds: a question and its answer, one a day. The numbers are standard combinatorics
// (e.g. 1,326 two-card starting hands; outs counted against the 47 unseen cards after the flop).

export interface PokerOdds {
  question: string
  answer: string
}

export const POKER_ODDS: PokerOdds[] = [
  { question: 'How often are you dealt pocket aces?', answer: '1 in 221 hands (about 0.45%). There are 6 ways to hold two aces out of 1,326 possible starting hands.' },
  { question: 'How often are you dealt any pocket pair?', answer: 'About 1 in 17 hands (5.9%).' },
  { question: 'How often are your two hole cards the same suit?', answer: 'About 23.5% of the time (roughly 1 in 4).' },
  { question: 'With a pocket pair, how often do you flop three of a kind (a set) or better?', answer: 'About 11.8% (roughly 1 in 8.5). That’s why “set mining” needs the right price.' },
  { question: 'You have a flush draw after the flop (9 outs). Chance of making it by the river?', answer: 'About 35%. With just one card to come (turn to river) it’s about 19.6% (9 of 46).' },
  { question: 'Open-ended straight draw after the flop (8 outs). Chance to hit by the river?', answer: 'About 31.5%. With one card to come, about 17.4% (8 of 46).' },
  { question: 'Gutshot straight draw after the flop (4 outs). Chance to hit by the river?', answer: 'About 16.5%. With one card to come, about 8.7%.' },
  { question: 'What is the “rule of 2 and 4”?', answer: 'A quick estimate of your chance to hit: outs × 4 after the flop (two cards to come), outs × 2 with one card to come. 9 outs ≈ 36% / 18%.' },
  { question: 'The pot is $30 and you must call $10. What equity do you need to call profitably (pot odds)?', answer: '25%. You risk $10 to win a total of $40 (the $30 pot plus your $10): 10 ÷ 40 = 25%.' },
  { question: 'Pocket aces against pocket kings, all in before the flop. Who wins how often?', answer: 'Aces win about 82% of the time; kings about 18%.' },
  { question: 'A pair against two higher cards (like Q♠Q♦ vs A♥K♣) before the flop?', answer: 'Close to a coin flip: the pair wins a bit more often, about 55–57%.' },
  { question: 'A-K against A-Q (a “dominated” hand) before the flop?', answer: 'A-K wins roughly 3 times out of 4 (about 70–75%); they share the ace, so A-Q mostly needs a queen.' },
  { question: 'Holding two different unpaired cards, how often do you pair at least one on the flop?', answer: 'About 32% (roughly 1 in 3).' },
  { question: 'With two suited cards, how often do you flop a flush?', answer: 'Under 1% (about 1 in 118). A flush draw on the flop is much more common: about 11%.' },
  { question: 'How many different starting hands are there?', answer: '1,326 exact two-card combinations, which group into 169 kinds (13 pairs, 78 suited and 78 offsuit hands).' },
  { question: 'Why is the dealer button the best seat?', answer: 'You act last on every round after the flop, so you see what everyone else does before deciding. Position is information.' },
  { question: 'What are “outs”?', answer: 'The unseen cards that would improve your hand to a likely winner. Don’t count cards that also give an opponent a better hand.' },
  { question: 'What are “implied odds”?', answer: 'Money you expect to win on later rounds if you hit. They can justify calling with a draw when the current pot odds alone are a little short.' },
  { question: 'With a pocket pair and no set on the flop, what are your chances of a set by the river?', answer: 'You have 2 outs: about 8.4% by the river, or about 4.3% with one card to come.' },
  { question: 'A flush draw plus an open-ended straight draw (15 outs) after the flop. Chance to hit by the river?', answer: 'About 54%: you’re actually a favorite against a single pair.' },
  { question: 'How likely is a royal flush in Texas Hold’em (your best 5 of 7 cards)?', answer: 'About 1 in 31,000 hands. With just five cards dealt, it’s 1 in 649,740.' },
]
