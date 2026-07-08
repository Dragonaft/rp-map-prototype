import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProvinceOccupationColumns1783530712041 implements MigrationInterface {
    name = 'AddProvinceOccupationColumns1783530712041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`provinces\`
                ADD \`occupier_id\` varchar(36) NULL,
                ADD \`occupation_turns\` int NOT NULL DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE \`provinces\`
                ADD CONSTRAINT \`FK_provinces_occupier\`
                    FOREIGN KEY (\`occupier_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP FOREIGN KEY \`FK_provinces_occupier\``);
        await queryRunner.query(`
            ALTER TABLE \`provinces\`
                DROP COLUMN \`occupier_id\`,
                DROP COLUMN \`occupation_turns\`
        `);
    }

}
