import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserResourcesTable1783339449452 implements MigrationInterface {
    name = 'CreateUserResourcesTable1783339449452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`user_resources\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`resource_id\` varchar(36) NOT NULL,
                \`quantity\` int NOT NULL DEFAULT 0,
                UNIQUE INDEX \`IDX_user_resources_user_resource\` (\`user_id\`, \`resource_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_resources\`
                ADD CONSTRAINT \`FK_user_resources_user\`
                    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE \`user_resources\`
                ADD CONSTRAINT \`FK_user_resources_resource\`
                    FOREIGN KEY (\`resource_id\`) REFERENCES \`resources\`(\`id\`) ON DELETE CASCADE
        `);

        // Backfill: replicate today's derived count exactly, so switching over to the
        // ledger doesn't change anyone's available resources.
        //   quantity = (MINE buildings on a province matching this resource)
        //            + (FORESTRY buildings, credited to the 'wood' resource)
        //            - (sum of requirement_resource_amount for buildings that already
        //               consume this resource key)
        // clamped at 0, mirroring action-executor.service.ts's pre-ledger logic.
        await queryRunner.query(`
            INSERT INTO \`user_resources\` (\`id\`, \`user_id\`, \`resource_id\`, \`quantity\`)
            SELECT
                UUID(),
                u.\`id\`,
                r.\`id\`,
                GREATEST(0,
                    COALESCE(mines.cnt, 0) + COALESCE(forestries.cnt, 0) - COALESCE(consumed.amt, 0)
                )
            FROM \`users\` u
            CROSS JOIN \`resources\` r
            LEFT JOIN (
                SELECT p.\`user_id\` AS user_id, p.\`resource_id\` AS resource_id, COUNT(*) AS cnt
                FROM \`province_building\` pb
                JOIN \`provinces\` p ON p.\`id\` = pb.\`province_id\`
                JOIN \`buildings\` b ON b.\`id\` = pb.\`building_id\`
                WHERE b.\`type\` = 'MINE' AND p.\`user_id\` IS NOT NULL AND p.\`resource_id\` IS NOT NULL
                GROUP BY p.\`user_id\`, p.\`resource_id\`
            ) mines ON mines.user_id = u.\`id\` AND mines.resource_id = r.\`id\`
            LEFT JOIN (
                SELECT p.\`user_id\` AS user_id, COUNT(*) AS cnt
                FROM \`province_building\` pb
                JOIN \`provinces\` p ON p.\`id\` = pb.\`province_id\`
                JOIN \`buildings\` b ON b.\`id\` = pb.\`building_id\`
                WHERE b.\`type\` = 'FORESTRY' AND p.\`user_id\` IS NOT NULL
                GROUP BY p.\`user_id\`
            ) forestries ON forestries.user_id = u.\`id\` AND r.\`key\` = 'wood'
            LEFT JOIN (
                SELECT p.\`user_id\` AS user_id, b.\`requirement_resource\` AS resource_key,
                       SUM(COALESCE(b.\`requirement_resource_amount\`, 1)) AS amt
                FROM \`province_building\` pb
                JOIN \`provinces\` p ON p.\`id\` = pb.\`province_id\`
                JOIN \`buildings\` b ON b.\`id\` = pb.\`building_id\`
                WHERE b.\`requirement_resource\` IS NOT NULL AND p.\`user_id\` IS NOT NULL
                GROUP BY p.\`user_id\`, b.\`requirement_resource\`
            ) consumed ON consumed.user_id = u.\`id\` AND consumed.resource_key = r.\`key\`
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`user_resources\``);
    }

}
