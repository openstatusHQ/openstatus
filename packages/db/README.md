# DB

We are using [turso](https://turso.tech) and sqlite as database to store
user/page/monitor settings. The timeseries data is stored in a
[tinybird](https://tinybird.co) datasource (built on top of ClickHouse).

## Local Development

Install the [Turso CLI](https://docs.turso.tech/reference/turso-cli).

For local environment, first
[install sqld](https://github.com/tursodatabase/libsql/blob/main/docs/BUILD-RUN.md).

When installing with Homebrew, follow:

```bash
$ brew tap libsql/sqld
$ brew install sqld-beta
$ sqld --help
```

If you want to keep your database locally, run:

```bash
$ turso dev --db-file openstatus.db
```

It will create a local database in the directory you run the command.

Add the environment variables to inside of the `.env` file in both projects, the
`/apps/web` and `/packages/db`:

```env
DATABASE_URL=http://127.0.0.1:8080
DATABASE_AUTH_TOKEN=any-token # no need to change token
```

Start the migration script inside of `/packages/db` to have the database schema
up to date:

```bash
$ pnpm migrate
```

You should be ready to go! Check out the Drizzle Studio to see if your tables
have been created:

```$
$ pnpm studio
```
