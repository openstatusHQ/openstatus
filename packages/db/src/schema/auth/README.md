Migration from Clerk to Next-Auth

We prefix `auth_` on each db schema to avoid confusion with the default `user`
and group it within the migration. Can be dropped later.
