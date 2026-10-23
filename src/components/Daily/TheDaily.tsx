import { useEffect, useState, type ReactNode } from 'react'
import { diffDays } from '../../engine/dates'
import { FACTS, QUOTES, RIDDLES, THOUGHTS, WORDS } from '../../daily/content'
import { mathPuzzle } from '../../daily/math'
import { CHESS_TIPS, fetchChessPuzzle, type ChessPuzzle } from '../../daily/chess'
import { POKER_ODDS } from '../../daily/poker'
import { ChessBoard } from './ChessBoard'
import miniPhilosophy from '../../daily/miniPhilosophy.json'
import { daily, fetchAnimal, fetchCommonsPicture, fetchJoke, fetchNasa, type Animal, type DailyPicture, type Joke } from '../../daily/sources'
import { DAILY_ITEMS, useDailySettings, type DailyItem } from '../../daily/settings'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { Icon } from '../UI/Icon'
import { PictureLightbox } from '../UI/Picture'
import { RevealCard } from '../UI/RevealCard'
import { SectionHeader } from '../UI/SectionHeader'

/** Days since 2026-01-01: picks the day's built-in items (the same for everyone that day). */
const dayIndex = (day: string) => Math.max(0, diffDays('2026-01-01', day))
const ofDay = <T,>(list: T[], day: string, salt: number) => list[(dayIndex(day) * 7 + salt) % list.length]

const loadSpace = (day: string) => fetchNasa(dayIndex(day))
const loadAnimal = (day: string) => fetchAnimal(dayIndex(day))

/** One fetched item: loads once per day, shows nothing until it arrives, and hides itself if the site is down. */
function useFetched<T>(day: string, key: string, on: boolean, load: (day: string) => Promise<T>): T | null {
  const [value, setValue] = useState<{ day: string; v: T } | null>(null)
  useEffect(() => {
    if (!on) return
    let live = true
    daily(day, key, () => load(day))
      .then((v) => live && setValue({ day, v }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [day, key, on, load])
  return value?.day === day ? value.v : null
}

/**
 * The Daily (DESIGN.md §10.5): a new word, joke, quote, question, fact, riddle, math puzzle and pictures each day,
 * each with its answer or more to reveal. Folded each morning (tap the title); choose items in Settings.
 */
export function TheDaily({ day }: { day: string }) {
  const [hidden, setHidden] = useDailyFlag('align-daily-folded', true)
  const settings = useDailySettings()
  const show = (i: DailyItem) => !hidden && !settings.hidden.has(i)
  const joke = useFetched<Joke>(day, 'joke', show('joke'), fetchJoke)
  const space = useFetched<DailyPicture>(day, 'space', show('space'), loadSpace)
  const picture = useFetched<DailyPicture>(day, 'picture', show('picture'), fetchCommonsPicture)
  const animal = useFetched<Animal>(day, 'animal', show('animal'), loadAnimal)
  const chess = useFetched<ChessPuzzle>(day, 'chess', show('chess'), fetchChessPuzzle)
  const [big, setBig] = useState<{ src: string; alt: string } | null>(null)

  const word = ofDay(WORDS, day, 0)
  const quote = ofDay(QUOTES, day, 3)
  const thought = ofDay(THOUGHTS, day, 5)
  const fact = ofDay(FACTS, day, 11)
  const riddle = ofDay(RIDDLES, day, 13)
  // A random-looking (but fixed for the day) one of Jonny Thomson's Mini Philosophy shorts.
  const video = ofDay(miniPhilosophy.videos, day, 17)
  const puzzle = mathPuzzle(day, settings.grade)
  const chessTip = ofDay(CHESS_TIPS, day, 19)
  const poker = ofDay(POKER_ODDS, day, 23)
  const count = DAILY_ITEMS.length - settings.hidden.size

  const pic = (p: DailyPicture | null, label: string, icon: 'star' | 'photo') =>
    p && (
      <RevealCard
        label={label}
        icon={icon}
        front={
          <button type="button" className="picture-button" onClick={() => setBig({ src: p.image, alt: p.title })} aria-label={`Show ${p.title} larger`}>
            <img className="daily-picture" src={p.image} alt={p.title} loading="lazy" />
          </button>
        }
        back={
          <>
            <strong>{p.title}</strong>
            {p.text && <p className="small">{p.text}</p>}
            <p className="muted small">
              {p.credit}
              {p.link && (
                <>
                  {' · '}
                  <a href={p.link} target="_blank" rel="noopener noreferrer">
                    More <Icon name="external" />
                  </a>
                </>
              )}
            </p>
          </>
        }
        revealLabel="Tell me more"
      />
    )

  const items: Partial<Record<DailyItem, ReactNode>> = {
    word: (
      <RevealCard
        label="Word of the Day"
        icon="book"
        front={
          <>
            <strong className="daily-big">{word.word}</strong> <span className="muted small">({word.pos})</span>
          </>
        }
        back={
          <>
            {word.meaning}. <em>“{word.example}”</em>
          </>
        }
        revealLabel="What does it mean?"
      />
    ),
    joke: joke && <RevealCard label="Joke" icon="message" front={joke.setup} back={joke.punchline || undefined} revealLabel="Tell me!" />,
    quote: (
      <RevealCard
        label="Quote"
        icon="note"
        front={<span className="daily-quote">“{quote.text}”</span>}
        back={<span className="muted">— {quote.by}</span>}
        revealLabel="Who said it?"
      />
    ),
    philosophy: (
      <RevealCard
        label="Mini Philosophy"
        icon="play"
        front={
          <>
            <a className="video-thumb" href={`https://www.youtube.com/shorts/${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={`${video.title} on YouTube`}>
              <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" />
              <Icon name="play" />
            </a>
            <strong>{video.title}</strong> <span className="muted small">· Jonny Thomson</span>
          </>
        }
        back={
          <iframe
            className="daily-video"
            src={`https://www.youtube-nocookie.com/embed/${video.id}`}
            title={video.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        }
        revealLabel="Watch here"
      />
    ),
    think: <RevealCard label="Something to Think About" icon="help" front={thought.question} back={thought.thought} revealLabel="One way to think about it" />,
    fact: <RevealCard label="Science" icon="sun" front={fact.question} back={fact.answer} revealLabel="Show answer" />,
    riddle: <RevealCard label="Riddle" icon="help" front={riddle.riddle} back={riddle.answer} revealLabel="Show answer" />,
    math: <RevealCard label={`Math Puzzle (Grade ${settings.grade})`} icon="todo" front={puzzle.question} back={puzzle.answer} revealLabel="Show answer" />,
    chess: chess && (
      <RevealCard
        label="Chess Puzzle: Mate in One"
        icon="star"
        front={
          <>
            <ChessBoard fen={chess.fen} from={chess.toMove} />
            <span className="small">{chess.toMove} to move. Find the checkmate in one move.</span>
          </>
        }
        back={
          <>
            <strong>{chess.answer}</strong>{' '}
            <a className="small" href={chess.url} target="_blank" rel="noopener noreferrer">
              Try it on Lichess <Icon name="external" />
            </a>
          </>
        }
        revealLabel="Show answer"
      />
    ),
    chessTip: <RevealCard label="Chess Lesson" icon="book" front={<><strong>{chessTip.title}.</strong> {chessTip.tip}</>} back={chessTip.more} revealLabel="Tell me more" />,
    poker: <RevealCard label="Poker Odds" icon="coin" front={poker.question} back={poker.answer} revealLabel="Show answer" />,
    space: pic(space, 'Space (NASA)', 'star'),
    picture: pic(picture, 'Picture of the Day', 'photo'),
    animal: animal && (
      <RevealCard
        label="Wild Animal: What Is It?"
        icon="photo"
        front={
          <button type="button" className="picture-button" onClick={() => setBig({ src: animal.image.replace('/medium.', '/large.'), alt: 'A wild animal' })} aria-label="Show the animal larger">
            <img className="daily-picture" src={animal.image} alt="A wild animal (guess what it is)" loading="lazy" />
          </button>
        }
        back={
          <>
            <strong>{animal.name}</strong> <em className="muted">{animal.scientific}</em>
            <p className="muted small">
              {animal.credit} ·{' '}
              <a href={animal.link} target="_blank" rel="noopener noreferrer">
                iNaturalist <Icon name="external" />
              </a>
            </p>
          </>
        }
        revealLabel="Show answer"
      />
    ),
  }

  return (
    <div className="day-section the-daily">
      <SectionHeader icon="sun" title="The Daily" count={count} onTitleClick={() => setHidden(!hidden)} expanded={!hidden} help="daily">
        <button type="button" className="link small" onClick={() => setHidden(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </SectionHeader>
      {!hidden && (
        <div className="daily-grid">
          {(Object.keys(items) as DailyItem[])
            .filter((k) => !settings.hidden.has(k) && items[k])
            .map((k) => (
              <div key={k}>{items[k]}</div>
            ))}
        </div>
      )}
      {big && <PictureLightbox src={big.src} alt={big.alt} onClose={() => setBig(null)} />}
    </div>
  )
}
