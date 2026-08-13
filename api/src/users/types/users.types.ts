export type PartialUser = {
  id: string;
  countryName: string;
  color: string;
  /** `/users/{id}/flag?v={hash}`, or null when the player has no uploaded flag. */
  flagUrl: string | null;
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
