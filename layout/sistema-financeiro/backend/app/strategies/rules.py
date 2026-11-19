"""Estratégias determinísticas (código, sem LLM). Indicadores de technical.py (regra 4).

bull_flag, ma20_reclaim e oversold_bounce são adaptadas dos setups do scanner
do "Trader skill v2" (Jake Schincariol, licença MIT).
"""

import pandas as pd

from app.indicators.technical import atr, rsi, sma
from app.strategies.base import Signal, hold, not_enough


def _fmt(x: float) -> str:
    return f"{x:.2f}"


class SmaCross:
    def __init__(self, fast: float = 9, slow: float = 21) -> None:
        self.fast, self.slow = int(fast), int(slow)

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.slow + 1
        if len(c) < need:
            return not_enough(len(c), need)
        f, s = sma(c["close"], self.fast), sma(c["close"], self.slow)
        up = f.iloc[-2] <= s.iloc[-2] and f.iloc[-1] > s.iloc[-1]
        down = f.iloc[-2] >= s.iloc[-2] and f.iloc[-1] < s.iloc[-1]
        info = f"MM{self.fast} {_fmt(f.iloc[-1])} x MM{self.slow} {_fmt(s.iloc[-1])}"
        if position_qty == 0 and up:
            return Signal("COMPRA", f"cruzamento para cima: {info}")
        if position_qty > 0 and down:
            return Signal("VENDA", f"cruzamento para baixo: {info}")
        return hold(f"sem cruzamento: {info}")


class RsiReversion:
    def __init__(self, period: float = 14, buy_below: float = 30, sell_above: float = 55) -> None:
        self.period, self.buy, self.sell = int(period), buy_below, sell_above

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.period + 2
        if len(c) < need:
            return not_enough(len(c), need)
        r = float(rsi(c["close"], self.period).iloc[-1])
        if position_qty == 0 and r < self.buy:
            return Signal("COMPRA", f"IFR{self.period} {r:.1f} < {self.buy:g} (sobrevenda)")
        if position_qty > 0 and r > self.sell:
            return Signal("VENDA", f"IFR{self.period} {r:.1f} > {self.sell:g} (voltou)")
        return hold(f"IFR{self.period} {r:.1f}")


class Donchian:
    def __init__(self, entry: float = 20, exit: float = 10) -> None:  # noqa: A002
        self.entry, self.exit = int(entry), int(exit)

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.entry + 1
        if len(c) < need:
            return not_enough(len(c), need)
        close = float(c["close"].iloc[-1])
        hi = float(c["high"].iloc[-self.entry - 1 : -1].max())  # sem o candle atual
        lo = float(c["low"].iloc[-self.exit - 1 : -1].min())
        if position_qty == 0 and close > hi:
            return Signal("COMPRA", f"rompeu a máxima de {self.entry}: {_fmt(close)} > {_fmt(hi)}")
        if position_qty > 0 and close < lo:
            return Signal("VENDA", f"perdeu a mínima de {self.exit}: {_fmt(close)} < {_fmt(lo)}")
        return hold(f"dentro do canal {_fmt(lo)} a {_fmt(hi)}")


class AtrTrend:
    def __init__(self, sma: float = 50, atr: float = 14, mult: float = 3) -> None:
        self.n, self.atr_n, self.mult = int(sma), int(atr), mult

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.n + 1
        if len(c) < need:
            return not_enough(len(c), need)
        close = float(c["close"].iloc[-1])
        ma = float(sma(c["close"], self.n).iloc[-1])
        a = float(atr(c["high"], c["low"], c["close"], self.atr_n).iloc[-1])
        if position_qty == 0 and close > ma:
            return Signal("COMPRA", f"acima da MM{self.n}: {_fmt(close)} > {_fmt(ma)}")
        if position_qty > 0:
            trail = float(c["high"].iloc[-20:].max()) - self.mult * a
            if close < trail:
                return Signal("VENDA", f"stop móvel {_fmt(trail)} (máx - {self.mult:g}xATR)")
        return hold(f"MM{self.n} {_fmt(ma)}, ATR {_fmt(a)}")


class BullFlag:
    def __init__(
        self, rise: float = 0.10, lookback: float = 10, flag: float = 5, band: float = 0.05
    ) -> None:
        self.rise, self.lookback, self.flag, self.band = rise, int(lookback), int(flag), band

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.lookback + self.flag + 2
        if len(c) < need:
            return not_enough(len(c), need)
        close = c["close"]
        if position_qty > 0:
            ma10 = float(sma(close, 10).iloc[-1])
            if close.iloc[-1] < ma10:
                return Signal("VENDA", f"perdeu a MM10: {_fmt(close.iloc[-1])} < {_fmt(ma10)}")
            return hold("bandeira em andamento")
        start = float(close.iloc[-(self.lookback + self.flag) - 1])
        pole_top = float(close.iloc[-self.flag - 2])
        window = close.iloc[-self.flag - 1 : -1]
        pole = pole_top / start - 1
        width = float(window.max() / window.min() - 1)
        top = float(c["high"].iloc[-self.flag - 1 : -1].max())
        if pole < self.rise:
            return hold(f"sem mastro: alta de {pole:.1%} < {self.rise:.0%}")
        if width >= self.band:
            return hold(f"bandeira larga demais: {width:.1%}")
        if close.iloc[-1] > top:
            return Signal("COMPRA", f"rompeu a bandeira: mastro {pole:.1%}, faixa {width:.1%}")
        return hold("bandeira formada, aguardando rompimento")


class Ma20Reclaim:
    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = 22
        if len(c) < need:
            return not_enough(len(c), need)
        close, ma = c["close"], sma(c["close"], 20)
        now, before = float(close.iloc[-1]), float(close.iloc[-2])
        if position_qty == 0 and before < ma.iloc[-2] and now > ma.iloc[-1]:
            return Signal("COMPRA", f"retomou a MM20 ({_fmt(ma.iloc[-1])})")
        if position_qty > 0 and now < ma.iloc[-1]:
            return Signal("VENDA", f"perdeu a MM20 ({_fmt(ma.iloc[-1])})")
        return hold(f"MM20 {_fmt(ma.iloc[-1])}")


class OversoldBounce:
    def __init__(self, period: float = 14, level: float = 30, sell_above: float = 55) -> None:
        self.period, self.level, self.sell = int(period), level, sell_above

    def decide(self, c: pd.DataFrame, position_qty: int) -> Signal:
        need = self.period + 3
        if len(c) < need:
            return not_enough(len(c), need)
        r = rsi(c["close"], self.period)
        close = c["close"]
        if position_qty == 0 and r.iloc[-2] < self.level and close.iloc[-1] > close.iloc[-2]:
            return Signal("COMPRA", f"repique: IFR ontem {r.iloc[-2]:.1f} e fechamento em alta")
        if position_qty > 0 and r.iloc[-1] > self.sell:
            return Signal("VENDA", f"IFR {r.iloc[-1]:.1f} > {self.sell:g}")
        return hold(f"IFR {r.iloc[-1]:.1f}")
