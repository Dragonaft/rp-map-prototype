import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateBuildingTypes1776765165489 implements MigrationInterface {
    name = 'UpdateBuildingTypes1776765165489'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`income\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`income\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`upkeep\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`upkeep\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`upkeep\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`upkeep\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`income\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`income\` varchar(255) NULL`);
    }

}
