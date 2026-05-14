import { MigrationInterface, QueryRunner } from "typeorm";

export class TechsAdd1776764077713 implements MigrationInterface {
    name = 'TechsAdd1776764077713'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`techs\` (\`id\` varchar(36) NOT NULL, \`key\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text NOT NULL, \`branch\` varchar(255) NOT NULL, \`is_class_root\` tinyint NOT NULL DEFAULT 0, \`cost\` int NOT NULL DEFAULT '0', \`prerequisites\` text NULL, UNIQUE INDEX \`IDX_ef13f6a0ace31b2bcaf5104a19\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_ef13f6a0ace31b2bcaf5104a19\` ON \`techs\``);
        await queryRunner.query(`DROP TABLE \`techs\``);
    }

}
