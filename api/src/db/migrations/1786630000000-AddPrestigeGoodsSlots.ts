import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written rather than `migration:generate` — this dev DB has accumulated unrelated FK
// naming drift against the current entities (same issue hit by AddUserFlag/AddUserLore), so a
// naive generate picks up a large, unrelated diff alongside the columns actually wanted here.
// Adds a second, independent goods slot to Building (one-time requirement) and TroopType
// (one-time requirement + per-turn supply), plus a resource-key override on Building's
// per-turn resource production — the schema backing the economy/class rework's prestige-goods
// ring (see .ai-docs/GAME-MECHANICS.md).
export class AddPrestigeGoodsSlots1786630000000 implements MigrationInterface {
    name = 'AddPrestigeGoodsSlots1786630000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Building: resource_production_key lets a building credit a resource other than the
        // province's own (e.g. PORT crediting fish while sitting on a grain/wood province).
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`resource_production_key\` varchar(255) NULL`);

        // Building: second one-time goods cost, independent of requirement_good_id — lets Lumber
        // become a universal construction cost without displacing the existing Weapons/Bricks slot.
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_good_2_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`buildings\` ADD \`requirement_good_2_amount\` int NULL`);
        await queryRunner.query(`
            ALTER TABLE \`buildings\`
                ADD CONSTRAINT \`FK_buildings_requirement_good_2\`
                    FOREIGN KEY (\`requirement_good_2_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);

        // TroopType: second one-time recruitment goods cost, same shape as required_goods/goods_amount.
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`required_goods_2\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`goods_amount_2\` int NULL`);
        await queryRunner.query(`
            ALTER TABLE \`troop_types\`
                ADD CONSTRAINT \`FK_troop_types_required_goods_2\`
                    FOREIGN KEY (\`required_goods_2\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);

        // TroopType: second per-turn supply good, same shape as supply_good_id/supply_per_100 —
        // the class elite units' permanent partner-good dependency.
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`supply_good_2_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`troop_types\` ADD \`supply_per_100_2\` int NULL`);
        await queryRunner.query(`
            ALTER TABLE \`troop_types\`
                ADD CONSTRAINT \`FK_troop_types_supply_good_2\`
                    FOREIGN KEY (\`supply_good_2_id\`) REFERENCES \`goods\`(\`id\`) ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP FOREIGN KEY \`FK_troop_types_supply_good_2\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`supply_per_100_2\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`supply_good_2_id\``);

        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP FOREIGN KEY \`FK_troop_types_required_goods_2\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`goods_amount_2\``);
        await queryRunner.query(`ALTER TABLE \`troop_types\` DROP COLUMN \`required_goods_2\``);

        await queryRunner.query(`ALTER TABLE \`buildings\` DROP FOREIGN KEY \`FK_buildings_requirement_good_2\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_good_2_amount\``);
        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`requirement_good_2_id\``);

        await queryRunner.query(`ALTER TABLE \`buildings\` DROP COLUMN \`resource_production_key\``);
    }

}
