export type Cartridge = {
  id: string;
  nfcId: string;
  gameId: string;
  collectionNumber: number;
  status: 'active' | 'disabled';
};
