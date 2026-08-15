import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewsWall1783686655706 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`news_agencies\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`name\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_news_agencies_user_id\` (\`user_id\`), UNIQUE INDEX \`IDX_news_agencies_name\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`news_articles\` (\`id\` varchar(36) NOT NULL, \`agency_id\` varchar(36) NOT NULL, \`title\` varchar(255) NOT NULL, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_news_articles_agency_id_createdAt\` (\`agency_id\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`news_agencies\` ADD CONSTRAINT \`FK_news_agencies_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`news_articles\` ADD CONSTRAINT \`FK_news_articles_agency\` FOREIGN KEY (\`agency_id\`) REFERENCES \`news_agencies\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`news_articles\` DROP FOREIGN KEY \`FK_news_articles_agency\``);
        await queryRunner.query(`ALTER TABLE \`news_agencies\` DROP FOREIGN KEY \`FK_news_agencies_user\``);
        await queryRunner.query(`DROP TABLE \`news_articles\``);
        await queryRunner.query(`DROP TABLE \`news_agencies\``);
    }

}
