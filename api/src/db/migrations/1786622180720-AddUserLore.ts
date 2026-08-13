import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written rather than the raw `migration:generate` output — same reasoning as
// AddUserFlag: this dev DB has accumulated unrelated FK-naming drift against the current
// entities, so a naive generate picks up a large, unrelated diff alongside the one column
// actually wanted here. This migration is scoped to exactly that column; the ADD COLUMN
// statement below is the genuine diff, lifted from the generated output before discarding it.
export class AddUserLore1786622180720 implements MigrationInterface {
    name = 'AddUserLore1786622180720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`lore\` mediumtext NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`lore\``);
    }

}
