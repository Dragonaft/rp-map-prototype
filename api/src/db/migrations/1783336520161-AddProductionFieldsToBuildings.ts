import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductionFieldsToBuildings1783336520161 implements MigrationInterface {
    name = 'AddProductionFieldsToBuildings1783336520161'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`production_good_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`production_requirement_resource\` varchar(255) NULL`);
        await queryRunner.query(`
            ALTER TABLE \`buildings\`
                ADD CONSTRAINT \`FK_buildings_production_good\`
                    FOREIGN KEY (\`production_good_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP FOREIGN KEY \`FK_buildings_production_good\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`production_requirement_resource\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`production_good_id\``);
    }

}
