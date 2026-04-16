import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResearchEntity1776353524061 implements MigrationInterface {
    name = 'AddResearchEntity1776353524061'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`techs\` (\`id\` varchar(36) NOT NULL, \`key\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`description\` text NOT NULL, \`branch\` varchar(255) NOT NULL, \`is_class_root\` tinyint NOT NULL DEFAULT 0, \`cost\` int NOT NULL DEFAULT '0', \`prerequisites\` text NOT NULL DEFAULT '', UNIQUE INDEX \`IDX_ef13f6a0ace31b2bcaf5104a19\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`research_points\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`completed_research\` text NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`class\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`class\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`completed_research\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`research_points\``);
        await queryRunner.query(`DROP INDEX \`IDX_ef13f6a0ace31b2bcaf5104a19\` ON \`techs\``);
        await queryRunner.query(`DROP TABLE \`techs\``);
    }

}
