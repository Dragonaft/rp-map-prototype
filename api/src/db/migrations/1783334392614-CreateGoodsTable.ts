import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGoodsTable1783334392614 implements MigrationInterface {
    name = 'CreateGoodsTable1783334392614'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`goods\` (
                \`id\` varchar(36) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`type\` varchar(255) NOT NULL DEFAULT 'civilian',
                \`price_per_one\` int NOT NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`goods\``);
    }

}
