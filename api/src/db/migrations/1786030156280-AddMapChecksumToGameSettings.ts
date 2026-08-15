import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMapChecksumToGameSettings1786030156280 implements MigrationInterface {
    name = 'AddMapChecksumToGameSettings1786030156280'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // NULL is the correct starting value — see GameSettings.map_checksum's doc comment
        // and import-provinces.ts, the only writer. No backfill: the web client treats a
        // null-vs-null checksum comparison as "nothing changed since tracking began", and the
        // first re-import after this migration populates a real value for every client to
        // correctly diff against.
        await queryRunner.query(`
            ALTER TABLE \`game_settings\` ADD COLUMN \`map_checksum\` varchar(255) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`game_settings\` DROP COLUMN \`map_checksum\``);
    }

}
