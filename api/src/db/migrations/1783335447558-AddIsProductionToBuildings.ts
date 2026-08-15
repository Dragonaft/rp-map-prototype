import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsProductionToBuildings1783335447558 implements MigrationInterface {
    name = 'AddIsProductionToBuildings1783335447558'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`isProduction\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`isProduction\``);
    }

}
