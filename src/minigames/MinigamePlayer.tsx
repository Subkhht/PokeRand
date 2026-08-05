import { type JSX } from 'react'
import type { CasinoMinigameProps } from './types'
import WheelFortune from './WheelFortune'
import Slingshot from './Slingshot'
import TargetShoot from './TargetShoot'
import SimonGame from './SimonGame'
import MemoryCards from './MemoryCards'
import WhackAMole from './WhackAMole'
import DiceGame from './DiceGame'
import SlotMachine from './SlotMachine'
import GuessNumber from './GuessNumber'
import GuessPokemon from './GuessPokemon'
import PokeballToss from './PokeballToss'
import PachinkoMinigame from './PachinkoMinigame'
import GuessType from './GuessType'
import TriviaPokemon from './TriviaPokemon'
import Fishing from './Fishing'
import CatchCoins from './CatchCoins'
import VoltorbFlip from './VoltorbFlip'
import SlidePuzzle from './SlidePuzzle'
import GuessDex from './GuessDex'

interface MinigamePlayerProps extends CasinoMinigameProps {
  gameKey: string
}

export default function MinigamePlayer({ gameKey, onComplete }: MinigamePlayerProps): JSX.Element {
  switch (gameKey) {
    case 'wheel': return <WheelFortune onComplete={onComplete} />
    case 'slingshot': return <Slingshot onComplete={onComplete} />
    case 'target': return <TargetShoot onComplete={onComplete} />
    case 'simon': return <SimonGame onComplete={onComplete} />
    case 'memory': return <MemoryCards onComplete={onComplete} />
    case 'mole': return <WhackAMole onComplete={onComplete} />
    case 'dice': return <DiceGame onComplete={onComplete} />
    case 'slots': return <SlotMachine onComplete={onComplete} />
    case 'guessNum': return <GuessNumber onComplete={onComplete} />
    case 'guessPoke': return <GuessPokemon onComplete={onComplete} />
    case 'toss': return <PokeballToss onComplete={onComplete} />
    case 'guessType': return <GuessType onComplete={onComplete} />
    case 'trivia': return <TriviaPokemon onComplete={onComplete} />
    case 'fishing': return <Fishing onComplete={onComplete} />
    case 'catchCoins': return <CatchCoins onComplete={onComplete} />
    case 'voltorbFlip': return <VoltorbFlip onComplete={onComplete} />
    case 'slidePuzzle': return <SlidePuzzle onComplete={onComplete} />
    case 'guessDex': return <GuessDex onComplete={onComplete} />
    default: return <PachinkoMinigame onComplete={onComplete} />
  }
}
