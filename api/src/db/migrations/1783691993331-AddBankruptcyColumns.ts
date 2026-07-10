import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankruptcyColumns1783691993331 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`negative_money_turns\` int NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`bankruptcy_debuff_turns\` int NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`bankruptcy_debuff_turns\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`negative_money_turns\``);
    }

}
