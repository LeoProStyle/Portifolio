import { beforeEach, describe, expect, it } from 'vitest'
import type { RobotRow } from '../panels/robots'
import { useRoomStore } from '../store/useRoomStore'
import { openRobot, selectedRow, useOfficeStore } from './useOfficeStore'

const r = (id: string, room: string) => ({ id, room }) as RobotRow

describe('seleção de robô', () => {
  beforeEach(() => useOfficeStore.setState({ selectedRobot: null, floor: 'acoes' }))

  it('acha o robô em qualquer sala; id que sumiu → null', () => {
    const robots = { acoes: [r('atlas', 'acoes')], minis: [r('win1', 'minis')] }
    expect(selectedRow({ robots, selectedRobot: 'win1' })?.id).toBe('win1')
    expect(selectedRow({ robots, selectedRobot: 'sumiu' })).toBeNull()
    expect(selectedRow({ robots, selectedRobot: null })).toBeNull()
  })

  it('trocar de andar fecha o painel do robô', () => {
    useOfficeStore.getState().select('atlas')
    expect(useOfficeStore.getState().selectedRobot).toBe('atlas')
    useOfficeStore.getState().setFloor('diretoria')
    expect(useOfficeStore.getState().selectedRobot).toBeNull()
    expect(useOfficeStore.getState().floor).toBe('diretoria')
  })
})

describe('abrir robô', () => {
  it('robô de ação troca o ativo do gráfico; minicontrato não (o gráfico é de ações)', () => {
    useRoomStore.setState({ ticker: 'PETR4.SA', tickers: ['PETR4.SA', 'VALE3.SA'] })
    openRobot({ id: 'orion', ticker: 'VALE3.SA' })
    expect(useRoomStore.getState().ticker).toBe('VALE3.SA')
    openRobot({ id: 'sirius', ticker: 'WIN' })
    expect(useRoomStore.getState().ticker).toBe('VALE3.SA')
    expect(useOfficeStore.getState().selectedRobot).toBe('sirius')
  })
})
