import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequiredGoodsToTroopTypes1783422745371 implements MigrationInterface {
    name = 'AddRequiredGoodsToTroopTypes1783422745371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`required_goods\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`goods_amount\` int NULL`);

        await queryRunner.query(`
            ALTER TABLE \`troop_types\`
                ADD CONSTRAINT \`FK_troop_types_required_goods\`
                    FOREIGN KEY (\`required_goods\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP FOREIGN KEY \`FK_troop_types_required_goods\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`goods_amount\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`required_goods\``);
    }

}
