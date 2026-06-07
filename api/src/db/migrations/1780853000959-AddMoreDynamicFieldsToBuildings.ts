import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMoreDynamicFieldsToBuildings1780853000959 implements MigrationInterface {
    name = 'AddMoreDynamicFieldsToBuildings1780853000959'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`buildable\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`destructible\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`unique_per_province\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`allowed_province_resources\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_resource\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_resource_amount\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_resource_amount\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_resource\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`allowed_province_resources\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`unique_per_province\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`destructible\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`buildable\``);
    }

}
