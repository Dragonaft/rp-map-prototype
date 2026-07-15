import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResearchProgress1783949945711 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`active_research_key\` varchar(255) NULL`);

        // research_points stops being a bankable stockpile and becomes a per-turn rate,
        // recomputed and overwritten every income tick — any currently-banked amount is
        // meaningless under the new model, so it's discarded rather than migrated.
        await queryRunner.query(`UPDATE \`users\` SET \`research_points\` = 0`);

        await queryRunner.query(`
            CREATE TABLE \`user_tech_progress\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`tech_key\` varchar(255) NOT NULL,
                \`progress\` float NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_user_tech_progress_user_tech\` (\`user_id\`, \`tech_key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_tech_progress\`
                ADD CONSTRAINT \`FK_user_tech_progress_user\`
                    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`user_tech_progress\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`active_research_key\``);
    }

}
