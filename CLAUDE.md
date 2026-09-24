# TaskTally

A task-first, WhatsApp-familiar accountability app. See [README.md](./README.md)
for setup and [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit.

## Trello workflow

Work on this project is tracked on the Trello board **Tally Task App**, which
has four lists: Product Backlog, In Progress (Current Sprint), Testing, Done.

### Credentials

The Trello REST API is reached with the environment variables
`TRELLO_API_KEY` and `TRELLO_TOKEN`, which live in `~/.zshrc`. Run
`source ~/.zshrc` before any command that needs them.

Never print these values, never write them into a file, and never commit them.
Pass them to `curl` by variable name (`key=$TRELLO_API_KEY`), never by pasting
the value into a command, a URL in a log, or a commit message.

### Moving cards

- **Before starting a task**, find its card on the board. If there is no card,
  create one in **Product Backlog**. Then move it to
  **In Progress (Current Sprint)**.
- **When the work is finished and the tests pass**, move the card to
  **Testing** and add a short comment summarising what changed.
- **Only move a card to Done when Isaac says so.** Never move a card to Done on
  your own judgement, however finished the work looks.
