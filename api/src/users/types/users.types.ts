export type PartialUser = {
  id: string;
  countryName: string;
  color: string;
};

export enum UserRoles {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  PLAYER = 'PLAYER',
}

export enum UserClasses {
  GUILD = 'guild',
  HOLY = 'holy',
  NOBLE = 'noble',
}
