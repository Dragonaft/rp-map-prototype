import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written rather than `migration:generate` — this dev DB has accumulated unrelated FK
// naming drift against the current entities, so a naive generate picks up a large, unrelated
// diff (dropping/recreating foreign keys across many tables) alongside the 3 columns actually
// wanted here. This migration is scoped to exactly those 3 columns; the ADD COLUMN statements
// below are the genuine diff, lifted from the generated output before discarding the rest.
export class AddUserFlag1786619708159 implements MigrationInterface {
    name = 'AddUserFlag1786619708159'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`flag_data\` mediumblob NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`flag_mime\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`flag_hash\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`flag_hash\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`flag_mime\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`flag_data\``);
    }

}
