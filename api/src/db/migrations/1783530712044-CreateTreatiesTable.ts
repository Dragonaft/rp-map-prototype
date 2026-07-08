import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTreatiesTable1783530712044 implements MigrationInterface {
    name = 'CreateTreatiesTable1783530712044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`treaties\` (
                \`id\` varchar(36) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`proposer_id\` varchar(36) NOT NULL,
                \`receiver_id\` varchar(36) NOT NULL,
                \`kind\` varchar(255) NOT NULL,
                \`peace_scope\` varchar(255) NULL,
                \`visibility\` varchar(255) NOT NULL DEFAULT 'private',
                \`recurring\` tinyint NOT NULL DEFAULT 0,
                \`status\` varchar(255) NOT NULL DEFAULT 'pending',
                \`articles\` json NOT NULL,
                \`note\` text NULL,
                \`pending_turns\` int NOT NULL DEFAULT 0,
                \`view_only\` tinyint NOT NULL DEFAULT 0,
                \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`resolved_at\` timestamp NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`treaties\`
                ADD CONSTRAINT \`FK_treaties_proposer\`
                    FOREIGN KEY (\`proposer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`treaties\`
                ADD CONSTRAINT \`FK_treaties_receiver\`
                    FOREIGN KEY (\`receiver_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE INDEX \`IDX_treaties_receiver_status\` ON \`treaties\` (\`receiver_id\`, \`status\`)
        `);
        await queryRunner.query(`
            CREATE INDEX \`IDX_treaties_proposer\` ON \`treaties\` (\`proposer_id\`)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`treaties\``);
    }

}
