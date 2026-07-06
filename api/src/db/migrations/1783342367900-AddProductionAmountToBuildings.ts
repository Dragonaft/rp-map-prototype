import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductionAmountToBuildings1783342367900 implements MigrationInterface {
    name = 'AddProductionAmountToBuildings1783342367900'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`production_amount\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`production_amount\``);
    }

}
