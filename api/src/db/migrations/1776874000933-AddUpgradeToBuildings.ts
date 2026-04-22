import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUpgradeToBuildings1776874000933 implements MigrationInterface {
    name = 'AddUpgradeToBuildings1776874000933'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`upgrade_to\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`upgrade_to\``);
    }

}
