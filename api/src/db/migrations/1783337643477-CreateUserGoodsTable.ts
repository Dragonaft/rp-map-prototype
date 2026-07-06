import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserGoodsTable1783337643477 implements MigrationInterface {
    name = 'CreateUserGoodsTable1783337643477'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`user_goods\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`good_id\` varchar(36) NOT NULL,
                \`quantity\` int NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_user_goods_user_good\` (\`user_id\`, \`good_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_goods\`
                ADD CONSTRAINT \`FK_user_goods_user\`
                    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`user_goods\`
                ADD CONSTRAINT \`FK_user_goods_good\`
                    FOREIGN KEY (\`good_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE CASCADE
        `);

        // Backfill a zero-quantity row for every existing (user, good) pair so
        // storage is fully populated for whatever users/goods already exist.
        await queryRunner.query(`
            INSERT INTO \`user_goods\` (\`id\`, \`user_id\`, \`good_id\`, \`quantity\`)
            SELECT UUID(), u.\`id\`, g.\`id\`, 0
            FROM \`users\` u
            CROSS JOIN \`goods\` g
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`user_goods\``);
    }

}
