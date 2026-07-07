import { mockCartridges, mockGames } from '@/lib/mock-data';
import type { Cartridge } from '@/models/cartridge';
import type { Game } from '@/models/game';

const adminGames: Game[] = [...mockGames];
const adminCartridges: Cartridge[] = [...mockCartridges];

export function getAdminGamesStore(): Game[] {
  return adminGames;
}

export function getAdminCartridgesStore(): Cartridge[] {
  return adminCartridges;
}

export function resetAdminStores() {
  adminGames.splice(0, adminGames.length, ...mockGames);
  adminCartridges.splice(0, adminCartridges.length, ...mockCartridges);
}
