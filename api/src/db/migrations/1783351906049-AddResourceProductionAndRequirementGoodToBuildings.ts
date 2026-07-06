import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResourceProductionAndRequirementGoodToBuildings1783351906049 implements MigrationInterface {
    name = 'AddResourceProductionAndRequirementGoodToBuildings1783351906049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`resource_production_amount\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`production_requirement_resource_amount\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_good_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_good_amount\` int NULL`);

        await queryRunner.query(`
            ALTER TABLE \`buildings\`
                ADD CONSTRAINT \`FK_buildings_requirement_good\`
                    FOREIGN KEY (\`requirement_good_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP FOREIGN KEY \`FK_buildings_requirement_good\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_good_amount\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_good_id\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`production_requirement_resource_amount\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`resource_production_amount\``);
    }

}
