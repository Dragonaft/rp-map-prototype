import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIsNew1774290621529 implements MigrationInterface {
    name = 'AddUserIsNew1774290621529'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`is_new\` tinyint NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`is_new\``);
    }

}
