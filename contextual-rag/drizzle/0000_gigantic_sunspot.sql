CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_id` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chunks.doc_id.idx` ON `chunks` (`doc_id`);--> statement-breakpoint
CREATE TABLE `docs` (
	`id` text PRIMARY KEY NOT NULL,
	`contents` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `docs.created.idx` ON `docs` (`created`);

CREATE VIRTUAL TABLE chunks_fts USING fts5(
	id UNINDEXED,
	doc_id UNINDEXED,
	text,
	content = 'chunks',
	created
);

CREATE TRIGGER chunks_ai
AFTER
INSERT
	ON chunks BEGIN
INSERT INTO
	chunks_fts(id, doc_id, text, created)
VALUES
	(
		new.id,
		new.doc_id,
		new.text,
		new.created
	);

END;

CREATE TRIGGER chunks_ad 
AFTER DELETE ON chunks 
FOR EACH ROW
BEGIN
    DELETE FROM chunks_fts WHERE id = old.id;
		INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');
END;

CREATE TRIGGER chunks_au 
AFTER UPDATE ON chunks BEGIN
    DELETE FROM chunks_fts WHERE id = old.id;
    INSERT INTO chunks_fts(id, doc_id, text, created)
    VALUES (new.id, new.doc_id, new.text, new.created);
		INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');
END;
