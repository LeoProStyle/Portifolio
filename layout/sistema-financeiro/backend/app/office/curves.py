"""Curvas de patrimônio: soma das contas de uma sala (função pura)."""


def sum_curves(curves: list[tuple[float, list[tuple[int, float]]]]) -> list[tuple[int, float]]:
    """Soma várias curvas `(inicial, [(ts, patrimônio)])` em cada horário existente.

    Em cada `ts`, cada conta entra com o último valor conhecido até ali; antes do
    primeiro ponto, com o capital inicial. Assim robôs que decidem em horários
    diferentes não abrem "buracos" na curva da sala.
    """
    stamps = sorted({ts for _, points in curves for ts, _ in points})
    if not stamps:
        return []
    last = [initial for initial, _ in curves]
    cursors = [0] * len(curves)
    out: list[tuple[int, float]] = []
    for ts in stamps:
        for i, (_, points) in enumerate(curves):
            while cursors[i] < len(points) and points[cursors[i]][0] <= ts:
                last[i] = points[cursors[i]][1]
                cursors[i] += 1
        out.append((ts, round(sum(last), 2)))
    return out
