/** Aparência de um boneco (cores e acessórios). Puro: sem Three.js. */
export interface Look {
  /** Cor do cabelo; `null` = careca. */
  hair: string | null
  skin: string
  shirt: string
  /** Gravata/detalhe no peito. */
  detail: string
  pants: string
  /** Paletó por cima da camisa (CEO e Gerente Geral). */
  suit?: string
  /** Óculos de grau: armação escura e lentes claras. */
  glasses?: boolean
  robot?: boolean
}
