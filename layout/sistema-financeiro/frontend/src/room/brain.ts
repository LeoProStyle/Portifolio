/**
 * "Cérebro" de um boneco: máquina de estados pura (sem PixiJS), dirigida
 * apenas pelos eventos WS (via director) e pelo tempo.
 *
 *   idle → walking → working → talking → idle
 */

export type Mode = 'idle' | 'walking' | 'working' | 'talking'

export interface Point {
  x: number
  y: number
}

/** Quanto tempo o boneco fica "falando" depois de terminar a tarefa. */
export const TALK_MS = 1500

type Step = { type: 'walk'; to: Point } | { type: 'wait'; ms: number }

export class CharacterBrain {
  mode: Mode = 'idle'
  pos: Point
  facing: 1 | -1 = 1
  private steps: Step[] = []
  private waitLeft = 0
  private talkLeft = 0
  /** Modo assumido quando a rota terminar. */
  private settle: Mode = 'idle'
  readonly home: Point
  /** pixels lógicos por segundo; Infinity = sem animação (movimento reduzido) */
  readonly speed: number

  constructor(home: Point, speed = 40) {
    this.home = { ...home }
    this.speed = speed
    this.pos = { ...home }
  }

  private get onRoute(): boolean {
    return this.steps.length > 0
  }

  work(): void {
    if (this.onRoute) this.settle = 'working'
    else this.mode = 'working'
  }

  finish(): void {
    if (this.onRoute) {
      this.settle = 'idle'
      return
    }
    this.mode = 'talking'
    this.talkLeft = TALK_MS
  }

  rest(): void {
    if (this.onRoute) this.settle = 'idle'
    else this.mode = 'idle'
  }

  /** Vai até `target`, fica `pauseMs` trabalhando lá e volta para casa. */
  visit(target: Point, pauseMs: number): void {
    if (!this.onRoute) this.settle = this.mode === 'working' ? 'working' : 'idle'
    this.steps = [
      { type: 'walk', to: { ...target } },
      { type: 'wait', ms: pauseMs },
      { type: 'walk', to: { ...this.home } },
    ]
    this.startStep()
  }

  reset(): void {
    this.steps = []
    this.pos = { ...this.home }
    this.mode = 'idle'
    this.settle = 'idle'
    this.facing = 1
  }

  update(dtMs: number): void {
    if (!this.onRoute) {
      if (this.mode === 'talking') {
        this.talkLeft -= dtMs
        if (this.talkLeft <= 0) this.mode = 'idle'
      }
      return
    }

    let remaining = dtMs
    for (let guard = 0; guard < 16 && this.onRoute; guard++) {
      const step = this.steps[0]
      if (step.type === 'walk') {
        const dx = step.to.x - this.pos.x
        const dy = step.to.y - this.pos.y
        const dist = Math.hypot(dx, dy)
        const needed = this.speed === Infinity ? 0 : (dist / this.speed) * 1000
        if (remaining >= needed) {
          this.pos = { ...step.to }
          remaining -= needed
          this.steps.shift()
          this.startStep()
          continue
        }
        const frac = remaining / needed
        this.pos = { x: this.pos.x + dx * frac, y: this.pos.y + dy * frac }
        return
      }
      if (remaining >= this.waitLeft) {
        remaining -= this.waitLeft
        this.steps.shift()
        this.startStep()
        continue
      }
      this.waitLeft -= remaining
      return
    }
  }

  private startStep(): void {
    const step = this.steps[0]
    if (!step) {
      this.mode = this.settle
      return
    }
    if (step.type === 'walk') {
      this.mode = 'walking'
      const dx = step.to.x - this.pos.x
      if (dx !== 0) this.facing = dx > 0 ? 1 : -1
    } else {
      this.mode = 'working'
      this.waitLeft = step.ms
    }
  }
}
