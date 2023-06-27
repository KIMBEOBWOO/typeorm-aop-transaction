CREATE USER beobwoo WITH PASSWORD 'testtest' SUPERUSER;
CREATE DATABASE test_db OWNER beobwoo;

-- Connect created database
\connect test_db

CREATE TABLE IF NOT EXISTS public."user" (
    id bigserial NOT NULL,
    user_id varchar(30) NOT NULL,
    "password" varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    phone_number varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    CONSTRAINT "PK_USER_ID" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."workspace" (
    id bigserial NOT NULL,
    "name" varchar(30) NOT NULL,
    owner_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    CONSTRAINT "PK_WORKSPACE_ID" PRIMARY KEY (id),
    CONSTRAINT "FK_OWNER_ID" FOREIGN KEY (owner_id) 
    REFERENCES "user" (id) ON DELETE CASCADE
);