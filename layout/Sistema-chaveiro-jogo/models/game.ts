export type Game = {
  id: string;
  title: string;
  console?: string;
  system: string;
  slug: string;
  description: string;
  image: string;
  romPath: string;
  active: boolean;
};

export type Room = {
  id: string;
  title: string;
  slug: string;
  description: string;
  gameSlug: string;
  capacity: number;
  status: 'open' | 'full' | 'soon';
  host: string;
  theme: string;
};
