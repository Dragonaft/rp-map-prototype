import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateResourcesTable1783271638258 implements MigrationInterface {
    name = 'CreateResourcesTable1783271638258'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the resources table
        await queryRunner.query(`
            CREATE TABLE \`resources\` (
                \`id\` varchar(36) NOT NULL,
                \`key\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`type\` varchar(255) NOT NULL DEFAULT 'plain',
                \`plain_income\` int NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_resources_key\` (\`key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // 2. Seed the canonical resources so the backfill below has rows to join against.
        //    (api/src/scripts/seed-resources.ts is the ongoing source of truth after this.)
        await queryRunner.query(`
            INSERT INTO \`resources\` (\`id\`, \`key\`, \`name\`, \`type\`, \`plain_income\`) VALUES
                (UUID(), 'stone', 'Stone', 'consumable', 75),
                (UUID(), 'iron', 'Iron', 'consumable', 125),
                (UUID(), 'gold', 'Gold', 'plain', 300),
                (UUID(), 'wood', 'Wood', 'consumable', 0),
                (UUID(), 'grain', 'Grain', 'plain', 0),
                (UUID(), 'fish', 'Fish', 'plain', 0)
        `);

        // 3. Add the FK column on provinces
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`resource_id\` varchar(36) NULL`);

        // 4. Backfill resource_id from the existing resource_type key
        await queryRunner.query(`
            UPDATE \`provinces\` p
            JOIN \`resources\` r ON r.\`key\` = p.\`resource_type\`
            SET p.\`resource_id\` = r.\`id\`
        `);

        // 5. Constrain + drop the old column
        await queryRunner.query(`
            ALTER TABLE \`provinces\`
                ADD CONSTRAINT \`FK_provinces_resource\`
                    FOREIGN KEY (\`resource_id\`) REFERENCES \`resources\`(\`id\`) ON DELETE SET NULL
        `);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`resource_type\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Recreate resource_type and backfill it from the resource relation
        await queryRunner.query(`ALTER TABLE \`provinces\` ADD \`resource_type\` varchar(255) NULL`);
        await queryRunner.query(`
            UPDATE \`provinces\` p
            JOIN \`resources\` r ON r.\`id\` = p.\`resource_id\`
            SET p.\`resource_type\` = r.\`key\`
        `);
        await queryRunner.query(`ALTER TABLE \`provinces\` MODIFY \`resource_type\` varchar(255) NOT NULL`);

        // 2. Drop the FK column
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP FOREIGN KEY \`FK_provinces_resource\``);
        await queryRunner.query(`ALTER TABLE \`provinces\` DROP COLUMN \`resource_id\``);

        // 3. Drop the resources table
        await queryRunner.query(`DROP TABLE \`resources\``);
    }
}
