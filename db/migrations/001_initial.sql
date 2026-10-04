CREATE TABLE students (
	crn text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	department text NOT NULL,
	batch text NOT NULL,
	blocked integer DEFAULT 0 NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX students_email_unique ON students (email);

CREATE TABLE events (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	company text NOT NULL,
	starts_at text NOT NULL,
	ends_at text NOT NULL,
	meeting_url text NOT NULL,
	status text DEFAULT 'draft' NOT NULL,
	created_at text NOT NULL
);

CREATE INDEX events_start_idx ON events (starts_at);

CREATE TABLE eligibility (
	event_id text NOT NULL,
	crn text NOT NULL,
	FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (crn) REFERENCES students(crn) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX eligibility_pair ON eligibility (event_id,crn);
CREATE INDEX eligibility_student ON eligibility (crn,event_id);

CREATE TABLE attendance (
	id text PRIMARY KEY NOT NULL,
	event_id text NOT NULL,
	crn text NOT NULL,
	joined_at text NOT NULL,
	left_at text NOT NULL,
	minutes integer NOT NULL,
	source text NOT NULL,
	imported_at text NOT NULL,
	FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (crn) REFERENCES students(crn) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX attendance_pair ON attendance (event_id,crn);
CREATE INDEX attendance_student ON attendance (crn,event_id);

CREATE TABLE access_records (
	id text PRIMARY KEY NOT NULL,
	event_id text NOT NULL,
	crn text,
	email text NOT NULL,
	decision text NOT NULL,
	reason text NOT NULL,
	at text NOT NULL,
	bucket integer NOT NULL,
	FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX access_dedup ON access_records (event_id,email,bucket);
CREATE INDEX access_event ON access_records (event_id,at);

CREATE TABLE audit (
	id text PRIMARY KEY NOT NULL,
	actor text NOT NULL,
	action text NOT NULL,
	detail text NOT NULL,
	at text NOT NULL
);

CREATE INDEX audit_time ON audit (at);

CREATE TABLE rate_limits (
	identity text NOT NULL,
	action text NOT NULL,
	window_id integer NOT NULL,
	count integer NOT NULL
);

CREATE UNIQUE INDEX rate_limit_identity_action ON rate_limits (identity,action);
ALTER TABLE students ADD CONSTRAINT blocked_value CHECK (blocked IN (0,1));
ALTER TABLE events ADD CONSTRAINT event_status CHECK (status IN ('draft','published','closed'));
ALTER TABLE attendance ADD CONSTRAINT nonnegative_minutes CHECK (minutes >= 0);

