# @openstatus/notification-telegram
To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

This project was created using `bun init` in bun v1.0.0. [Bun](https://bun.sh)
is a fast all-in-one JavaScript runtime.


---

Important `@BotFather` commands to update the bot.

```
Change profile image
/setuserpic
Change display name
/setname
Change bot description
/setdescription
Short about text shown in bio preview
/setabouttext
```

---

#### TODO

This integration is very "raw". We need to let the user search for their chat id (e.g. by asking RawDataBot `@raw_info_bot`).

In the future, we could work with `/setcommands` behaviors to send the value to our `/getUpdates` endpoint and access the chat id. We will need to forward a specific unique identifier with it to match the chat id with the proper notification.

An improved UX option:

```
1. user enters `/connect` command
2. we listen to the `/getUpdates` messages and generate an id, store it for a few days in redis, and send it back to the user's chat id
3. user enters generated id into openstatus dashboard to connect with chat id - we validate it from the `/getUpdates`
```

