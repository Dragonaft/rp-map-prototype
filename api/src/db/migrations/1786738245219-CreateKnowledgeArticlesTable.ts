import { MigrationInterface, QueryRunner } from "typeorm";

// Hand-written rather than `migration:generate` — this dev DB has accumulated unrelated FK-naming
// drift against the current entities (same issue noted in AddUserLore/AddPrestigeGoodsSlots), so
// a naive generate picks up a large, unrelated diff. Content rows are owned by
// api/src/scripts/seed-knowledge.ts (upsert from api/data/knowledge/*.md) — this migration only
// creates the empty table.
export class CreateKnowledgeArticlesTable1786738245219 implements MigrationInterface {
    name = 'CreateKnowledgeArticlesTable1786738245219'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`knowledge_articles\` (
                \`id\` varchar(36) NOT NULL,
                \`key\` varchar(255) NOT NULL,
                \`title\` varchar(255) NOT NULL,
                \`category\` varchar(255) NOT NULL,
                \`sort_order\` int NOT NULL DEFAULT 0,
                \`content\` mediumtext NOT NULL,
                \`is_visible\` tinyint NOT NULL DEFAULT 1,
                UNIQUE INDEX \`IDX_knowledge_articles_key\` (\`key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`knowledge_articles\``);
    }

}
