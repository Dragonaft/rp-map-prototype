import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArmySupply1785754862643 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`supply_good_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`supply_per_100\` int NULL`);
        await queryRunner.query(`
            ALTER TABLE \`troop_types\`
                ADD CONSTRAINT \`FK_troop_types_supply_good\`
                    FOREIGN KEY (\`supply_good_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);

        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`supply_building\` tinyint NOT NULL DEFAULT 0`);

        await queryRunner.query(`ALTER TABLE \`armies\` ADD \`supply_distance\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`armies\` DROP COLUMN \`supply_distance\``);

        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`supply_building\``);

        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP FOREIGN KEY \`FK_troop_types_supply_good\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`supply_per_100\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`supply_good_id\``);
    }

}
