import { MigrationInterface, QueryRunner } from "typeorm";

export class TechBuildRework1776763876496 implements MigrationInterface {
    name = 'TechBuildRework1776763876496'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_tech\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_building\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`research_points\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`completed_research\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`class\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS', 'RESEARCH') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action_queue\` CHANGE \`actionType\` \`actionType\` enum ('BUILD', 'INVADE', 'DEPLOY', 'UPGRADE', 'TRANSFER_TROOPS') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`class\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`completed_research\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`research_points\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_building\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_tech\``);
    }

}
