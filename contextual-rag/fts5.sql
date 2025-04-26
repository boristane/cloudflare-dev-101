-- TODO Make sure to copy this in the .sql file drizzle generates for migrations

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
