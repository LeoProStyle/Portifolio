import type { Game, Room } from '@/models/game';
import type { Cartridge } from '@/models/cartridge';

export const mockGames: Game[] = [
  {
    id: 'game-1',
    title: 'Super Retro',
    console: 'Arcade',
    system: 'Arcade (FBNeo)',
    slug: 'super-retro',
    description: 'A classic arcade experience.',
    image: '/images/super-retro.png',
    romPath: '/roms/super-retro.bin',
    active: true
  },
  {
    id: 'game-2',
    title: 'Pixel Quest',
    console: 'Arcade',
    system: 'Arcade (FBNeo)',
    slug: 'pixel-quest',
    description: 'A retro platformer for the modern browser.',
    image: '/images/pixel-quest.png',
    romPath: '/roms/pixel-quest.bin',
    active: true
  }
];

export const mockCartridges: Cartridge[] = [
  {
    id: 'cartridge-1',
    nfcId: 'demo',
    gameId: 'game-1',
    collectionNumber: 101,
    status: 'active'
  }
];

export const mockRooms: Room[] = [
  {
    id: 'room-1',
    title: 'Arcade Nights',
    slug: 'arcade-nights',
    description: 'A live retro room for shared play and short tournaments.',
    gameSlug: 'super-retro',
    capacity: 8,
    status: 'open',
    host: 'RetroKey Lab',
    theme: 'Arcade'
  },
  {
    id: 'room-2',
    title: 'Pixel Quest',
    slug: 'pixel-quest',
    description: 'A chill room focused on co-op and co-op-style challenges.',
    gameSlug: 'pixel-quest',
    capacity: 4,
    status: 'soon',
    host: 'Pixel Crew',
    theme: 'Platformer'
  }
];
