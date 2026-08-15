import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWarsTables1783530712043 implements MigrationInterface {
    name = 'CreateWarsTables1783530712043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`wars\` (
                \`id\` varchar(36) NOT NULL,
                \`attacker_leader_id\` varchar(36) NOT NULL,
                \`defender_leader_id\` varchar(36) NOT NULL,
                \`status\` varchar(255) NOT NULL DEFAULT 'active',
                \`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
        await queryRunner.query(`
            ALTER TABLE \`wars\`
                ADD CONSTRAINT \`FK_wars_attacker_leader\`
                    FOREIGN KEY (\`attacker_leader_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`wars\`
                ADD CONSTRAINT \`FK_wars_defender_leader\`
                    FOREIGN KEY (\`defender_leader_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE TABLE \`war_participants\` (
                \`id\` varchar(36) NOT NULL,
                \`war_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`side\` varchar(255) NOT NULL,
                \`is_leader\` tinyint NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_war_participants_war_user\` (\`war_id\`, \`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
        await queryRunner.query(`
            ALTER TABLE \`war_participants\`
                ADD CONSTRAINT \`FK_war_participants_war\`
                    FOREIGN KEY (\`war_id\`) REFERENCES \`wars\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`war_participants\`
                ADD CONSTRAINT \`FK_war_participants_user\`
                    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`war_participants\``);
        await queryRunner.query(`DROP TABLE \`wars\``);
    }

}
