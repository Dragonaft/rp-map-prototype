import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written rather than `migration:generate` — this dev DB has accumulated unrelated FK-naming
// drift against the current entities (same reasoning as every recent migration in this repo, see
// AddUserLore/CreateKnowledgeArticlesTable). Content rows are owned by
// api/src/scripts/seed-icons.ts (upsert from api/data/icons/*.png via manifest.json) plus admin
// panel uploads — this migration only creates the empty table.
export class CreateGameIconsTable1786741393061 implements MigrationInterface {
    name = 'CreateGameIconsTable1786741393061'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`game_icons\` (
                \`id\` varchar(36) NOT NULL,
                \`kind\` varchar(255) NOT NULL,
                \`key\` varchar(255) NOT NULL,
                \`icon_data\` mediumblob NOT NULL,
                \`icon_mime\` varchar(255) NOT NULL,
                \`icon_hash\` varchar(255) NOT NULL,
                UNIQUE INDEX \`IDX_game_icons_kind_key\` (\`kind\`, \`key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`game_icons\``);
    }

}
