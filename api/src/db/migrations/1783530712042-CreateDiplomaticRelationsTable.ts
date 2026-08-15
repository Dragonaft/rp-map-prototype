import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDiplomaticRelationsTable1783530712042 implements MigrationInterface {
    name = 'CreateDiplomaticRelationsTable1783530712042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`diplomatic_relations\` (
                \`id\` varchar(36) NOT NULL,
                \`user_a_id\` varchar(36) NOT NULL,
                \`user_b_id\` varchar(36) NOT NULL,
                \`state\` varchar(255) NOT NULL DEFAULT 'neutral',
                \`peace_turns\` int NOT NULL DEFAULT 0,
                \`has_trade\` tinyint NOT NULL DEFAULT 0,
                \`pass_a_to_b\` tinyint NOT NULL DEFAULT 0,
                \`pass_b_to_a\` tinyint NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_diplomatic_relations_pair\` (\`user_a_id\`, \`user_b_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`diplomatic_relations\`
                ADD CONSTRAINT \`FK_diplomatic_relations_user_a\`
                    FOREIGN KEY (\`user_a_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`diplomatic_relations\`
                ADD CONSTRAINT \`FK_diplomatic_relations_user_b\`
                    FOREIGN KEY (\`user_b_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`diplomatic_relations\``);
    }

}
